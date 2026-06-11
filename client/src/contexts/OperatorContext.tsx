import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

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
}

interface OperatorContextType {
  operator: OperatorPermissions | null;
  granularPermissions: Record<string, boolean>;
  isLoggedIn: boolean;
  login: (operator: OperatorPermissions, granularPerms?: Record<string, boolean>) => void;
  logout: () => void;
  hasAccess: (section: string) => boolean;
  hasGranularAccess: (key: string) => boolean;
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

  const hasAccess = useCallback((section: string): boolean => {
    if (!operator) return false;
    switch (section) {
      case "estoque": return operator.accessEstoque;
      case "vendas": return operator.accessVendas;
      case "gestao-comercial": return operator.name === "Fernando" || operator.name === "Guilherme" || operator.name === "Juvenal";
      case "faturamento": return operator.accessFaturamento;
      case "financeiro": return operator.accessFinanceiro;
      case "importacao": return operator.name === "Fernando" || operator.name === "Guilherme" || operator.name === "Larissa" || operator.name === "Bruno" || operator.name === "Gilson";
      case "producao": return operator.accessProducao;
      case "configuracoes": return operator.accessConfiguracoes || (granularPermissions["cfg.produtos"] === true);
      case "valorizacao": return operator.accessValorizacao;
      default: return false;
    }
  }, [operator, granularPermissions]);

  // Granular permission check: returns true if permission is explicitly enabled or not set (default = authorized),
  // false only if explicitly disabled
  const hasGranularAccess = useCallback((key: string): boolean => {
    if (key in granularPermissions) return granularPermissions[key] === true;
    return true; // default: autorizado se não existir no banco
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
