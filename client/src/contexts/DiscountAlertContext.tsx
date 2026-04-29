/**
 * DiscountAlertContext - Sistema de alertas cascading para descontos Sicoob
 * 
 * Quando Fernando salva uma seleção de desconto, gera um alerta para Guilherme/Flávio/Thiago.
 * O alerta cascata funciona assim:
 * 1. Aba "Financeiro" no TopNav pisca (blink) → operador clica
 * 2. Sub-aba "Recebíveis" pisca → operador clica
 * 3. Card da empresa correspondente pisca → operador clica para expandir
 * 4. Mês correspondente pisca → operador clica para ver detalhes
 * 5. Ao visualizar, o alerta é marcado como lido
 * 
 * Operadores que veem alertas: Guilherme, Flávio, Thiago
 */

import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { trpc } from "@/lib/trpc";
import { useOperator } from "./OperatorContext";

/** Operadores que devem receber alertas de desconto */
const DISCOUNT_ALERT_OPERATORS = ["Guilherme", "Flávio", "Thiago"];

interface DiscountAlert {
  id: number;
  createdBy: string;
  empresa: string;
  contaLabel: string;
  mesKey: string;
  totalTitulos: number;
  valorTotal: string;
  createdAt: number;
  isRead: boolean;
}

/** Nível do cascading: qual elemento deve piscar */
type BlinkLevel = "financeiro-tab" | "recebiveis-tab" | "empresa-card" | "mes-card" | "none";

interface DiscountAlertContextType {
  /** Alertas não lidos pendentes */
  unreadAlerts: DiscountAlert[];
  /** Total de alertas não lidos */
  unreadCount: number;
  /** Nível atual do blink (qual elemento deve piscar) */
  blinkLevel: BlinkLevel;
  /** Empresas com alertas pendentes (para piscar o card correto) */
  alertEmpresas: Set<string>;
  /** Meses com alertas pendentes por empresa (para piscar o mês correto) */
  alertMeses: Map<string, Set<string>>;
  /** Avançar o cascading: operador clicou no elemento piscante */
  advanceBlink: (level: BlinkLevel) => void;
  /** Marcar alerta como lido (quando operador chega ao mês final) */
  markAlertRead: (alertId: number) => void;
  /** Marcar todos os alertas de uma empresa/mês como lidos */
  markAlertsReadForMes: (empresa: string, mesKey: string) => void;
  /** Se o operador atual deve ver alertas de desconto */
  isAlertOperator: boolean;
}

const DiscountAlertContext = createContext<DiscountAlertContextType | null>(null);

export function DiscountAlertProvider({ children }: { children: ReactNode }) {
  const { operator } = useOperator();
  const operatorName = operator?.name || "";
  const isAlertOperator = DISCOUNT_ALERT_OPERATORS.includes(operatorName);

  // Buscar alertas do backend (polling a cada 30s)
  const { data: alertsData, refetch } = trpc.financial.getDiscountAlerts.useQuery(
    { operatorName },
    { 
      enabled: isAlertOperator && !!operatorName,
      refetchInterval: 30000,
    }
  );

  const markReadMutation = trpc.financial.markDiscountAlertRead.useMutation({
    onSuccess: () => refetch(),
  });

  const unreadAlerts = useMemo(() => {
    if (!alertsData) return [];
    return alertsData.filter((a: any) => !a.isRead);
  }, [alertsData]);

  const unreadCount = unreadAlerts.length;

  // Empresas com alertas pendentes
  const alertEmpresas = useMemo(() => {
    const set = new Set<string>();
    unreadAlerts.forEach(a => set.add(a.empresa));
    return set;
  }, [unreadAlerts]);

  // Meses com alertas pendentes por empresa
  const alertMeses = useMemo(() => {
    const map = new Map<string, Set<string>>();
    unreadAlerts.forEach(a => {
      if (!map.has(a.empresa)) map.set(a.empresa, new Set());
      map.get(a.empresa)!.add(a.mesKey);
    });
    return map;
  }, [unreadAlerts]);

  // Nível do blink cascading
  const [currentLevel, setCurrentLevel] = useState<BlinkLevel>("none");

  // Quando há alertas não lidos, iniciar o cascading
  useEffect(() => {
    if (unreadCount > 0 && isAlertOperator) {
      setCurrentLevel("financeiro-tab");
    } else {
      setCurrentLevel("none");
    }
  }, [unreadCount, isAlertOperator]);

  const advanceBlink = useCallback((level: BlinkLevel) => {
    switch (level) {
      case "financeiro-tab":
        setCurrentLevel("recebiveis-tab");
        break;
      case "recebiveis-tab":
        setCurrentLevel("empresa-card");
        break;
      case "empresa-card":
        setCurrentLevel("mes-card");
        break;
      case "mes-card":
        setCurrentLevel("none");
        break;
    }
  }, []);

  const markAlertRead = useCallback((alertId: number) => {
    if (!operatorName) return;
    markReadMutation.mutate({ alertId, operatorName });
  }, [operatorName, markReadMutation]);

  const markAlertsReadForMes = useCallback((empresa: string, mesKey: string) => {
    if (!operatorName) return;
    const matching = unreadAlerts.filter(a => a.empresa === empresa && a.mesKey === mesKey);
    matching.forEach(a => {
      markReadMutation.mutate({ alertId: a.id, operatorName });
    });
  }, [operatorName, unreadAlerts, markReadMutation]);

  const value = useMemo(() => ({
    unreadAlerts,
    unreadCount,
    blinkLevel: currentLevel,
    alertEmpresas,
    alertMeses,
    advanceBlink,
    markAlertRead,
    markAlertsReadForMes,
    isAlertOperator,
  }), [unreadAlerts, unreadCount, currentLevel, alertEmpresas, alertMeses, advanceBlink, markAlertRead, markAlertsReadForMes, isAlertOperator]);

  return (
    <DiscountAlertContext.Provider value={value}>
      {children}
    </DiscountAlertContext.Provider>
  );
}

export function useDiscountAlerts() {
  const ctx = useContext(DiscountAlertContext);
  if (!ctx) throw new Error("useDiscountAlerts must be used within DiscountAlertProvider");
  return ctx;
}
