import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";

export interface OperatorPermissions {
  id: number;
  name: string;
  accessEstoque: boolean;
  accessVendas: boolean;
  accessFaturamento: boolean;
  accessFinanceiro: boolean;
  accessConfiguracoes: boolean;
  accessValorizacao: boolean;
  accessProducao: boolean;
  accessGestaoComercial: boolean;
  accessImportacao: boolean;
}

interface OperatorContextType {
  operator: OperatorPermissions | null;
  granularPermissions: Record<string, boolean>;
  isLoggedIn: boolean;
  login: (operator: OperatorPermissions, granularPerms?: Record<string, boolean>) => void;
  logout: () => void;
  hasAccess: (section: string) => boolean;
  hasGranularAccess: (key: string) => boolean;
  getVisiblePeopleForFeature: (featureKey: string) => string[];
  setGranularPermissions: (perms: Record<string, boolean>) => void;
}

const OperatorContext = createContext<OperatorContextType | null>(null);

/**
 * Retorna a data de hoje no formato YYYY-MM-DD (horário local do navegador).
 * Usada para verificar se a sessão ainda é do dia atual.
 */
function getTodayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/**
 * Verifica se a sessão armazenada ainda é válida (mesmo dia).
 * Se o dia mudou, limpa a sessão e retorna null.
 */
function getStoredOperator(): OperatorPermissions | null {
  try {
    const loginDate = sessionStorage.getItem("operatorLoginDate");
    const today = getTodayStr();

    // Se o dia mudou, sessão expirou
    if (loginDate && loginDate !== today) {
      sessionStorage.removeItem("operator");
      sessionStorage.removeItem("granularPermissions");
      sessionStorage.removeItem("operatorLoginDate");
      return null;
    }

    const stored = sessionStorage.getItem("operator");
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function getStoredGranularPerms(): Record<string, boolean> {
  try {
    const loginDate = sessionStorage.getItem("operatorLoginDate");
    const today = getTodayStr();
    if (loginDate && loginDate !== today) return {};

    const stored = sessionStorage.getItem("granularPermissions");
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export function OperatorProvider({ children }: { children: ReactNode }) {
  const [operator, setOperator] = useState<OperatorPermissions | null>(getStoredOperator);
  const [granularPermissions, setGranularPermsState] = useState<Record<string, boolean>>(getStoredGranularPerms);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const login = useCallback((op: OperatorPermissions, granularPerms?: Record<string, boolean>) => {
    setOperator(op);
    sessionStorage.setItem("operator", JSON.stringify(op));
    sessionStorage.setItem("operatorLoginDate", getTodayStr());
    const gp = granularPerms || {};
    setGranularPermsState(gp);
    sessionStorage.setItem("granularPermissions", JSON.stringify(gp));
  }, []);

  const logout = useCallback(() => {
    setOperator(null);
    setGranularPermsState({});
    sessionStorage.removeItem("operator");
    sessionStorage.removeItem("granularPermissions");
    sessionStorage.removeItem("operatorLoginDate");
  }, []);

  // Verificação periódica: a cada 60 segundos, checar se o dia virou
  // Se virou meia-noite, faz logout automático
  useEffect(() => {
    if (!operator) return;

    const checkExpiry = () => {
      const loginDate = sessionStorage.getItem("operatorLoginDate");
      const today = getTodayStr();
      if (loginDate && loginDate !== today) {
        logout();
      }
    };

    const interval = setInterval(checkExpiry, 60_000); // Checa a cada 1 minuto
    return () => clearInterval(interval);
  }, [operator, logout]);

  // Periodic permission refresh: every 30 seconds, fetch fresh permissions from DB
  // This ensures that if an admin changes permissions for this operator, they take effect
  // without requiring a re-login (max 30s delay)
  useEffect(() => {
    if (!operator) {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      return;
    }

    const refreshPermissions = async () => {
      try {
        const res = await fetch(`/api/trpc/settings.getGranularPermissions?input=${encodeURIComponent(JSON.stringify({ json: { operatorId: operator.id } }))}`);
        if (!res.ok) return;
        const data = await res.json();
        const items = data?.result?.data?.json || data?.result?.data || [];
        if (!Array.isArray(items)) return;
        const freshPerms: Record<string, boolean> = {};
        for (const item of items) {
          if (item.permissionKey && typeof item.enabled === "boolean") {
            freshPerms[item.permissionKey] = item.enabled;
          } else if (item.permissionKey && (item.enabled === 1 || item.enabled === 0)) {
            freshPerms[item.permissionKey] = item.enabled === 1;
          }
        }
        // Only update if permissions actually changed
        const currentStr = JSON.stringify(granularPermissions);
        const freshStr = JSON.stringify(freshPerms);
        if (currentStr !== freshStr) {
          setGranularPermsState(freshPerms);
          sessionStorage.setItem("granularPermissions", JSON.stringify(freshPerms));
        }
      } catch {
        // Silently ignore network errors during refresh
      }
    };

    // Initial refresh after 5 seconds (in case permissions changed while page was loading)
    const initialTimeout = setTimeout(refreshPermissions, 5000);
    // Then refresh every 30 seconds
    refreshTimerRef.current = setInterval(refreshPermissions, 30_000);

    return () => {
      clearTimeout(initialTimeout);
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [operator]); // Note: intentionally NOT including granularPermissions to avoid infinite loop

  const hasAccess = useCallback((section: string): boolean => {
    if (!operator) return false;
    switch (section) {
      case "estoque": return operator.accessEstoque;
      case "vendas": return operator.accessVendas;
      case "gestao-comercial": return operator.accessGestaoComercial;
      case "faturamento": return operator.accessFaturamento;
      case "financeiro": return operator.accessFinanceiro;
      case "importacao": return operator.accessImportacao;
      case "producao": return operator.accessProducao;
      case "configuracoes": return operator.accessConfiguracoes || (granularPermissions["cfg.produtos"] === true);
      case "valorizacao": return operator.accessValorizacao;
      default: return false;
    }
  }, [operator, granularPermissions]);

  // Granular permission check: returns true ONLY if permission is explicitly enabled in the database.
  // If not set, defaults to FALSE (denied) - only explicitly ticked permissions are allowed.
  const hasGranularAccess = useCallback((key: string): boolean => {
    if (key in granularPermissions) return granularPermissions[key] === true;
    return false; // default: negado se não existir no banco - só libera o que foi explicitamente ticado
  }, [granularPermissions]);

  // Returns slugs of people visible for a given feature (e.g. gc.cadastroClientes.jordao_laine -> "jordao_laine")
  const getVisiblePeopleForFeature = useCallback((featureKey: string): string[] => {
    const prefix = `${featureKey}.`;
    const people: string[] = [];
    for (const [key, val] of Object.entries(granularPermissions)) {
      if (key.startsWith(prefix) && val === true) {
        people.push(key.slice(prefix.length));
      }
    }
    return people;
  }, [granularPermissions]);

  const setGranularPermissions = useCallback((perms: Record<string, boolean>) => {
    setGranularPermsState(perms);
    sessionStorage.setItem("granularPermissions", JSON.stringify(perms));
  }, []);

  return (
    <OperatorContext.Provider value={{
      operator,
      granularPermissions,
      isLoggedIn: !!operator,
      login,
      logout,
      hasAccess,
      hasGranularAccess,
      getVisiblePeopleForFeature,
      setGranularPermissions,
    }}>
      {children}
    </OperatorContext.Provider>
  );
}

export function useOperator() {
  const ctx = useContext(OperatorContext);
  if (!ctx) throw new Error("useOperator must be used within OperatorProvider");
  return ctx;
}
