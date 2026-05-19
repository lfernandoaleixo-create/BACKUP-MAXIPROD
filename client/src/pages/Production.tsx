/**
 * Produção - Controle de produção industrial
 * 9 setores com lançamento diário por máquina/mesa
 * Multilamina (setor 1): status + campos fixos Benazzi/Madeira Dura (sempre visíveis)
 * Vareteira (setor 2): status + campos fixos 150mm-350mm (sempre visíveis)
 * Todos os setores: caixa de comentários opcional
 */

import { useState, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import TopNav from "@/components/TopNav";
import { useOperator } from "@/contexts/OperatorContext";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Factory, ChevronDown, ChevronRight, ChevronUp, Save, Calendar, BarChart3,
  ArrowLeft, ArrowRight, Loader2, Cog, Eye, Package, Box, Zap, Scissors,
  Layers, Printer, History, AlertTriangle, Wrench, Ban, CheckCircle2, Clock,
  MessageSquare, TreePine, Ruler, Search, X, Plus, Pencil, Trash2, Flame, Type,
  FileDown, TrendingUp,
} from "lucide-react";
import { generateDailyPdf, generateWeeklyPdf, generateMonthlyPdf } from "@/lib/productionPdfExport";
import { generateAnnotationPdf } from "@/lib/annotationPdfExport";
import ProductionCharts from "@/components/ProductionCharts";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend as RechartsLegend,
} from "recharts";

// ─── Status options ───
const MACHINE_STATUS_OPTIONS = [
  { value: "producao_normal", label: "Produção Normal", color: "#10b981", icon: CheckCircle2, bgClass: "bg-emerald-50", textClass: "text-emerald-700", borderClass: "border-emerald-200" },
  { value: "falta_madeira", label: "Falta de Madeira", color: "#ef4444", icon: AlertTriangle, bgClass: "bg-red-50", textClass: "text-red-700", borderClass: "border-red-200" },
  { value: "producao_nao_necessaria", label: "Produção Não Necessária", color: "#f59e0b", icon: Ban, bgClass: "bg-amber-50", textClass: "text-amber-700", borderClass: "border-amber-200" },
  { value: "manutencao", label: "Manutenção", color: "#6366f1", icon: Wrench, bgClass: "bg-indigo-50", textClass: "text-indigo-700", borderClass: "border-indigo-200" },
  { value: "manutencao_pontual", label: "Manutenção Pontual", color: "#8b5cf6", icon: Clock, bgClass: "bg-violet-50", textClass: "text-violet-700", borderClass: "border-violet-200" },
];

// ─── Wood type options (Multilamina) - always shown ───
const WOOD_TYPE_OPTIONS = [
  { value: "benazzi", label: "Benazzi", color: "#d97706", bgClass: "bg-amber-50", textClass: "text-amber-800", borderClass: "border-amber-300" },
  { value: "madeira_dura", label: "Madeira Dura", color: "#059669", bgClass: "bg-emerald-50", textClass: "text-emerald-800", borderClass: "border-emerald-300" },
];

// ─── Medidas por setor ───
// Vareteira (setor 2): todas 3,8x + 3,5x200/250/350
// Vareteira: medidas base (3,8x) para máquinas 1-4
const VARETEIRA_BASE_OPTIONS = [
  { value: "3.8x150mm", label: "3,8x150mm", color: "#0ea5e9", bgClass: "bg-sky-50", textClass: "text-sky-800", borderClass: "border-sky-300" },
  { value: "3.8x180mm", label: "3,8x180mm", color: "#06b6d4", bgClass: "bg-cyan-50", textClass: "text-cyan-800", borderClass: "border-cyan-300" },
  { value: "3.8x200mm", label: "3,8x200mm", color: "#14b8a6", bgClass: "bg-teal-50", textClass: "text-teal-800", borderClass: "border-teal-300" },
  { value: "3.8x218mm", label: "3,8x218mm", color: "#10b981", bgClass: "bg-emerald-50", textClass: "text-emerald-800", borderClass: "border-emerald-300" },
  { value: "3.8x250mm", label: "3,8x250mm", color: "#22c55e", bgClass: "bg-green-50", textClass: "text-green-800", borderClass: "border-green-300" },
  { value: "3.8x300mm", label: "3,8x300mm", color: "#84cc16", bgClass: "bg-lime-50", textClass: "text-lime-800", borderClass: "border-lime-300" },
  { value: "3.8x350mm", label: "3,8x350mm", color: "#eab308", bgClass: "bg-yellow-50", textClass: "text-yellow-800", borderClass: "border-yellow-300" },
];
// Vareteira: medidas extras (3,5x) apenas para máquina 5
const VARETEIRA_EXTRA_35_OPTIONS = [
  { value: "3.5x200mm", label: "3,5x200mm", color: "#f97316", bgClass: "bg-orange-50", textClass: "text-orange-800", borderClass: "border-orange-300" },
  { value: "3.5x250mm", label: "3,5x250mm", color: "#ef4444", bgClass: "bg-red-50", textClass: "text-red-800", borderClass: "border-red-300" },
  { value: "3.5x350mm", label: "3,5x350mm", color: "#ec4899", bgClass: "bg-pink-50", textClass: "text-pink-800", borderClass: "border-pink-300" },
];
// Vareteira completa (máquina 5): base + extras
const VARETEIRA_MEASURE_OPTIONS = [...VARETEIRA_BASE_OPTIONS, ...VARETEIRA_EXTRA_35_OPTIONS];

// Seletora de Toco (setor 3): sem 150/300/350, 3,8x nas restantes + 3,5x200/250
const SELETORA_TOCO_MEASURE_OPTIONS = [
  { value: "3.8x180mm", label: "3,8x180mm", color: "#06b6d4", bgClass: "bg-cyan-50", textClass: "text-cyan-800", borderClass: "border-cyan-300" },
  { value: "3.8x200mm", label: "3,8x200mm", color: "#14b8a6", bgClass: "bg-teal-50", textClass: "text-teal-800", borderClass: "border-teal-300" },
  { value: "3.8x218mm", label: "3,8x218mm", color: "#10b981", bgClass: "bg-emerald-50", textClass: "text-emerald-800", borderClass: "border-emerald-300" },
  { value: "3.8x250mm", label: "3,8x250mm", color: "#22c55e", bgClass: "bg-green-50", textClass: "text-green-800", borderClass: "border-green-300" },
  { value: "3.5x200mm", label: "3,5x200mm", color: "#f97316", bgClass: "bg-orange-50", textClass: "text-orange-800", borderClass: "border-orange-300" },
  { value: "3.5x250mm", label: "3,5x250mm", color: "#ef4444", bgClass: "bg-red-50", textClass: "text-red-800", borderClass: "border-red-300" },
];

// Seleção Automática (setor 4): sem 300/350, 3,8x nas restantes + 3,5x200/250
const SELECAO_AUTO_MEASURE_OPTIONS = [
  { value: "3.8x150mm", label: "3,8x150mm", color: "#0ea5e9", bgClass: "bg-sky-50", textClass: "text-sky-800", borderClass: "border-sky-300" },
  { value: "3.8x180mm", label: "3,8x180mm", color: "#06b6d4", bgClass: "bg-cyan-50", textClass: "text-cyan-800", borderClass: "border-cyan-300" },
  { value: "3.8x200mm", label: "3,8x200mm", color: "#14b8a6", bgClass: "bg-teal-50", textClass: "text-teal-800", borderClass: "border-teal-300" },
  { value: "3.8x218mm", label: "3,8x218mm", color: "#10b981", bgClass: "bg-emerald-50", textClass: "text-emerald-800", borderClass: "border-emerald-300" },
  { value: "3.8x250mm", label: "3,8x250mm", color: "#22c55e", bgClass: "bg-green-50", textClass: "text-green-800", borderClass: "border-green-300" },
  { value: "3.5x200mm", label: "3,5x200mm", color: "#f97316", bgClass: "bg-orange-50", textClass: "text-orange-800", borderClass: "border-orange-300" },
  { value: "3.5x250mm", label: "3,5x250mm", color: "#ef4444", bgClass: "bg-red-50", textClass: "text-red-800", borderClass: "border-red-300" },
];

// Seleção Visual (setor 5): 3,8x em todas (sem 300mm) + 3,5x200mm
const SELECAO_VISUAL_MEASURE_OPTIONS = [
  { value: "3.8x150mm", label: "3,8x150mm", color: "#0ea5e9", bgClass: "bg-sky-50", textClass: "text-sky-800", borderClass: "border-sky-300" },
  { value: "3.8x180mm", label: "3,8x180mm", color: "#06b6d4", bgClass: "bg-cyan-50", textClass: "text-cyan-800", borderClass: "border-cyan-300" },
  { value: "3.8x200mm", label: "3,8x200mm", color: "#14b8a6", bgClass: "bg-teal-50", textClass: "text-teal-800", borderClass: "border-teal-300" },
  { value: "3.8x218mm", label: "3,8x218mm", color: "#10b981", bgClass: "bg-emerald-50", textClass: "text-emerald-800", borderClass: "border-emerald-300" },
  { value: "3.8x250mm", label: "3,8x250mm", color: "#22c55e", bgClass: "bg-green-50", textClass: "text-green-800", borderClass: "border-green-300" },
  { value: "3.8x350mm", label: "3,8x350mm", color: "#eab308", bgClass: "bg-yellow-50", textClass: "text-yellow-800", borderClass: "border-yellow-300" },
  { value: "3.5x200mm", label: "3,5x200mm", color: "#f97316", bgClass: "bg-orange-50", textClass: "text-orange-800", borderClass: "border-orange-300" },
];

// ─── Fatores de conversão caixa → saco (setores 2, 3, 4) ───
// Cada medida tem fatores diferentes para caixa pequena e caixa grande.
// Será atualizado com os fatores reais fornecidos pelo usuário.
const CONVERSION_FACTORS: Record<string, { cxp: number; cxg: number }> = {
  "3.8x150mm": { cxp: 0, cxg: 0 },
  "3.8x180mm": { cxp: 0.5, cxg: 0 },
  "3.8x200mm": { cxp: 0.6, cxg: 0.8 },
  "3.8x218mm": { cxp: 0.6, cxg: 0.8 },
  "3.8x220mm": { cxp: 0.5, cxg: 0.7 },
  "3.8x250mm": { cxp: 0, cxg: 0.8 },
  "3.8x300mm": { cxp: 0, cxg: 0 },
  "3.8x350mm": { cxp: 0.4, cxg: 0.6 },
  "3.5x200mm": { cxp: 0.6, cxg: 0.8 },
  "3.5x250mm": { cxp: 0, cxg: 0 },
  "3.5x350mm": { cxp: 0, cxg: 0 },
};

// Setores que usam sistema triplo caixa peq/caixa grande/saco (Vareteira, Seletoras Toco, Seleção Automática)
function isDualUnitSector(ordem: number) { return ordem === 2 || ordem === 3 || ordem === 4; }

function convertCxpToSaco(medida: string, caixas: number): number {
  const fator = CONVERSION_FACTORS[medida]?.cxp || 1;
  return caixas * fator;
}
function convertCxgToSaco(medida: string, caixas: number): number {
  const fator = CONVERSION_FACTORS[medida]?.cxg || 1;
  return caixas * fator;
}

// ─── Measure options (Flow Pack, setor 6) ───
const FLOWPACK_MEASURE_OPTIONS = [
  { value: "3.8x180mm", label: "3,8x180mm", color: "#06b6d4", bgClass: "bg-cyan-50", textClass: "text-cyan-800", borderClass: "border-cyan-300" },
  { value: "3.8x220mm", label: "3,8x220mm", color: "#10b981", bgClass: "bg-emerald-50", textClass: "text-emerald-800", borderClass: "border-emerald-300" },
  { value: "3.8x250mm", label: "3,8x250mm", color: "#22c55e", bgClass: "bg-green-50", textClass: "text-green-800", borderClass: "border-green-300" },
  { value: "3.5x200mm", label: "3,5x200mm", color: "#f97316", bgClass: "bg-orange-50", textClass: "text-orange-800", borderClass: "border-orange-300" },
];

// ─── Measure options (Flow Pack Fibra) - always shown ───
const FLOWPACK_FIBRA_OPTIONS = [
  { value: "fibra_3.0x200mm", label: "3,0x200mm", color: "#8b5cf6", bgClass: "bg-violet-50", textClass: "text-violet-800", borderClass: "border-violet-300" },
];

// ─── Measure options (Ponteira) - always shown ───
const PONTEIRA_MEASURE_OPTIONS = [
  { value: "3.8x180mm", label: "3,8x180mm", color: "#06b6d4", bgClass: "bg-cyan-50", textClass: "text-cyan-800", borderClass: "border-cyan-300" },
  { value: "3.8x200mm", label: "3,8x200mm", color: "#14b8a6", bgClass: "bg-teal-50", textClass: "text-teal-800", borderClass: "border-teal-300" },
  { value: "3.8x220mm", label: "3,8x220mm", color: "#10b981", bgClass: "bg-emerald-50", textClass: "text-emerald-800", borderClass: "border-emerald-300" },
  { value: "3.8x250mm", label: "3,8x250mm", color: "#22c55e", bgClass: "bg-green-50", textClass: "text-green-800", borderClass: "border-green-300" },
];

// ─── Wood type options (Pirografar) - always shown ───
const PIROGRAFAR_TYPE_OPTIONS = [
  { value: "bambu", label: "Bambu", color: "#16a34a", bgClass: "bg-green-50", textClass: "text-green-800", borderClass: "border-green-300" },
  { value: "madeira", label: "Madeira", color: "#92400e", bgClass: "bg-amber-50", textClass: "text-amber-800", borderClass: "border-amber-300" },
];

function getStatusOption(value: string) {
  return MACHINE_STATUS_OPTIONS.find(o => o.value === value) || MACHINE_STATUS_OPTIONS[0];
}

function fmtNum(n: number, decimals = 0): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function getTodayBR(): string {
  const now = new Date();
  const br = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return br.toISOString().slice(0, 10);
}

function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function getWeekRange(dateStr: string): { start: string; end: string } {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: monday.toISOString().slice(0, 10), end: sunday.toISOString().slice(0, 10) };
}

function getSectorIcon(ordem: number) {
  switch (ordem) {
    case 1: return Layers; case 2: return Cog; case 3: return Eye;
    case 4: return Zap; case 5: return Eye; case 6: return Package;
    case 7: return Scissors; case 8: return Box; case 9: return Printer;
    default: return Factory;
  }
}

const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// Sector 1 = Multilamina (tipo de madeira)
// Sector 2 = Vareteira, 3 = Seletoras Toco, 4 = Seleção Automática (medida de madeira)
function isMultilamina(ordem: number) { return ordem === 1; }
function isPirografar(ordem: number) { return ordem === 9; }
function isPonteira(ordem: number) { return ordem === 7; }
function isFlowPack(ordem: number) { return ordem === 6; }
function hasMeasureFeatures(ordem: number) { return ordem === 2 || ordem === 3 || ordem === 4 || ordem === 5 || ordem === 6; }
function hasExpandableFeatures(ordem: number) { return ordem === 1 || ordem === 2 || ordem === 3 || ordem === 4 || ordem === 5 || ordem === 6 || ordem === 7; }

// Get the FIXED variant options for a sector (always all shown)
function getVariantOptions(sectorOrdem: number, machineOrdem?: number) {
  if (isMultilamina(sectorOrdem)) return WOOD_TYPE_OPTIONS;
  // Pirografar agora usa componente dedicado PirografiaMachinePanel
  if (isPirografar(sectorOrdem)) return [];
  if (isPonteira(sectorOrdem)) return PONTEIRA_MEASURE_OPTIONS;
  if (isFlowPack(sectorOrdem)) return FLOWPACK_MEASURE_OPTIONS;
  if (sectorOrdem === 2) {
    // Vareteira: máquina 5 tem medidas extras 3,5x; máquinas 1-4 só 3,8x
    return machineOrdem === 5 ? VARETEIRA_MEASURE_OPTIONS : VARETEIRA_BASE_OPTIONS;
  }
  if (sectorOrdem === 3) return SELETORA_TOCO_MEASURE_OPTIONS;
  if (sectorOrdem === 4) return SELECAO_AUTO_MEASURE_OPTIONS;
  if (sectorOrdem === 5) return SELECAO_VISUAL_MEASURE_OPTIONS;
  return [];
}

function getVariantLabel(sectorOrdem: number) {
  if (isMultilamina(sectorOrdem)) return "Tipo de Madeira";
  if (isPirografar(sectorOrdem)) return "Tipo de Madeira";
  if (isPonteira(sectorOrdem)) return "Medida de Madeira";
  if (isFlowPack(sectorOrdem)) return "Medida de Madeira";
  if (hasMeasureFeatures(sectorOrdem)) return "Medida de Madeira";
  return "";
}

function getVariantIcon(sectorOrdem: number) {
  if (isMultilamina(sectorOrdem) || isPirografar(sectorOrdem)) return TreePine;
  return Ruler; // Ponteira e setores com medida usam Ruler
}

