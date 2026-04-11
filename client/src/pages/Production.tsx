/**
 * Produção - Controle de produção industrial
 * 9 setores com lançamento diário por máquina/mesa
 * Multilamina e Vareteira: status expandível + tipo de madeira por máquina
 * Todos os setores: caixa de comentários opcional
 */

import { useState, useMemo } from "react";
import TopNav from "@/components/TopNav";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Factory,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Save,
  Calendar,
  BarChart3,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Cog,
  Eye,
  Package,
  Box,
  Zap,
  Scissors,
  Layers,
  Printer,
  History,
  AlertTriangle,
  Wrench,
  Ban,
  CheckCircle2,
  Clock,
  MessageSquare,
  TreePine,
} from "lucide-react";

// ─── Status options ───
const MACHINE_STATUS_OPTIONS = [
  { value: "producao_normal", label: "Produção Normal", color: "#10b981", icon: CheckCircle2, bgClass: "bg-emerald-50", textClass: "text-emerald-700", borderClass: "border-emerald-200" },
  { value: "falta_madeira", label: "Falta de Madeira", color: "#ef4444", icon: AlertTriangle, bgClass: "bg-red-50", textClass: "text-red-700", borderClass: "border-red-200" },
  { value: "producao_nao_necessaria", label: "Produção Não Necessária", color: "#f59e0b", icon: Ban, bgClass: "bg-amber-50", textClass: "text-amber-700", borderClass: "border-amber-200" },
  { value: "manutencao", label: "Manutenção", color: "#6366f1", icon: Wrench, bgClass: "bg-indigo-50", textClass: "text-indigo-700", borderClass: "border-indigo-200" },
  { value: "manutencao_pontual", label: "Manutenção Pontual", color: "#8b5cf6", icon: Clock, bgClass: "bg-violet-50", textClass: "text-violet-700", borderClass: "border-violet-200" },
];

// ─── Wood type options ───
const WOOD_TYPE_OPTIONS = [
  { value: "benazzi", label: "Benazzi", color: "#d97706", bgClass: "bg-amber-50", textClass: "text-amber-800", borderClass: "border-amber-300" },
  { value: "madeira_dura", label: "Madeira Dura", color: "#059669", bgClass: "bg-emerald-50", textClass: "text-emerald-800", borderClass: "border-emerald-300" },
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
    case 1: return Layers;
    case 2: return Cog;
    case 3: return Eye;
    case 4: return Zap;
    case 5: return Eye;
    case 6: return Package;
    case 7: return Scissors;
    case 8: return Box;
    case 9: return Printer;
    default: return Factory;
  }
}

const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// Check if sector has expandable features (status + wood type)
function hasExpandableFeatures(sectorOrdem: number) {
  return sectorOrdem === 1 || sectorOrdem === 2; // Multilamina e Vareteira
}

