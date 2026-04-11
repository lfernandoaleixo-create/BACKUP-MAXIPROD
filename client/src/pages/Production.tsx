/**
 * Produção - Controle de produção industrial
 * 9 setores com lançamento diário por máquina/mesa
 * Multilamina (setor 1): status + campos fixos Benazzi/Madeira Dura (sempre visíveis)
 * Vareteira (setor 2): status + campos fixos 150mm-350mm (sempre visíveis)
 * Todos os setores: caixa de comentários opcional
 */

import { useState, useMemo } from "react";
import TopNav from "@/components/TopNav";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Factory, ChevronDown, ChevronRight, ChevronUp, Save, Calendar, BarChart3,
  ArrowLeft, ArrowRight, Loader2, Cog, Eye, Package, Box, Zap, Scissors,
  Layers, Printer, History, AlertTriangle, Wrench, Ban, CheckCircle2, Clock,
  MessageSquare, TreePine, Ruler,
} from "lucide-react";

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

// ─── Wood measure options (Vareteira) - always shown ───
const WOOD_MEASURE_OPTIONS = [
  { value: "150mm", label: "150mm", color: "#0ea5e9", bgClass: "bg-sky-50", textClass: "text-sky-800", borderClass: "border-sky-300" },
  { value: "180mm", label: "180mm", color: "#06b6d4", bgClass: "bg-cyan-50", textClass: "text-cyan-800", borderClass: "border-cyan-300" },
  { value: "200mm", label: "200mm", color: "#14b8a6", bgClass: "bg-teal-50", textClass: "text-teal-800", borderClass: "border-teal-300" },
  { value: "218mm", label: "218mm", color: "#10b981", bgClass: "bg-emerald-50", textClass: "text-emerald-800", borderClass: "border-emerald-300" },
  { value: "250mm", label: "250mm", color: "#22c55e", bgClass: "bg-green-50", textClass: "text-green-800", borderClass: "border-green-300" },
  { value: "300mm", label: "300mm", color: "#84cc16", bgClass: "bg-lime-50", textClass: "text-lime-800", borderClass: "border-lime-300" },
  { value: "350mm", label: "350mm", color: "#eab308", bgClass: "bg-yellow-50", textClass: "text-yellow-800", borderClass: "border-yellow-300" },
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

// Sector 1 = Multilamina (tipo de madeira), Sector 2 = Vareteira (medida de madeira)
function isMultilamina(ordem: number) { return ordem === 1; }
function isVareteira(ordem: number) { return ordem === 2; }
function hasExpandableFeatures(ordem: number) { return ordem === 1 || ordem === 2; }

// Get the FIXED variant options for a sector (always all shown)
function getVariantOptions(sectorOrdem: number) {
  if (isMultilamina(sectorOrdem)) return WOOD_TYPE_OPTIONS;
  if (isVareteira(sectorOrdem)) return WOOD_MEASURE_OPTIONS;
  return [];
}

function getVariantLabel(sectorOrdem: number) {
  if (isMultilamina(sectorOrdem)) return "Tipo de Madeira";
  if (isVareteira(sectorOrdem)) return "Medida de Madeira";
  return "";
}

function getVariantIcon(sectorOrdem: number) {
  if (isMultilamina(sectorOrdem)) return TreePine;
  return Ruler;
}

export default function Production() {
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
  const [viewMode, setViewMode] = useState<"lancamento" | "historico">("lancamento");

  const utils = trpc.useUtils();

  const { data: sectors, isLoading: loadingSectors } = trpc.production.getSectors.useQuery();
  const { data: entries } = trpc.production.getEntries.useQuery({ data: selectedDate });
  const { data: dailySummary } = trpc.production.getDailySummary.useQuery({ data: selectedDate });

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
    if (machineEntries.length > 0) return machineEntries[0].status || "producao_normal";
    return "producao_normal";
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
      let sectorTotal = 0;
      for (const machine of sector.machines) {
        for (const opt of variantOpts) {
          const varKey = `${sectorId}-${machine.id}-${opt.value}`;
          // Se o usuário editou o campo, usar o valor editado (mesmo que seja 0)
          if (variantEditValues[varKey] !== undefined) {
            if (variantEditValues[varKey] !== "") {
              const num = parseFloat(variantEditValues[varKey].replace(",", "."));
              if (!isNaN(num) && num >= 0) sectorTotal += num;
            }
            // Se editou e está vazio, conta como 0 (não busca do banco)
          } else {
            // Não editou: buscar do banco
            const entry = getEntryForVariant(sectorId, machine.id, opt.value);
            if (entry) sectorTotal += Number(entry.quantidade);
          }
        }
      }
      return sectorTotal;
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

  // Save for expandable sectors - always sends ALL variant options
  const handleVariantSave = (sectorId: number, machineId: number | null, sectorOrdem: number) => {
    const machineKey = `${sectorId}-${machineId || "null"}`;
    const status = statusValues[machineKey] || getEntryStatus(sectorId, machineId);
    const comment = commentValues[machineKey] !== undefined ? commentValues[machineKey] : getEntryComment(sectorId, machineId);

    const variantOpts = getVariantOptions(sectorOrdem);
    const batchEntries: any[] = [];

    for (const opt of variantOpts) {
      const varKey = `${machineKey}-${opt.value}`;
      const existingEntry = getEntryForVariant(sectorId, machineId, opt.value);
      const val = variantEditValues[varKey];
      let quantidade: number;
      if (val !== undefined) {
        // Usuário editou o campo: usar valor editado (0 se vazio)
        quantidade = val !== "" ? parseFloat(val.replace(",", ".")) : 0;
      } else if (existingEntry) {
        // Não editou: manter valor do banco
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

    setSavingKeys(prev => new Set(prev).add(machineKey));
    batchUpsert.mutate({ sectorId, machineId, data: selectedDate, entries: batchEntries });
  };

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

  const getStatusValue = (sectorId: number, machineId: number | null): string => {
    const key = `${sectorId}-${machineId || "null"}`;
    if (statusValues[key] !== undefined) return statusValues[key];
    return getEntryStatus(sectorId, machineId);
  };

  const setStatusValue = (sectorId: number, machineId: number | null, value: string) => {
    const key = `${sectorId}-${machineId || "null"}`;
    setStatusValues(prev => ({ ...prev, [key]: value }));
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

  // Compute live total for a machine from all fixed variant fields
  const getMachineLiveTotal = (sectorId: number, machineId: number | null, sectorOrdem: number): number => {
    const variantOpts = getVariantOptions(sectorOrdem);
    let total = 0;
    for (const opt of variantOpts) {
      const val = getVariantEditValue(sectorId, machineId, opt.value);
      if (val !== "") {
        const num = parseFloat(val.replace(",", "."));
        if (!isNaN(num) && num >= 0) total += num;
      }
    }
    return total;
  };

  const dayOfWeek = useMemo(() => {
    const d = new Date(selectedDate + "T12:00:00");
    return diasSemana[d.getDay()];
  }, [selectedDate]);

  const isToday = selectedDate === getTodayBR();

  if (loadingSectors) {
    return (
      <div className="min-h-screen bg-slate-50">
        <TopNav />
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <TopNav />
      <div className="container py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Factory className="w-6 h-6 text-teal-600" />
              Controle de Produção
            </h1>
            <p className="text-sm text-slate-500 mt-1">Lançamento diário de produção por setor e máquina</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setViewMode("lancamento")} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === "lancamento" ? "bg-teal-600 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>
              <Save className="w-4 h-4" /> Lançamento
            </button>
            <button onClick={() => setViewMode("historico")} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === "historico" ? "bg-teal-600 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>
              <History className="w-4 h-4" /> Histórico
            </button>
          </div>
        </div>

        {/* Date selector */}
        <div className="flex items-center gap-3 mb-6 bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
          <Calendar className="w-5 h-5 text-teal-600" />
          <button onClick={() => changeDate(-1)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors">
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </button>
          <div className="flex items-center gap-2">
            <input type="date" value={selectedDate} onChange={(e) => { setSelectedDate(e.target.value); resetEditState(); }} className="text-sm font-medium text-slate-700 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500" />
            <span className="text-sm text-slate-500 font-medium">
              {dayOfWeek}
              {isToday && <span className="ml-1.5 text-xs bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full font-semibold">Hoje</span>}
            </span>
          </div>
          <button onClick={() => changeDate(1)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors">
            <ArrowRight className="w-4 h-4 text-slate-600" />
          </button>
          <button onClick={() => { setSelectedDate(getTodayBR()); resetEditState(); }} className="ml-auto text-xs text-teal-600 hover:text-teal-700 font-medium px-2 py-1 rounded hover:bg-teal-50 transition-colors">
            Ir para Hoje
          </button>
        </div>

        {viewMode === "lancamento" ? (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-3 mb-6">
              {sectors?.map(sector => {
                const total = getSectorTotal(sector.id);
                const Icon = getSectorIcon(sector.ordem);
                return (
                  <div key={sector.id} className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => toggleSector(sector.id)}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: (sector.cor || "#6b7280") + "20" }}>
                        <Icon className="w-3.5 h-3.5" style={{ color: sector.cor || "#6b7280" }} />
                      </div>
                      <span className="text-[10px] font-semibold text-slate-500 uppercase truncate leading-tight">{sector.nome}</span>
                    </div>
                    <div className="text-lg font-bold text-slate-800 tabular-nums">{fmtNum(total, sector.unidadeMedida === "m³" ? 3 : 0)}</div>
                    <div className="text-[10px] text-slate-400">{sector.unidadeLabel}</div>
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

                return (
                  <div key={sector.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
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
                          {sector.isSequencial && <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-semibold">Sequencial</span>}
                          {isMultilamina(sector.ordem) && <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold">Tipo Madeira</span>}
                          {isVareteira(sector.ordem) && <span className="text-[9px] bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded-full font-semibold">Medida Madeira</span>}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {hasMachines ? `${sector.quantidadeEquipamentos} ${sector.tipoEquipamento === "mesa" ? "mesas" : "máquinas"}` : "Sem equipamento"}
                          {" · "}{sector.unidadeLabel}
                        </div>
                      </div>
                      <div className="text-right mr-3">
                        <div className="text-lg font-bold tabular-nums" style={{ color: sector.cor || "#6b7280" }}>{fmtNum(total, decimals)}</div>
                        <div className="text-[10px] text-slate-400">{sector.unidadeMedida}</div>
                      </div>
                      {isExpanded ? <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" /> : <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />}
                    </div>

                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/50">
                        {hasMachines ? (
                          <div className="divide-y divide-slate-100">
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
                                    liveTotal={getMachineLiveTotal(sector.id, machine.id, sector.ordem)}
                                    changed={hasChanges(sector.id, machine.id)}
                                    getVariantValue={(v) => getVariantEditValue(sector.id, machine.id, v)}
                                    onToggleMachine={() => toggleMachine(sector.id, machine.id)}
                                    onToggleComment={() => toggleComment(`${sector.id}-${machine.id}`)}
                                    onSetStatus={(v) => setStatusValue(sector.id, machine.id, v)}
                                    onSetVariantValue={(v, val) => setVariantEditValue(`${sector.id}-${machine.id}-${v}`, val)}
                                    onSetComment={(v) => setCommentValue(sector.id, machine.id, v)}
                                    onSave={() => handleVariantSave(sector.id, machine.id, sector.ordem)}
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
                                />
                              );
                            })}
                          </div>
                        ) : (
                          <SectorWithoutMachines
                            sector={sector}
                            currentVal={getEditValue(sector.id, null)}
                            currentComment={getCommentValue(sector.id, null)}
                            commentIsOpen={commentOpen.has(`${sector.id}-null`)}
                            isSaving={savingKeys.has(`${sector.id}-null`)}
                            changed={hasChanges(sector.id, null)}
                            onSetValue={(v) => setEditValue(sector.id, null, v)}
                            onSetComment={(v) => setCommentValue(sector.id, null, v)}
                            onToggleComment={() => toggleComment(`${sector.id}-null`)}
                            onSave={() => handleSimpleSave(sector.id, null)}
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <HistoryView sectors={sectors || []} weekRange={weekRange} weeklySummary={weeklySummary || []} selectedDate={selectedDate} />
        )}
      </div>
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
  getVariantValue: (variant: string) => string;
  onToggleMachine: () => void;
  onToggleComment: () => void;
  onSetStatus: (v: string) => void;
  onSetVariantValue: (variant: string, value: string) => void;
  onSetComment: (v: string) => void;
  onSave: () => void;
}

function ExpandableMachineRow({
  sector, machine, machineExpanded, commentIsOpen, isSaving,
  currentStatus, currentComment, liveTotal, changed,
  getVariantValue, onToggleMachine, onToggleComment, onSetStatus,
  onSetVariantValue, onSetComment, onSave,
}: ExpandableMachineRowProps) {
  const statusOpt = getStatusOption(currentStatus);
  const hasComment = currentComment.trim().length > 0;
  const variantOptions = getVariantOptions(sector.ordem);
  const variantLabel = getVariantLabel(sector.ordem);
  const VariantIcon = getVariantIcon(sector.ordem);
  const decimals = sector.unidadeMedida === "m³" ? 3 : 0;

  // Build per-variant display for badges (only show variants with value > 0)
  const variantDisplay: { label: string; value: number; bgClass: string; textClass: string; borderClass: string }[] = [];
  for (const opt of variantOptions) {
    const val = getVariantValue(opt.value);
    const num = val !== "" ? parseFloat(val.replace(",", ".")) : 0;
    if (!isNaN(num) && num > 0) {
      variantDisplay.push({ label: opt.label, value: num, bgClass: opt.bgClass, textClass: opt.textClass, borderClass: opt.borderClass });
    }
  }

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

        {/* Status badge */}
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusOpt.bgClass} ${statusOpt.textClass} ${statusOpt.borderClass}`}>
          <statusOpt.icon className="w-3 h-3" />
          <span className="hidden sm:inline">{statusOpt.label}</span>
        </div>

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
          <div className="text-sm font-bold tabular-nums text-slate-700">{fmtNum(liveTotal, decimals)}</div>
          <div className="text-[9px] text-slate-400">{sector.unidadeMedida}</div>
        </div>

        {/* Save button */}
        <button onClick={onSave} disabled={isSaving || !changed} className="w-8 h-8 rounded-lg flex items-center justify-center bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0">
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        </button>
      </div>

      {/* Comment box */}
      {commentIsOpen && (
        <div className="px-4 pb-2 pl-16">
          <div className="bg-white rounded-lg border border-slate-200 p-2">
            <textarea value={currentComment} onChange={(e) => onSetComment(e.target.value)} placeholder="Adicionar comentário ou observação..." rows={2} className="w-full text-xs text-slate-600 border-0 bg-transparent resize-none focus:outline-none placeholder:text-slate-400" />
          </div>
        </div>
      )}

      {/* Expanded panel */}
      {machineExpanded && (
        <div className="px-4 pb-3 pl-16 space-y-2">
          {/* Status selector */}
          <div className="bg-white rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Status da Máquina</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {MACHINE_STATUS_OPTIONS.map(opt => {
                const isSelected = currentStatus === opt.value;
                const OptIcon = opt.icon;
                return (
                  <button key={opt.value} onClick={() => onSetStatus(opt.value)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${isSelected ? `${opt.bgClass} ${opt.textClass} ${opt.borderClass} ring-2 ring-offset-1` : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"}`}
                    style={isSelected ? { '--tw-ring-color': opt.color } as React.CSSProperties : {}}
                  >
                    <OptIcon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fixed variant inputs - ALL always visible */}
          <div className="bg-white rounded-lg border border-slate-200 p-3">
            <div className="flex items-center gap-2 mb-3">
              <VariantIcon className="w-3.5 h-3.5 text-slate-500" />
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Produção por {variantLabel}</p>
            </div>
            <div className={`grid gap-2 ${variantOptions.length <= 3 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"}`}>
              {variantOptions.map(opt => {
                const val = getVariantValue(opt.value);
                return (
                  <div key={opt.value} className="flex items-center gap-2">
                    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold shrink-0 ${opt.bgClass} ${opt.textClass} ${opt.borderClass}`} style={{ minWidth: variantOptions.length <= 3 ? "110px" : "80px" }}>
                      <VariantIcon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{opt.label}</span>
                    </div>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={val}
                      onChange={(e) => onSetVariantValue(opt.value, e.target.value)}
                      placeholder="0"
                      className="flex-1 min-w-0 w-20 text-right text-sm font-medium border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 tabular-nums bg-white"
                    />
                    <span className="text-[10px] text-slate-400 shrink-0 w-8">{sector.unidadeMedida}</span>
                  </div>
                );
              })}
            </div>
          </div>
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
}

function SimpleMachineRow({ sector, machine, commentIsOpen, isSaving, currentVal, currentComment, changed, onToggleComment, onSetValue, onSetComment, onSave }: SimpleMachineRowProps) {
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
          <input type="text" inputMode="decimal" value={currentVal} onChange={(e) => onSetValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") onSave(); }} placeholder="0" className="w-24 text-right text-sm font-medium border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 tabular-nums bg-white" />
          <span className="text-xs text-slate-400 w-10">{sector.unidadeMedida}</span>
          <button onClick={onSave} disabled={isSaving || !changed} className="w-8 h-8 rounded-lg flex items-center justify-center bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          </button>
        </div>
      </div>
      {commentIsOpen && (
        <div className="px-4 pb-2 pl-16">
          <div className="bg-white rounded-lg border border-slate-200 p-2">
            <textarea value={currentComment} onChange={(e) => onSetComment(e.target.value)} placeholder="Adicionar comentário ou observação..." rows={2} className="w-full text-xs text-slate-600 border-0 bg-transparent resize-none focus:outline-none placeholder:text-slate-400" />
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SECTOR WITHOUT MACHINES (Embalagem)
   ═══════════════════════════════════════════════════════════ */
interface SectorWithoutMachinesProps {
  sector: any; currentVal: string; currentComment: string; commentIsOpen: boolean;
  isSaving: boolean; changed: boolean;
  onSetValue: (v: string) => void; onSetComment: (v: string) => void;
  onToggleComment: () => void; onSave: () => void;
}

function SectorWithoutMachines({ sector, currentVal, currentComment, commentIsOpen, isSaving, changed, onSetValue, onSetComment, onToggleComment, onSave }: SectorWithoutMachinesProps) {
  const hasComment = currentComment.trim().length > 0;
  return (
    <div>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-8 h-8 rounded-md bg-white border border-slate-200 flex items-center justify-center shrink-0">
          <Box className="w-4 h-4 text-slate-400" />
        </div>
        <span className="text-sm text-slate-600 font-medium flex-1">Produção do setor</span>
        <button onClick={onToggleComment} className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors ${hasComment || commentIsOpen ? "bg-blue-50 text-blue-600 border border-blue-200" : "bg-white text-slate-400 border border-slate-200 hover:bg-slate-50"}`} title="Comentário">
          <MessageSquare className="w-3.5 h-3.5" />
        </button>
        <div className="flex items-center gap-2 shrink-0">
          <input type="text" inputMode="decimal" value={currentVal} onChange={(e) => onSetValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") onSave(); }} placeholder="0" className="w-24 text-right text-sm font-medium border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 tabular-nums bg-white" />
          <span className="text-xs text-slate-400 w-10">{sector.unidadeMedida}</span>
          <button onClick={onSave} disabled={isSaving || !changed} className="w-8 h-8 rounded-lg flex items-center justify-center bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          </button>
        </div>
      </div>
      {commentIsOpen && (
        <div className="px-4 pb-3 pl-16">
          <div className="bg-white rounded-lg border border-slate-200 p-2">
            <textarea value={currentComment} onChange={(e) => onSetComment(e.target.value)} placeholder="Adicionar comentário ou observação..." rows={2} className="w-full text-xs text-slate-600 border-0 bg-transparent resize-none focus:outline-none placeholder:text-slate-400" />
          </div>
        </div>
      )}
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
        m[entry.sectorId][entry.data] = Number(entry.total);
      }
    }
    return m;
  }, [sectors, weekDays, weeklySummary]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-teal-600" />
          <h2 className="text-sm font-bold text-slate-700">Histórico Semanal — {fmtDate(weekRange.start)} a {fmtDate(weekRange.end)}</h2>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
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
              const decimals = sector.unidadeMedida === "m³" ? 3 : 0;
              const weekTotal = weekDays.reduce((sum, day) => sum + (matrix[sector.id]?.[day] || 0), 0);
              return (
                <tr key={sector.id} className="border-b border-slate-100 hover:bg-slate-50/50">
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
                          {val > 0 ? fmtNum(val, decimals) : "—"}
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