export default function Production() {
  const { hasAccess, operator } = useOperator();
  const [, setLocation] = useLocation();

  // Guard: redirecionar se não tem acesso à produção
  if (!hasAccess("producao")) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <TopNav />
        <div className="flex flex-col items-center justify-center py-20">
          <div className="bg-white rounded-2xl shadow-lg border border-red-100 p-8 max-w-md text-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Factory className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Acesso Restrito</h2>
            <p className="text-slate-500 mb-4">
              {operator?.name || "Você"} não tem permissão para acessar o Controle de Produção.
            </p>
            <button
              onClick={() => setLocation("/")}
              className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium"
            >
              Voltar ao Estoque
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Apenas Maria pode editar; demais operadores somente visualizam
  const canEdit = operator?.name === "Maria";

  const [selectedDate, setSelectedDate] = useState(getTodayBR);
  const [expandedSectors, setExpandedSectors] = useState<Set<number>>(new Set());
  const [expandedMachines, setExpandedMachines] = useState<Set<string>>(new Set());
  const [commentOpen, setCommentOpen] = useState<Set<string>>(new Set());
  // For non-expandable sectors: simple value per machine
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  // For expandable sectors: value per machine per variant (key: "sectorId-machineId-variant")
  const [variantEditValues, setVariantEditValues] = useState<Record<string, string>>({});
  const [statusValues, setStatusValues] = useState<Record<string, string>>({});
  const [commentValues, setCommentValues] = useState<Record<string, string>>({});
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"lancamento" | "historico" | "pirografia" | "graficos">("lancamento");
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [showConversionModal, setShowConversionModal] = useState(false);
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);
  const [showPdfMenu, setShowPdfMenu] = useState(false);

  const utils = trpc.useUtils();

  const { data: sectors, isLoading: loadingSectors } = trpc.production.getSectors.useQuery();
  const { data: entries } = trpc.production.getEntries.useQuery({ data: selectedDate });
  const { data: dailySummary } = trpc.production.getDailySummary.useQuery({ data: selectedDate });
  const { data: monthlyAverage } = trpc.production.getMonthlyAverage.useQuery({ data: selectedDate });

  const weekRange = useMemo(() => getWeekRange(selectedDate), [selectedDate]);
  const { data: weeklySummary } = trpc.production.getWeeklySummary.useQuery({
    dataInicio: weekRange.start, dataFim: weekRange.end,
  }, { enabled: viewMode === "historico" });

  // Single entry upsert (for non-expandable sectors)
  const upsertEntry = trpc.production.upsertEntry.useMutation({
    onSuccess: (_r, v) => {
      const key = `${v.sectorId}-${v.machineId || "null"}`;
      setSavingKeys(prev => { const n = new Set(prev); n.delete(key); return n; });
      utils.production.getEntries.invalidate({ data: selectedDate });
      utils.production.getDailySummary.invalidate({ data: selectedDate });
      utils.production.getWeeklySummary.invalidate();
      toast.success("Produção salva!");
    },
    onError: (err, v) => {
      const key = `${v.sectorId}-${v.machineId || "null"}`;
      setSavingKeys(prev => { const n = new Set(prev); n.delete(key); return n; });
      toast.error("Erro ao salvar: " + err.message);
    },
  });

  // Batch upsert (for expandable sectors with multiple variants)
  const batchUpsert = trpc.production.batchUpsertEntries.useMutation({
    onSuccess: (_r) => {
      setSavingKeys(new Set());
      utils.production.getEntries.invalidate({ data: selectedDate });
      utils.production.getDailySummary.invalidate({ data: selectedDate });
      utils.production.getWeeklySummary.invalidate();
      // Reset edit state for this machine after successful save
      toast.success("Produção salva!");
    },
    onError: (err) => {
      setSavingKeys(new Set());
      toast.error("Erro ao salvar: " + err.message);
    },
  });

  const toggleSector = (id: number) => {
    setExpandedSectors(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };
  const toggleMachine = (sectorId: number, machineId: number) => {
    const key = `${sectorId}-${machineId}`;
    setExpandedMachines(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  };
  const toggleComment = (key: string) => {
    setCommentOpen(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  };

  const resetEditState = () => {
    setEditValues({});
    setVariantEditValues({});
    setStatusValues({});
    setCommentValues({});
  };

  const changeDate = (delta: number) => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() + delta);
    setSelectedDate(d.toISOString().slice(0, 10));
    resetEditState();
  };

  // ─── Entry helpers ───
  const getEntriesForMachine = (sectorId: number, machineId: number | null) => {
    if (!entries) return [];
    return entries.filter(e =>
      e.sectorId === sectorId &&
      (machineId ? e.machineId === machineId : e.machineId === null)
    );
  };

  const getEntryForVariant = (sectorId: number, machineId: number | null, variant: string | null) => {
    if (!entries) return null;
    return entries.find(e =>
      e.sectorId === sectorId &&
      (machineId ? e.machineId === machineId : e.machineId === null) &&
      (variant ? e.tipoMadeira === variant : !e.tipoMadeira)
    ) || null;
  };

  const getEntryStatus = (sectorId: number, machineId: number | null): string => {
    const machineEntries = getEntriesForMachine(sectorId, machineId);
    if (machineEntries.length > 0) return machineEntries[0].status || "";
    return "";
  };

  const getEntryComment = (sectorId: number, machineId: number | null): string => {
    const machineEntries = getEntriesForMachine(sectorId, machineId);
    if (machineEntries.length > 0) return machineEntries[0].observacoes || "";
    return "";
  };

  /**
   * Calcula o total do setor.
   * Para setores expandíveis (Multilamina/Vareteira): soma os valores de TODOS os campos fixos
   * usando valores editados (se existirem) ou valores do banco.
   * Para setores simples: usa o dailySummary do backend.
   */
  const getSectorTotal = (sectorId: number): number => {
    const sector = sectors?.find(s => s.id === sectorId);
    if (!sector) {
      if (!dailySummary) return 0;
      const s = dailySummary.find(d => d.sectorId === sectorId);
      return s ? Number(s.total) : 0;
    }

    if (hasExpandableFeatures(sector.ordem)) {
      if (!sector.machines || sector.machines.length === 0) return 0;
      const variantOpts = getVariantOptions(sector.ordem);
      // Flow Pack also has fibra options that must be included in the total
      const fibraOpts = isFlowPack(sector.ordem) ? FLOWPACK_FIBRA_OPTIONS : [];
      const allVariantOpts = [...variantOpts, ...fibraOpts];
      let sectorTotal = 0;
      if (allVariantOpts.length === 0) {
        // Expandable but no variants: use simple edit values or DB entries
        for (const machine of sector.machines) {
          const key = `${sectorId}-${machine.id}`;
          if (editValues[key] !== undefined) {
            if (editValues[key] !== "") {
              const num = parseFloat(editValues[key].replace(",", "."));
              if (!isNaN(num) && num >= 0) sectorTotal += num;
            }
          } else {
            const machineEntries = getEntriesForMachine(sectorId, machine.id);
            sectorTotal += machineEntries.reduce((sum, e) => sum + Number(e.quantidade), 0);
          }
        }
        return sectorTotal;
      }
      const dualUnit = isDualUnitSector(sector.ordem);
      for (const machine of sector.machines) {
        const machineVariantOpts = getVariantOptions(sector.ordem, machine.ordem);
        // Include fibra options for Flow Pack per-machine as well
        const machineFibraOpts: typeof FLOWPACK_FIBRA_OPTIONS = isFlowPack(sector.ordem) ? FLOWPACK_FIBRA_OPTIONS : [];
        const allMachineOpts: typeof machineVariantOpts = [...machineVariantOpts, ...machineFibraOpts];
        let machineTotal = 0;
        for (const opt of allMachineOpts as Array<{value: string; label: string}>) {
          if (dualUnit) {
            // Triple unit: saco direto + caixa pequena convertida + caixa grande convertida
            const sacoKey = `${sectorId}-${machine.id}-${opt.value}_saco`;
            const cxpKey = `${sectorId}-${machine.id}-${opt.value}_cxp`;
            const cxgKey = `${sectorId}-${machine.id}-${opt.value}_cxg`;
            let sacoVal = 0;
            let cxpVal = 0;
            let cxgVal = 0;
            // Saco
            if (variantEditValues[sacoKey] !== undefined) {
              if (variantEditValues[sacoKey] !== "") {
                const n = parseFloat(variantEditValues[sacoKey].replace(",", "."));
                if (!isNaN(n) && n >= 0) sacoVal = n;
              }
            } else {
              const entry = getEntryForVariant(sectorId, machine.id, `${opt.value}_saco`);
              if (entry) sacoVal = Number(entry.quantidade);
            }
            // Caixa Pequena
            if (variantEditValues[cxpKey] !== undefined) {
              if (variantEditValues[cxpKey] !== "") {
                const n = parseFloat(variantEditValues[cxpKey].replace(",", "."));
                if (!isNaN(n) && n >= 0) cxpVal = n;
              }
            } else {
              const entry = getEntryForVariant(sectorId, machine.id, `${opt.value}_cxp`);
              if (entry) cxpVal = Number(entry.quantidade);
            }
            // Caixa Grande
            if (variantEditValues[cxgKey] !== undefined) {
              if (variantEditValues[cxgKey] !== "") {
                const n = parseFloat(variantEditValues[cxgKey].replace(",", "."));
                if (!isNaN(n) && n >= 0) cxgVal = n;
              }
            } else {
              const entry = getEntryForVariant(sectorId, machine.id, `${opt.value}_cxg`);
              if (entry) cxgVal = Number(entry.quantidade);
            }
            machineTotal += sacoVal + convertCxpToSaco(opt.value, cxpVal) + convertCxgToSaco(opt.value, cxgVal);
          } else {
            // Single unit (Multilamina, Ponteira, etc.)
            const varKey = `${sectorId}-${machine.id}-${opt.value}`;
            if (variantEditValues[varKey] !== undefined) {
              if (variantEditValues[varKey] !== "") {
                const num = parseFloat(variantEditValues[varKey].replace(",", "."));
                if (!isNaN(num) && num >= 0) machineTotal += num;
              }
            } else {
              const entry = getEntryForVariant(sectorId, machine.id, opt.value);
              if (entry) machineTotal += Number(entry.quantidade);
            }
          }
        }
        sectorTotal += machineTotal;
      }
      // Maria can enter fractional values (caixas quebradas like 9.9, 11.8)
      // Individual machine values stay as-entered, but sector total rounds DOWN
      return Math.floor(sectorTotal);
    }

    // For simple sectors: use dailySummary from backend
    if (!dailySummary) return 0;
    const s = dailySummary.find(d => d.sectorId === sectorId);
    return s ? Number(s.total) : 0;
  };

  // ─── Save handlers ───
  // Simple save for non-expandable sectors
  const handleSimpleSave = (sectorId: number, machineId: number | null) => {
    const key = `${sectorId}-${machineId || "null"}`;
    const val = editValues[key];
    const comment = commentValues[key];

    const quantidade = val !== undefined && val !== "" ? parseFloat(val.replace(",", ".")) : 0;
    if (isNaN(quantidade) || quantidade < 0) { toast.error("Valor inválido"); return; }

    setSavingKeys(prev => new Set(prev).add(key));
    upsertEntry.mutate({
      sectorId, machineId, data: selectedDate, quantidade,
      observacoes: comment !== undefined ? comment : getEntryComment(sectorId, machineId),
    });
  };

  // Save for expandable sectors - sends ALL variant options or simple upsert if no variants
  const handleVariantSave = (sectorId: number, machineId: number | null, sectorOrdem: number, machineOrdem?: number) => {
    const machineKey = `${sectorId}-${machineId || "null"}`;
    const status = statusValues[machineKey] || getEntryStatus(sectorId, machineId);
    const comment = commentValues[machineKey] !== undefined ? commentValues[machineKey] : getEntryComment(sectorId, machineId);

    const variantOpts = getVariantOptions(sectorOrdem, machineOrdem);
    // Flow Pack also has fibra options
    const fibraOpts = isFlowPack(sectorOrdem) ? FLOWPACK_FIBRA_OPTIONS : [];
    const allVariantOpts = [...variantOpts, ...fibraOpts];

    // Setores expansíveis sem variantes (6, 7, 9): usar upsertEntry simples com status
    if (allVariantOpts.length === 0) {
      const val = editValues[machineKey];
      const quantidade = val !== undefined && val !== "" ? parseFloat(val.replace(",", ".")) : 0;
      if (isNaN(quantidade) || quantidade < 0) { toast.error("Valor inválido"); return; }
      setSavingKeys(prev => new Set(prev).add(machineKey));
      upsertEntry.mutate({
        sectorId, machineId, data: selectedDate, quantidade,
        status, observacoes: comment,
      });
      return;
    }

    const batchEntries: any[] = [];
    const dualUnit = isDualUnitSector(sectorOrdem);
    for (const opt of allVariantOpts) {
      if (dualUnit) {
        // Triple unit: salvar 3 registros por medida (cx pequena, cx grande e saco)
        const suffixLabels = { "_cxp": "cx pequena", "_cxg": "cx grande", "_saco": "saco" };
        for (const suffix of ["_cxp", "_cxg", "_saco"] as const) {
          const varKey = `${machineKey}-${opt.value}${suffix}`;
          const existingEntry = getEntryForVariant(sectorId, machineId, `${opt.value}${suffix}`);
          const val = variantEditValues[varKey];
          let quantidade: number;
          if (val !== undefined) {
            quantidade = val !== "" ? parseFloat(val.replace(",", ".")) : 0;
          } else if (existingEntry) {
            quantidade = Number(existingEntry.quantidade);
          } else {
            quantidade = 0;
          }
          if (isNaN(quantidade) || quantidade < 0) { toast.error(`Valor inválido para ${opt.label} (${suffixLabels[suffix]})`); return; }
          batchEntries.push({
            sectorId, machineId, data: selectedDate, quantidade, status,
            tipoMadeira: `${opt.value}${suffix}`, observacoes: comment,
          });
        }
      } else {
        // Single unit
        const varKey = `${machineKey}-${opt.value}`;
        const existingEntry = getEntryForVariant(sectorId, machineId, opt.value);
        const val = variantEditValues[varKey];
        let quantidade: number;
        if (val !== undefined) {
          quantidade = val !== "" ? parseFloat(val.replace(",", ".")) : 0;
        } else if (existingEntry) {
          quantidade = Number(existingEntry.quantidade);
        } else {
          quantidade = 0;
        }
        if (isNaN(quantidade) || quantidade < 0) { toast.error(`Valor inválido para ${opt.label}`); return; }
        batchEntries.push({
          sectorId, machineId, data: selectedDate, quantidade, status,
          tipoMadeira: opt.value, observacoes: comment,
        });
      }
    }

    setSavingKeys(prev => new Set(prev).add(machineKey));
    batchUpsert.mutate({ sectorId, machineId, data: selectedDate, entries: batchEntries });
  };

  // Save for Embalagem sector (setor 8) - saves individual product entries
  const handleEmbalagemSave = (sectorId: number, codigoItem: string, quantidade: number, _descricao: string) => {
    const key = `${sectorId}-emb`;
    setSavingKeys(prev => new Set(prev).add(key));
    upsertEntry.mutate({
      sectorId, machineId: null, data: selectedDate, quantidade,
      tipoMadeira: codigoItem, observacoes: "",
      lancadoPor: operator?.name || "Desconhecido",
    }, {
      onSuccess: () => {
        setSavingKeys(prev => { const n = new Set(prev); n.delete(key); return n; });
        utils.production.getEntries.invalidate({ data: selectedDate });
        utils.production.getDailySummary.invalidate({ data: selectedDate });
        utils.production.getWeeklySummary.invalidate();
        toast.success("Produção embalagem salva!");
      },
      onError: (err: any) => {
        setSavingKeys(prev => { const n = new Set(prev); n.delete(key); return n; });
        toast.error("Erro ao salvar: " + err.message);
      },
    });
  };

  // ─── Save All Day handler ───
  const handleSaveAllDay = async () => {
    if (!sectors) return;
    setIsSavingAll(true);
    const promises: Promise<any>[] = [];

    for (const sector of sectors) {
      const hasMachines = sector.machines && sector.machines.length > 0;
      const expandable = hasExpandableFeatures(sector.ordem);

      // Setor 8 (Embalagem) é salvo individualmente por produto - pular
      if (!hasMachines) continue;

      for (const machine of sector.machines) {
        const machineKey = `${sector.id}-${machine.id || "null"}`;

        if (expandable) {
          const variantOpts = getVariantOptions(sector.ordem, machine.ordem);
          const status = statusValues[machineKey] || getEntryStatus(sector.id, machine.id);
          const comment = commentValues[machineKey] !== undefined ? commentValues[machineKey] : getEntryComment(sector.id, machine.id);

          if (variantOpts.length === 0) {
            // Expandable but no variants (6, 7, 9)
            const val = editValues[machineKey];
            const quantidade = val !== undefined && val !== "" ? parseFloat(val.replace(",", ".")) : undefined;
            if (quantidade !== undefined && !isNaN(quantidade) && quantidade >= 0) {
              promises.push(
                upsertEntry.mutateAsync({
                  sectorId: sector.id, machineId: machine.id, data: selectedDate, quantidade,
                  status, observacoes: comment,
                })
              );
            } else if (statusValues[machineKey] !== undefined || commentValues[machineKey] !== undefined) {
              // Save status/comment even if no quantity change
              const existingTotal = getEntriesForMachine(sector.id, machine.id).reduce((s, e) => s + Number(e.quantidade), 0);
              promises.push(
                upsertEntry.mutateAsync({
                  sectorId: sector.id, machineId: machine.id, data: selectedDate, quantidade: existingTotal,
                  status, observacoes: comment,
                })
              );
            }
          } else {
            // Expandable with variants (1, 2, 3, 4, 5, 7-ponteira, 9-pirografar)
            const batchEntries: any[] = [];
            let hasAnyChange = false;
            const dualUnit = isDualUnitSector(sector.ordem);
            for (const opt of variantOpts) {
              if (dualUnit) {
                for (const suffix of ["_cxp", "_cxg", "_saco"] as const) {
                  const varKey = `${machineKey}-${opt.value}${suffix}`;
                  const existingEntry = getEntryForVariant(sector.id, machine.id, `${opt.value}${suffix}`);
                  const val = variantEditValues[varKey];
                  let quantidade: number;
                  if (val !== undefined) {
                    quantidade = val !== "" ? parseFloat(val.replace(",", ".")) : 0;
                    hasAnyChange = true;
                  } else if (existingEntry) {
                    quantidade = Number(existingEntry.quantidade);
                  } else {
                    quantidade = 0;
                  }
                  if (isNaN(quantidade) || quantidade < 0) quantidade = 0;
                  batchEntries.push({
                    sectorId: sector.id, machineId: machine.id, data: selectedDate, quantidade, status,
                    tipoMadeira: `${opt.value}${suffix}`, observacoes: comment,
                  });
                }
              } else {
                const varKey = `${machineKey}-${opt.value}`;
                const existingEntry = getEntryForVariant(sector.id, machine.id, opt.value);
                const val = variantEditValues[varKey];
                let quantidade: number;
                if (val !== undefined) {
                  quantidade = val !== "" ? parseFloat(val.replace(",", ".")) : 0;
                  hasAnyChange = true;
                } else if (existingEntry) {
                  quantidade = Number(existingEntry.quantidade);
                } else {
                  quantidade = 0;
                }
                if (isNaN(quantidade) || quantidade < 0) quantidade = 0;
                batchEntries.push({
                  sectorId: sector.id, machineId: machine.id, data: selectedDate, quantidade, status,
                  tipoMadeira: opt.value, observacoes: comment,
                });
              }
            }
            if (hasAnyChange || statusValues[machineKey] !== undefined || commentValues[machineKey] !== undefined) {
              promises.push(
                batchUpsert.mutateAsync({ sectorId: sector.id, machineId: machine.id, data: selectedDate, entries: batchEntries })
              );
            }
          }
        } else {
          // Simple sector
          const val = editValues[machineKey];
          const comment = commentValues[machineKey];
          if (val !== undefined || comment !== undefined) {
            const quantidade = val !== undefined && val !== "" ? parseFloat(val.replace(",", ".")) : 0;
            if (!isNaN(quantidade) && quantidade >= 0) {
              promises.push(
                upsertEntry.mutateAsync({
                  sectorId: sector.id, machineId: machine.id, data: selectedDate, quantidade,
                  observacoes: comment !== undefined ? comment : getEntryComment(sector.id, machine.id),
                })
              );
            }
          }
        }
      }
    }

    try {
      if (promises.length === 0) {
        toast.info("Nenhuma alteração para salvar");
        setIsSavingAll(false);
        return;
      }
      await Promise.all(promises);
      utils.production.getEntries.invalidate({ data: selectedDate });
      utils.production.getDailySummary.invalidate({ data: selectedDate });
      utils.production.getWeeklySummary.invalidate();
      toast.success(`Dia salvo com sucesso! (${promises.length} lançamento(s))`);
      resetEditState();
    } catch (err: any) {
      toast.error("Erro ao salvar: " + (err?.message || "Erro desconhecido"));
    } finally {
      setIsSavingAll(false);
      setSavingKeys(new Set());
    }
  };

  // Check if there are any unsaved changes across all sectors
  const hasAnyChanges = useMemo(() => {
    return Object.keys(editValues).length > 0 ||
      Object.keys(variantEditValues).length > 0 ||
      Object.keys(statusValues).length > 0 ||
      Object.keys(commentValues).length > 0;
  }, [editValues, variantEditValues, statusValues, commentValues]);

  // ─── Edit value helpers ───
  const getEditValue = (sectorId: number, machineId: number | null): string => {
    const key = `${sectorId}-${machineId || "null"}`;
    if (editValues[key] !== undefined) return editValues[key];
    const machineEntries = getEntriesForMachine(sectorId, machineId);
    const total = machineEntries.reduce((sum, e) => sum + Number(e.quantidade), 0);
    return total > 0 ? String(total) : "";
  };

  const setEditValue = (sectorId: number, machineId: number | null, value: string) => {
    const key = `${sectorId}-${machineId || "null"}`;
    setEditValues(prev => ({ ...prev, [key]: value }));
  };

  const getVariantEditValue = (sectorId: number, machineId: number | null, variant: string): string => {
    const key = `${sectorId}-${machineId || "null"}-${variant}`;
    if (variantEditValues[key] !== undefined) return variantEditValues[key];
    const entry = getEntryForVariant(sectorId, machineId, variant);
    if (entry && Number(entry.quantidade) > 0) return String(Number(entry.quantidade));
    return "";
  };

  const setVariantEditValue = (key: string, value: string) => {
    setVariantEditValues(prev => ({ ...prev, [key]: value }));
  };

  // Status é multi-select: armazenado como string separada por vírgula (ex: "producao_normal,manutencao_pontual")
  const getStatusValue = (sectorId: number, machineId: number | null): string => {
    const key = `${sectorId}-${machineId || "null"}`;
    if (statusValues[key] !== undefined) return statusValues[key];
    return getEntryStatus(sectorId, machineId);
  };

  const getSelectedStatuses = (sectorId: number, machineId: number | null): Set<string> => {
    const val = getStatusValue(sectorId, machineId);
    if (!val) return new Set();
    return new Set(val.split(",").filter(Boolean));
  };

  const toggleStatusValue = (sectorId: number, machineId: number | null, statusVal: string) => {
    const key = `${sectorId}-${machineId || "null"}`;
    const current = getSelectedStatuses(sectorId, machineId);
    if (current.has(statusVal)) {
      current.delete(statusVal);
    } else {
      current.add(statusVal);
    }
    const newVal = Array.from(current).join(",");
    setStatusValues(prev => ({ ...prev, [key]: newVal }));
  };

  const getCommentValue = (sectorId: number, machineId: number | null): string => {
    const key = `${sectorId}-${machineId || "null"}`;
    if (commentValues[key] !== undefined) return commentValues[key];
    return getEntryComment(sectorId, machineId);
  };

  const setCommentValue = (sectorId: number, machineId: number | null, value: string) => {
    const key = `${sectorId}-${machineId || "null"}`;
    setCommentValues(prev => ({ ...prev, [key]: value }));
  };

  const hasChanges = (sectorId: number, machineId: number | null): boolean => {
    const key = `${sectorId}-${machineId || "null"}`;
    if (editValues[key] !== undefined || statusValues[key] !== undefined || commentValues[key] !== undefined) return true;
    for (const k of Object.keys(variantEditValues)) {
      if (k.startsWith(key + "-")) return true;
    }
    return false;
  };

  // Compute live total for a machine from all fixed variant fields (or simple edit value if no variants)
  const getMachineLiveTotal = (sectorId: number, machineId: number | null, sectorOrdem: number, machineOrdem?: number): number => {
    const variantOpts = getVariantOptions(sectorOrdem, machineOrdem);
    // Flow Pack also has fibra options
    const fibraOpts = isFlowPack(sectorOrdem) ? FLOWPACK_FIBRA_OPTIONS : [];
    const allOpts = [...variantOpts, ...fibraOpts];
    if (allOpts.length === 0) {
      // No variants: use simple edit value
      const val = getEditValue(sectorId, machineId);
      if (val !== "") {
        const num = parseFloat(val.replace(",", "."));
        if (!isNaN(num) && num >= 0) return num;
      }
      return 0;
    }
    let total = 0;
    const dualUnit = isDualUnitSector(sectorOrdem);
    for (const opt of allOpts) {
      if (dualUnit) {
        const sacoVal = getVariantEditValue(sectorId, machineId, `${opt.value}_saco`);
        const cxpVal = getVariantEditValue(sectorId, machineId, `${opt.value}_cxp`);
        const cxgVal = getVariantEditValue(sectorId, machineId, `${opt.value}_cxg`);
        const sacoNum = sacoVal !== "" ? parseFloat(sacoVal.replace(",", ".")) : 0;
        const cxpNum = cxpVal !== "" ? parseFloat(cxpVal.replace(",", ".")) : 0;
        const cxgNum = cxgVal !== "" ? parseFloat(cxgVal.replace(",", ".")) : 0;
        if (!isNaN(sacoNum) && sacoNum >= 0) total += sacoNum;
        if (!isNaN(cxpNum) && cxpNum >= 0) total += convertCxpToSaco(opt.value, cxpNum);
        if (!isNaN(cxgNum) && cxgNum >= 0) total += convertCxgToSaco(opt.value, cxgNum);
      } else {
        const val = getVariantEditValue(sectorId, machineId, opt.value);
        if (val !== "") {
          const num = parseFloat(val.replace(",", "."));
          if (!isNaN(num) && num >= 0) total += num;
        }
      }
    }
    return total;
  };

  const dayOfWeek = useMemo(() => {
    const d = new Date(selectedDate + "T12:00:00");
    return diasSemana[d.getDay()];
  }, [selectedDate]);

  const isToday = selectedDate === getTodayBR();
  const isFutureDate = selectedDate > getTodayBR();

  if (loadingSectors) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <TopNav />
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <TopNav />
      <div className="container py-6 pb-20 md:pb-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Factory className="w-6 h-6 text-teal-600" />
              Controle de Produção
            </h1>
            <p className="text-sm text-slate-500 mt-1">Lançamento diário de produção por setor e máquina</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setViewMode("lancamento")} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === "lancamento" ? "bg-teal-600 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>
              <Save className="w-4 h-4" /> Lançamento
            </button>
            <button onClick={() => setViewMode("historico")} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === "historico" ? "bg-teal-600 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>
              <History className="w-4 h-4" /> Histórico
            </button>
            <button onClick={() => setViewMode("pirografia")} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === "pirografia" ? "bg-orange-600 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>
              <Flame className="w-4 h-4" /> Pirografia
            </button>
            <button onClick={() => setViewMode("graficos")} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === "graficos" ? "bg-indigo-600 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>
              <BarChart3 className="w-4 h-4" /> Gráficos
            </button>

            {/* ─── PDF Export Menu ─── */}
            <div className="relative">
              <button
                onClick={() => setShowPdfMenu(!showPdfMenu)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              >
                <FileDown className="w-4 h-4" /> PDF
              </button>
              {showPdfMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowPdfMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg py-1 w-56">
                    <button
                      onClick={async () => {
                        if (!sectors || !entries) return;
                        setPdfLoading("diario");
                        setShowPdfMenu(false);
                        try {
                          await generateDailyPdf(sectors as any, entries as any, selectedDate);
                          toast.success("PDF Diário gerado!");
                        } catch (err: any) { toast.error("Erro ao gerar PDF: " + err.message); }
                        finally { setPdfLoading(null); }
                      }}
                      disabled={pdfLoading !== null}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 flex items-center gap-2 disabled:opacity-50"
                    >
                      {pdfLoading === "diario" ? <Loader2 className="w-4 h-4 animate-spin text-teal-600" /> : <Calendar className="w-4 h-4 text-teal-600" />}
                      <div>
                        <div className="font-medium text-slate-700">PDF Diário</div>
                        <div className="text-[10px] text-slate-400">Lançamento do dia {fmtDate(selectedDate)}</div>
                      </div>
                    </button>
                    <button
                      onClick={async () => {
                        if (!sectors) return;
                        setPdfLoading("semanal");
                        setShowPdfMenu(false);
                        try {
                          const range = getWeekRange(selectedDate);
                          const histData = await utils.production.getHistory.fetch({ dataInicio: range.start, dataFim: range.end });
                          // Fetch monthly averages for the same month
                          const monthlyAvg = await utils.production.getMonthlyAverage.fetch({ data: range.start });
                          await generateWeeklyPdf(sectors as any, histData as any, range.start, range.end, monthlyAvg as any);
                          toast.success("PDF Semanal gerado!");
                        } catch (err: any) { toast.error("Erro ao gerar PDF: " + err.message); }
                        finally { setPdfLoading(null); }
                      }}
                      disabled={pdfLoading !== null}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 flex items-center gap-2 disabled:opacity-50"
                    >
                      {pdfLoading === "semanal" ? <Loader2 className="w-4 h-4 animate-spin text-blue-600" /> : <BarChart3 className="w-4 h-4 text-blue-600" />}
                      <div>
                        <div className="font-medium text-slate-700">PDF Semanal</div>
                        <div className="text-[10px] text-slate-400">Fechamento da semana</div>
                      </div>
                    </button>
                    <button
                      onClick={async () => {
                        if (!sectors) return;
                        setPdfLoading("mensal");
                        setShowPdfMenu(false);
                        try {
                          const month = selectedDate.slice(0, 7);
                          const [y, m] = month.split("-");
                          const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
                          const histData = await utils.production.getHistory.fetch({ dataInicio: `${month}-01`, dataFim: `${month}-${String(lastDay).padStart(2, "0")}` });
                          await generateMonthlyPdf(sectors as any, histData as any, month);
                          toast.success("PDF Mensal gerado!");
                        } catch (err: any) { toast.error("Erro ao gerar PDF: " + err.message); }
                        finally { setPdfLoading(null); }
                      }}
                      disabled={pdfLoading !== null}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 flex items-center gap-2 disabled:opacity-50"
                    >
                      {pdfLoading === "mensal" ? <Loader2 className="w-4 h-4 animate-spin text-purple-600" /> : <FileDown className="w-4 h-4 text-purple-600" />}
                      <div>
                        <div className="font-medium text-slate-700">PDF Mensal</div>
                        <div className="text-[10px] text-slate-400">Fechamento do mês</div>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Date selector */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-6 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-3 sm:px-4 py-3 shadow-sm">
          <Calendar className="w-5 h-5 text-teal-600 flex-shrink-0" />
          <button onClick={() => changeDate(-1)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors flex-shrink-0">
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <input type="date" value={selectedDate} onChange={(e) => { setSelectedDate(e.target.value); resetEditState(); }} className="text-sm font-medium text-slate-700 border border-slate-200 rounded-lg px-2 sm:px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500 min-w-0" />
            <span className="text-sm text-slate-500 font-medium whitespace-nowrap">
              {dayOfWeek}
              {isToday && <span className="ml-1.5 text-xs bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full font-semibold">Hoje</span>}
            </span>
          </div>
          <button onClick={() => changeDate(1)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors flex-shrink-0">
            <ArrowRight className="w-4 h-4 text-slate-600" />
          </button>
          <button onClick={() => { setSelectedDate(getTodayBR()); resetEditState(); }} className="ml-auto text-xs text-teal-600 hover:text-teal-700 font-medium px-2 py-1 rounded hover:bg-teal-50 transition-colors whitespace-nowrap">
            Ir para Hoje
          </button>
          {viewMode === "lancamento" && canEdit && !isFutureDate && (
            <button
              onClick={handleSaveAllDay}
              disabled={isSavingAll || !hasAnyChanges}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                hasAnyChanges && !isSavingAll
                  ? "bg-teal-600 text-white hover:bg-teal-700 shadow-sm"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
              }`}
            >
              {isSavingAll ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
              ) : (
                <><Save className="w-4 h-4" /> Salvar Dia{hasAnyChanges ? " *" : ""}</>
              )}
            </button>
          )}
        </div>

        {/* Banner de data futura - bloqueia edição */}
        {isFutureDate && viewMode === "lancamento" && (
          <div className="flex items-center gap-2 mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            <p className="text-sm text-red-600">
              <span className="font-semibold">Data futura selecionada!</span> Não é possível registrar produção para datas futuras. Selecione o dia de hoje ou uma data anterior.
            </p>
          </div>
        )}

        {/* Banner de alerta: data diferente de hoje (passada) */}
        {!isToday && !isFutureDate && canEdit && viewMode === "lancamento" && (
          <div className="flex items-center gap-2 mb-4 bg-orange-50 border-2 border-orange-300 rounded-xl px-4 py-3 animate-pulse">
            <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-orange-800 font-bold">
                Atenção Maria! Você está preenchendo produção para {new Date(selectedDate + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}, que NÃO é o dia de hoje.
              </p>
              <p className="text-xs text-orange-600 mt-0.5">Confira se é isso mesmo!</p>
            </div>
            <button
              onClick={() => { setSelectedDate(getTodayBR()); resetEditState(); }}
              className="text-xs bg-orange-600 text-white px-3 py-1.5 rounded-lg hover:bg-orange-700 transition-colors font-medium whitespace-nowrap"
            >
              Ir para Hoje
            </button>
          </div>
        )}

        {/* Banner somente leitura para operadores que não são Maria */}
        {!canEdit && !isFutureDate && viewMode === "lancamento" && (
          <div className="flex items-center gap-2 mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
            <Eye className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-700">
              <span className="font-semibold">{operator?.name}</span> — Modo visualização. Apenas Maria pode registrar produção.
            </p>
          </div>
        )}

        {viewMode === "lancamento" ? (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-3 mb-6">
              {sectors?.map(sector => {
                const total = getSectorTotal(sector.id);
                const Icon = getSectorIcon(sector.ordem);
                const avgData = monthlyAverage?.find(a => a.sectorId === sector.id);
                // Totals always show integers (0 decimals) except m³
                const decimals = sector.unidadeMedida === "m³" ? 3 : 0;
                // Averages can show 1 decimal for dual-unit sectors
                const avgDecimals = sector.unidadeMedida === "m³" ? 3 : isDualUnitSector(sector.ordem) ? 1 : 0;
                return (
                  <div key={sector.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => toggleSector(sector.id)}>
                    <div className="flex items-start gap-1.5 mb-1">
                      <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Icon className="w-3.5 h-3.5" style={{ color: sector.cor || "#6b7280" }} />
                      </div>
                      <span className="text-[10px] font-semibold text-slate-500 uppercase leading-tight break-words hyphens-auto" style={{ wordBreak: 'break-word' }}>{sector.nome}</span>
                    </div>
                    <div className="text-lg font-bold text-slate-800 tabular-nums">{fmtNum(total, decimals)}</div>
                    <div className="text-[10px] text-slate-400">{isDualUnitSector(sector.ordem) ? "sacos produzidos" : sector.unidadeLabel}</div>
                    {avgData && avgData.mediaDiaria > 0 && (
                      <div className="mt-1.5 pt-1.5 border-t border-slate-100">
                        <div className="text-[10px] text-slate-500 flex items-center gap-1">
                          <TrendingUp className="w-3 h-3 text-teal-500" />
                          <span>média: <span className="font-bold text-teal-600">{fmtNum(avgData.mediaDiaria, avgDecimals)}</span></span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Sector cards */}
            <div className="space-y-3">
              {sectors?.map(sector => {
                const isExpanded = expandedSectors.has(sector.id);
                const total = getSectorTotal(sector.id);
                const Icon = getSectorIcon(sector.ordem);
                const hasMachines = sector.machines && sector.machines.length > 0;
                const decimals = sector.unidadeMedida === "m³" ? 3 : 0;
                const expandable = hasExpandableFeatures(sector.ordem);
                const sectorAvg = monthlyAverage?.find(a => a.sectorId === sector.id);

                return (
                  <div key={sector.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                    <div
                      onClick={() => toggleSector(sector.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer"
                      role="button" tabIndex={0}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggleSector(sector.id); }}
                    >
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: (sector.cor || "#6b7280") + "15" }}>
                        <Icon className="w-5 h-5" style={{ color: sector.cor || "#6b7280" }} />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-800">{sector.ordem}. {sector.nome}</span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {hasMachines ? `${sector.quantidadeEquipamentos} ${sector.tipoEquipamento === "mesa" ? "mesas" : "máquinas"}` : "Sem equipamento"}
                          {" · "}{sector.unidadeLabel}
                          {sectorAvg && sectorAvg.mediaDiaria > 0 && (
                            <span className="ml-1 text-teal-600 font-semibold">· média: {fmtNum(sectorAvg.mediaDiaria, isDualUnitSector(sector.ordem) ? 1 : decimals)}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right mr-3">
                        <div className="text-lg font-bold tabular-nums" style={{ color: sector.cor || "#6b7280" }}>{fmtNum(total, decimals)}</div>
                        <div className="text-[10px] text-slate-400">{isDualUnitSector(sector.ordem) ? "saco" : sector.unidadeMedida}</div>
                      </div>
                      {isExpanded ? <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" /> : <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />}
                    </div>

                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/50">
                        {isPirografar(sector.ordem) && hasMachines ? (
                          <PirografiaSector
                            sector={sector}
                            selectedDate={selectedDate}
                            canEdit={canEdit && !isFutureDate}
                            operatorName={operator?.name || "Desconhecido"}
                          />
                        ) : hasMachines ? (
                          <div className="divide-y divide-slate-100 dark:divide-slate-700">
                            {sector.machines.map((machine: any) => {
                              if (expandable) {
                                return (
                                  <ExpandableMachineRow
                                    key={machine.id}
                                    sector={sector}
                                    machine={machine}
                                    machineExpanded={expandedMachines.has(`${sector.id}-${machine.id}`)}
                                    commentIsOpen={commentOpen.has(`${sector.id}-${machine.id}`)}
                                    isSaving={savingKeys.has(`${sector.id}-${machine.id}`)}
                                    currentStatus={getStatusValue(sector.id, machine.id)}
                                    currentComment={getCommentValue(sector.id, machine.id)}
                                    liveTotal={getMachineLiveTotal(sector.id, machine.id, sector.ordem, machine.ordem)}
                                    changed={hasChanges(sector.id, machine.id)}
                                    currentVal={getEditValue(sector.id, machine.id)}
                                    getVariantValue={(v) => getVariantEditValue(sector.id, machine.id, v)}
                                    onToggleMachine={() => toggleMachine(sector.id, machine.id)}
                                    onSetValue={(val) => setEditValue(sector.id, machine.id, val)}
                                    onToggleComment={() => toggleComment(`${sector.id}-${machine.id}`)}
                                    onToggleStatus={(v) => toggleStatusValue(sector.id, machine.id, v)}
                                    selectedStatuses={getSelectedStatuses(sector.id, machine.id)}
                                    onSetVariantValue={(v, val) => setVariantEditValue(`${sector.id}-${machine.id}-${v}`, val)}
                                    onSetComment={(v) => setCommentValue(sector.id, machine.id, v)}
                                    onSave={() => handleVariantSave(sector.id, machine.id, sector.ordem, machine.ordem)}
                                    canEdit={canEdit && !isFutureDate}
                                    onShowConversion={() => setShowConversionModal(true)}
                                  />
                                );
                              }
                              // Simple machine row
                              return (
                                <SimpleMachineRow
                                  key={machine.id}
                                  sector={sector}
                                  machine={machine}
                                  commentIsOpen={commentOpen.has(`${sector.id}-${machine.id}`)}
                                  isSaving={savingKeys.has(`${sector.id}-${machine.id}`)}
                                  currentVal={getEditValue(sector.id, machine.id)}
                                  currentComment={getCommentValue(sector.id, machine.id)}
                                  changed={hasChanges(sector.id, machine.id)}
                                  onToggleComment={() => toggleComment(`${sector.id}-${machine.id}`)}
                                  onSetValue={(v) => setEditValue(sector.id, machine.id, v)}
                                  onSetComment={(v) => setCommentValue(sector.id, machine.id, v)}
                                  onSave={() => handleSimpleSave(sector.id, machine.id)}
                                  canEdit={canEdit && !isFutureDate}
                                />
                              );
                            })}
                          </div>
                        ) : (
                          <EmbalagemSector
                            sector={sector}
                            selectedDate={selectedDate}
                            entries={entries || []}
                            savingKeys={savingKeys}
                            onSaveProduct={handleEmbalagemSave}
                            canEdit={canEdit && !isFutureDate}
                          />
                        )}

                        {/* Annotation cards for Seleção Automática (setor 4) */}
                        {sector.ordem === 4 && (
                          <AnnotationCards
                            selectedDate={selectedDate}
                            sectorId={sector.id}
                            canEdit={canEdit && !isFutureDate}
                            operatorName={operator?.name || "Desconhecido"}
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>


          </>
        ) : viewMode === "historico" ? (
          <HistoryView sectors={sectors || []} weekRange={weekRange} weeklySummary={weeklySummary || []} selectedDate={selectedDate} />
        ) : viewMode === "graficos" ? (
          <ProductionCharts key={`charts-${viewMode}`} selectedDate={selectedDate} sectors={(sectors || []) as any} />
        ) : (
          <PirografiaHistoryView />
        )}
      </div>

      {/* ─── Modal Neon: Fatores de Conversão Caixa → Saco ─── */}
      {showConversionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowConversionModal(false)}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          {/* Card */}
          <div
            className="relative w-full max-w-lg rounded-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "linear-gradient(135deg, #0f0c29 0%, #1a1145 40%, #24243e 100%)",
              boxShadow: "0 0 40px rgba(139, 92, 246, 0.3), 0 0 80px rgba(99, 102, 241, 0.15), inset 0 1px 0 rgba(255,255,255,0.1)",
            }}
          >
            {/* Glow border effect */}
            <div className="absolute inset-0 rounded-2xl" style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.4), rgba(59,130,246,0.2), rgba(236,72,153,0.3))", padding: "1px", mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)", maskComposite: "exclude", WebkitMaskComposite: "xor", pointerEvents: "none" }} />

            {/* Header */}
            <div className="px-6 pt-6 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #8b5cf6, #6366f1)", boxShadow: "0 0 20px rgba(139,92,246,0.5)" }}>
                    <Eye className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Fatores de Conversão</h3>
                    <p className="text-xs text-violet-300/80">Caixa → Saco | Setores 2, 3 e 4</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowConversionModal(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Explicação */}
            <div className="px-6 pb-4">
              <div className="rounded-xl p-3" style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)" }}>
                <p className="text-xs text-violet-200/90 leading-relaxed">
                  Quando a produção é registrada em <span className="font-bold text-orange-300">caixas pequenas</span> ou <span className="font-bold text-amber-300">caixas grandes</span>, o sistema converte automaticamente para <span className="font-bold text-blue-300">sacos</span> usando os fatores abaixo.
                  O total do setor é sempre exibido em sacos.
                </p>
                <div className="mt-2 px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.05)" }}>
                  <p className="text-[11px] text-violet-300 font-mono leading-relaxed">
                    Total (sacos) = <span className="text-blue-300">Sacos</span> + (<span className="text-orange-300">Cx Peq</span> × <span className="text-emerald-300">Fator Peq</span>) + (<span className="text-amber-300">Cx Grande</span> × <span className="text-emerald-300">Fator Grande</span>)
                  </p>
                </div>
              </div>
            </div>

            {/* Tabela de fatores */}
            <div className="px-6 pb-6">
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(139,92,246,0.2)" }}>
                <div className="grid grid-cols-[1fr_80px_80px] text-[10px] font-bold uppercase tracking-wider" style={{ background: "rgba(139,92,246,0.15)" }}>
                  <div className="px-4 py-2.5 text-violet-300">Medida</div>
                  <div className="px-4 py-2.5 text-violet-300 text-center">Cx Peq</div>
                  <div className="px-4 py-2.5 text-violet-300 text-center">Cx Grande</div>
                </div>
                {/* Medidas em ordem crescente */}
                {[
                  "3.5x200mm", "3.5x250mm", "3.5x350mm",
                  "3.8x150mm", "3.8x180mm", "3.8x200mm", "3.8x218mm", "3.8x220mm", "3.8x250mm", "3.8x350mm",
                ].filter(key => CONVERSION_FACTORS[key]).map((key: string, i: number) => {
                  const opt = VARETEIRA_MEASURE_OPTIONS.find(o => o.value === key) || SELETORA_TOCO_MEASURE_OPTIONS.find(o => o.value === key) || SELECAO_AUTO_MEASURE_OPTIONS.find(o => o.value === key) || FLOWPACK_MEASURE_OPTIONS.find(o => o.value === key) || { value: key, label: key.replace(".", ","), bgClass: "bg-slate-50", textClass: "text-slate-800", borderClass: "border-slate-300" };
                  const factors = CONVERSION_FACTORS[key];
                  return (
                    <div
                      key={key}
                      className="grid grid-cols-[1fr_80px_80px] items-center"
                      style={{ background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.05)" }}
                    >
                      <div className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold ${opt.bgClass} ${opt.textClass} ${opt.borderClass}`} style={{ border: "1px solid" }}>
                          <Ruler className="w-3 h-3" />
                          {opt.label}
                        </span>
                      </div>
                      <div className="px-4 py-2.5 text-center">
                        {factors.cxp > 0 ? (
                          <span className="text-base font-bold" style={{ color: "#fb923c", textShadow: "0 0 8px rgba(251,146,60,0.4)" }}>
                            {factors.cxp}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">—</span>
                        )}
                      </div>
                      <div className="px-4 py-2.5 text-center">
                        {factors.cxg > 0 ? (
                          <span className="text-base font-bold" style={{ color: "#fbbf24", textShadow: "0 0 8px rgba(251,191,36,0.4)" }}>
                            {factors.cxg}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">—</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 px-2">
                <p className="text-[10px] text-violet-300/70 leading-relaxed">
                  <span className="font-semibold text-orange-300">Cx Peq</span> = fator de conversão da caixa pequena para sacos &nbsp;|&nbsp;
                  <span className="font-semibold text-amber-300">Cx Grande</span> = fator de conversão da caixa grande para sacos
                </p>
                <p className="text-[10px] text-violet-400/50 mt-1">
                  Ex: 10 cx peq de 3,8x180mm = 10 × 0,5 = <span className="text-blue-300 font-semibold">5 sacos</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   EXPANDABLE MACHINE ROW (Multilamina & Vareteira)
   Shows status selector + ALL variant fields always visible
   No toggle/selection needed - just fill in the values
   ═══════════════════════════════════════════════════════════ */
interface ExpandableMachineRowProps {
  sector: any;
  machine: any;
  machineExpanded: boolean;
  commentIsOpen: boolean;
  isSaving: boolean;
  currentStatus: string;
  currentComment: string;
  liveTotal: number;
  changed: boolean;
  currentVal?: string;
  getVariantValue: (variant: string) => string;
  onToggleMachine: () => void;
  onToggleComment: () => void;
  onToggleStatus: (v: string) => void;
  selectedStatuses: Set<string>;
  onSetValue?: (value: string) => void;
  onSetVariantValue: (variant: string, value: string) => void;
  onSetComment: (v: string) => void;
  onSave: () => void;
  canEdit?: boolean;
  onShowConversion?: () => void;
}

function ExpandableMachineRow({
  sector, machine, machineExpanded, commentIsOpen, isSaving,
  currentStatus, currentComment, liveTotal, changed,
  currentVal, getVariantValue, onToggleMachine, onToggleComment, onToggleStatus,
  selectedStatuses, onSetValue, onSetVariantValue, onSetComment, onSave,
  canEdit = true, onShowConversion,
}: ExpandableMachineRowProps) {
  const hasComment = currentComment.trim().length > 0;
  const variantOptions = getVariantOptions(sector.ordem, machine.ordem);
  const variantLabel = getVariantLabel(sector.ordem);
  const VariantIcon = getVariantIcon(sector.ordem);
  // Individual machine values stay fractional as entered (1 decimal)
  // Only sector totals and history/report use integers
  const decimals = sector.unidadeMedida === "m³" ? 3 : 1;

  // Build per-variant display for badges (only show variants with value > 0)
  const dualUnit = isDualUnitSector(sector.ordem);
  const fibraOptions = isFlowPack(sector.ordem) ? FLOWPACK_FIBRA_OPTIONS : [];
  const allDisplayOptions = [...variantOptions, ...fibraOptions];
  const variantDisplay: { label: string; value: number; unit: string; bgClass: string; textClass: string; borderClass: string }[] = [];
  for (const opt of allDisplayOptions) {
    if (dualUnit) {
      const sacoVal = getVariantValue(`${opt.value}_saco`);
      const cxpVal = getVariantValue(`${opt.value}_cxp`);
      const cxgVal = getVariantValue(`${opt.value}_cxg`);
      const sacoNum = sacoVal !== "" ? parseFloat(sacoVal.replace(",", ".")) : 0;
      const cxpNum = cxpVal !== "" ? parseFloat(cxpVal.replace(",", ".")) : 0;
      const cxgNum = cxgVal !== "" ? parseFloat(cxgVal.replace(",", ".")) : 0;
      const totalSacos = (isNaN(sacoNum) ? 0 : sacoNum) + convertCxpToSaco(opt.value, isNaN(cxpNum) ? 0 : cxpNum) + convertCxgToSaco(opt.value, isNaN(cxgNum) ? 0 : cxgNum);
      if (totalSacos > 0) {
        variantDisplay.push({ label: opt.label, value: totalSacos, unit: "saco", bgClass: opt.bgClass, textClass: opt.textClass, borderClass: opt.borderClass });
      }
    } else {
      const val = getVariantValue(opt.value);
      const num = val !== "" ? parseFloat(val.replace(",", ".")) : 0;
      if (!isNaN(num) && num > 0) {
        variantDisplay.push({ label: opt.label, value: num, unit: sector.unidadeMedida, bgClass: opt.bgClass, textClass: opt.textClass, borderClass: opt.borderClass });
      }
    }
  }

  // Build status display badges
  const statusDisplay = MACHINE_STATUS_OPTIONS.filter(opt => selectedStatuses.has(opt.value));

  return (
    <div className="bg-white/50">
      {/* Machine header */}
      <div className="flex items-center gap-3 px-4 py-2.5">
        <div
          className="w-8 h-8 rounded-md bg-white border border-slate-200 flex items-center justify-center shrink-0 cursor-pointer hover:bg-slate-50 transition-colors"
          onClick={onToggleMachine}
        >
          {machineExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
        </div>

        <span className="text-sm text-slate-600 font-medium flex-1 min-w-0 truncate cursor-pointer" onClick={onToggleMachine}>
          {machine.nome}
        </span>

        {/* Status badges (only selected) */}
        {statusDisplay.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {statusDisplay.map(opt => (
              <div key={opt.value} className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${opt.bgClass} ${opt.textClass} ${opt.borderClass}`}>
                <opt.icon className="w-3 h-3" />
                <span className="hidden sm:inline">{opt.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Variant badges with quantities (only non-zero) */}
        {variantDisplay.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {variantDisplay.map(vd => (
              <span key={vd.label} className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold border ${vd.bgClass} ${vd.textClass} ${vd.borderClass}`}>
                {vd.label}: {fmtNum(vd.value, decimals)}
              </span>
            ))}
          </div>
        )}

        {/* Comment button */}
        <button onClick={onToggleComment} className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors ${hasComment || commentIsOpen ? "bg-blue-50 text-blue-600 border border-blue-200" : "bg-white text-slate-400 border border-slate-200 hover:bg-slate-50"}`} title="Comentário">
          <MessageSquare className="w-3.5 h-3.5" />
        </button>

        {/* Total display */}
        <div className="text-right shrink-0 w-20">
          <div className="text-sm font-bold tabular-nums text-slate-700">{fmtNum(liveTotal, dualUnit ? 1 : decimals)}</div>
          <div className="text-[9px] text-slate-400">{dualUnit ? "saco" : sector.unidadeMedida}</div>
        </div>


      </div>

      {/* Comment box */}
      {commentIsOpen && (
        <div className="px-4 pb-2 pl-16">
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-2">
            <textarea value={currentComment} onChange={(e) => onSetComment(e.target.value)} placeholder="Adicionar comentário ou observação..." rows={2} className="w-full text-xs text-slate-600 border-0 bg-transparent resize-none focus:outline-none placeholder:text-slate-400" disabled={!canEdit} />
            {canEdit && (
              <div className="flex justify-end mt-1.5">
                <button
                  onClick={onSave}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white text-xs font-medium rounded-lg hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Enviar Observação
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Expanded panel */}
      {machineExpanded && (
        <div className="px-4 pb-3 pl-16 space-y-2">
          {/* Status selector - MULTI-SELECT: pode marcar vários */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
            <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Status da Máquina <span className="text-slate-400 font-normal">(pode marcar vários)</span></p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {MACHINE_STATUS_OPTIONS.map(opt => {
                const isSelected = selectedStatuses.has(opt.value);
                const OptIcon = opt.icon;
                return (
                  <button key={opt.value} onClick={() => canEdit && onToggleStatus(opt.value)}
                    disabled={!canEdit}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${!canEdit ? 'opacity-60 cursor-not-allowed' : ''} ${isSelected ? `${opt.bgClass} ${opt.textClass} ${opt.borderClass} ring-2 ring-offset-1` : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"}`}
                    style={isSelected ? { '--tw-ring-color': opt.color } as React.CSSProperties : {}}
                  >
                    <OptIcon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Variant inputs or simple production input */}
          {variantOptions.length > 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
            <div className="flex items-center gap-2 mb-3">
              <VariantIcon className="w-3.5 h-3.5 text-slate-500" />
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Produção por {variantLabel}</p>
              {isDualUnitSector(sector.ordem) && (
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    onClick={(e) => { e.stopPropagation(); onShowConversion?.(); }}
                    className="w-7 h-7 rounded-full flex items-center justify-center bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-300/50 hover:shadow-violet-400/70 hover:scale-110 transition-all duration-200"
                    title="Ver fatores de conversão"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs font-semibold text-violet-600 whitespace-nowrap">(Fator de Conversão)</span>
                </div>
              )}
            </div>
            {dualUnit ? (
              /* ─── Triple unit layout: cx peq + cx grande + saco + total por medida ─── */
              <div className="space-y-2">
                {/* Header labels — full width, professional */}
                <div className="grid grid-cols-[minmax(120px,1.5fr)_1fr_1fr_1fr_minmax(80px,0.8fr)] gap-2 items-end px-2 pb-2 border-b border-slate-200">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Medida</span>
                  <div className="flex flex-col items-center">
                    <span className="text-[11px] font-bold text-orange-600 uppercase tracking-wider leading-tight text-center">Caixa</span>
                    <span className="text-[11px] font-bold text-orange-600 uppercase tracking-wider leading-tight text-center">Pequena</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider leading-tight text-center">Caixa</span>
                    <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider leading-tight text-center">Grande</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[12px] font-bold text-blue-700 uppercase tracking-wider text-center">Saco</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[12px] font-bold text-emerald-700 uppercase tracking-wider text-center">Total</span>
                  </div>
                </div>
                {variantOptions.map(opt => {
                  const cxpVal = getVariantValue(`${opt.value}_cxp`);
                  const cxgVal = getVariantValue(`${opt.value}_cxg`);
                  const sacoVal = getVariantValue(`${opt.value}_saco`);
                  const cxpNum = cxpVal !== "" ? parseFloat(cxpVal.replace(",", ".")) : 0;
                  const cxgNum = cxgVal !== "" ? parseFloat(cxgVal.replace(",", ".")) : 0;
                  const sacoNum = sacoVal !== "" ? parseFloat(sacoVal.replace(",", ".")) : 0;
                  const cxpConverted = !isNaN(cxpNum) && cxpNum > 0 ? convertCxpToSaco(opt.value, cxpNum) : 0;
                  const cxgConverted = !isNaN(cxgNum) && cxgNum > 0 ? convertCxgToSaco(opt.value, cxgNum) : 0;
                  const lineTotal = (!isNaN(sacoNum) ? sacoNum : 0) + cxpConverted + cxgConverted;
                  return (
                    <div key={opt.value} className="grid grid-cols-[minmax(120px,1.5fr)_1fr_1fr_1fr_minmax(80px,0.8fr)] gap-2 items-center px-2 py-1.5 rounded-lg hover:bg-slate-50/60 transition-colors">
                      {/* Measure badge — centered in card */}
                      <div className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border-2 text-[14px] font-bold shadow-sm ${opt.bgClass} ${opt.textClass} ${opt.borderClass}`}>
                        <VariantIcon className="w-4 h-4 shrink-0" />
                        <span>{opt.label}</span>
                      </div>
                      {/* Caixa Pequena */}
                      <div className="flex flex-col items-center gap-0.5">
                        <input
                          type="text" inputMode="decimal" value={cxpVal}
                          onChange={(e) => canEdit && onSetVariantValue(`${opt.value}_cxp`, e.target.value)}
                          placeholder="0" disabled={!canEdit}
                          className={`w-full text-center text-base font-bold border-2 border-orange-200 rounded-xl px-2 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 tabular-nums ${!canEdit ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : 'bg-orange-50/40 text-slate-900'}`}
                        />
                        {!isNaN(cxpNum) && cxpNum > 0 && (
                          <span className="text-[10px] text-orange-500 font-semibold">{`\u2248 ${Math.round(cxpConverted)} sacos`}</span>
                        )}
                      </div>
                      {/* Caixa Grande */}
                      <div className="flex flex-col items-center gap-0.5">
                        <input
                          type="text" inputMode="decimal" value={cxgVal}
                          onChange={(e) => canEdit && onSetVariantValue(`${opt.value}_cxg`, e.target.value)}
                          placeholder="0" disabled={!canEdit}
                          className={`w-full text-center text-base font-bold border-2 border-amber-200 rounded-xl px-2 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 tabular-nums ${!canEdit ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : 'bg-amber-50/40 text-slate-900'}`}
                        />
                        {!isNaN(cxgNum) && cxgNum > 0 && (
                          <span className="text-[10px] text-amber-600 font-semibold">{`\u2248 ${Math.round(cxgConverted)} sacos`}</span>
                        )}
                      </div>
                      {/* Saco */}
                      <div className="flex flex-col items-center">
                        <input
                          type="text" inputMode="decimal" value={sacoVal}
                          onChange={(e) => canEdit && onSetVariantValue(`${opt.value}_saco`, e.target.value)}
                          placeholder="0" disabled={!canEdit}
                          className={`w-full text-center text-base font-bold border-2 border-blue-200 rounded-xl px-2 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 tabular-nums ${!canEdit ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : 'bg-blue-50/40 text-slate-900'}`}
                        />
                      </div>
                      {/* Total da medida em sacos */}
                      <div className="flex items-center justify-center gap-1.5 bg-emerald-50 rounded-xl py-2.5 px-3 border-2 border-emerald-200 shadow-sm">
                        <span className={`text-base font-extrabold tabular-nums ${lineTotal > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                          {lineTotal > 0 ? Math.round(lineTotal).toLocaleString('pt-BR') : '0'}
                        </span>
                        <span className={`text-[11px] font-bold ${lineTotal > 0 ? 'text-emerald-500' : 'text-slate-400'}`}>sacos</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* ─── Single unit layout (original) ─── */
              <div className={`grid gap-2 ${variantOptions.length <= 3 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"}`}>
                {variantOptions.map(opt => {
                  const val = getVariantValue(opt.value);
                  return (
                    <div key={opt.value} className="flex items-center gap-2">
                      <div className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border-2 text-[13px] font-bold shadow-sm ${opt.bgClass} ${opt.textClass} ${opt.borderClass}`} style={{ minWidth: variantOptions.length <= 3 ? "120px" : "100px" }}>
                        <VariantIcon className="w-3.5 h-3.5 shrink-0" />
                        <span>{opt.label}</span>
                      </div>
                      <input
                        type="text" inputMode="decimal" value={val}
                        onChange={(e) => canEdit && onSetVariantValue(opt.value, e.target.value)}
                        placeholder="0" disabled={!canEdit}
                        className={`flex-1 min-w-0 w-20 text-right text-sm font-medium border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 tabular-nums ${!canEdit ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : 'bg-white'}`}
                      />
                      <span className="text-[10px] text-slate-400 shrink-0 w-8">{sector.unidadeMedida}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ─── Flow Pack: Seção de Fibra (abaixo da Madeira) ─── */}
            {isFlowPack(sector.ordem) && (
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Flame className="w-3.5 h-3.5 text-violet-500" />
                  <p className="text-xs font-semibold text-violet-500 uppercase tracking-wider">Produção por Medida de Fibra</p>
                </div>
                <div className={`grid gap-2 grid-cols-1 sm:grid-cols-2`}>
                  {FLOWPACK_FIBRA_OPTIONS.map(opt => {
                    const val = getVariantValue(opt.value);
                    return (
                      <div key={opt.value} className="flex items-center gap-2">
                        <div className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border-2 text-[13px] font-bold shadow-sm ${opt.bgClass} ${opt.textClass} ${opt.borderClass}`} style={{ minWidth: "120px" }}>
                          <Flame className="w-3.5 h-3.5 shrink-0" />
                          <span>{opt.label}</span>
                        </div>
                        <input
                          type="text" inputMode="decimal" value={val}
                          onChange={(e) => canEdit && onSetVariantValue(opt.value, e.target.value)}
                          placeholder="0" disabled={!canEdit}
                          className={`flex-1 min-w-0 w-20 text-right text-sm font-medium border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 tabular-nums ${!canEdit ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : 'bg-white'}`}
                        />
                        <span className="text-[10px] text-slate-400 shrink-0 w-8">{sector.unidadeMedida}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {canEdit && (
              <div className="flex justify-end mt-3">
                <button onClick={onSave} disabled={isSaving || !changed}
                  className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors shadow-sm ${changed ? 'bg-teal-600 text-white hover:bg-teal-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'} disabled:opacity-40 disabled:cursor-not-allowed`}>
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : changed ? 'OK' : 'Salvar'}
                </button>
              </div>
            )}
          </div>
          ) : (
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
            <div className="flex items-center gap-2 mb-3">
              <Package className="w-3.5 h-3.5 text-slate-500" />
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Produção</p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="text"
                inputMode="decimal"
                value={currentVal || ""}
                onChange={(e) => canEdit && onSetValue?.(e.target.value)}
                placeholder="0"
                disabled={!canEdit}
                className={`flex-1 min-w-0 w-32 text-right text-sm font-medium border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 tabular-nums ${!canEdit ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : 'bg-white'}`}
              />
              <span className="text-xs text-slate-400 shrink-0">{sector.unidadeMedida}</span>
              {canEdit && changed && (
                <button onClick={onSave} disabled={isSaving}
                  className="px-3 py-1.5 bg-teal-600 text-white text-xs font-bold rounded-lg hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm">
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'OK'}
                </button>
              )}
            </div>
          </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SIMPLE MACHINE ROW (non-expandable sectors)
   ═══════════════════════════════════════════════════════════ */
interface SimpleMachineRowProps {
  sector: any;
  machine: any;
  commentIsOpen: boolean;
  isSaving: boolean;
  currentVal: string;
  currentComment: string;
  changed: boolean;
  onToggleComment: () => void;
  onSetValue: (v: string) => void;
  onSetComment: (v: string) => void;
  onSave: () => void;
  canEdit?: boolean;
}

function SimpleMachineRow({ sector, machine, commentIsOpen, isSaving, currentVal, currentComment, changed, onToggleComment, onSetValue, onSetComment, onSave, canEdit = true }: SimpleMachineRowProps) {
  const hasComment = currentComment.trim().length > 0;
  return (
    <div className="bg-white/50">
      <div className="flex items-center gap-3 px-4 py-2.5">
        <div className="w-8 h-8 rounded-md bg-white border border-slate-200 flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-slate-500">{machine.ordem}</span>
        </div>
        <span className="text-sm text-slate-600 font-medium flex-1 min-w-0 truncate">{machine.nome}</span>
        <button onClick={onToggleComment} className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors ${hasComment || commentIsOpen ? "bg-blue-50 text-blue-600 border border-blue-200" : "bg-white text-slate-400 border border-slate-200 hover:bg-slate-50"}`} title="Comentário">
          <MessageSquare className="w-3.5 h-3.5" />
        </button>
        <div className="flex items-center gap-2 shrink-0">
          <input type="text" inputMode="decimal" value={currentVal} onChange={(e) => canEdit && onSetValue(e.target.value)} placeholder="0" disabled={!canEdit} className={`w-24 text-right text-sm font-medium border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 tabular-nums ${!canEdit ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : 'bg-white'}`} />
          <span className="text-xs text-slate-400 w-6">{sector.unidadeMedida}</span>
          {canEdit && changed && (
            <button onClick={onSave} disabled={isSaving}
              className="px-2.5 py-1.5 bg-teal-600 text-white text-xs font-bold rounded-lg hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm">
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'OK'}
            </button>
          )}
        </div>
      </div>
      {commentIsOpen && (
        <div className="px-4 pb-2 pl-16">
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-2">
            <textarea value={currentComment} onChange={(e) => onSetComment(e.target.value)} placeholder="Adicionar comentário ou observação..." rows={2} className="w-full text-xs text-slate-600 border-0 bg-transparent resize-none focus:outline-none placeholder:text-slate-400" disabled={!canEdit} />
            {canEdit && (
              <div className="flex justify-end mt-1.5">
                <button
                  onClick={onSave}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white text-xs font-medium rounded-lg hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Enviar Observação
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   EMBALAGEM SECTOR (setor 8) - Busca de produtos acabados
   ═══════════════════════════════════════════════════════════ */
interface EmbalagemSectorProps {
  sector: any;
  selectedDate: string;
  entries: any[];
  savingKeys: Set<string>;
  onSaveProduct: (sectorId: number, codigoItem: string, quantidade: number, descricao: string) => void;
  canEdit?: boolean;
}

function EmbalagemSector({ sector, selectedDate, entries, savingKeys, onSaveProduct, canEdit = true }: EmbalagemSectorProps) {
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<{ codigoItem: string; descricaoItem: string; unidadeMedida: string } | null>(null);
  const [qty, setQty] = useState("");
  const [editingCard, setEditingCard] = useState<string | null>(null);
  const [editCardQty, setEditCardQty] = useState("");
  const [categoria, setCategoria] = useState<"madeira" | "bambu">("madeira");

  const { data: products, isLoading } = trpc.production.getFinishedProducts.useQuery({ categoria });

  // Entries for this sector on the selected date
  const sectorEntries = useMemo(() => {
    if (!entries) return [];
    return entries.filter((e: any) => e.sectorId === sector.id && e.data === selectedDate && e.tipoMadeira);
  }, [entries, sector.id, selectedDate]);

  // Products already registered today
  const registeredMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of sectorEntries) {
      if (e.tipoMadeira) map[e.tipoMadeira] = Number(e.quantidade);
    }
    return map;
  }, [sectorEntries]);

  // Registered products with their details (for cards)
  const registeredProducts = useMemo(() => {
    if (!products) return [];
    return Object.entries(registeredMap)
      .filter(([_, qty]) => qty > 0)
      .map(([codigo, qty]) => {
        const prod = products.find((p: any) => p.codigoItem === codigo);
        return {
          codigoItem: codigo,
          descricaoItem: prod?.descricaoItem || codigo,
          unidadeMedida: prod?.unidadeMedida || "cx",
          quantidade: qty,
        };
      })
      .sort((a, b) => a.descricaoItem.localeCompare(b.descricaoItem));
  }, [registeredMap, products]);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    const q = search.toLowerCase().trim();
    const filtered = q
      ? products.filter((p: any) =>
          p.descricaoItem.toLowerCase().includes(q) || p.codigoItem.toLowerCase().includes(q)
        )
      : products;
    // Exclude already registered products from the search list
    return filtered.filter((p: any) => !registeredMap[p.codigoItem] || registeredMap[p.codigoItem] === 0);
  }, [products, search, registeredMap]);

  const totalEmbalado = useMemo(() => {
    return Object.values(registeredMap).reduce((sum, v) => sum + v, 0);
  }, [registeredMap]);

  /** Get the display unit for a product (Rojão 00129 = dz, others = cx) */
  const getProductUnit = (codigoItem: string, unidadeMedida?: string): string => {
    if (codigoItem === "00129") return "dz"; // Rojão: dúzias
    if (codigoItem === "00223" || codigoItem === "00058") return "kg"; // Vareta de Apito: quilogramas
    return "cx";
  };

  const handleSelectProduct = (product: any) => {
    if (selectedProduct?.codigoItem === product.codigoItem) {
      setSelectedProduct(null);
      setQty("");
    } else {
      setSelectedProduct(product);
      setQty("");
    }
  };

  const handleSave = () => {
    if (!selectedProduct) return;
    const quantidade = qty !== "" ? parseFloat(qty.replace(",", ".")) : 0;
    if (isNaN(quantidade) || quantidade <= 0) { toast.error("Digite uma quantidade válida"); return; }
    onSaveProduct(sector.id, selectedProduct.codigoItem, quantidade, selectedProduct.descricaoItem);
    setSelectedProduct(null);
    setQty("");
    setSearch("");
  };

  const handleEditCard = (codigoItem: string, currentQty: number) => {
    setEditingCard(codigoItem);
    setEditCardQty(String(currentQty));
  };

  const handleSaveCardEdit = (codigoItem: string, descricao: string) => {
    const quantidade = editCardQty !== "" ? parseFloat(editCardQty.replace(",", ".")) : 0;
    if (isNaN(quantidade) || quantidade < 0) { toast.error("Valor inválido"); return; }
    onSaveProduct(sector.id, codigoItem, quantidade, descricao);
    setEditingCard(null);
    setEditCardQty("");
  };

  const handleRemoveCard = (codigoItem: string, descricao: string) => {
    // Set quantity to 0 to remove
    onSaveProduct(sector.id, codigoItem, 0, descricao);
  };

  const isSaving = savingKeys.has(`${sector.id}-emb`);

  return (
    <div className="px-4 py-3 space-y-3">
      {/* Registered products cards */}
      {registeredProducts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Registrados hoje</span>
            <span className="text-sm font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full">
              Total: {totalEmbalado} itens
            </span>
          </div>
          <div className="space-y-1.5">
            {registeredProducts.map((rp) => {
              const isEditing = editingCard === rp.codigoItem;
              return (
                <div
                  key={rp.codigoItem}
                  className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 transition-all"
                >
                  {isEditing ? (
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-mono text-emerald-500">{rp.codigoItem}</div>
                          <div className="text-sm text-slate-700 truncate" title={rp.descricaoItem}>{rp.descricaoItem}</div>
                        </div>
                        <button
                          onClick={() => { setEditingCard(null); setEditCardQty(""); }}
                          className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-slate-200 text-slate-400 shrink-0 ml-2"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="text-xs text-slate-500 shrink-0">Qtd:</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={editCardQty}
                          onChange={(e) => setEditCardQty(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleSaveCardEdit(rp.codigoItem, rp.descricaoItem); if (e.key === "Escape") { setEditingCard(null); setEditCardQty(""); } }}
                          autoFocus
                          className="w-20 text-right text-sm font-medium border border-slate-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 tabular-nums bg-white"
                        />
                        <span className="text-xs text-slate-400">{getProductUnit(rp.codigoItem, rp.unidadeMedida)}</span>
                        <button
                          onClick={() => handleSaveCardEdit(rp.codigoItem, rp.descricaoItem)}
                          disabled={isSaving}
                          className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                        >
                          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-mono text-emerald-500">{rp.codigoItem}</div>
                        <div className="text-sm text-slate-700 truncate" title={rp.descricaoItem}>{rp.descricaoItem}</div>
                      </div>
                      <span className="text-sm font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full shrink-0 tabular-nums">
                        {rp.quantidade} {getProductUnit(rp.codigoItem, rp.unidadeMedida)}
                      </span>
                      {canEdit && (
                        <button
                          onClick={() => handleEditCard(rp.codigoItem, rp.quantidade)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-emerald-100 text-emerald-600 transition-colors shrink-0"
                          title="Editar quantidade"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canEdit && (
                        <button
                          onClick={() => handleRemoveCard(rp.codigoItem, rp.descricaoItem)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors shrink-0"
                          title="Remover registro"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Divider between registered and search */}
      {registeredProducts.length > 0 && (
        <div className="flex items-center gap-2 pt-1">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-xs text-slate-400">{canEdit ? 'Adicionar produto' : 'Produtos disponíveis'}</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>
      )}

      {/* Search bar and product list - visible to all */}
      <>
        {/* Category selector: Madeira / Bambu */}
        <div className="flex gap-2">
          <button
            onClick={() => { setCategoria("madeira"); setSearch(""); setSelectedProduct(null); }}
            className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200 border-2 ${
              categoria === "madeira"
                ? "bg-amber-50 border-amber-400 text-amber-800 shadow-sm shadow-amber-100"
                : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <span className="text-base">🪵</span>
              Madeira
            </span>
          </button>
          <button
            onClick={() => { setCategoria("bambu"); setSearch(""); setSelectedProduct(null); }}
            className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200 border-2 ${
              categoria === "bambu"
                ? "bg-emerald-50 border-emerald-400 text-emerald-800 shadow-sm shadow-emerald-100"
                : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <span className="text-base">🎋</span>
              Bambu
            </span>
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Buscar produto ${categoria === "madeira" ? "de madeira" : "de bambu"}...`}
            className="w-full pl-9 pr-8 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200">
              <X className="w-3 h-3 text-slate-500" />
            </button>
          )}
        </div>

        {/* Product list (only unregistered) */}
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="max-h-[300px] overflow-y-auto space-y-1 -mx-1 px-1">
            {filteredProducts.map((product: any) => {
              const isSelected = selectedProduct?.codigoItem === product.codigoItem;

              return (
                <div key={product.codigoItem}>
                  <button
                    onClick={() => handleSelectProduct(product)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-3 ${
                      isSelected
                        ? "bg-teal-50 border border-teal-300 ring-1 ring-teal-200"
                        : "bg-white border border-slate-100 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-mono text-slate-400">{product.codigoItem}</div>
                      <div className="text-sm text-slate-700 truncate">{product.descricaoItem}</div>
                    </div>
                    {isSelected ? <ChevronDown className="w-4 h-4 text-teal-600 shrink-0" /> : <Plus className="w-4 h-4 text-slate-300 shrink-0" />}
                  </button>

                  {/* Expanded: quantity input - only editable for Maria */}
                  {isSelected && canEdit && (
                    <div className="ml-6 mt-1 mb-2 flex items-center gap-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-2">
                      <Package className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-xs text-slate-500 shrink-0">Qtd:</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={qty}
                        onChange={(e) => setQty(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
                        placeholder="0"
                        autoFocus
                        className="w-20 text-right text-sm font-medium border border-slate-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 tabular-nums bg-white"
                      />
                      <span className="text-xs text-slate-400">{selectedProduct ? getProductUnit(selectedProduct.codigoItem, selectedProduct.unidadeMedida) : "cx"}</span>
                      <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                      >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      </button>
                    </div>
                  )}
                  {/* Read-only: show product is selected but no form */}
                  {isSelected && !canEdit && (
                    <div className="ml-6 mt-1 mb-2 bg-slate-50 rounded-lg border border-slate-200 p-2">
                      <p className="text-xs text-slate-400 italic">Somente visualização — apenas Maria pode registrar</p>
                    </div>
                  )}
                </div>
              );
            })}
            {filteredProducts.length === 0 && !search && registeredProducts.length > 0 && (
              <div className="text-center py-4 text-sm text-slate-400">Todos os produtos já foram registrados</div>
            )}
            {filteredProducts.length === 0 && search && (
              <div className="text-center py-4 text-sm text-slate-400">Nenhum produto encontrado</div>
            )}
          </div>
        )}
      </>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PIROGRAFIA SECTOR (setor 9) - Registro detalhado de pirografia
   Seletor de produto (Bambu/Madeira), nome pirografado, quantidade
   ═══════════════════════════════════════════════════════════ */
interface PirografiaSectorProps {
  sector: any;
  selectedDate: string;
  canEdit: boolean;
  operatorName: string;
}

function PirografiaSector({ sector, selectedDate, canEdit, operatorName }: PirografiaSectorProps) {
  const [categoria, setCategoria] = useState<"bambu" | "madeira">("bambu");
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<{ codigoItem: string; descricaoItem: string; unidadeMedida: string; materialOrigem: string } | null>(null);
  const [nomePirografado, setNomePirografado] = useState("");
  const [qty, setQty] = useState("");
  const [selectedMachineId, setSelectedMachineId] = useState<number | null>(null);
  const [expandedMachines, setExpandedMachines] = useState<Set<number>>(new Set());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editNome, setEditNome] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [machineStatuses, setMachineStatuses] = useState<Record<number, string>>({});
  const [savingStatus, setSavingStatus] = useState<number | null>(null);

  const utils = trpc.useUtils();

  const { data: products, isLoading: loadingProducts } = trpc.production.getPirografiaProducts.useQuery({ categoria });
  const { data: entries } = trpc.production.getPirografiaEntries.useQuery({
    data: selectedDate,
    sectorId: sector.id,
  });

  // Fetch production entries for this sector/date to get machine statuses
  const { data: prodEntries } = trpc.production.getEntries.useQuery({
    data: selectedDate,
    sectorId: sector.id,
  });

  // Get the current status for a machine from production_entries
  const getMachineStatus = (machineId: number): string => {
    if (machineStatuses[machineId] !== undefined) return machineStatuses[machineId];
    if (!prodEntries) return "";
    const entry = prodEntries.find(e => e.machineId === machineId);
    return entry?.status || "";
  };

  // Status mutation using the existing upsertEntry
  const statusMutation = trpc.production.upsertEntry.useMutation({
    onSuccess: () => {
      setSavingStatus(null);
      utils.production.getEntries.invalidate();
      utils.production.getHistory.invalidate();
      toast.success("Status atualizado!");
    },
    onError: (err: any) => {
      setSavingStatus(null);
      toast.error("Erro ao salvar status: " + err.message);
    },
  });

  const handleStatusChange = (machineId: number, statusVal: string) => {
    const current = getMachineStatus(machineId);
    // Toggle: if same status, go back to empty (normal)
    const newStatus = current === statusVal ? "" : statusVal;
    setMachineStatuses(prev => ({ ...prev, [machineId]: newStatus }));
    setSavingStatus(machineId);
    statusMutation.mutate({
      sectorId: sector.id,
      machineId,
      data: selectedDate,
      quantidade: 0,
      status: newStatus || "producao_normal",
      lancadoPor: operatorName,
    });
  };

  const saveMutation = trpc.production.savePirografiaEntry.useMutation({
    onSuccess: () => {
      setIsSaving(false);
      setSelectedProduct(null);
      setNomePirografado("");
      setQty("");
      setSearch("");
      utils.production.getPirografiaEntries.invalidate();
      utils.production.getEntries.invalidate();
      utils.production.getDailySummary.invalidate();
      utils.production.getWeeklySummary.invalidate();
      toast.success("Pirografia registrada!");
    },
    onError: (err: any) => {
      setIsSaving(false);
      toast.error("Erro: " + err.message);
    },
  });

  const updateMutation = trpc.production.updatePirografiaEntry.useMutation({
    onSuccess: () => {
      setEditingId(null);
      setEditQty("");
      setEditNome("");
      utils.production.getPirografiaEntries.invalidate();
      utils.production.getEntries.invalidate();
      utils.production.getDailySummary.invalidate();
      utils.production.getWeeklySummary.invalidate();
      toast.success("Registro atualizado!");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const deleteMutation = trpc.production.deletePirografiaEntry.useMutation({
    onSuccess: () => {
      utils.production.getPirografiaEntries.invalidate();
      utils.production.getEntries.invalidate();
      utils.production.getDailySummary.invalidate();
      utils.production.getWeeklySummary.invalidate();
      toast.success("Registro removido!");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  // Group entries by machine
  const entriesByMachine = useMemo(() => {
    const map: Record<number, any[]> = {};
    if (!entries) return map;
    for (const e of entries) {
      if (!map[e.machineId]) map[e.machineId] = [];
      map[e.machineId].push(e);
    }
    return map;
  }, [entries]);

  // Machine total
  const getMachineTotal = (machineId: number) => {
    const machineEntries = entriesByMachine[machineId] || [];
    return machineEntries.reduce((sum: number, e: any) => sum + (parseFloat(String(e.quantidade)) || 0), 0);
  };

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    const q = search.toLowerCase().trim();
    if (!q) return products;
    return products.filter((p: any) =>
      p.descricaoItem.toLowerCase().includes(q) || p.codigoItem.toLowerCase().includes(q)
    );
  }, [products, search]);

  const handleSave = () => {
    if (!selectedProduct || !selectedMachineId) {
      toast.error("Selecione uma máquina e um produto");
      return;
    }
    if (!nomePirografado.trim()) {
      toast.error("Digite o nome pirografado");
      return;
    }
    const quantidade = qty !== "" ? parseFloat(qty.replace(",", ".")) : 0;
    if (isNaN(quantidade) || quantidade <= 0) {
      toast.error("Digite uma quantidade válida");
      return;
    }
    setIsSaving(true);
    saveMutation.mutate({
      sectorId: sector.id,
      machineId: selectedMachineId,
      data: selectedDate,
      codigoItem: selectedProduct.codigoItem,
      descricaoItem: selectedProduct.descricaoItem,
      materialOrigem: selectedProduct.materialOrigem as "bambu" | "madeira",
      nomePirografado: nomePirografado.trim(),
      quantidade,
      lancadoPor: operatorName,
    });
  };

  const handleUpdate = (id: number) => {
    const quantidade = editQty !== "" ? parseFloat(editQty.replace(",", ".")) : undefined;
    if (quantidade !== undefined && (isNaN(quantidade) || quantidade < 0)) {
      toast.error("Quantidade inválida");
      return;
    }
    if (editNome !== undefined && !editNome.trim()) {
      toast.error("Nome não pode ficar vazio");
      return;
    }
    updateMutation.mutate({
      id,
      quantidade,
      nomePirografado: editNome.trim() || undefined,
    });
  };

  const toggleMachineExpand = (machineId: number) => {
    setExpandedMachines(prev => {
      const n = new Set(prev);
      if (n.has(machineId)) n.delete(machineId); else n.add(machineId);
      return n;
    });
  };

  const machines = sector.machines || [];

  return (
    <div className="px-4 py-3 space-y-3">
      {/* Machine accordion */}
      {machines.map((machine: any) => {
        const machineTotal = getMachineTotal(machine.id);
        const machineEntries = entriesByMachine[machine.id] || [];
        const isExpanded = expandedMachines.has(machine.id);

        return (
          <div key={machine.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {/* Machine header */}
            <div
              onClick={() => toggleMachineExpand(machine.id)}
              className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-100 to-red-100 flex items-center justify-center shrink-0">
                <Flame className="w-4 h-4 text-orange-600" />
              </div>
              <span className="text-sm font-semibold text-slate-700 flex-1">{machine.nome}</span>

              {/* Status badge */}
              {(() => {
                const st = getMachineStatus(machine.id);
                const statusOpt = st && st !== "producao_normal" ? MACHINE_STATUS_OPTIONS.find(o => o.value === st) : null;
                if (!statusOpt) return null;
                const StIcon = statusOpt.icon;
                return (
                  <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusOpt.bgClass} ${statusOpt.textClass} ${statusOpt.borderClass}`}>
                    <StIcon className="w-3 h-3" />
                    <span className="hidden sm:inline">{statusOpt.label}</span>
                  </div>
                );
              })()}

              {/* Entry badges summary */}
              {machineEntries.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-50 text-orange-700 border border-orange-200">
                    {machineEntries.length} registro{machineEntries.length !== 1 ? "s" : ""}
                  </span>
                </div>
              )}

              <div className="text-right shrink-0 w-16">
                <div className="text-sm font-bold tabular-nums text-orange-700">{machineTotal > 0 ? machineTotal : 0}</div>
                <div className="text-[9px] text-slate-400">caixa</div>
              </div>
              {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
            </div>

            {/* Expanded content */}
            {isExpanded && (
              <div className="border-t border-slate-100 px-4 py-3 space-y-3">
                {/* Status selector for Pirografia machine */}
                <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                  <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Status da Máquina</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                    {MACHINE_STATUS_OPTIONS.map(opt => {
                      const currentSt = getMachineStatus(machine.id);
                      const isSelected = currentSt === opt.value || (opt.value === "producao_normal" && (!currentSt || currentSt === "producao_normal"));
                      const OptIcon = opt.icon;
                      return (
                        <button key={opt.value} onClick={() => canEdit && handleStatusChange(machine.id, opt.value)}
                          disabled={!canEdit || savingStatus === machine.id}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${!canEdit ? 'opacity-60 cursor-not-allowed' : ''} ${isSelected ? `${opt.bgClass} ${opt.textClass} ${opt.borderClass} ring-2 ring-offset-1` : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"}`}
                          style={isSelected ? { '--tw-ring-color': opt.color } as React.CSSProperties : {}}
                        >
                          {savingStatus === machine.id ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <OptIcon className="w-4 h-4 shrink-0" />}
                          <span className="truncate">{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Registered entries for this machine */}
                {machineEntries.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Registros do dia</span>
                    <div className="space-y-1.5">
                      {machineEntries.map((entry: any) => {
                        const isEditing = editingId === entry.id;
                        const matColor = entry.materialOrigem === "bambu" ? "emerald" : "amber";
                        return (
                          <div key={entry.id} className={`rounded-lg px-3 py-2 border transition-all ${matColor === "emerald" ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
                            {isEditing ? (
                              <div className="space-y-2">
                                <div className="flex items-start justify-between">
                                  <div className="min-w-0 flex-1">
                                    <div className="text-xs font-mono" style={{ color: matColor === "emerald" ? "#059669" : "#d97706" }}>{entry.codigoItem}</div>
                                    <div className="text-sm text-slate-700 truncate">{entry.descricaoItem || entry.codigoItem}</div>
                                  </div>
                                  <button onClick={() => { setEditingId(null); setEditQty(""); setEditNome(""); }} className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-slate-200 text-slate-400 shrink-0 ml-2">
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Type className="w-4 h-4 text-slate-400 shrink-0" />
                                  <span className="text-xs text-slate-500 shrink-0">Nome:</span>
                                  <input
                                    type="text"
                                    value={editNome}
                                    onChange={(e) => setEditNome(e.target.value)}
                                    className="flex-1 text-sm font-medium border border-slate-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <Package className="w-4 h-4 text-slate-400 shrink-0" />
                                  <span className="text-xs text-slate-500 shrink-0">Qtd:</span>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={editQty}
                                    onChange={(e) => setEditQty(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === "Enter") handleUpdate(entry.id); if (e.key === "Escape") { setEditingId(null); setEditQty(""); setEditNome(""); } }}
                                    autoFocus
                                    className="w-20 text-right text-sm font-medium border border-slate-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 tabular-nums bg-white"
                                  />
                                  <span className="text-xs text-slate-400">cx</span>
                                  <button
                                    onClick={() => handleUpdate(entry.id)}
                                    disabled={updateMutation.isPending}
                                    className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                                  >
                                    {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${matColor === "emerald" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                                      {entry.materialOrigem === "bambu" ? "🎋 Bambu" : "🪵 Madeira"}
                                    </span>
                                    <span className="text-xs font-mono text-slate-400">{entry.codigoItem}</span>
                                  </div>
                                  <div className="text-sm text-slate-700 truncate mt-0.5" title={entry.descricaoItem}>{entry.descricaoItem || entry.codigoItem}</div>
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <Flame className="w-3 h-3 text-orange-500" />
                                    <span className="text-xs font-semibold text-orange-700">{entry.nomePirografado}</span>
                                  </div>
                                </div>
                                <span className={`text-sm font-bold px-2.5 py-1 rounded-full shrink-0 tabular-nums ${matColor === "emerald" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                                  {parseFloat(String(entry.quantidade))} cx
                                </span>
                                {canEdit && (
                                  <button
                                    onClick={() => { setEditingId(entry.id); setEditQty(String(parseFloat(String(entry.quantidade)))); setEditNome(entry.nomePirografado); }}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-orange-100 text-orange-600 transition-colors shrink-0"
                                    title="Editar"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {canEdit && (
                                  <button
                                    onClick={() => deleteMutation.mutate({ id: entry.id })}
                                    disabled={deleteMutation.isPending}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors shrink-0"
                                    title="Remover"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Category selector, search and product list - visible to all */}
                <div className="space-y-3">
                  {machineEntries.length > 0 && (
                    <div className="flex items-center gap-2 pt-1">
                      <div className="flex-1 h-px bg-slate-200" />
                      <span className="text-xs text-slate-400">{canEdit ? 'Novo registro' : 'Produtos disponíveis'}</span>
                      <div className="flex-1 h-px bg-slate-200" />
                    </div>
                  )}

                  {/* Category selector */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setCategoria("bambu"); setSearch(""); setSelectedProduct(null); }}
                      className={`flex-1 py-2 px-3 rounded-xl text-sm font-semibold transition-all duration-200 border-2 ${
                        categoria === "bambu"
                          ? "bg-emerald-50 border-emerald-400 text-emerald-800 shadow-sm shadow-emerald-100"
                          : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <span className="flex items-center justify-center gap-1.5">
                        <span className="text-sm">🎋</span> Bambu
                      </span>
                    </button>
                    <button
                      onClick={() => { setCategoria("madeira"); setSearch(""); setSelectedProduct(null); }}
                      className={`flex-1 py-2 px-3 rounded-xl text-sm font-semibold transition-all duration-200 border-2 ${
                        categoria === "madeira"
                          ? "bg-amber-50 border-amber-400 text-amber-800 shadow-sm shadow-amber-100"
                          : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <span className="flex items-center justify-center gap-1.5">
                        <span className="text-sm">🪵</span> Madeira
                      </span>
                    </button>
                  </div>

                  {/* Product search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={`Buscar produto ${categoria === "bambu" ? "de bambu" : "de madeira"}...`}
                      className="w-full pl-9 pr-8 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white"
                    />
                    {search && (
                      <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200">
                        <X className="w-3 h-3 text-slate-500" />
                      </button>
                    )}
                  </div>

                  {/* Product list */}
                  {loadingProducts ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                    </div>
                  ) : (
                    <div className="max-h-[200px] overflow-y-auto space-y-1 -mx-1 px-1">
                      {filteredProducts.map((product: any) => {
                        const isSelected = selectedProduct?.codigoItem === product.codigoItem;
                        return (
                          <div key={product.codigoItem}>
                            <button
                              onClick={() => {
                                if (isSelected) { setSelectedProduct(null); } else {
                                  setSelectedProduct(product);
                                  setSelectedMachineId(machine.id);
                                  setQty("");
                                }
                              }}
                              className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-3 ${
                                isSelected
                                  ? "bg-orange-50 border border-orange-300 ring-1 ring-orange-200"
                                  : "bg-white border border-slate-100 hover:bg-slate-50"
                              }`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-mono text-slate-400">{product.codigoItem}</div>
                                <div className="text-sm text-slate-700 truncate">{product.descricaoItem}</div>
                              </div>
                              {isSelected ? <ChevronDown className="w-4 h-4 text-orange-600 shrink-0" /> : <Plus className="w-4 h-4 text-slate-300 shrink-0" />}
                            </button>

                            {/* Expanded: name + quantity input - only editable for Maria */}
                            {isSelected && canEdit && (
                              <div className="ml-4 mt-1 mb-2 space-y-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                                {/* Nome pirografado */}
                                <div className="flex items-center gap-2">
                                  <Flame className="w-4 h-4 text-orange-500 shrink-0" />
                                  <span className="text-xs text-slate-500 shrink-0 whitespace-nowrap">Nome pirografado:</span>
                                  <input
                                    type="text"
                                    value={nomePirografado}
                                    onChange={(e) => setNomePirografado(e.target.value)}
                                    placeholder="Ex: João Silva"
                                    className="flex-1 text-sm font-medium border border-slate-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white"
                                  />
                                </div>
                                {/* Quantidade */}
                                <div className="flex items-center gap-2">
                                  <Package className="w-4 h-4 text-slate-400 shrink-0" />
                                  <span className="text-xs text-slate-500 shrink-0">Qtd:</span>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={qty}
                                    onChange={(e) => setQty(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
                                    placeholder="0"
                                    className="w-20 text-right text-sm font-medium border border-slate-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 tabular-nums bg-white"
                                  />
                                  <span className="text-xs text-slate-400">cx</span>
                                  <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="ml-auto px-3 py-1.5 rounded-lg flex items-center gap-1.5 bg-orange-600 text-white text-xs font-medium hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                                  >
                                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                    Salvar
                                  </button>
                                </div>
                              </div>
                            )}
                            {/* Read-only: show full form fields disabled for non-Maria */}
                            {isSelected && !canEdit && (
                              <div className="ml-4 mt-1 mb-2 space-y-2 bg-slate-50 rounded-lg border border-slate-200 p-3">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Visualização do formulário</span>
                                </div>
                                {/* Material */}
                                <div className="flex items-center gap-2">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${product.materialOrigem === "bambu" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                                    {product.materialOrigem === "bambu" ? "🎋 Bambu" : "🪵 Madeira"}
                                  </span>
                                  <span className="text-xs text-slate-500 truncate">{product.descricaoItem}</span>
                                </div>
                                {/* Nome pirografado - disabled */}
                                <div className="flex items-center gap-2">
                                  <Flame className="w-4 h-4 text-orange-400 shrink-0" />
                                  <span className="text-xs text-slate-400 shrink-0 whitespace-nowrap">Nome pirografado:</span>
                                  <div className="flex-1 text-sm text-slate-400 border border-slate-200 rounded-md px-2 py-1.5 bg-slate-100 cursor-not-allowed">
                                    Ex: João Silva
                                  </div>
                                </div>
                                {/* Quantidade - disabled */}
                                <div className="flex items-center gap-2">
                                  <Package className="w-4 h-4 text-slate-300 shrink-0" />
                                  <span className="text-xs text-slate-400 shrink-0">Qtd:</span>
                                  <div className="w-20 text-right text-sm text-slate-400 border border-slate-200 rounded-md px-2 py-1.5 bg-slate-100 tabular-nums cursor-not-allowed">
                                    0
                                  </div>
                                  <span className="text-xs text-slate-400">cx</span>
                                  <div className="ml-auto px-3 py-1.5 rounded-lg flex items-center gap-1.5 bg-slate-300 text-white text-xs font-medium cursor-not-allowed shrink-0">
                                    <Save className="w-3.5 h-3.5" />
                                    Salvar
                                  </div>
                                </div>
                                <p className="text-[10px] text-slate-400 italic pt-1">Somente Maria pode registrar pirografia</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {filteredProducts.length === 0 && search && (
                        <div className="text-center py-4 text-sm text-slate-400">Nenhum produto encontrado</div>
                      )}
                      {filteredProducts.length === 0 && !search && (
                        <div className="text-center py-4 text-sm text-slate-400">Nenhum produto disponível</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   HISTORY VIEW
   ═══════════════════════════════════════════════════════════ */
interface HistoryViewProps {
  sectors: any[]; weekRange: { start: string; end: string }; weeklySummary: any[]; selectedDate: string;
}

function HistoryView({ sectors, weekRange, weeklySummary, selectedDate }: HistoryViewProps) {
  const weekDays = useMemo(() => {
    const days: string[] = [];
    const start = new Date(weekRange.start + "T12:00:00");
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d.toISOString().slice(0, 10));
    }
    return days;
  }, [weekRange]);

  const matrix = useMemo(() => {
    const m: Record<number, Record<string, number>> = {};
    for (const sector of sectors) {
      m[sector.id] = {};
      for (const day of weekDays) m[sector.id][day] = 0;
    }
    for (const entry of weeklySummary) {
      if (m[entry.sectorId] && m[entry.sectorId][entry.data] !== undefined) {
        const qty = Number(entry.total);
        const sector = sectors.find((s: any) => s.id === entry.sectorId);
        const isDual = sector && isDualUnitSector(sector.ordem);
        if (isDual && entry.tipoMadeira) {
          // Apply cxp/cxg → saco conversion for dual-unit sectors
          const variant = entry.tipoMadeira as string; // e.g. "3.8x200mm_cxg"
          const parts = variant.split("_");
          const suffix = parts[parts.length - 1]; // "saco", "cxp", or "cxg"
          const medida = parts.slice(0, -1).join("_"); // e.g. "3.8x200mm"
          if (suffix === "cxp") {
            m[entry.sectorId][entry.data] += convertCxpToSaco(medida, qty);
          } else if (suffix === "cxg") {
            m[entry.sectorId][entry.data] += convertCxgToSaco(medida, qty);
          } else {
            // "_saco" or no suffix = raw saco count
            m[entry.sectorId][entry.data] += qty;
          }
        } else {
          // Non dual-unit sectors: sum raw values (no conversion needed)
          m[entry.sectorId][entry.data] += qty;
        }
      }
    }
    return m;
  }, [sectors, weekDays, weeklySummary]);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-teal-600" />
          <h2 className="text-sm font-bold text-slate-700">Histórico Semanal — {fmtDate(weekRange.start)} a {fmtDate(weekRange.end)}</h2>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase w-48 border-r border-slate-200">Setor</th>
              {weekDays.map(day => {
                const d = new Date(day + "T12:00:00");
                const isSelected = day === selectedDate;
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                return (
                  <th key={day} className={`text-center px-2 py-2.5 text-xs font-semibold border-r border-slate-200 last:border-r-0 ${isSelected ? "bg-teal-50 text-teal-700" : isWeekend ? "bg-slate-100 text-slate-400" : "text-slate-500"}`}>
                    <div>{diasSemana[d.getDay()]}</div>
                    <div className="text-[10px] font-normal">{day.slice(8, 10)}/{day.slice(5, 7)}</div>
                  </th>
                );
              })}
              <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-700 uppercase bg-slate-100">Total</th>
            </tr>
          </thead>
          <tbody>
            {sectors.map(sector => {
              const Icon = getSectorIcon(sector.ordem);
              const isDual = isDualUnitSector(sector.ordem);
              // History always shows integers (no decimals) except m³
              const decimals = sector.unidadeMedida === "m\u00b3" ? 3 : 0;
              const rawWeekTotal = weekDays.reduce((sum, day) => sum + (matrix[sector.id]?.[day] || 0), 0);
              const weekTotal = sector.unidadeMedida === "m\u00b3" ? rawWeekTotal : Math.floor(rawWeekTotal);
              return (
                <tr key={sector.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50/50">
                  <td className="px-4 py-2.5 border-r border-slate-200">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: (sector.cor || "#6b7280") + "15" }}>
                        <Icon className="w-3.5 h-3.5" style={{ color: sector.cor || "#6b7280" }} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-700">{sector.nome}</div>
                        <div className="text-[10px] text-slate-400">{sector.unidadeMedida}</div>
                      </div>
                    </div>
                  </td>
                  {weekDays.map(day => {
                    const val = matrix[sector.id]?.[day] || 0;
                    const isSelected = day === selectedDate;
                    const d = new Date(day + "T12:00:00");
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    return (
                      <td key={day} className={`text-center px-2 py-2.5 tabular-nums border-r border-slate-200 last:border-r-0 ${isSelected ? "bg-teal-50/50" : isWeekend ? "bg-slate-50/50" : ""}`}>
                        <span className={`text-xs font-medium ${val > 0 ? "text-slate-700" : "text-slate-300"}`}>
                          {val > 0 ? fmtNum(sector.unidadeMedida === "m\u00b3" ? val : Math.floor(val), decimals) : "—"}
                        </span>
                      </td>
                    );
                  })}
                  <td className="text-center px-3 py-2.5 bg-slate-50 tabular-nums">
                    <span className="text-xs font-bold" style={{ color: sector.cor || "#6b7280" }}>
                      {weekTotal > 0 ? fmtNum(weekTotal, decimals) : "—"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PIROGRAFIA HISTORY VIEW - Ranking de nomes e produtos pirografados
   ═══════════════════════════════════════════════════════════ */
function PirografiaHistoryView() {
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [dataInicio, setDataInicio] = useState(thirtyDaysAgo);
  const [dataFim, setDataFim] = useState(today);

  const { data, isLoading } = trpc.production.getPirografiaHistory.useQuery({
    dataInicio,
    dataFim,
  });

  const formatQty = (n: number) => n % 1 === 0 ? String(n) : n.toFixed(1);

  // Quick period presets
  const setPreset = (days: number) => {
    const end = new Date();
    const start = new Date(Date.now() - days * 86400000);
    setDataInicio(start.toISOString().slice(0, 10));
    setDataFim(end.toISOString().slice(0, 10));
  };

  return (
    <div className="space-y-6">
      {/* Header + Period Filter */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" />
              Histórico de Pirografia
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">Ranking de nomes e produtos mais pirografados</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setPreset(7)} className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">7 dias</button>
            <button onClick={() => setPreset(30)} className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">30 dias</button>
            <button onClick={() => setPreset(90)} className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">90 dias</button>
            <button onClick={() => setPreset(365)} className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">1 ano</button>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-500">De:</label>
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-500">Até:</label>
            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
          <span className="ml-2 text-sm text-slate-500">Carregando histórico...</span>
        </div>
      )}

      {/* Summary Card */}
      {data && !isLoading && (
        <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border border-orange-200 p-5">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-orange-700 tabular-nums">{formatQty(data.total)}</div>
              <div className="text-xs text-orange-600 font-medium mt-0.5">Caixas Pirografadas</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-700 tabular-nums">{data.topNomes.length}</div>
              <div className="text-xs text-amber-600 font-medium mt-0.5">Nomes Diferentes</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-700 tabular-nums">{data.topProdutos.length}</div>
              <div className="text-xs text-yellow-600 font-medium mt-0.5">Produtos Usados</div>
            </div>
          </div>
        </div>
      )}

      {/* Rankings Grid */}
      {data && !isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Nomes */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Type className="w-4 h-4 text-orange-500" />
                Top Nomes Pirografados
              </h3>
            </div>
            {data.topNomes.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-400">Nenhum registro no período</div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {data.topNomes.map((item, idx) => {
                  const maxQty = data.topNomes[0]?.quantidade || 1;
                  const pct = (item.quantidade / maxQty) * 100;
                  return (
                    <div key={item.nome} className="px-5 py-3 hover:bg-slate-50/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          idx === 0 ? 'bg-orange-100 text-orange-700' :
                          idx === 1 ? 'bg-amber-100 text-amber-700' :
                          idx === 2 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-slate-700 truncate">{item.nome}</div>
                          <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-orange-400 to-amber-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <div className="text-sm font-bold text-slate-700 tabular-nums">{formatQty(item.quantidade)} cx</div>
                          <div className="text-[10px] text-slate-400">{item.registros} reg.</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top Produtos */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Package className="w-4 h-4 text-teal-500" />
                Top Produtos Pirografados
              </h3>
            </div>
            {data.topProdutos.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-400">Nenhum registro no período</div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {data.topProdutos.map((item, idx) => {
                  const maxQty = data.topProdutos[0]?.quantidade || 1;
                  const pct = (item.quantidade / maxQty) * 100;
                  const matColor = item.materialOrigem === "bambu" ? "emerald" : "amber";
                  return (
                    <div key={`${item.codigoItem}-${item.materialOrigem}`} className="px-5 py-3 hover:bg-slate-50/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          idx === 0 ? 'bg-teal-100 text-teal-700' :
                          idx === 1 ? 'bg-cyan-100 text-cyan-700' :
                          idx === 2 ? 'bg-sky-100 text-sky-700' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-700 truncate">{item.descricaoItem}</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                              matColor === "emerald" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                            }`}>
                              {item.materialOrigem === "bambu" ? "BAMBU" : "MADEIRA"}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">Cód: {item.codigoItem}</div>
                          <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${
                              matColor === "emerald" ? "bg-gradient-to-r from-emerald-400 to-teal-400" : "bg-gradient-to-r from-amber-400 to-yellow-400"
                            }`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <div className="text-sm font-bold text-slate-700 tabular-nums">{formatQty(item.quantidade)} cx</div>
                          <div className="text-[10px] text-slate-400">{item.registros} reg.</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {data && !isLoading && data.total === 0 && (
        <div className="text-center py-12">
          <Flame className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">Nenhum registro de pirografia encontrado no período selecionado.</p>
          <p className="text-xs text-slate-400 mt-1">Tente ampliar o intervalo de datas.</p>
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════
   ANNOTATION CARDS (Queijo Coalho & Alídio)
   Cards de anotação avulsa para Seleção Automática.
   NÃO contabilizam no total do setor — apenas registro.
   ═══════════════════════════════════════════════════════════ */
interface AnnotationCardsProps {
  selectedDate: string;
  sectorId: number;
  canEdit: boolean;
  operatorName: string;
}

const ANNOTATION_TYPES = [
  { tipo: "queijo_coalho", label: "Queijo Coalho", emoji: "🧀", color: "#f59e0b", bgClass: "bg-amber-50", borderClass: "border-amber-200", textClass: "text-amber-700" },
  { tipo: "alidio", label: "Alídio", emoji: "📦", color: "#8b5cf6", bgClass: "bg-violet-50", borderClass: "border-violet-200", textClass: "text-violet-700" },
];

function AnnotationCards({ selectedDate, sectorId, canEdit, operatorName }: AnnotationCardsProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [obs, setObs] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editObs, setEditObs] = useState("");
  const [showChart, setShowChart] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const utils = trpc.useUtils();

  const { data: entries } = trpc.annotations.getEntries.useQuery({
    data: selectedDate,
    sectorId,
  });

  // Weekly trend: last 7 days from selectedDate
  const weekRange = useMemo(() => {
    const end = new Date(selectedDate + "T12:00:00");
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    };
  }, [selectedDate]);

  const { data: weekHistory } = trpc.annotations.getHistory.useQuery({
    startDate: weekRange.startDate,
    endDate: weekRange.endDate,
  }, { enabled: showChart });

  // Monthly range for PDF export
  const monthRange = useMemo(() => {
    const d = new Date(selectedDate + "T12:00:00");
    const y = d.getFullYear();
    const m = d.getMonth();
    const start = `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(y, m + 1, 0).getDate();
    const end = `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    return { startDate: start, endDate: end, month: m, year: y };
  }, [selectedDate]);

  const { data: monthHistory } = trpc.annotations.getHistory.useQuery({
    startDate: monthRange.startDate,
    endDate: monthRange.endDate,
  }, { enabled: generatingPdf });

  // Build chart data
  const chartData = useMemo(() => {
    if (!weekHistory) return [];
    const validEntries = weekHistory.filter((e: any) => parseFloat(String(e.quantidade)) > 0);
    const days: { date: string; label: string; queijo_coalho: number; alidio: number }[] = [];
    const end = new Date(selectedDate + "T12:00:00");
    for (let i = 6; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayLabel = d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" });
      const qc = validEntries.filter((e: any) => e.data === dateStr && e.tipo === "queijo_coalho").reduce((s: number, e: any) => s + parseFloat(String(e.quantidade)), 0);
      const al = validEntries.filter((e: any) => e.data === dateStr && e.tipo === "alidio").reduce((s: number, e: any) => s + parseFloat(String(e.quantidade)), 0);
      days.push({ date: dateStr, label: dayLabel, queijo_coalho: qc, alidio: al });
    }
    return days;
  }, [weekHistory, selectedDate]);

  const handleExportPdf = useCallback(async () => {
    setGeneratingPdf(true);
    // Small delay to let the query fire
    await new Promise(r => setTimeout(r, 500));
  }, []);

  // Effect to generate PDF once monthHistory is loaded
  useMemo(() => {
    if (generatingPdf && monthHistory) {
      generateAnnotationPdf({
        entries: monthHistory as any,
        month: monthRange.month,
        year: monthRange.year,
      }).then(() => {
        setGeneratingPdf(false);
        toast.success("PDF gerado com sucesso!");
      }).catch((err) => {
        setGeneratingPdf(false);
        toast.error("Erro ao gerar PDF: " + err.message);
      });
    }
  }, [generatingPdf, monthHistory, monthRange]);

  const createMutation = trpc.annotations.create.useMutation({
    onSuccess: (_data, variables) => {
      setValues(prev => ({ ...prev, [variables.tipo]: "" }));
      setObs(prev => ({ ...prev, [variables.tipo]: "" }));
      utils.annotations.getEntries.invalidate();
      toast.success("Anotação registrada!");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const updateMutation = trpc.annotations.update.useMutation({
    onSuccess: () => {
      setEditingId(null);
      setEditQty("");
      setEditObs("");
      utils.annotations.getEntries.invalidate();
      toast.success("Anotação atualizada!");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const deleteMutation = trpc.annotations.delete.useMutation({
    onSuccess: () => {
      utils.annotations.getEntries.invalidate();
      toast.success("Anotação removida!");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const handleSave = (tipo: string) => {
    const raw = values[tipo] || "";
    const quantidade = parseFloat(raw.replace(",", "."));
    if (isNaN(quantidade) || quantidade <= 0) {
      toast.error("Digite uma quantidade válida");
      return;
    }
    createMutation.mutate({
      tipo,
      data: selectedDate,
      sectorId,
      quantidade,
      observacoes: obs[tipo] || undefined,
      lancadoPor: operatorName,
    });
  };

  const handleUpdate = (id: number) => {
    const quantidade = editQty ? parseFloat(editQty.replace(",", ".")) : undefined;
    if (quantidade !== undefined && (isNaN(quantidade) || quantidade < 0)) {
      toast.error("Quantidade inválida");
      return;
    }
    updateMutation.mutate({
      id,
      quantidade,
      observacoes: editObs || undefined,
    });
  };

  const getEntriesForType = (tipo: string) => {
    if (!entries) return [];
    return entries.filter((e: any) => e.tipo === tipo && parseFloat(String(e.quantidade)) > 0);
  };

  const getTotalForType = (tipo: string) => {
    return getEntriesForType(tipo).reduce((sum: number, e: any) => sum + (parseFloat(String(e.quantidade)) || 0), 0);
  };

  return (
    <div className="border-t border-slate-200 bg-gradient-to-b from-slate-50/50 to-white px-4 py-3 space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Anotações Avulsas</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-slate-400 italic">Registros de acompanhamento — NÃO contabilizam no total do setor</p>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowChart(prev => !prev)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all border ${
              showChart ? "bg-teal-50 text-teal-700 border-teal-200" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <TrendingUp className="w-3 h-3" />
            Tendência
          </button>
          <button
            onClick={handleExportPdf}
            disabled={generatingPdf}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 transition-all disabled:opacity-40"
          >
            {generatingPdf ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileDown className="w-3 h-3" />}
            PDF Mensal
          </button>
        </div>
      </div>

      {/* Weekly Trend Chart */}
      {showChart && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-teal-600" />
            <span className="text-xs font-semibold text-slate-700">Últimos 7 dias</span>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={30} />
                <RechartsTooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}
                  formatter={(value: number, name: string) => [
                    `${value} cx`,
                    name === "queijo_coalho" ? "Queijo Coalho" : "Alídio"
                  ]}
                />
                <RechartsLegend
                  formatter={(value: string) => value === "queijo_coalho" ? "Queijo Coalho" : "Alídio"}
                  wrapperStyle={{ fontSize: 10 }}
                />
                <Bar dataKey="queijo_coalho" fill="#f59e0b" radius={[4, 4, 0, 0]} name="queijo_coalho" />
                <Bar dataKey="alidio" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="alidio" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[120px] text-xs text-slate-400">
              Nenhum dado nos últimos 7 dias
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ANNOTATION_TYPES.map(at => {
          const typeEntries = getEntriesForType(at.tipo);
          const total = getTotalForType(at.tipo);

          return (
            <div key={at.tipo} className={`rounded-xl border-2 ${at.borderClass} overflow-hidden`}>
              {/* Card header */}
              <div className={`${at.bgClass} px-4 py-3 flex items-center gap-3`}>
                <span className="text-2xl">{at.emoji}</span>
                <div className="flex-1">
                  <span className={`text-sm font-bold ${at.textClass}`}>{at.label}</span>
                  <div className="text-[10px] text-slate-400">Apenas registro</div>
                </div>
                {total > 0 && (
                  <div className="text-right">
                    <div className={`text-lg font-bold tabular-nums ${at.textClass}`}>{total}</div>
                    <div className="text-[9px] text-slate-400">cx hoje</div>
                  </div>
                )}
              </div>

              {/* Entries list */}
              {typeEntries.length > 0 && (
                <div className="px-3 py-2 space-y-1.5 bg-white">
                  {typeEntries.map((entry: any) => {
                    const isEditing = editingId === entry.id;
                    return (
                      <div key={entry.id} className={`rounded-lg px-3 py-2 border ${at.borderClass} ${at.bgClass}`}>
                        {isEditing ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Package className="w-4 h-4 text-slate-400 shrink-0" />
                              <span className="text-xs text-slate-500 shrink-0">Qtd:</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={editQty}
                                onChange={(e) => setEditQty(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") handleUpdate(entry.id); if (e.key === "Escape") { setEditingId(null); setEditQty(""); setEditObs(""); } }}
                                autoFocus
                                className="w-20 text-right text-sm font-medium border border-slate-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 tabular-nums bg-white"
                              />
                              <span className="text-xs text-slate-400">cx</span>
                              <button
                                onClick={() => handleUpdate(entry.id)}
                                disabled={updateMutation.isPending}
                                className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center text-white transition-colors shrink-0"
                                style={{ backgroundColor: at.color }}
                              >
                                {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                              </button>
                              <button onClick={() => { setEditingId(null); setEditQty(""); setEditObs(""); }} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-200 text-slate-400 shrink-0">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="flex items-center gap-2">
                              <MessageSquare className="w-4 h-4 text-slate-400 shrink-0" />
                              <input
                                type="text"
                                value={editObs}
                                onChange={(e) => setEditObs(e.target.value)}
                                placeholder="Observação..."
                                className="flex-1 text-xs border border-slate-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold tabular-nums ${at.textClass}`}>{parseFloat(String(entry.quantidade))} cx</span>
                            {entry.observacoes && entry.observacoes !== "[REMOVIDO]" && (
                              <span className="text-xs text-slate-500 truncate flex-1" title={entry.observacoes}>— {entry.observacoes}</span>
                            )}
                            {!entry.observacoes && <span className="flex-1" />}
                            <span className="text-[10px] text-slate-400 shrink-0">{entry.lancadoPor}</span>
                            {canEdit && (
                              <>
                                <button
                                  onClick={() => { setEditingId(entry.id); setEditQty(String(parseFloat(String(entry.quantidade)))); setEditObs(entry.observacoes || ""); }}
                                  className="w-6 h-6 rounded flex items-center justify-center hover:bg-slate-200 text-slate-400 shrink-0"
                                  title="Editar"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => deleteMutation.mutate({ id: entry.id })}
                                  disabled={deleteMutation.isPending}
                                  className="w-6 h-6 rounded flex items-center justify-center hover:bg-red-100 text-red-400 hover:text-red-600 shrink-0"
                                  title="Remover"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Input area */}
              {canEdit && (
                <div className="px-3 py-2.5 bg-white border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={values[at.tipo] || ""}
                      onChange={(e) => setValues(prev => ({ ...prev, [at.tipo]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") handleSave(at.tipo); }}
                      placeholder="Qtd"
                      className="w-20 text-right text-sm font-medium border border-slate-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:border-transparent tabular-nums bg-white"
                      style={{ '--tw-ring-color': at.color } as React.CSSProperties}
                    />
                    <span className="text-xs text-slate-400">cx</span>
                    <input
                      type="text"
                      value={obs[at.tipo] || ""}
                      onChange={(e) => setObs(prev => ({ ...prev, [at.tipo]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") handleSave(at.tipo); }}
                      placeholder="Obs (opcional)"
                      className="flex-1 text-xs border border-slate-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:border-transparent bg-white"
                      style={{ '--tw-ring-color': at.color } as React.CSSProperties}
                    />
                    <button
                      onClick={() => handleSave(at.tipo)}
                      disabled={createMutation.isPending}
                      className="px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-white text-xs font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
                      style={{ backgroundColor: at.color }}
                    >
                      {createMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      Lançar
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