export default function Production() {
  const [selectedDate, setSelectedDate] = useState(getTodayBR);
  const [expandedSectors, setExpandedSectors] = useState<Set<number>>(new Set());
  const [expandedMachines, setExpandedMachines] = useState<Set<string>>(new Set());
  const [commentOpen, setCommentOpen] = useState<Set<string>>(new Set()); // keys for open comment boxes
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [statusValues, setStatusValues] = useState<Record<string, string>>({});
  const [woodTypeValues, setWoodTypeValues] = useState<Record<string, Set<string>>>({});
  const [commentValues, setCommentValues] = useState<Record<string, string>>({});
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"lancamento" | "historico">("lancamento");

  const utils = trpc.useUtils();

  const { data: sectors, isLoading: loadingSectors } = trpc.production.getSectors.useQuery();
  const { data: entries } = trpc.production.getEntries.useQuery({ data: selectedDate });
  const { data: dailySummary } = trpc.production.getDailySummary.useQuery({ data: selectedDate });

  const weekRange = useMemo(() => getWeekRange(selectedDate), [selectedDate]);
  const { data: weeklySummary } = trpc.production.getWeeklySummary.useQuery({
    dataInicio: weekRange.start,
    dataFim: weekRange.end,
  }, { enabled: viewMode === "historico" });

  const upsertEntry = trpc.production.upsertEntry.useMutation({
    onSuccess: (_result, variables) => {
      const key = `${variables.sectorId}-${variables.machineId || "null"}`;
      setSavingKeys(prev => { const n = new Set(prev); n.delete(key); return n; });
      utils.production.getEntries.invalidate({ data: selectedDate });
      utils.production.getDailySummary.invalidate({ data: selectedDate });
      utils.production.getWeeklySummary.invalidate();
      toast.success("Produção salva!");
    },
    onError: (err, variables) => {
      const key = `${variables.sectorId}-${variables.machineId || "null"}`;
      setSavingKeys(prev => { const n = new Set(prev); n.delete(key); return n; });
      toast.error("Erro ao salvar: " + err.message);
    },
  });

  const toggleSector = (id: number) => {
    setExpandedSectors(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const toggleMachine = (sectorId: number, machineId: number) => {
    const key = `${sectorId}-${machineId}`;
    setExpandedMachines(prev => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
  };

  const toggleComment = (key: string) => {
    setCommentOpen(prev => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
  };

  const resetEditState = () => {
    setEditValues({});
    setStatusValues({});
    setWoodTypeValues({});
    setCommentValues({});
  };

  const changeDate = (delta: number) => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() + delta);
    setSelectedDate(d.toISOString().slice(0, 10));
    resetEditState();
  };

  // ─── Entry helpers ───
  const getEntry = (sectorId: number, machineId: number | null) => {
    if (!entries) return null;
    return entries.find(e =>
      e.sectorId === sectorId &&
      (machineId ? e.machineId === machineId : e.machineId === null)
    ) || null;
  };

  const getEntryStatus = (sectorId: number, machineId: number | null): string => {
    const entry = getEntry(sectorId, machineId);
    return entry?.status || "producao_normal";
  };

  const getEntryWoodTypes = (sectorId: number, machineId: number | null): Set<string> => {
    const entry = getEntry(sectorId, machineId);
    if (!entry?.tipoMadeira) return new Set();
    return new Set(entry.tipoMadeira.split(",").filter(Boolean));
  };

  const getEntryComment = (sectorId: number, machineId: number | null): string => {
    const entry = getEntry(sectorId, machineId);
    return entry?.observacoes || "";
  };

  const getSectorTotal = (sectorId: number): number => {
    if (!dailySummary) return 0;
    const s = dailySummary.find(d => d.sectorId === sectorId);
    return s ? Number(s.total) : 0;
  };

  // ─── Save handler ───
  const handleSave = (sectorId: number, machineId: number | null, _unidade: string) => {
    const key = `${sectorId}-${machineId || "null"}`;
    const val = editValues[key];
    const status = statusValues[key];
    const woodTypes = woodTypeValues[key];
    const comment = commentValues[key];

    const quantidade = val !== undefined && val !== "" ? parseFloat(val.replace(",", ".")) : 0;
    if (isNaN(quantidade) || quantidade < 0) {
      toast.error("Valor inválido");
      return;
    }

    // Build tipoMadeira string from set
    let tipoMadeira: string | undefined;
    if (woodTypes && woodTypes.size > 0) {
      tipoMadeira = Array.from(woodTypes).sort().join(",");
    } else {
      // Use existing value if not changed
      const existingWood = getEntryWoodTypes(sectorId, machineId);
      if (existingWood.size > 0) {
        tipoMadeira = Array.from(existingWood).sort().join(",");
      }
    }

    setSavingKeys(prev => new Set(prev).add(key));
    upsertEntry.mutate({
      sectorId,
      machineId,
      data: selectedDate,
      quantidade,
      status: status || getEntryStatus(sectorId, machineId),
      tipoMadeira,
      observacoes: comment !== undefined ? comment : getEntryComment(sectorId, machineId),
    });
  };

  // ─── Edit value helpers ───
  const getEditValue = (sectorId: number, machineId: number | null): string => {
    const key = `${sectorId}-${machineId || "null"}`;
    if (editValues[key] !== undefined) return editValues[key];
    const entry = getEntry(sectorId, machineId);
    if (entry) return String(Number(entry.quantidade));
    return "";
  };

  const setEditValue = (sectorId: number, machineId: number | null, value: string) => {
    const key = `${sectorId}-${machineId || "null"}`;
    setEditValues(prev => ({ ...prev, [key]: value }));
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

  const getWoodTypeValue = (sectorId: number, machineId: number | null): Set<string> => {
    const key = `${sectorId}-${machineId || "null"}`;
    if (woodTypeValues[key]) return woodTypeValues[key];
    return getEntryWoodTypes(sectorId, machineId);
  };

  const toggleWoodType = (sectorId: number, machineId: number | null, woodType: string) => {
    const key = `${sectorId}-${machineId || "null"}`;
    setWoodTypeValues(prev => {
      const current = prev[key] ? new Set(prev[key]) : new Set(getEntryWoodTypes(sectorId, machineId));
      if (current.has(woodType)) {
        current.delete(woodType);
      } else {
        current.add(woodType);
      }
      return { ...prev, [key]: current };
    });
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
    return editValues[key] !== undefined || statusValues[key] !== undefined || woodTypeValues[key] !== undefined || commentValues[key] !== undefined;
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
            <button
              onClick={() => setViewMode("lancamento")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === "lancamento" ? "bg-teal-600 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}
            >
              <Save className="w-4 h-4" />
              Lançamento
            </button>
            <button
              onClick={() => setViewMode("historico")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === "historico" ? "bg-teal-600 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}
            >
              <History className="w-4 h-4" />
              Histórico
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
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => { setSelectedDate(e.target.value); resetEditState(); }}
              className="text-sm font-medium text-slate-700 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
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
                const isExpandable = hasExpandableFeatures(sector.ordem);

                return (
                  <div key={sector.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    {/* Sector header */}
                    <div
                      onClick={() => toggleSector(sector.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggleSector(sector.id); }}
                    >
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: (sector.cor || "#6b7280") + "15" }}>
                        <Icon className="w-5 h-5" style={{ color: sector.cor || "#6b7280" }} />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-800">{sector.ordem}. {sector.nome}</span>
                          {sector.isSequencial && <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-semibold">Sequencial</span>}
                          {isExpandable && <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-semibold">Status + Madeira</span>}
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

                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/50">
                        {hasMachines ? (
                          <div className="divide-y divide-slate-100">
                            {sector.machines.map((machine: any) => (
                              <MachineRow
                                key={machine.id}
                                sector={sector}
                                machine={machine}
                                isExpandable={isExpandable}
                                machineExpanded={expandedMachines.has(`${sector.id}-${machine.id}`)}
                                commentIsOpen={commentOpen.has(`${sector.id}-${machine.id}`)}
                                isSaving={savingKeys.has(`${sector.id}-${machine.id}`)}
                                currentVal={getEditValue(sector.id, machine.id)}
                                currentStatus={getStatusValue(sector.id, machine.id)}
                                currentWoodTypes={getWoodTypeValue(sector.id, machine.id)}
                                currentComment={getCommentValue(sector.id, machine.id)}
                                changed={hasChanges(sector.id, machine.id)}
                                onToggleMachine={() => toggleMachine(sector.id, machine.id)}
                                onToggleComment={() => toggleComment(`${sector.id}-${machine.id}`)}
                                onSetValue={(v) => setEditValue(sector.id, machine.id, v)}
                                onSetStatus={(v) => setStatusValue(sector.id, machine.id, v)}
                                onToggleWoodType={(v) => toggleWoodType(sector.id, machine.id, v)}
                                onSetComment={(v) => setCommentValue(sector.id, machine.id, v)}
                                onSave={() => handleSave(sector.id, machine.id, sector.unidadeMedida)}
                              />
                            ))}
                          </div>
                        ) : (
                          /* Sector without machines (Embalagem) */
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
                            onSave={() => handleSave(sector.id, null, sector.unidadeMedida)}
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
   MACHINE ROW COMPONENT
   ═══════════════════════════════════════════════════════════ */
interface MachineRowProps {
  sector: any;
  machine: any;
  isExpandable: boolean;
  machineExpanded: boolean;
  commentIsOpen: boolean;
  isSaving: boolean;
  currentVal: string;
  currentStatus: string;
  currentWoodTypes: Set<string>;
  currentComment: string;
  changed: boolean;
  onToggleMachine: () => void;
  onToggleComment: () => void;
  onSetValue: (v: string) => void;
  onSetStatus: (v: string) => void;
  onToggleWoodType: (v: string) => void;
  onSetComment: (v: string) => void;
  onSave: () => void;
}

function MachineRow({
  sector, machine, isExpandable, machineExpanded, commentIsOpen, isSaving,
  currentVal, currentStatus, currentWoodTypes, currentComment, changed,
  onToggleMachine, onToggleComment, onSetValue, onSetStatus, onToggleWoodType, onSetComment, onSave,
}: MachineRowProps) {
  const statusOpt = getStatusOption(currentStatus);
  const hasComment = currentComment.trim().length > 0;

  return (
    <div className="bg-white/50">
      {/* Machine header row */}
      <div className="flex items-center gap-3 px-4 py-2.5">
        {isExpandable ? (
          <div
            className="w-8 h-8 rounded-md bg-white border border-slate-200 flex items-center justify-center shrink-0 cursor-pointer hover:bg-slate-50 transition-colors"
            onClick={onToggleMachine}
          >
            {machineExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
          </div>
        ) : (
          <div className="w-8 h-8 rounded-md bg-white border border-slate-200 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-slate-500">{machine.ordem}</span>
          </div>
        )}

        <span
          className={`text-sm text-slate-600 font-medium flex-1 min-w-0 truncate ${isExpandable ? "cursor-pointer" : ""}`}
          onClick={isExpandable ? onToggleMachine : undefined}
        >
          {machine.nome}
        </span>

        {/* Status badge (only for expandable sectors) */}
        {isExpandable && (
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusOpt.bgClass} ${statusOpt.textClass} ${statusOpt.borderClass}`}>
            <statusOpt.icon className="w-3 h-3" />
            <span className="hidden sm:inline">{statusOpt.label}</span>
          </div>
        )}

        {/* Wood type badges (only for expandable sectors) */}
        {isExpandable && currentWoodTypes.size > 0 && (
          <div className="flex items-center gap-1">
            {Array.from(currentWoodTypes).map(wt => {
              const opt = WOOD_TYPE_OPTIONS.find(o => o.value === wt);
              if (!opt) return null;
              return (
                <span key={wt} className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold border ${opt.bgClass} ${opt.textClass} ${opt.borderClass}`}>
                  {opt.label}
                </span>
              );
            })}
          </div>
        )}

        {/* Comment indicator */}
        <button
          onClick={onToggleComment}
          className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors ${
            hasComment || commentIsOpen ? "bg-blue-50 text-blue-600 border border-blue-200" : "bg-white text-slate-400 border border-slate-200 hover:bg-slate-50"
          }`}
          title="Comentário"
        >
          <MessageSquare className="w-3.5 h-3.5" />
        </button>

        <div className="flex items-center gap-2 shrink-0">
          <input
            type="text"
            inputMode="decimal"
            value={currentVal}
            onChange={(e) => onSetValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onSave(); }}
            placeholder="0"
            className="w-24 text-right text-sm font-medium border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 tabular-nums bg-white"
          />
          <span className="text-xs text-slate-400 w-10">{sector.unidadeMedida}</span>
          <button
            onClick={onSave}
            disabled={isSaving || !changed}
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Comment box (all sectors) */}
      {commentIsOpen && (
        <div className="px-4 pb-2 pl-16">
          <div className="bg-white rounded-lg border border-slate-200 p-2">
            <textarea
              value={currentComment}
              onChange={(e) => onSetComment(e.target.value)}
              placeholder="Adicionar comentário ou observação..."
              rows={2}
              className="w-full text-xs text-slate-600 border-0 bg-transparent resize-none focus:outline-none placeholder:text-slate-400"
            />
          </div>
        </div>
      )}

      {/* Expanded panel: status + wood type (Multilamina and Vareteira only) */}
      {isExpandable && machineExpanded && (
        <div className="px-4 pb-3 pl-16 space-y-2">
          {/* Status selector */}
          <div className="bg-white rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Status da Máquina</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {MACHINE_STATUS_OPTIONS.map(opt => {
                const isSelected = currentStatus === opt.value;
                const OptIcon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    onClick={() => onSetStatus(opt.value)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                      isSelected
                        ? `${opt.bgClass} ${opt.textClass} ${opt.borderClass} ring-2 ring-offset-1`
                        : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                    }`}
                    style={isSelected ? { '--tw-ring-color': opt.color } as React.CSSProperties : {}}
                  >
                    <OptIcon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Wood type selector */}
          <div className="bg-white rounded-lg border border-slate-200 p-3">
            <div className="flex items-center gap-2 mb-2">
              <TreePine className="w-3.5 h-3.5 text-slate-500" />
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo de Madeira</p>
              <span className="text-[10px] text-slate-400 ml-1">(pode selecionar ambos)</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {WOOD_TYPE_OPTIONS.map(opt => {
                const isSelected = currentWoodTypes.has(opt.value);
                return (
                  <button
                    key={opt.value}
                    onClick={() => onToggleWoodType(opt.value)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                      isSelected
                        ? `${opt.bgClass} ${opt.textClass} ${opt.borderClass} ring-2 ring-offset-1`
                        : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                    }`}
                    style={isSelected ? { '--tw-ring-color': opt.color } as React.CSSProperties : {}}
                  >
                    <TreePine className="w-4 h-4 shrink-0" />
                    <span>{opt.label}</span>
                    {isSelected && <CheckCircle2 className="w-4 h-4 ml-auto shrink-0" />}
                  </button>
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
   SECTOR WITHOUT MACHINES (Embalagem)
   ═══════════════════════════════════════════════════════════ */
interface SectorWithoutMachinesProps {
  sector: any;
  currentVal: string;
  currentComment: string;
  commentIsOpen: boolean;
  isSaving: boolean;
  changed: boolean;
  onSetValue: (v: string) => void;
  onSetComment: (v: string) => void;
  onToggleComment: () => void;
  onSave: () => void;
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
        <button
          onClick={onToggleComment}
          className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors ${
            hasComment || commentIsOpen ? "bg-blue-50 text-blue-600 border border-blue-200" : "bg-white text-slate-400 border border-slate-200 hover:bg-slate-50"
          }`}
          title="Comentário"
        >
          <MessageSquare className="w-3.5 h-3.5" />
        </button>
        <div className="flex items-center gap-2 shrink-0">
          <input
            type="text"
            inputMode="decimal"
            value={currentVal}
            onChange={(e) => onSetValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onSave(); }}
            placeholder="0"
            className="w-24 text-right text-sm font-medium border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 tabular-nums bg-white"
          />
          <span className="text-xs text-slate-400 w-10">{sector.unidadeMedida}</span>
          <button
            onClick={onSave}
            disabled={isSaving || !changed}
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          </button>
        </div>
      </div>
      {commentIsOpen && (
        <div className="px-4 pb-3 pl-16">
          <div className="bg-white rounded-lg border border-slate-200 p-2">
            <textarea
              value={currentComment}
              onChange={(e) => onSetComment(e.target.value)}
              placeholder="Adicionar comentário ou observação..."
              rows={2}
              className="w-full text-xs text-slate-600 border-0 bg-transparent resize-none focus:outline-none placeholder:text-slate-400"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   HISTORY VIEW COMPONENT
   ═══════════════════════════════════════════════════════════ */
interface HistoryViewProps {
  sectors: any[];
  weekRange: { start: string; end: string };
  weeklySummary: any[];
  selectedDate: string;
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
      for (const day of weekDays) {
        m[sector.id][day] = 0;
      }
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
