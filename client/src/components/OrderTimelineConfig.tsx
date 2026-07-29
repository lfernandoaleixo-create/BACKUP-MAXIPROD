import React, { useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { ChevronDown, ChevronRight, Check, Clock, Eye, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Person {
  id: number;
  name: string;
  type: "gestor" | "vendedor";
}

interface OrderTimelineConfigProps {
  sellerId: number;
  sellerName: string;
  allPeople: Person[];
  gcEnabled: boolean;
}

const CONDITION_OPTIONS = [
  { value: "sempre", label: "Sempre (todo pedido)", needsValue: false },
  { value: "desconto_produto_acima", label: "Desconto no produto acima de", needsValue: true, suffix: "%" },
  { value: "desconto_produto_abaixo", label: "Desconto no produto abaixo de", needsValue: true, suffix: "%" },
  { value: "margem_pedido_acima", label: "Margem de lucro do pedido acima de", needsValue: true, suffix: "%" },
  { value: "margem_pedido_abaixo", label: "Margem de lucro do pedido abaixo de", needsValue: true, suffix: "%" },
  { value: "margem_mensal_acima", label: "Margem de lucro mensal acima de", needsValue: true, suffix: "%" },
  { value: "margem_mensal_abaixo", label: "Margem de lucro mensal abaixo de", needsValue: true, suffix: "%" },
  { value: "media_ponderada_descontos_acima", label: "Média ponderada descontos do mês acima de", needsValue: true, suffix: "%" },
  { value: "media_ponderada_descontos_abaixo", label: "Média ponderada descontos do mês abaixo de", needsValue: true, suffix: "%" },
];

const ACTION_OPTIONS = [
  { value: "visualizar", label: "Apenas Visualizar", icon: Eye, color: "text-blue-600" },
  { value: "autorizar", label: "Precisa Autorizar", icon: ShieldCheck, color: "text-orange-600" },
];

export function OrderTimelineConfig({ sellerId, sellerName, allPeople, gcEnabled }: OrderTimelineConfigProps) {

  const [expanded, setExpanded] = useState(false);
  const [expandedRecipients, setExpandedRecipients] = useState<Record<number, boolean>>({});

  // Fetch existing rules for this seller
  const { data: existingRules, refetch } = trpc.orderTimeline.getRulesForSeller.useQuery(
    { sellerId },
    { enabled: expanded }
  );

  const saveMutation = trpc.orderTimeline.saveRules.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Linha do tempo atualizada com sucesso");
    },
  });

  const deleteMutation = trpc.orderTimeline.deleteRulesForRecipient.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  // Group existing rules by recipient
  const rulesByRecipient = useMemo(() => {
    const map = new Map<number, typeof existingRules>();
    if (existingRules) {
      for (const rule of existingRules) {
        const existing = map.get(rule.recipientId) || [];
        existing.push(rule);
        map.set(rule.recipientId, existing);
      }
    }
    return map;
  }, [existingRules]);

  // Local state for editing conditions per recipient
  const [localConditions, setLocalConditions] = useState<Record<number, Array<{
    conditionType: string;
    conditionValue: number | null;
    actionType: string;
  }>>>({});

  // Initialize local conditions from DB when rules load
  const getConditionsForRecipient = useCallback((recipientId: number) => {
    if (localConditions[recipientId]) return localConditions[recipientId];
    const rules = rulesByRecipient.get(recipientId);
    if (rules && rules.length > 0) {
      return rules.map(r => ({
        conditionType: r.conditionType,
        conditionValue: r.conditionValue ? parseFloat(String(r.conditionValue)) : null,
        actionType: r.actionType,
      }));
    }
    return [];
  }, [localConditions, rulesByRecipient]);

  const isRecipientEnabled = (recipientId: number) => {
    return rulesByRecipient.has(recipientId) || (localConditions[recipientId] && localConditions[recipientId].length > 0);
  };

  const toggleRecipient = (person: Person) => {
    if (isRecipientEnabled(person.id)) {
      // Remove all rules for this recipient
      deleteMutation.mutate({ sellerId, recipientId: person.id });
      setLocalConditions(prev => {
        const next = { ...prev };
        delete next[person.id];
        return next;
      });
    } else {
      // Enable with default "sempre" + "visualizar"
      const defaultConditions = [{ conditionType: "sempre", conditionValue: null, actionType: "visualizar" }];
      setLocalConditions(prev => ({ ...prev, [person.id]: defaultConditions }));
      saveMutation.mutate({
        sellerId,
        sellerName,
        recipientId: person.id,
        recipientName: person.name,
        recipientType: person.type,
        rules: defaultConditions,
      });
    }
  };

  const toggleCondition = (recipientId: number, recipientName: string, recipientType: string, conditionType: string) => {
    const current = getConditionsForRecipient(recipientId);
    let updated: typeof current;

    const exists = current.find(c => c.conditionType === conditionType);
    if (exists) {
      updated = current.filter(c => c.conditionType !== conditionType);
    } else {
      const needsValue = CONDITION_OPTIONS.find(o => o.value === conditionType)?.needsValue;
      updated = [...current, { conditionType, conditionValue: needsValue ? 10 : null, actionType: "visualizar" }];
    }

    setLocalConditions(prev => ({ ...prev, [recipientId]: updated }));

    // Auto-save
    if (updated.length > 0) {
      saveMutation.mutate({
        sellerId,
        sellerName,
        recipientId,
        recipientName,
        recipientType,
        rules: updated,
      });
    } else {
      deleteMutation.mutate({ sellerId, recipientId });
    }
  };

  const updateConditionValue = (recipientId: number, recipientName: string, recipientType: string, conditionType: string, value: number) => {
    const current = getConditionsForRecipient(recipientId);
    const updated = current.map(c => c.conditionType === conditionType ? { ...c, conditionValue: value } : c);
    setLocalConditions(prev => ({ ...prev, [recipientId]: updated }));
    saveMutation.mutate({
      sellerId,
      sellerName,
      recipientId,
      recipientName,
      recipientType,
      rules: updated,
    });
  };

  const updateActionType = (recipientId: number, recipientName: string, recipientType: string, conditionType: string, actionType: string) => {
    const current = getConditionsForRecipient(recipientId);
    const updated = current.map(c => c.conditionType === conditionType ? { ...c, actionType } : c);
    setLocalConditions(prev => ({ ...prev, [recipientId]: updated }));
    saveMutation.mutate({
      sellerId,
      sellerName,
      recipientId,
      recipientName,
      recipientType,
      rules: updated,
    });
  };

  const enabledCount = Array.from(rulesByRecipient.keys()).length + 
    Object.keys(localConditions).filter(k => !rulesByRecipient.has(Number(k)) && localConditions[Number(k)]?.length > 0).length;

  return (
    <div className="mt-1">
      <button
        onClick={() => gcEnabled && setExpanded(!expanded)}
        disabled={!gcEnabled}
        className="flex items-center gap-1.5 text-left group w-full"
      >
        {expanded ? <ChevronDown className="w-3 h-3 text-purple-600 shrink-0" /> : <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-purple-600 shrink-0" />}
        <Clock className="w-3 h-3 text-purple-500 shrink-0" />
        <span className="text-xs text-slate-600 group-hover:text-purple-700 font-medium">Linha do Tempo do Pedido de Venda</span>
        {enabledCount > 0 && <span className="text-[9px] bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-1 rounded shrink-0">{enabledCount} destino(s)</span>}
      </button>

      {expanded && (
        <div className="ml-5 mt-2 space-y-1.5 border-l-2 border-purple-100 pl-2.5 pb-1">
          {allPeople.filter(p => p.id !== sellerId).map(person => {
            const enabled = isRecipientEnabled(person.id);
            const isExpanded = expandedRecipients[person.id];
            const conditions = getConditionsForRecipient(person.id);

            return (
              <div key={person.id} className="space-y-1">
                {/* Recipient name + checkbox */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => enabled && setExpandedRecipients(prev => ({ ...prev, [person.id]: !prev[person.id] }))}
                    className="flex items-center gap-1 flex-1 min-w-0 text-left"
                    disabled={!enabled}
                  >
                    {enabled && (isExpanded ? <ChevronDown className="w-2.5 h-2.5 text-purple-500 shrink-0" /> : <ChevronRight className="w-2.5 h-2.5 text-slate-400 shrink-0" />)}
                    {!enabled && <span className="w-2.5 shrink-0" />}
                    <span className={`text-[11px] truncate ${enabled ? "text-purple-700 font-medium" : "text-slate-500"}`}>
                      {person.name}
                    </span>
                    <span className="text-[9px] text-slate-400">({person.type})</span>
                    {enabled && conditions.length > 0 && (
                      <span className="text-[9px] bg-green-100 text-green-700 px-1 rounded shrink-0">
                        {conditions.find(c => c.conditionType === "sempre") ? "sempre" : `${conditions.length} cond.`}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => toggleRecipient(person)}
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all shrink-0 ${
                      enabled
                        ? "bg-purple-500 border-transparent text-white"
                        : "border-slate-300 dark:border-slate-500 hover:border-purple-400 bg-white dark:bg-slate-700"
                    }`}
                  >
                    {enabled && <Check className="w-2.5 h-2.5" />}
                  </button>
                </div>

                {/* Expanded conditions for this recipient */}
                {enabled && isExpanded && (
                  <div className="ml-4 space-y-1.5 border-l border-purple-50 pl-2 pb-1">
                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Quando enviar para {person.name}?</p>
                    
                    {CONDITION_OPTIONS.map(opt => {
                      const active = conditions.find(c => c.conditionType === opt.value);
                      return (
                        <div key={opt.value} className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => toggleCondition(person.id, person.name, person.type, opt.value)}
                              className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all shrink-0 ${
                                active
                                  ? "bg-purple-500 border-transparent text-white"
                                  : "border-slate-300 hover:border-purple-400 bg-white"
                              }`}
                            >
                              {active && <Check className="w-2 h-2" />}
                            </button>
                            <span className={`text-[10px] ${active ? "text-purple-700 font-medium" : "text-slate-500"}`}>
                              {opt.label}
                            </span>
                            {opt.needsValue && active && (
                              <div className="flex items-center gap-0.5 shrink-0">
                                <Input
                                  type="number"
                                  value={active.conditionValue ?? 10}
                                  onChange={(e) => updateConditionValue(person.id, person.name, person.type, opt.value, parseFloat(e.target.value) || 0)}
                                  className="w-14 h-5 text-[10px] px-1 text-center"
                                  min={0}
                                  max={100}
                                  step={0.5}
                                />
                                <span className="text-[10px] text-slate-400">{opt.suffix}</span>
                              </div>
                            )}
                          </div>

                          {/* Action type selector for each active condition */}
                          {active && (
                            <div className="ml-5 flex items-center gap-2">
                              {ACTION_OPTIONS.map(action => (
                                <button
                                  key={action.value}
                                  onClick={() => updateActionType(person.id, person.name, person.type, opt.value, action.value)}
                                  className={`flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded transition-all ${
                                    active.actionType === action.value
                                      ? `bg-slate-100 dark:bg-slate-700 ${action.color} font-medium ring-1 ring-slate-200`
                                      : "text-slate-400 hover:text-slate-600"
                                  }`}
                                >
                                  <action.icon className="w-2.5 h-2.5" />
                                  {action.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {allPeople.filter(p => p.id !== sellerId).length === 0 && (
            <span className="text-[10px] text-slate-400 italic">Nenhuma pessoa cadastrada</span>
          )}
        </div>
      )}
    </div>
  );
}
