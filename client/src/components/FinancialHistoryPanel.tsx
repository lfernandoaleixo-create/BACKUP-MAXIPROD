/**
 * FinancialHistoryPanel - Painel de Histórico de Mudanças Financeiras
 * 
 * Design sofisticado e profissional com:
 * - Header com gradiente e estatísticas resumidas
 * - Cards por semana com barras de progresso visual
 * - Itens com layout limpo, espaçado e hierarquia visual clara
 * - Animações suaves e micro-interações
 * - Ordenação do mais antigo para o mais recente (com toggle)
 * - Datas completas das semanas (ex: "Semana analisada: 01/06 a 07/06")
 * - Labels explicativos nos números e datas de modificação
 * - Nomes sem truncar (quebra de linha)
 * - Ícone do olho com animação visual didática explicando o sistema
 * 
 * Dois modos:
 * 1. Por semana (inline no BucketCard): mostra mudanças de uma semana específica
 * 2. Completo (painel grande): mostra todas as mudanças do mês, agrupadas por semana e dia
 */

import React, { useState, useMemo, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import {
  Loader2,
  ChevronDown,
  ChevronUp,
  Plus,
  Minus,
  ArrowUpDown,
  Clock,
  X,
  CalendarDays,
  FolderOpen,
  History,
  TrendingUp,
  TrendingDown,
  FileText,
  BarChart3,
  ArrowUp,
  ArrowDown,
  Eye,
  Play,
  RotateCcw,
  Pause,
  Calendar,
  Search,
  ArrowRight,
  CheckCircle2,
  Zap,
} from "lucide-react";

function formatCurrency(n: number): string {
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
  if (n < 0) return formatted.replace("R$", "R$ -");
  return formatted;
}

function formatDateBR(dateStr: string): string {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function formatVencimento(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = dateStr.split("T")[0];
  const [y, m, day] = d.split("-");
  return `${day}/${m}`;
}

const dayNames: Record<number, string> = {
  0: "Dom", 1: "Seg", 2: "Ter", 3: "Qua", 4: "Qui", 5: "Sex", 6: "Sáb"
};

function getDayName(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dayNames[dt.getDay()] || "";
}

/**
 * Converte labels de semana como "07/04 - 13/04" para "Semana analisada: 07/04 a 13/04"
 * e labels especiais como "Vencidas" para "Títulos vencidos (anteriores à data atual)"
 */
export function formatSemanaLabel(label: string): string {
  if (!label) return "Sem semana";
  // Labels dinâmicos: "Venc. antes de DD/MM"
  if (label.startsWith("Venc. antes de ")) {
    const date = label.replace("Venc. antes de ", "");
    return `Vencidos antes de ${date}`;
  }
  // Labels dinâmicos: "Após DD/MM"
  if (label.startsWith("Após ")) {
    return `Vencimento após ${label.replace("Após ", "")}`;
  }
  // Compat: labels antigos que ainda podem existir no banco
  if (label === "Vencidas") return "Títulos vencidos";
  if (label === "Além de 8 semanas") return "Além de 8 semanas";
  if (label === "Sem vencimento") return "Sem data de vencimento";
  // Formato DD/MM - DD/MM → "Semana: DD/MM a DD/MM"
  const match = label.match(/^(\d{2}\/\d{2})\s*-\s*(\d{2}\/\d{2})$/);
  if (match) {
    return `Semana: ${match[1]} a ${match[2]}`;
  }
  return label;
}

/**
 * Extrai uma chave de ordenação numérica de um semanaLabel para ordenar cronologicamente.
 * Labels no formato DD/MM - DD/MM são convertidos para MMDD (início da semana).
 * "Vencidas" vem antes de tudo (retorna -1).
 * "Além de 8 semanas" vem depois de tudo (retorna 9999).
 */
export function getSemanaOrderKey(label: string): number {
  // Labels dinâmicos: "Venc. antes de DD/MM" → vem primeiro
  if (label.startsWith("Venc. antes de ")) return -1;
  // Compat: labels antigos
  if (label === "Vencidas") return -1;
  if (label === "Sem vencimento") return 9998;
  // Labels dinâmicos: "Após DD/MM" → vem por último
  if (label.startsWith("Após ")) return 9999;
  if (label === "Além de 8 semanas") return 9999;
  const match = label.match(/^(\d{2})\/(\d{2})\s*-/);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    return month * 100 + day;
  }
  return 5000; // fallback
}


/* ============================================
   ANIMATED EYE EXPLAINER - Como funciona o sistema
   ============================================ */

function HistoryExplainerModal({ onClose, tipo }: { onClose: () => void; tipo: "pagar" | "receber" }) {
  const isPagar = tipo === "pagar";
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const steps = useMemo(() => [
    {
      icon: Calendar,
      title: "Início do mês — Snapshot",
      description: "No início de cada mês, o sistema \"printa\" (registra uma foto) de TODOS os títulos a " + (isPagar ? "pagar" : "receber") + " previstos para as 8 semanas seguintes no Maxiprod. Esse é o ponto de partida.",
      visual: "snapshot",
      highlight: "amber",
    },
    {
      icon: Search,
      title: "Monitoramento diário automático",
      description: "A cada dia do mês, o sistema compara automaticamente a lista atual de títulos com a do dia anterior. Qualquer alteração — acréscimo ou decréscimo — é detectada e registrada no histórico.",
      visual: "compare",
      highlight: "blue",
    },
    {
      icon: Plus,
      title: "Títulos acrescentados (entradas)",
      description: "Quando um novo título aparece em qualquer semana (novo boleto, nova nota fiscal, renegociação), ele é registrado como \"Acrescentado\". O histórico mostra: o nome do cliente, o valor, a data de vencimento e QUANDO a modificação foi detectada.",
      visual: "added",
      highlight: "green",
    },
    {
      icon: Minus,
      title: "Títulos retirados (saídas)",
      description: "Quando um título desaparece de uma semana (pagamento, cancelamento, baixa, transferência), ele é registrado como \"Retirado\". Você sabe exatamente qual dia aquele título saiu e quanto representava.",
      visual: "removed",
      highlight: "red",
    },
    {
      icon: CalendarDays,
      title: "Organização por semana de vencimento",
      description: "As alterações são agrupadas nas 8 semanas seguintes. Cada semana mostra suas datas (ex: 13/04 a 19/04), o total acrescentado, o total retirado e o saldo líquido. Dentro de cada semana, as mudanças são organizadas por dia de modificação.",
      visual: "weeks",
      highlight: "purple",
    },
    {
      icon: CheckCircle2,
      title: "Rastreabilidade completa",
      description: "Resumindo: no início do mês tudo é \"printado\". Durante o mês, qualquer entrada ou saída fica registrada com data, valor, cliente e semana de vencimento. Você tem controle total sobre o que mudou, quando mudou e quanto mudou!",
      visual: "complete",
      highlight: "emerald",
    },
  ], [isPagar]);

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const progress = ((currentStep + 1) / steps.length) * 100;

  // Auto-advance
  useEffect(() => {
    if (!isPlaying || isLastStep) return;
    timerRef.current = setTimeout(() => {
      setCurrentStep(s => Math.min(s + 1, steps.length - 1));
    }, 4000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [currentStep, isPlaying, isLastStep, steps.length]);

  const handleRestart = () => { setCurrentStep(0); setIsPlaying(true); };

  const highlightColors: Record<string, { bg: string; border: string; text: string; iconBg: string; glow: string }> = {
    amber: { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-300", iconBg: "bg-gradient-to-br from-amber-400 to-orange-500", glow: "shadow-amber-500/20" },
    blue: { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-300", iconBg: "bg-gradient-to-br from-blue-400 to-indigo-500", glow: "shadow-blue-500/20" },
    green: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-300", iconBg: "bg-gradient-to-br from-emerald-400 to-green-500", glow: "shadow-emerald-500/20" },
    red: { bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-300", iconBg: "bg-gradient-to-br from-red-400 to-rose-500", glow: "shadow-red-500/20" },
    purple: { bg: "bg-purple-500/10", border: "border-purple-500/30", text: "text-purple-300", iconBg: "bg-gradient-to-br from-purple-400 to-violet-500", glow: "shadow-purple-500/20" },
    emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-300", iconBg: "bg-gradient-to-br from-emerald-400 to-teal-500", glow: "shadow-emerald-500/20" },
  };

  const colors = highlightColors[step.highlight] || highlightColors.amber;
  const StepIcon = step.icon;

  // Visual animations for each step
  const renderVisual = () => {
    switch (step.visual) {
      case "snapshot":
        return (
          <div className="flex items-center justify-center gap-3">
            <div className="flex flex-col items-center gap-1">
              <div className="w-16 h-20 bg-slate-700 rounded-lg border border-slate-600 flex flex-col items-center justify-center gap-1 relative overflow-hidden">
                <div className="w-10 h-1.5 bg-slate-500 rounded" />
                <div className="w-8 h-1.5 bg-slate-500 rounded" />
                <div className="w-10 h-1.5 bg-slate-500 rounded" />
                <div className="w-6 h-1.5 bg-slate-500 rounded" />
                <div className="absolute inset-0 bg-amber-400/20 animate-pulse" />
              </div>
              <span className="text-[9px] text-slate-400">Títulos</span>
            </div>
            <Zap className="w-5 h-5 text-amber-400 animate-pulse" />
            <div className="flex flex-col items-center gap-1">
              <div className="w-16 h-20 bg-amber-900/30 rounded-lg border-2 border-amber-500/50 flex flex-col items-center justify-center gap-1">
                <div className="w-10 h-1.5 bg-amber-500/60 rounded" />
                <div className="w-8 h-1.5 bg-amber-500/60 rounded" />
                <div className="w-10 h-1.5 bg-amber-500/60 rounded" />
                <div className="w-6 h-1.5 bg-amber-500/60 rounded" />
              </div>
              <span className="text-[9px] text-amber-400">Foto salva</span>
            </div>
          </div>
        );
      case "compare":
        return (
          <div className="flex items-center justify-center gap-4">
            <div className="flex flex-col items-center gap-1">
              <div className="w-14 h-16 bg-slate-700 rounded-lg border border-slate-600 flex flex-col items-center justify-center gap-1">
                <div className="w-8 h-1.5 bg-blue-400/40 rounded" />
                <div className="w-6 h-1.5 bg-blue-400/40 rounded" />
                <div className="w-8 h-1.5 bg-blue-400/40 rounded" />
              </div>
              <span className="text-[9px] text-slate-400">Ontem</span>
            </div>
            <div className="flex flex-col items-center">
              <ArrowRight className="w-5 h-5 text-blue-400 animate-pulse" />
              <Search className="w-4 h-4 text-blue-300 mt-1" />
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-14 h-16 bg-blue-900/30 rounded-lg border-2 border-blue-500/50 flex flex-col items-center justify-center gap-1 relative">
                <div className="w-8 h-1.5 bg-blue-400/60 rounded" />
                <div className="w-6 h-1.5 bg-blue-400/60 rounded" />
                <div className="w-8 h-1.5 bg-blue-400/60 rounded" />
                <div className="w-8 h-1.5 bg-emerald-400/80 rounded animate-pulse" />
              </div>
              <span className="text-[9px] text-blue-400">Hoje</span>
            </div>
          </div>
        );
      case "added":
        return (
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-emerald-900/30 border border-emerald-500/40 rounded-lg px-3 py-2 flex items-center gap-2"
                  style={{ animation: `fadeInUp 0.5s ease-out ${i * 0.3}s both` }}>
                  <Plus className="w-3 h-3 text-emerald-400" />
                  <div>
                    <div className="w-12 h-1.5 bg-emerald-400/50 rounded" />
                    <div className="w-8 h-1 bg-emerald-400/30 rounded mt-1" />
                  </div>
                </div>
              ))}
            </div>
            <span className="text-[10px] text-emerald-400 font-medium">Novos títulos detectados</span>
          </div>
        );
      case "removed":
        return (
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              {[1, 2].map(i => (
                <div key={i} className="bg-red-900/30 border border-red-500/40 rounded-lg px-3 py-2 flex items-center gap-2 opacity-70"
                  style={{ animation: `fadeInUp 0.5s ease-out ${i * 0.3}s both` }}>
                  <Minus className="w-3 h-3 text-red-400" />
                  <div>
                    <div className="w-12 h-1.5 bg-red-400/50 rounded line-through" />
                    <div className="w-8 h-1 bg-red-400/30 rounded mt-1" />
                  </div>
                </div>
              ))}
            </div>
            <span className="text-[10px] text-red-400 font-medium">Títulos que saíram da lista</span>
          </div>
        );
      case "weeks":
        return (
          <div className="flex items-end gap-1.5 justify-center">
            {["Sem 1", "Sem 2", "Sem 3", "Sem 4", "Sem 5", "Sem 6", "Sem 7", "Sem 8"].map((w, i) => (
              <div key={w} className="flex flex-col items-center gap-1">
                <div
                  className="w-6 bg-purple-500/60 rounded-t-sm transition-all"
                  style={{
                    height: `${20 + Math.random() * 30}px`,
                    animation: `growUp 0.5s ease-out ${i * 0.1}s both`,
                  }}
                />
                <span className="text-[7px] text-purple-400">{w}</span>
              </div>
            ))}
          </div>
        );
      case "complete":
        return (
          <div className="flex items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 border-2 border-emerald-400/50 flex items-center justify-center animate-pulse">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
            <div className="text-left">
              <p className="text-xs text-emerald-300 font-bold">100% rastreável</p>
              <p className="text-[10px] text-slate-400">Cliente + Valor + Data</p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-700"
        onClick={e => e.stopPropagation()}
        style={{ animation: "fadeInUp 0.3s ease-out" }}>

        {/* Header */}
        <div className={`${isPagar ? "bg-gradient-to-r from-red-800 via-slate-900 to-red-800" : "bg-gradient-to-r from-emerald-800 via-slate-900 to-emerald-800"} px-6 py-5`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${colors.iconBg} flex items-center justify-center shadow-lg ${colors.glow}`}>
                <Eye className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold text-base">Como funciona o Histórico</h3>
                <p className={`${isPagar ? "text-red-300" : "text-emerald-300"} text-xs`}>
                  Sistema de detecção automática de mudanças
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Visual area */}
        <div className="px-6 pt-5 pb-3">
          <div className={`${colors.bg} border ${colors.border} rounded-xl p-5 min-h-[120px] flex flex-col items-center justify-center transition-all duration-500`}>
            {renderVisual()}
          </div>
        </div>

        {/* Step info */}
        <div className="px-6 pb-3">
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-8 h-8 rounded-lg ${colors.iconBg} flex items-center justify-center shadow-md ${colors.glow}`}>
              <StepIcon className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                Passo {currentStep + 1} de {steps.length}
              </p>
              <p className="text-sm font-bold text-white">{step.title}</p>
            </div>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed pl-11">
            {step.description}
          </p>
        </div>

        {/* Progress + controls */}
        <div className="px-6 pb-4">
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-3">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isPagar ? "bg-gradient-to-r from-red-500 to-rose-400" : "bg-gradient-to-r from-emerald-500 to-teal-400"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Step dots */}
          <div className="flex items-center justify-center gap-2 mb-3">
            {steps.map((_, idx) => (
              <button
                key={idx}
                onClick={() => { setCurrentStep(idx); setIsPlaying(false); }}
                className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${
                  idx === currentStep
                    ? isPagar ? "bg-red-400 scale-125" : "bg-emerald-400 scale-125"
                    : idx < currentStep ? "bg-slate-500" : "bg-slate-700"
                }`}
              />
            ))}
          </div>

          {/* Play/Pause/Restart */}
          <div className="flex items-center justify-center gap-3">
            {isLastStep ? (
              <button onClick={handleRestart}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-white transition-all hover:scale-105 cursor-pointer ${
                  isPagar ? "bg-red-600 hover:bg-red-500" : "bg-emerald-600 hover:bg-emerald-500"
                }`}>
                <RotateCcw className="w-3.5 h-3.5" /> Assistir novamente
              </button>
            ) : (
              <button onClick={() => setIsPlaying(!isPlaying)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold transition-all cursor-pointer">
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {isPlaying ? "Pausar" : "Continuar"}
              </button>
            )}
            <button onClick={onClose}
              className="px-4 py-2 text-xs text-slate-400 hover:text-white font-medium transition-colors cursor-pointer">
              Fechar
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes growUp {
          from { height: 0; opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}


/* ============================================
   MINI PANEL - Inline dentro de cada BucketCard
   ============================================ */

interface WeekHistoryPanelProps {
  tipo: "pagar" | "receber";
  semanaLabel: string;
  onClose: () => void;
}

export function WeekHistoryPanel({ tipo, semanaLabel, onClose }: WeekHistoryPanelProps) {
  const isPagar = tipo === "pagar";
  const { data, isLoading } = trpc.financial.getChanges.useQuery({ tipo, semanaLabel });

  const [activeTab, setActiveTab] = useState<"adicionado" | "removido">("adicionado");
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [sortAsc, setSortAsc] = useState(true); // true = mais antigo primeiro
  const [showExplainer, setShowExplainer] = useState(false);

  const toggleDay = (date: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const allItems = useMemo(() => {
    if (!data) return { adicionado: [], removido: [], alterado: [] };
    const adicionado: any[] = [];
    const removido: any[] = [];
    const alterado: any[] = [];
    for (const dayGroup of data) {
      for (const item of dayGroup.items) {
        const enriched = { ...item, _changeDate: dayGroup.date };
        if (item.changeType === "adicionado") adicionado.push(enriched);
        else if (item.changeType === "removido") removido.push(enriched);
        else if (item.changeType === "alterado") alterado.push(enriched);
      }
    }
    return { adicionado, removido, alterado };
  }, [data]);

  const totalAdicionado = allItems.adicionado.reduce((s, i) => s + Number(i.valor || 0), 0);
  const totalRemovido = allItems.removido.reduce((s, i) => s + Number(i.valor || 0), 0);

  const currentItems = activeTab === "adicionado" ? allItems.adicionado : [...allItems.removido, ...allItems.alterado];
  const groupedByDay = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    for (const item of currentItems) {
      const date = item._changeDate || item.changeDate;
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(item);
    }
    const entries = Object.entries(grouped);
    return entries.sort(([a], [b]) => sortAsc ? a.localeCompare(b) : b.localeCompare(a));
  }, [currentItems, sortAsc]);

  const hasChanges = allItems.adicionado.length > 0 || allItems.removido.length > 0 || allItems.alterado.length > 0;

  // Cards start collapsed - user clicks to expand

  return (
    <div className={`mt-3 rounded-2xl border-2 ${isPagar ? "border-red-200/60" : "border-emerald-200/60"} overflow-hidden shadow-lg`}>
      {/* Header */}
      <div className={`${isPagar ? "bg-gradient-to-r from-red-600 to-red-500" : "bg-gradient-to-r from-emerald-600 to-emerald-500"} px-5 py-3.5 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
            <History className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="text-sm font-bold text-white">Histórico de Modificação</span>
            <p className="text-[10px] text-white/70 font-medium">{formatSemanaLabel(semanaLabel)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Eye icon - explainer */}
          <button
            onClick={() => setShowExplainer(true)}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-amber-500/30 flex items-center justify-center transition-all cursor-pointer group"
            title="Como funciona o sistema de detecção"
          >
            <Eye className="w-4 h-4 text-white/70 group-hover:text-amber-300 transition-colors" />
          </button>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {/* Summary badges */}
      {hasChanges && !isLoading && (
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-green-600" />
            <span className="text-xs font-bold text-green-700">Acrescentados: +{formatCurrency(totalAdicionado)}</span>
          </div>
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
            <TrendingDown className="w-3.5 h-3.5 text-red-600" />
            <span className="text-xs font-bold text-red-700">Retirados: -{formatCurrency(totalRemovido)}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Saldo líquido:</span>
            <span className={`text-sm font-bold ${totalAdicionado - totalRemovido >= 0 ? "text-green-700" : "text-red-700"}`}>
              {totalAdicionado - totalRemovido >= 0 ? "+" : ""}{formatCurrency(totalAdicionado - totalRemovido)}
            </span>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          <span className="text-xs text-slate-400">Carregando histórico de modificações...</span>
        </div>
      ) : !hasChanges ? (
        <div className="text-center py-10">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <FileText className="w-6 h-6 text-slate-300" />
          </div>
          <span className="text-sm text-slate-400">Nenhuma modificação registrada nesta semana</span>
        </div>
      ) : (
        <>
          {/* Tabs + Sort toggle */}
          <div className="flex items-center border-b border-slate-100 dark:border-slate-700">
            <button
              onClick={() => setActiveTab("adicionado")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-all cursor-pointer border-b-2 ${
                activeTab === "adicionado"
                  ? "bg-green-50/80 text-green-700 border-green-500"
                  : "text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:bg-slate-800/50 border-transparent"
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>Acrescentados</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                activeTab === "adicionado" ? "bg-green-200/60 text-green-800" : "bg-slate-100 text-slate-500"
              }`}>
                {allItems.adicionado.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("removido")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-all cursor-pointer border-b-2 ${
                activeTab === "removido"
                  ? "bg-red-50/80 text-red-700 border-red-500"
                  : "text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:bg-slate-800/50 border-transparent"
              }`}
            >
              <Minus className="w-4 h-4" />
              <span>Retirados</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                activeTab === "removido" ? "bg-red-200/60 text-red-800" : "bg-slate-100 text-slate-500"
              }`}>
                {allItems.removido.length + allItems.alterado.length}
              </span>
            </button>
            {/* Sort toggle */}
            <button
              onClick={() => setSortAsc(!sortAsc)}
              className="px-3 py-3 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer flex items-center gap-1"
              title={sortAsc ? "Ordenado: mais antigo primeiro. Clique para inverter." : "Ordenado: mais recente primeiro. Clique para inverter."}
            >
              {sortAsc ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
              <span className="text-[10px] font-semibold">{sortAsc ? "Antigo" : "Recente"}</span>
            </button>
          </div>

          {/* Items grouped by day */}
          <div className="max-h-[400px] overflow-y-auto">
            {groupedByDay.length === 0 ? (
              <div className="text-center py-10 text-sm text-slate-400">
                Nenhum item {activeTab === "adicionado" ? "acrescentado" : "retirado"} nesta semana
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {groupedByDay.map(([date, items]) => {
                  const isExpanded = expandedDays.has(date);
                  const dayTotal = items.reduce((s: number, i: any) => s + Number(i.valor || 0), 0);

                  return (
                    <div key={date}>
                      <button
                        onClick={() => toggleDay(date)}
                        className="w-full px-5 py-3 flex items-center justify-between hover:bg-slate-50/80 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${activeTab === "adicionado" ? "bg-green-100" : "bg-red-100"}`}>
                            <CalendarDays className={`w-3.5 h-3.5 ${activeTab === "adicionado" ? "text-green-600" : "text-red-600"}`} />
                          </div>
                          <span className="text-xs text-slate-500 font-medium">Data da modificação:</span>
                          <span className="text-sm font-bold text-slate-700">{formatDateBR(date)}</span>
                          <span className="text-xs text-slate-400 font-medium">({getDayName(date)})</span>
                          <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">{items.length} {items.length === 1 ? "título" : "títulos"}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-sm font-bold ${activeTab === "adicionado" ? "text-green-600" : "text-red-600"}`}>
                            {formatCurrency(dayTotal)}
                          </span>
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-transform ${isExpanded ? "rotate-180" : ""} ${
                            activeTab === "adicionado" ? "bg-green-100" : "bg-red-100"
                          }`}>
                            <ChevronDown className={`w-3.5 h-3.5 ${activeTab === "adicionado" ? "text-green-600" : "text-red-600"}`} />
                          </div>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-5 pb-4 space-y-2">
                          {items.map((item: any, idx: number) => (
                            <div key={item.maxiprodId || idx} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 px-4 py-3 hover:border-slate-200 hover:shadow-sm transition-all">
                              <div className="flex items-start gap-x-3">
                                {item.changeType === "adicionado" ? (
                                  <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center shrink-0 mt-0.5">
                                    <Plus className="w-3 h-3 text-green-600" />
                                  </div>
                                ) : item.changeType === "removido" ? (
                                  <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                                    <Minus className="w-3 h-3 text-red-600" />
                                  </div>
                                ) : (
                                  <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                                    <ArrowUpDown className="w-3 h-3 text-amber-600" />
                                  </div>
                                )}
                                <span className="text-sm text-slate-700 font-medium min-w-0 break-words leading-relaxed" style={{ flex: '1 1 0', wordBreak: 'break-word' }}>
                                  {item.nome || "—"}
                                </span>
                                {item.vencimentoData && (
                                  <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-lg whitespace-nowrap shrink-0 border border-slate-100" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                    Venc. {formatVencimento(item.vencimentoData)}
                                  </span>
                                )}
                                <span className={`text-sm font-bold whitespace-nowrap text-right shrink-0 ${
                                  item.changeType === "adicionado" ? "text-green-700" :
                                  item.changeType === "removido" ? "text-red-700" : "text-amber-700"
                                }`} style={{ width: '100px', fontVariantNumeric: 'tabular-nums' }}>
                                  {item.changeType === "alterado" ? (
                                    <>
                                      <span className="text-slate-400 line-through text-[10px]">{formatCurrency(Number(item.valorAnterior || 0))}</span>
                                      {" → "}
                                      {formatCurrency(Number(item.valor || 0))}
                                    </>
                                  ) : (
                                    formatCurrency(Number(item.valor || 0))
                                  )}
                                </span>
                              </div>
                              {(item.referenteA || item.observacoes) && (
                                <p className="text-xs text-slate-400 pl-9 mt-1.5 break-words leading-relaxed" style={{ wordBreak: 'break-word' }}>
                                  {item.referenteA || item.observacoes}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Explainer modal */}
      {showExplainer && (
        <HistoryExplainerModal onClose={() => setShowExplainer(false)} tipo={tipo} />
      )}
    </div>
  );
}


/* ============================================
   FULL PANEL - Histórico Completo (header principal)
   ============================================ */

interface FullHistoryPanelProps {
  tipo: "pagar" | "receber";
  onClose: () => void;
}

export default function FullHistoryPanel({ tipo, onClose }: FullHistoryPanelProps) {
  const isPagar = tipo === "pagar";
  const title = isPagar ? "Pagamentos" : "Recebimentos";

  const { data, isLoading } = trpc.financial.getChanges.useQuery({ tipo });

  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"adicionado" | "removido">("adicionado");
  const [sortAsc, setSortAsc] = useState(true); // true = mais antigo primeiro (default)
  const [showExplainer, setShowExplainer] = useState(false);

  const toggleWeek = (semana: string) => {
    setExpandedWeeks(prev => {
      const next = new Set(prev);
      if (next.has(semana)) next.delete(semana);
      else next.add(semana);
      return next;
    });
  };

  const toggleDay = (date: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  // Group all items by semana, then by day
  const grouped = useMemo(() => {
    if (!data) return { adicionado: new Map<string, any[]>(), removido: new Map<string, any[]>() };
    
    const adicionadoBySemana = new Map<string, any[]>();
    const removidoBySemana = new Map<string, any[]>();

    for (const dayGroup of data) {
      for (const item of dayGroup.items) {
        const enriched = { ...item, _changeDate: dayGroup.date };
        const semana = item.semanaLabel || "Sem semana";
        
        if (item.changeType === "adicionado") {
          if (!adicionadoBySemana.has(semana)) adicionadoBySemana.set(semana, []);
          adicionadoBySemana.get(semana)!.push(enriched);
        } else {
          if (!removidoBySemana.has(semana)) removidoBySemana.set(semana, []);
          removidoBySemana.get(semana)!.push(enriched);
        }
      }
    }

    return { adicionado: adicionadoBySemana, removido: removidoBySemana };
  }, [data]);

  const currentMap = activeTab === "adicionado" ? grouped.adicionado : grouped.removido;

  // Calculate totals
  const totalAdicionado = useMemo(() => {
    let total = 0;
    for (const items of Array.from(grouped.adicionado.values())) {
      for (const item of items) total += Number(item.valor || 0);
    }
    return total;
  }, [grouped]);

  const totalRemovido = useMemo(() => {
    let total = 0;
    for (const items of Array.from(grouped.removido.values())) {
      for (const item of items) total += Number(item.valor || 0);
    }
    return total;
  }, [grouped]);

  const totalCount = useMemo(() => {
    let count = 0;
    for (const items of Array.from(grouped.adicionado.values())) count += items.length;
    for (const items of Array.from(grouped.removido.values())) count += items.length;
    return count;
  }, [grouped]);

  const saldoLiquido = totalAdicionado - totalRemovido;

  // Find max week total for progress bars
  const maxWeekTotal = useMemo(() => {
    let max = 0;
    for (const [, items] of Array.from(currentMap.entries())) {
      const total = items.reduce((s: number, i: any) => s + Number(i.valor || 0), 0);
      if (total > max) max = total;
    }
    return max;
  }, [currentMap]);

  // Sorted entries: oldest first (ascending) or newest first (descending)
  const sortedEntries = useMemo(() => {
    const entries = Array.from(currentMap.entries());
    return entries.sort(([a], [b]) => {
      const keyA = getSemanaOrderKey(a);
      const keyB = getSemanaOrderKey(b);
      return sortAsc ? keyA - keyB : keyB - keyA;
    });
  }, [currentMap, sortAsc]);

  return (
    <div className={`bg-white rounded-2xl border ${isPagar ? "border-red-200/50" : "border-emerald-200/50"} shadow-xl overflow-hidden`}>
      {/* ── Gradient Header ── */}
      <div className={`${isPagar ? "bg-gradient-to-br from-red-700 via-red-600 to-rose-500" : "bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-500"} px-4 sm:px-6 py-4 sm:py-5`}>
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center shrink-0">
              <History className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-lg font-bold text-white tracking-tight">
                Histórico Completo de Modificações
              </h3>
              <p className="text-[10px] sm:text-xs text-white/70 font-medium">{title} — Todas as alterações detectadas desde o início do mês</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Eye icon - explainer */}
            <button
              onClick={() => setShowExplainer(true)}
              className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-white/10 hover:bg-amber-500/30 flex items-center justify-center transition-all cursor-pointer group"
              title="Como funciona o sistema de detecção"
            >
              <Eye className="w-4 h-4 sm:w-5 sm:h-5 text-white/70 group-hover:text-amber-300 transition-colors" />
            </button>
            <button onClick={onClose} className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all cursor-pointer">
              <X className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 flex sm:flex-col items-center sm:items-start justify-between sm:justify-start gap-2 sm:gap-0">
            <div className="flex items-center gap-1.5 sm:mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-green-300" />
              <span className="text-[10px] text-white/60 font-semibold uppercase tracking-wider">Títulos acrescentados</span>
            </div>
            <span className="text-sm sm:text-base font-bold text-green-200 whitespace-nowrap">+{formatCurrency(totalAdicionado)}</span>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 flex sm:flex-col items-center sm:items-start justify-between sm:justify-start gap-2 sm:gap-0">
            <div className="flex items-center gap-1.5 sm:mb-1">
              <TrendingDown className="w-3.5 h-3.5 text-red-300" />
              <span className="text-[10px] text-white/60 font-semibold uppercase tracking-wider">Títulos retirados</span>
            </div>
            <span className="text-sm sm:text-base font-bold text-red-200 whitespace-nowrap">-{formatCurrency(totalRemovido)}</span>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 flex sm:flex-col items-center sm:items-start justify-between sm:justify-start gap-2 sm:gap-0">
            <div className="flex items-center gap-1.5 sm:mb-1">
              <BarChart3 className="w-3.5 h-3.5 text-white/60" />
              <span className="text-[10px] text-white/60 font-semibold uppercase tracking-wider">Saldo líquido</span>
            </div>
            <span className={`text-sm sm:text-base font-bold whitespace-nowrap ${saldoLiquido >= 0 ? "text-green-200" : "text-red-200"}`}>
              {saldoLiquido >= 0 ? "+" : ""}{formatCurrency(saldoLiquido)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Tab Switcher + Sort Toggle ── */}
      <div className="flex bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("adicionado")}
          className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-3 sm:py-3.5 text-xs sm:text-sm font-bold transition-all cursor-pointer border-b-[3px] ${
            activeTab === "adicionado"
              ? "bg-white text-green-700 border-green-500 shadow-sm"
              : "text-slate-400 hover:text-slate-600 border-transparent"
          }`}
        >
          <div className={`hidden sm:flex w-6 h-6 rounded-full items-center justify-center ${activeTab === "adicionado" ? "bg-green-100" : "bg-slate-100"}`}>
            <Plus className={`w-3.5 h-3.5 ${activeTab === "adicionado" ? "text-green-600" : "text-slate-400"}`} />
          </div>
          <Plus className={`w-3 h-3 sm:hidden ${activeTab === "adicionado" ? "text-green-600" : "text-slate-400"}`} />
          Acrescentados
          <span className={`text-[10px] sm:text-xs px-1.5 sm:px-2.5 py-0.5 rounded-full font-bold ${
            activeTab === "adicionado" ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-500"
          }`}>
            {Array.from(grouped.adicionado.values()).reduce((s, items) => s + items.length, 0)}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("removido")}
          className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-3 sm:py-3.5 text-xs sm:text-sm font-bold transition-all cursor-pointer border-b-[3px] ${
            activeTab === "removido"
              ? "bg-white text-red-700 border-red-500 shadow-sm"
              : "text-slate-400 hover:text-slate-600 border-transparent"
          }`}
        >
          <div className={`hidden sm:flex w-6 h-6 rounded-full items-center justify-center ${activeTab === "removido" ? "bg-red-100" : "bg-slate-100"}`}>
            <Minus className={`w-3.5 h-3.5 ${activeTab === "removido" ? "text-red-600" : "text-slate-400"}`} />
          </div>
          <Minus className={`w-3 h-3 sm:hidden ${activeTab === "removido" ? "text-red-600" : "text-slate-400"}`} />
          Retirados
          <span className={`text-[10px] sm:text-xs px-1.5 sm:px-2.5 py-0.5 rounded-full font-bold ${
            activeTab === "removido" ? "bg-red-100 text-red-800" : "bg-slate-200 text-slate-500"
          }`}>
            {Array.from(grouped.removido.values()).reduce((s, items) => s + items.length, 0)}
          </span>
        </button>
        {/* Sort toggle button */}
        <button
          onClick={() => setSortAsc(!sortAsc)}
          className="px-2 sm:px-4 py-3 sm:py-3.5 flex items-center gap-1 sm:gap-1.5 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer border-b-[3px] border-transparent hover:bg-slate-100"
          title={sortAsc ? "Ordenação: mais antigo primeiro. Clique para inverter." : "Ordenação: mais recente primeiro. Clique para inverter."}
        >
          <div className="flex flex-col items-center">
            <ArrowUp className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${sortAsc ? "text-teal-600" : "text-slate-300"}`} />
            <ArrowDown className={`w-3 h-3 sm:w-3.5 sm:h-3.5 -mt-1 ${!sortAsc ? "text-teal-600" : "text-slate-300"}`} />
          </div>
          <span className="text-[9px] sm:text-[10px] font-bold uppercase">{sortAsc ? "Antigo" : "Recente"}</span>
        </button>
      </div>

      {/* ── Content grouped by semana ── */}
      <div className="max-h-[550px] overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
              <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
            </div>
            <span className="text-sm text-slate-400 font-medium">Carregando histórico de modificações...</span>
          </div>
        ) : currentMap.size === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
              <FileText className="w-7 h-7 text-slate-300" />
            </div>
            <span className="text-sm text-slate-400 font-medium">
              Nenhum título {activeTab === "adicionado" ? "acrescentado" : "retirado"} neste mês
            </span>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {sortedEntries
              .map(([semana, items]) => {
                const semanaTotal = items.reduce((s: number, i: any) => s + Number(i.valor || 0), 0);
                const isWeekExpanded = expandedWeeks.has(semana);
                const progressPercent = maxWeekTotal > 0 ? (semanaTotal / maxWeekTotal) * 100 : 0;
                
                // Group items by day within this semana
                const byDay: Record<string, any[]> = {};
                for (const item of items) {
                  const date = item._changeDate || item.changeDate;
                  if (!byDay[date]) byDay[date] = [];
                  byDay[date].push(item);
                }
                // Sort days: ascending (oldest first) or descending
                const dayEntries = Object.entries(byDay).sort(([a], [b]) => sortAsc ? a.localeCompare(b) : b.localeCompare(a));

                return (
                  <div key={semana} className={`rounded-xl border overflow-hidden transition-all ${
                    isWeekExpanded 
                      ? activeTab === "adicionado" ? "border-green-200 shadow-lg" : "border-red-200 shadow-lg"
                      : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
                  }`}>
                    {/* Semana header card */}
                    <button
                      onClick={() => toggleWeek(semana)}
                      className={`w-full px-5 py-4 flex items-center justify-between transition-all cursor-pointer ${
                        isWeekExpanded
                          ? activeTab === "adicionado" ? "bg-green-50" : "bg-red-50"
                          : "bg-white hover:bg-slate-50 dark:hover:bg-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          activeTab === "adicionado" ? "bg-green-100" : "bg-red-100"
                        }`}>
                          <CalendarDays className={`w-4.5 h-4.5 ${activeTab === "adicionado" ? "text-green-600" : "text-red-600"}`} />
                        </div>
                        <div className="text-left min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-slate-800">{formatSemanaLabel(semana)}</span>
                            <span className="text-xs bg-slate-100 text-slate-500 px-2.5 py-0.5 rounded-full font-semibold">
                              {items.length} {items.length === 1 ? "título" : "títulos"}
                            </span>
                          </div>
                          {/* Mini progress bar */}
                          <div className="w-28 h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                activeTab === "adicionado" ? "bg-green-400" : "bg-red-400"
                              }`}
                              style={{ width: `${Math.max(progressPercent, 5)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`text-base font-bold ${activeTab === "adicionado" ? "text-green-600" : "text-red-600"}`}>
                          {activeTab === "adicionado" ? "+" : "-"}{formatCurrency(semanaTotal)}
                        </span>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-transform ${isWeekExpanded ? "rotate-180" : ""} ${
                          activeTab === "adicionado" ? "bg-green-100" : "bg-red-100"
                        }`}>
                          <ChevronDown className={`w-3.5 h-3.5 ${activeTab === "adicionado" ? "text-green-600" : "text-red-600"}`} />
                        </div>
                      </div>
                    </button>

                    {/* Days within semana */}
                    {isWeekExpanded && (
                      <div className="border-t border-slate-100">
                        {dayEntries.map(([date, dayItems]) => {
                          const isDayExpanded = expandedDays.has(`${semana}-${date}`);
                          const dayTotal = dayItems.reduce((s: number, i: any) => s + Number(i.valor || 0), 0);

                          return (
                            <div key={date} className="border-b border-slate-50 last:border-b-0">
                              <button
                                onClick={() => toggleDay(`${semana}-${date}`)}
                                className="w-full px-5 py-3 flex items-center justify-between hover:bg-slate-50/80 transition-colors cursor-pointer"
                              >
                                <div className="flex items-center gap-2.5">
                                  <div className="w-2 h-2 rounded-full bg-slate-300 ml-2" />
                                  <span className="text-xs text-slate-500 font-medium">Data da modificação:</span>
                                  <span className="text-sm font-bold text-slate-600">{formatDateBR(date)}</span>
                                  <span className="text-xs text-slate-400 font-medium">({getDayName(date)})</span>
                                  <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">{dayItems.length} {dayItems.length === 1 ? "título" : "títulos"}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className={`text-sm font-bold ${activeTab === "adicionado" ? "text-green-600" : "text-red-600"}`}>
                                    {formatCurrency(dayTotal)}
                                  </span>
                                  <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-transform ${isDayExpanded ? "rotate-180" : ""}`}>
                                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                                  </div>
                                </div>
                              </button>

                              {isDayExpanded && (
                                <div className="px-5 pb-4 pl-10 space-y-2">
                                  {dayItems.map((item: any, idx: number) => (
                                    <div key={item.maxiprodId || idx} className="bg-slate-50/80 rounded-xl border border-slate-100 px-4 py-3 hover:bg-white hover:border-slate-200 hover:shadow-sm transition-all">
                                      <div className="flex items-start gap-x-3">
                                        {item.changeType === "adicionado" ? (
                                          <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center shrink-0 mt-0.5">
                                            <Plus className="w-3 h-3 text-green-600" />
                                          </div>
                                        ) : item.changeType === "removido" ? (
                                          <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                                            <Minus className="w-3 h-3 text-red-600" />
                                          </div>
                                        ) : (
                                          <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                                            <ArrowUpDown className="w-3 h-3 text-amber-600" />
                                          </div>
                                        )}
                                        <span className="text-sm text-slate-700 font-medium min-w-0 break-words leading-relaxed" style={{ flex: '1 1 0', wordBreak: 'break-word' }}>
                                          {item.nome || "—"}
                                        </span>
                                        {item.vencimentoData && (
                                          <span className="text-xs text-slate-400 bg-white px-2 py-1 rounded-lg border border-slate-100 whitespace-nowrap shrink-0" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                            Venc. {formatVencimento(item.vencimentoData)}
                                          </span>
                                        )}
                                        <span className={`text-sm font-bold whitespace-nowrap text-right shrink-0 ${
                                          item.changeType === "adicionado" ? "text-green-700" :
                                          item.changeType === "removido" ? "text-red-700" : "text-amber-700"
                                        }`} style={{ width: '100px', fontVariantNumeric: 'tabular-nums' }}>
                                          {item.changeType === "alterado" ? (
                                            <>
                                              <span className="text-slate-400 line-through text-[10px]">{formatCurrency(Number(item.valorAnterior || 0))}</span>
                                              {" → "}
                                              {formatCurrency(Number(item.valor || 0))}
                                            </>
                                          ) : (
                                            formatCurrency(Number(item.valor || 0))
                                          )}
                                        </span>
                                      </div>
                                      {(item.referenteA || item.observacoes) && (
                                        <p className="text-xs text-slate-400 pl-9 mt-1.5 italic break-words leading-relaxed" style={{ wordBreak: 'break-word' }}>
                                          {item.referenteA || item.observacoes}
                                        </p>
                                      )}
                                    </div>
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
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      {!isLoading && totalCount > 0 && (
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-400 font-medium">
            {totalCount} movimentações registradas neste mês
          </span>
          <span className="text-xs text-slate-400">
            Conciliação diária automática
          </span>
        </div>
      )}

      {/* Explainer modal */}
      {showExplainer && (
        <HistoryExplainerModal onClose={() => setShowExplainer(false)} tipo={tipo} />
      )}
    </div>
  );
}
