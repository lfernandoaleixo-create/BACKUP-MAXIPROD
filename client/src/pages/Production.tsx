/**
 * Produção - Controle de produção industrial
 * 9 setores com lançamento diário por máquina/mesa
 * Multilamina (setor 1) com status expandível por máquina
 */

import { useState, useMemo, useCallback } from "react";
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
} from "lucide-react";

// Status options for machines (especially Multilamina)
const MACHINE_STATUS_OPTIONS = [
  { value: "producao_normal", label: "Produção Normal", color: "#10b981", icon: CheckCircle2, bgClass: "bg-emerald-50", textClass: "text-emerald-700", borderClass: "border-emerald-200" },
  { value: "falta_madeira", label: "Falta de Madeira", color: "#ef4444", icon: AlertTriangle, bgClass: "bg-red-50", textClass: "text-red-700", borderClass: "border-red-200" },
  { value: "producao_nao_necessaria", label: "Produção Não Necessária", color: "#f59e0b", icon: Ban, bgClass: "bg-amber-50", textClass: "text-amber-700", borderClass: "border-amber-200" },
  { value: "manutencao", label: "Manutenção", color: "#6366f1", icon: Wrench, bgClass: "bg-indigo-50", textClass: "text-indigo-700", borderClass: "border-indigo-200" },
] as const;

function getStatusOption(value: string) {
  return MACHINE_STATUS_OPTIONS.find(o => o.value === value) || MACHINE_STATUS_OPTIONS[0];
}

// Format number with locale
function fmtNum(n: number, decimals = 0): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// Get today's date in YYYY-MM-DD (Brasilia timezone)
function getTodayBR(): string {
  const now = new Date();
  const br = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return br.toISOString().slice(0, 10);
}

// Format date for display
function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

// Get week range (Monday to Sunday) for a given date
function getWeekRange(dateStr: string): { start: string; end: string } {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  };
}

// Sector icon mapping
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

// Days of week labels
const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function Production() {
  const [selectedDate, setSelectedDate] = useState(getTodayBR);
  const [expandedSectors, setExpandedSectors] = useState<Set<number>>(new Set());
  const [expandedMachines, setExpandedMachines] = useState<Set<string>>(new Set()); // "sectorId-machineId"
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [statusValues, setStatusValues] = useState<Record<string, string>>({});
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"lancamento" | "historico">("lancamento");

  const utils = trpc.useUtils();

  // Fetch sectors with machines
  const { data: sectors, isLoading: loadingSectors } = trpc.production.getSectors.useQuery();

  // Fetch entries for selected date
  const { data: entries, isLoading: loadingEntries } = trpc.production.getEntries.useQuery({
    data: selectedDate,
  });

  // Fetch daily summary
  const { data: dailySummary } = trpc.production.getDailySummary.useQuery({
    data: selectedDate,
  });

  // Weekly summary for history view
  const weekRange = useMemo(() => getWeekRange(selectedDate), [selectedDate]);
  const { data: weeklySummary } = trpc.production.getWeeklySummary.useQuery({
    dataInicio: weekRange.start,
    dataFim: weekRange.end,
  }, { enabled: viewMode === "historico" });

  // Upsert mutation
  const upsertEntry = trpc.production.upsertEntry.useMutation({
    onSuccess: (result, variables) => {
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

  // Toggle sector expansion
  const toggleSector = (id: number) => {
    setExpandedSectors(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  // Toggle machine expansion (for Multilamina)
  const toggleMachine = (sectorId: number, machineId: number) => {
    const key = `${sectorId}-${machineId}`;
    setExpandedMachines(prev => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
  };

  // Navigate date
  const changeDate = (delta: number) => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() + delta);
    setSelectedDate(d.toISOString().slice(0, 10));
    // Reset edit values when changing date
    setEditValues({});
    setStatusValues({});
  };

  // Get entry for a sector/machine
  const getEntry = (sectorId: number, machineId: number | null) => {
    if (!entries) return null;
    return entries.find(e =>
      e.sectorId === sectorId &&
      (machineId ? e.machineId === machineId : e.machineId === null)
    ) || null;
  };

  // Get entry value for a sector/machine
  const getEntryValue = (sectorId: number, machineId: number | null): number => {
    const entry = getEntry(sectorId, machineId);
    return entry ? Number(entry.quantidade) : 0;
  };

  // Get entry status for a sector/machine
  const getEntryStatus = (sectorId: number, machineId: number | null): string => {
    const entry = getEntry(sectorId, machineId);
    return entry?.status || "producao_normal";
  };

  // Get sector total for a day
  const getSectorTotal = (sectorId: number): number => {
    if (!dailySummary) return 0;
    const s = dailySummary.find(d => d.sectorId === sectorId);
    return s ? Number(s.total) : 0;
  };

  // Handle save - now accepts zero values
  const handleSave = (sectorId: number, machineId: number | null, unidade: string) => {
    const key = `${sectorId}-${machineId || "null"}`;
    const val = editValues[key];
    const status = statusValues[key];

    // Allow saving even if val is "0" or empty (defaults to 0)
    const quantidade = val !== undefined && val !== "" ? parseFloat(val.replace(",", ".")) : 0;
    if (isNaN(quantidade) || quantidade < 0) {
      toast.error("Valor inválido");
      return;
    }

    setSavingKeys(prev => new Set(prev).add(key));
    upsertEntry.mutate({
      sectorId,
      machineId,
      data: selectedDate,
      quantidade,
      status: status || getEntryStatus(sectorId, machineId),
    });
  };

  // Initialize edit values from entries
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

  // Get/set status value
  const getStatusValue = (sectorId: number, machineId: number | null): string => {
    const key = `${sectorId}-${machineId || "null"}`;
    if (statusValues[key] !== undefined) return statusValues[key];
    return getEntryStatus(sectorId, machineId);
  };

  const setStatusValue = (sectorId: number, machineId: number | null, value: string) => {
    const key = `${sectorId}-${machineId || "null"}`;
    setStatusValues(prev => ({ ...prev, [key]: value }));
  };

  // Check if a value has been modified (for enabling save button)
  const hasChanges = (sectorId: number, machineId: number | null): boolean => {
    const key = `${sectorId}-${machineId || "null"}`;
    const editVal = editValues[key];
    const statusVal = statusValues[key];
    // Has changes if either value or status was explicitly set
    return editVal !== undefined || statusVal !== undefined;
  };

  // Get day of week name
  const dayOfWeek = useMemo(() => {
    const d = new Date(selectedDate + "T12:00:00");
    return diasSemana[d.getDay()];
  }, [selectedDate]);

  const isToday = selectedDate === getTodayBR();

  // Check if sector is Multilamina (ordem === 1)
  const isMultilamina = (sectorOrdem: number) => sectorOrdem === 1;

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
            <p className="text-sm text-slate-500 mt-1">
              Lançamento diário de produção por setor e máquina
            </p>
          </div>

          {/* View mode toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode("lancamento")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === "lancamento"
                  ? "bg-teal-600 text-white shadow-sm"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Save className="w-4 h-4" />
              Lançamento
            </button>
            <button
              onClick={() => setViewMode("historico")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === "historico"
                  ? "bg-teal-600 text-white shadow-sm"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              <History className="w-4 h-4" />
              Histórico
            </button>
          </div>
        </div>

        {/* Date selector */}
        <div className="flex items-center gap-3 mb-6 bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
          <Calendar className="w-5 h-5 text-teal-600" />
          <button
            onClick={() => changeDate(-1)}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </button>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => { setSelectedDate(e.target.value); setEditValues({}); setStatusValues({}); }}
              className="text-sm font-medium text-slate-700 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <span className="text-sm text-slate-500 font-medium">
              {dayOfWeek}
              {isToday && (
                <span className="ml-1.5 text-xs bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full font-semibold">
                  Hoje
                </span>
              )}
            </span>
          </div>
          <button
            onClick={() => changeDate(1)}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors"
          >
            <ArrowRight className="w-4 h-4 text-slate-600" />
          </button>
          <button
            onClick={() => { setSelectedDate(getTodayBR()); setEditValues({}); setStatusValues({}); }}
            className="ml-auto text-xs text-teal-600 hover:text-teal-700 font-medium px-2 py-1 rounded hover:bg-teal-50 transition-colors"
          >
            Ir para Hoje
          </button>
        </div>

        {viewMode === "lancamento" ? (
          /* ========== LANÇAMENTO VIEW ========== */
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-3 mb-6">
              {sectors?.map(sector => {
                const total = getSectorTotal(sector.id);
                const Icon = getSectorIcon(sector.ordem);
                return (
                  <div
                    key={sector.id}
                    className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => toggleSector(sector.id)}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <div
                        className="w-6 h-6 rounded-md flex items-center justify-center"
                        style={{ backgroundColor: (sector.cor || "#6b7280") + "20" }}
                      >
                        <Icon className="w-3.5 h-3.5" style={{ color: sector.cor || "#6b7280" }} />
                      </div>
                      <span className="text-[10px] font-semibold text-slate-500 uppercase truncate leading-tight">
                        {sector.nome}
                      </span>
                    </div>
                    <div className="text-lg font-bold text-slate-800 tabular-nums">
                      {fmtNum(total, sector.unidadeMedida === "m³" ? 3 : 0)}
                    </div>
                    <div className="text-[10px] text-slate-400">{sector.unidadeLabel}</div>
                  </div>
                );
              })}
            </div>

            {/* Sector cards with machine inputs */}
            <div className="space-y-3">
              {sectors?.map(sector => {
                const isExpanded = expandedSectors.has(sector.id);
                const total = getSectorTotal(sector.id);
                const Icon = getSectorIcon(sector.ordem);
                const hasMachines = sector.machines && sector.machines.length > 0;
                const decimals = sector.unidadeMedida === "m³" ? 3 : 0;
                const isMulti = isMultilamina(sector.ordem);

                return (
                  <div
                    key={sector.id}
                    className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
                  >
                    {/* Sector header */}
                    <div
                      onClick={() => toggleSector(sector.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggleSector(sector.id); }}
                    >
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: (sector.cor || "#6b7280") + "15" }}
                      >
                        <Icon className="w-5 h-5" style={{ color: sector.cor || "#6b7280" }} />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-800">
                            {sector.ordem}. {sector.nome}
                          </span>
                          {sector.isSequencial && (
                            <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-semibold">
                              Sequencial
                            </span>
                          )}
                          {isMulti && (
                            <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-semibold">
                              Status por máquina
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {hasMachines
                            ? `${sector.quantidadeEquipamentos} ${sector.tipoEquipamento === "mesa" ? "mesas" : "máquinas"}`
                            : "Sem equipamento"
                          }
                          {" · "}{sector.unidadeLabel}
                        </div>
                      </div>
                      <div className="text-right mr-3">
                        <div className="text-lg font-bold tabular-nums" style={{ color: sector.cor || "#6b7280" }}>
                          {fmtNum(total, decimals)}
                        </div>
                        <div className="text-[10px] text-slate-400">{sector.unidadeMedida}</div>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
                      )}
                    </div>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/50">
                        {hasMachines ? (
                          <div className="divide-y divide-slate-100">
                            {sector.machines.map(machine => {
                              const key = `${sector.id}-${machine.id}`;
                              const isSaving = savingKeys.has(key);
                              const currentVal = getEditValue(sector.id, machine.id);
                              const currentStatus = getStatusValue(sector.id, machine.id);
                              const statusOpt = getStatusOption(currentStatus);
                              const machineExpanded = expandedMachines.has(key);
                              const changed = hasChanges(sector.id, machine.id);

                              if (isMulti) {
                                // Multilamina: expandable machine with status selector
                                return (
                                  <div key={machine.id} className="bg-white/50">
                                    {/* Machine header row */}
                                    <div className="flex items-center gap-3 px-4 py-2.5">
                                      <div
                                        className="w-8 h-8 rounded-md bg-white border border-slate-200 flex items-center justify-center shrink-0 cursor-pointer hover:bg-slate-50"
                                        onClick={() => toggleMachine(sector.id, machine.id)}
                                      >
                                        {machineExpanded ? (
                                          <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                                        ) : (
                                          <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                                        )}
                                      </div>
                                      <span
                                        className="text-sm text-slate-600 font-medium flex-1 min-w-0 truncate cursor-pointer"
                                        onClick={() => toggleMachine(sector.id, machine.id)}
                                      >
                                        {machine.nome}
                                      </span>
                                      {/* Status badge */}
                                      <div
                                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusOpt.bgClass} ${statusOpt.textClass} ${statusOpt.borderClass}`}
                                      >
                                        <statusOpt.icon className="w-3 h-3" />
                                        <span className="hidden sm:inline">{statusOpt.label}</span>
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0">
                                        <input
                                          type="text"
                                          inputMode="decimal"
                                          value={currentVal}
                                          onChange={(e) => setEditValue(sector.id, machine.id, e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") handleSave(sector.id, machine.id, sector.unidadeMedida);
                                          }}
                                          placeholder="0"
                                          className="w-24 text-right text-sm font-medium border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 tabular-nums bg-white"
                                        />
                                        <span className="text-xs text-slate-400 w-10">{sector.unidadeMedida}</span>
                                        <button
                                          onClick={() => handleSave(sector.id, machine.id, sector.unidadeMedida)}
                                          disabled={isSaving || !changed}
                                          className="w-8 h-8 rounded-lg flex items-center justify-center bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                                        >
                                          {isSaving ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                          ) : (
                                            <Save className="w-4 h-4" />
                                          )}
                                        </button>
                                      </div>
                                    </div>

                                    {/* Expanded: status selector */}
                                    {machineExpanded && (
                                      <div className="px-4 pb-3 pl-16">
                                        <div className="bg-white rounded-lg border border-slate-200 p-3">
                                          <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">
                                            Status da Máquina
                                          </p>
                                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            {MACHINE_STATUS_OPTIONS.map(opt => {
                                              const isSelected = currentStatus === opt.value;
                                              const OptIcon = opt.icon;
                                              return (
                                                <button
                                                  key={opt.value}
                                                  onClick={() => setStatusValue(sector.id, machine.id, opt.value)}
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
                                      </div>
                                    )}
                                  </div>
                                );
                              }

                              // Normal machine row (non-Multilamina)
                              return (
                                <div
                                  key={machine.id}
                                  className="flex items-center gap-3 px-4 py-2.5"
                                >
                                  <div className="w-8 h-8 rounded-md bg-white border border-slate-200 flex items-center justify-center shrink-0">
                                    <span className="text-xs font-bold text-slate-500">
                                      {machine.ordem}
                                    </span>
                                  </div>
                                  <span className="text-sm text-slate-600 font-medium flex-1 min-w-0 truncate">
                                    {machine.nome}
                                  </span>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      value={currentVal}
                                      onChange={(e) => setEditValue(sector.id, machine.id, e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") handleSave(sector.id, machine.id, sector.unidadeMedida);
                                      }}
                                      placeholder="0"
                                      className="w-24 text-right text-sm font-medium border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 tabular-nums bg-white"
                                    />
                                    <span className="text-xs text-slate-400 w-10">{sector.unidadeMedida}</span>
                                    <button
                                      onClick={() => handleSave(sector.id, machine.id, sector.unidadeMedida)}
                                      disabled={isSaving || !changed}
                                      className="w-8 h-8 rounded-lg flex items-center justify-center bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                                    >
                                      {isSaving ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <Save className="w-4 h-4" />
                                      )}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          /* Sector without machines (Embalagem) */
                          <div className="flex items-center gap-3 px-4 py-3">
                            <div className="w-8 h-8 rounded-md bg-white border border-slate-200 flex items-center justify-center shrink-0">
                              <Box className="w-4 h-4 text-slate-400" />
                            </div>
                            <span className="text-sm text-slate-600 font-medium flex-1">
                              Produção do setor
                            </span>
                            <div className="flex items-center gap-2 shrink-0">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={getEditValue(sector.id, null)}
                                onChange={(e) => setEditValue(sector.id, null, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSave(sector.id, null, sector.unidadeMedida);
                                }}
                                placeholder="0"
                                className="w-24 text-right text-sm font-medium border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 tabular-nums bg-white"
                              />
                              <span className="text-xs text-slate-400 w-10">{sector.unidadeMedida}</span>
                              <button
                                onClick={() => handleSave(sector.id, null, sector.unidadeMedida)}
                                disabled={savingKeys.has(`${sector.id}-null`) || !hasChanges(sector.id, null)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                              >
                                {savingKeys.has(`${sector.id}-null`) ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Save className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          /* ========== HISTÓRICO VIEW ========== */
          <HistoryView
            sectors={sectors || []}
            weekRange={weekRange}
            weeklySummary={weeklySummary || []}
            selectedDate={selectedDate}
          />
        )}
      </div>
    </div>
  );
}

/* ========== HISTORY VIEW COMPONENT ========== */
interface HistoryViewProps {
  sectors: any[];
  weekRange: { start: string; end: string };
  weeklySummary: any[];
  selectedDate: string;
}

function HistoryView({ sectors, weekRange, weeklySummary, selectedDate }: HistoryViewProps) {
  // Generate all days of the week
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

  // Build matrix: sector -> day -> total
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
          <h2 className="text-sm font-bold text-slate-700">
            Histórico Semanal — {fmtDate(weekRange.start)} a {fmtDate(weekRange.end)}
          </h2>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase w-48 border-r border-slate-200">
                Setor
              </th>
              {weekDays.map(day => {
                const d = new Date(day + "T12:00:00");
                const isSelected = day === selectedDate;
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                return (
                  <th
                    key={day}
                    className={`text-center px-2 py-2.5 text-xs font-semibold border-r border-slate-200 last:border-r-0 ${
                      isSelected
                        ? "bg-teal-50 text-teal-700"
                        : isWeekend
                          ? "bg-slate-100 text-slate-400"
                          : "text-slate-500"
                    }`}
                  >
                    <div>{diasSemana[d.getDay()]}</div>
                    <div className="text-[10px] font-normal">{day.slice(8, 10)}/{day.slice(5, 7)}</div>
                  </th>
                );
              })}
              <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-700 uppercase bg-slate-100">
                Total
              </th>
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
                      <div
                        className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                        style={{ backgroundColor: (sector.cor || "#6b7280") + "15" }}
                      >
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
                      <td
                        key={day}
                        className={`text-center px-2 py-2.5 tabular-nums border-r border-slate-200 last:border-r-0 ${
                          isSelected
                            ? "bg-teal-50/50"
                            : isWeekend
                              ? "bg-slate-50/50"
                              : ""
                        }`}
                      >
                        <span className={`text-xs font-medium ${
                          val > 0 ? "text-slate-700" : "text-slate-300"
                        }`}>
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
