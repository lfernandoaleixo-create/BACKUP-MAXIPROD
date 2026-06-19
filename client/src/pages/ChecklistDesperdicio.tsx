/**
 * Checklist de Desperdício - Frontend Component
 * 
 * Renders inside the Produção page as a new view mode.
 * Shows 3 sectors with 6 items each, Verde/Vermelho buttons,
 * observation + photo upload for non-conformities,
 * and a "Concluir Ronda" button.
 */
import { useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useOperator } from "@/contexts/OperatorContext";
import {
  CheckCircle2, XCircle, Camera, MessageSquare, Send,
  Loader2, Lock, ClipboardCheck, AlertTriangle, Clock,
  ChevronDown, ChevronUp, Trash2, History, BarChart3, TrendingDown
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ───
type ViewTab = "checklist" | "historico" | "analytics";

// ─── Main Component ───
export function ChecklistDesperdicio() {
  const { operator } = useOperator();
  const [activeTab, setActiveTab] = useState<ViewTab>("checklist");
  const [expandedSectors, setExpandedSectors] = useState<Set<number>>(new Set([1, 2, 3]));
  const [observationOpen, setObservationOpen] = useState<string | null>(null);
  const [observations, setObservations] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<Record<string, { data: string; name: string; type: string } | null>>({});
  const [submitting, setSubmitting] = useState<Set<string>>(new Set());

  const utils = trpc.useUtils();

  // Queries
  const { data: roundData, isLoading: loadingRound } = trpc.checklist.getRound.useQuery(undefined, {
    refetchInterval: 60000, // Refresh every minute
  });
  const { data: sectorsData, isLoading: loadingItems } = trpc.checklist.getItems.useQuery();

  // Mutations
  const submitResponse = trpc.checklist.submitResponse.useMutation({
    onSuccess: () => {
      utils.checklist.getRound.invalidate();
    },
  });
  const completeRound = trpc.checklist.completeRound.useMutation({
    onSuccess: () => {
      utils.checklist.getRound.invalidate();
      toast.success("Ronda concluída com sucesso!");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  // Derived state
  const round = roundData?.round;
  const responses = roundData?.responses || [];
  const isLocked = round?.status === "completed" || round?.status === "not_done";
  const isToday = useMemo(() => {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    return round?.date === today;
  }, [round?.date]);

  // Count answered items
  const totalActiveItems = useMemo(() => {
    if (!sectorsData) return 0;
    return Object.values(sectorsData).reduce((acc, s) => acc + s.items.length, 0);
  }, [sectorsData]);
  const answeredCount = responses.length;
  const allAnswered = answeredCount >= totalActiveItems && totalActiveItems > 0;
  const hasNonConforme = responses.some(r => r.status === "nao_conforme");

  // Get response for a specific item
  const getResponse = useCallback((itemId: number) => {
    return responses.find(r => r.itemId === itemId);
  }, [responses]);

  // Handle response submission
  const handleSubmit = async (itemId: number, status: "conforme" | "nao_conforme") => {
    if (!round || isLocked) return;
    const key = `${round.id}-${itemId}`;
    
    if (status === "nao_conforme" && !observations[key]?.trim()) {
      // Open observation field if marking as non-conforme without observation
      setObservationOpen(key);
      toast.error("Observação obrigatória para itens Não Conforme");
      return;
    }

    setSubmitting(prev => new Set(prev).add(key));
    try {
      const photoData = photos[key];
      await submitResponse.mutateAsync({
        roundId: round.id,
        itemId,
        status,
        observation: observations[key] || undefined,
        photoData: photoData?.data || undefined,
        photoFileName: photoData?.name || undefined,
        photoMimeType: photoData?.type || undefined,
        operatorName: operator?.name || "Desconhecido",
      });
      // Clear local state for this item
      setObservationOpen(null);
      toast.success(status === "conforme" ? "Conforme ✓" : "Não Conforme registrado");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar resposta");
    } finally {
      setSubmitting(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  // Handle photo selection
  const handlePhotoSelect = (itemId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !round) return;
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Foto deve ter no máximo 5MB");
      return;
    }
    
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      const key = `${round.id}-${itemId}`;
      setPhotos(prev => ({ ...prev, [key]: { data: base64, name: file.name, type: file.type } }));
    };
    reader.readAsDataURL(file);
  };

  // Handle complete round
  const handleComplete = async () => {
    if (!round || !operator) return;
    completeRound.mutate({
      roundId: round.id,
      operatorName: operator.name,
    });
  };

  // Toggle sector expansion
  const toggleSector = (sector: number) => {
    setExpandedSectors(prev => {
      const next = new Set(prev);
      if (next.has(sector)) next.delete(sector);
      else next.add(sector);
      return next;
    });
  };

  // ─── Render ───
  if (loadingRound || loadingItems) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
        <span className="ml-3 text-slate-500">Carregando checklist...</span>
      </div>
    );
  }

  // No round for today (not a checklist day)
  if (!round) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
          <ClipboardCheck className="w-10 h-10 text-slate-400" />
        </div>
        <h3 className="text-lg font-bold text-slate-700 mb-2">Sem Checklist Hoje</h3>
        <p className="text-sm text-slate-500 text-center max-w-md">
          O Checklist de Desperdício é gerado automaticamente às <span className="font-semibold">segundas, quartas e sextas</span> às 07:00h.
        </p>
        <div className="mt-6 flex gap-2">
          <button
            onClick={() => setActiveTab("historico")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <History className="w-4 h-4" /> Ver Histórico
          </button>
          <button
            onClick={() => setActiveTab("analytics")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <BarChart3 className="w-4 h-4" /> Análise
          </button>
        </div>
      </div>
    );
  }

  // Sector colors
  const sectorColors: Record<number, { bg: string; border: string; text: string; accent: string }> = {
    1: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-800", accent: "bg-blue-600" },
    2: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-800", accent: "bg-amber-600" },
    3: { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-800", accent: "bg-purple-600" },
  };

  return (
    <div className="space-y-4">
      {/* ─── Tab Navigation ─── */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setActiveTab("checklist")}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "checklist"
              ? "bg-teal-600 text-white shadow-sm"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          <ClipboardCheck className="w-4 h-4" /> Checklist
        </button>
        <button
          onClick={() => setActiveTab("historico")}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "historico"
              ? "bg-teal-600 text-white shadow-sm"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          <History className="w-4 h-4" /> Histórico
        </button>
        <button
          onClick={() => setActiveTab("analytics")}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "analytics"
              ? "bg-indigo-600 text-white shadow-sm"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          <TrendingDown className="w-4 h-4" /> Análise
        </button>
      </div>

      {activeTab === "checklist" && (
        <>
          {/* ─── Status Banner ─── */}
          {isLocked && (
            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
              round.status === "completed"
                ? "bg-green-50 border-green-200"
                : "bg-red-50 border-red-200"
            }`}>
              {round.status === "completed" ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-green-800">Ronda Concluída</p>
                    <p className="text-xs text-green-600">
                      Preenchida por <span className="font-bold">{round.completedBy}</span>
                      {round.completedAt && ` às ${new Date(round.completedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5 text-red-600 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-red-800">Não Realizado</p>
                    <p className="text-xs text-red-600">
                      O checklist não foi preenchido até as 17:00h e foi travado automaticamente.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ─── Progress Bar ─── */}
          {!isLocked && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">
                  Progresso: <span className="font-bold text-teal-600">{answeredCount}</span> / {totalActiveItems} itens
                </span>
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Trava às 17:00h
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    allAnswered ? "bg-green-500" : hasNonConforme ? "bg-orange-500" : "bg-teal-500"
                  }`}
                  style={{ width: `${totalActiveItems > 0 ? (answeredCount / totalActiveItems) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* ─── Sector Cards ─── */}
          {sectorsData && Object.entries(sectorsData).map(([sectorNum, sectorData]) => {
            const sector = Number(sectorNum);
            const colors = sectorColors[sector] || sectorColors[1];
            const isExpanded = expandedSectors.has(sector);
            const sectorResponses = sectorData.items.map(item => getResponse(item.id));
            const sectorAnswered = sectorResponses.filter(Boolean).length;
            const sectorNonConforme = sectorResponses.filter(r => r?.status === "nao_conforme").length;
            const sectorComplete = sectorAnswered === sectorData.items.length;

            return (
              <div key={sector} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Sector Header */}
                <div
                  onClick={() => toggleSector(sector)}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors ${colors.bg} ${colors.border} border-b`}
                >
                  <div className={`w-8 h-8 rounded-lg ${colors.accent} flex items-center justify-center`}>
                    <span className="text-white font-bold text-sm">{sector}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-sm font-bold ${colors.text}`}>
                      Setor {sector} — {sectorData.sectorName}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-500">
                        {sectorAnswered}/{sectorData.items.length} respondidos
                      </span>
                      {sectorNonConforme > 0 && (
                        <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-semibold">
                          {sectorNonConforme} não conforme
                        </span>
                      )}
                      {sectorComplete && sectorNonConforme === 0 && (
                        <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-semibold">
                          ✓ OK
                        </span>
                      )}
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </div>

                {/* Items */}
                {isExpanded && (
                  <div className="divide-y divide-slate-100">
                    {sectorData.items.map((item, idx) => {
                      const response = getResponse(item.id);
                      const key = `${round.id}-${item.id}`;
                      const isSubmitting = submitting.has(key);
                      const obsKey = key;
                      const hasPhoto = !!photos[key];

                      return (
                        <div key={item.id} className={`px-4 py-3 ${response ? (response.status === "conforme" ? "bg-green-50/50" : "bg-red-50/50") : ""}`}>
                          {/* Item text + buttons */}
                          <div className="flex items-start gap-3">
                            <span className="text-xs font-bold text-slate-400 mt-1 w-5 shrink-0">{idx + 1}.</span>
                            <p className="text-sm text-slate-700 flex-1 leading-relaxed">{item.text}</p>
                            
                            {/* Response buttons */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              {isSubmitting ? (
                                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                              ) : isLocked ? (
                                response ? (
                                  response.status === "conforme" ? (
                                    <CheckCircle2 className="w-6 h-6 text-green-500" />
                                  ) : (
                                    <XCircle className="w-6 h-6 text-red-500" />
                                  )
                                ) : (
                                  <span className="text-xs text-slate-400">—</span>
                                )
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleSubmit(item.id, "conforme")}
                                    disabled={isSubmitting}
                                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                                      response?.status === "conforme"
                                        ? "bg-green-500 text-white shadow-sm ring-2 ring-green-200"
                                        : "bg-white border border-green-300 text-green-600 hover:bg-green-50 hover:border-green-400"
                                    }`}
                                    title="Conforme"
                                  >
                                    <CheckCircle2 className="w-5 h-5" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (!observations[obsKey]?.trim()) {
                                        setObservationOpen(obsKey);
                                      } else {
                                        handleSubmit(item.id, "nao_conforme");
                                      }
                                    }}
                                    disabled={isSubmitting}
                                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                                      response?.status === "nao_conforme"
                                        ? "bg-red-500 text-white shadow-sm ring-2 ring-red-200"
                                        : "bg-white border border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
                                    }`}
                                    title="Não Conforme"
                                  >
                                    <XCircle className="w-5 h-5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Observation/photo area (for non-conforme or when open) */}
                          {(observationOpen === obsKey || response?.status === "nao_conforme") && !isLocked && (
                            <div className="mt-3 ml-8 space-y-2">
                              <div className="bg-white rounded-lg border border-slate-200 p-3">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">
                                  Observação {response?.status !== "nao_conforme" && <span className="text-red-500">*</span>}
                                </label>
                                <textarea
                                  value={observations[obsKey] || ""}
                                  onChange={(e) => setObservations(prev => ({ ...prev, [obsKey]: e.target.value }))}
                                  placeholder="Descreva o problema encontrado..."
                                  rows={2}
                                  className="w-full text-sm border border-slate-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
                                />
                                <div className="flex items-center justify-between mt-2">
                                  <div className="flex items-center gap-2">
                                    <label className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-medium text-slate-600 cursor-pointer hover:bg-slate-200 transition-colors">
                                      <Camera className="w-3.5 h-3.5" />
                                      {hasPhoto ? "Foto anexada ✓" : "Anexar foto"}
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => handlePhotoSelect(item.id, e)}
                                      />
                                    </label>
                                    {hasPhoto && (
                                      <button
                                        onClick={() => setPhotos(prev => ({ ...prev, [key]: null }))}
                                        className="text-xs text-red-500 hover:text-red-700"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => handleSubmit(item.id, "nao_conforme")}
                                    disabled={!observations[obsKey]?.trim() || isSubmitting}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                    Registrar Não Conforme
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Show existing observation (read-only when locked) */}
                          {response?.status === "nao_conforme" && isLocked && (response.observation || response.photoUrl) && (
                            <div className="mt-2 ml-8 bg-red-50 rounded-lg border border-red-100 p-3">
                              {response.observation && (
                                <p className="text-xs text-red-700"><span className="font-semibold">Obs:</span> {response.observation}</p>
                              )}
                              {response.photoUrl && (
                                <a href={response.photoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1">
                                  <Camera className="w-3 h-3" /> Ver foto
                                </a>
                              )}
                              <p className="text-[10px] text-slate-400 mt-1">
                                Por {response.respondedBy} às {new Date(response.respondedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                          )}

                          {/* Show conforme badge */}
                          {response?.status === "conforme" && isLocked && (
                            <p className="mt-1 ml-8 text-[10px] text-green-600">
                              ✓ Conforme — por {response.respondedBy} às {new Date(response.respondedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* ─── Concluir Ronda Button ─── */}
          {!isLocked && (
            <div className="sticky bottom-4 flex justify-center pt-4">
              <button
                onClick={handleComplete}
                disabled={!allAnswered || completeRound.isPending}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold shadow-lg transition-all ${
                  allAnswered
                    ? "bg-green-600 text-white hover:bg-green-700 hover:shadow-xl"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                }`}
              >
                {completeRound.isPending ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Concluindo...</>
                ) : (
                  <><ClipboardCheck className="w-5 h-5" /> Concluir Ronda</>
                )}
              </button>
              {!allAnswered && (
                <p className="absolute -bottom-5 text-[10px] text-slate-400">
                  Faltam {totalActiveItems - answeredCount} itens
                </p>
              )}
            </div>
          )}
        </>
      )}

      {activeTab === "historico" && <ChecklistHistory />}
      {activeTab === "analytics" && <ChecklistAnalytics />}
    </div>
  );
}

// ─── History Sub-Component ───
function ChecklistHistory() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = trpc.checklist.getHistory.useQuery({ page, pageSize: 10 });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!data || data.history.length === 0) {
    return (
      <div className="text-center py-12">
        <History className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-500">Nenhum histórico disponível</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
        <History className="w-4 h-4 text-teal-600" />
        Histórico de Rondas
      </h3>
      
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Data</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Status</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Líder</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Itens</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Não Conforme</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.history.map((entry) => (
              <tr key={entry.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 font-medium text-slate-700">
                  {new Date(entry.date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}
                </td>
                <td className="px-4 py-2.5">
                  {entry.status === "completed" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                      <CheckCircle2 className="w-3 h-3" /> Concluído
                    </span>
                  ) : entry.status === "not_done" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                      <XCircle className="w-3 h-3" /> Não Realizado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                      <Clock className="w-3 h-3" /> Em Aberto
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-slate-600">
                  {entry.completedBy || "—"}
                </td>
                <td className="px-4 py-2.5 text-center text-slate-600">
                  {entry.totalResponses}
                </td>
                <td className="px-4 py-2.5 text-center">
                  {entry.nonConformeCount > 0 ? (
                    <span className="font-bold text-red-600">{entry.nonConformeCount}</span>
                  ) : (
                    <span className="text-slate-400">0</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data.total > 10 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Anterior
          </button>
          <span className="text-xs text-slate-500">
            Página {page} de {Math.ceil(data.total / 10)}
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page >= Math.ceil(data.total / 10)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Analytics Sub-Component ───
function ChecklistAnalytics() {
  const [yearMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const { data, isLoading } = trpc.checklist.getAnalytics.useQuery({ yearMonth });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-500">Nenhuma não-conformidade registrada neste mês</p>
        <p className="text-xs text-slate-400 mt-1">
          {data?.totalRounds || 0} rondas realizadas | {data?.completedRounds || 0} concluídas
        </p>
      </div>
    );
  }

  const monthLabel = new Date(yearMonth + "-15").toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-red-500" />
          Itens que Mais Reprovam — {monthLabel}
        </h3>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>{data.totalRounds} rondas</span>
          <span className="text-green-600 font-semibold">{data.completedRounds} concluídas</span>
          <span className="text-red-600 font-semibold">{data.notDoneRounds} não realizadas</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="divide-y divide-slate-100">
          {data.items.slice(0, 10).map((item, idx) => (
            <div key={item.itemId} className="flex items-center gap-3 px-4 py-3">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                idx === 0 ? "bg-red-100 text-red-700" :
                idx === 1 ? "bg-orange-100 text-orange-700" :
                idx === 2 ? "bg-amber-100 text-amber-700" :
                "bg-slate-100 text-slate-600"
              }`}>
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-700 truncate">{item.text}</p>
                <p className="text-[10px] text-slate-400">Setor {item.sector} — {item.sectorName}</p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-sm font-bold text-red-600">{item.failCount}×</span>
                <p className="text-[10px] text-slate-400">{item.failRate}% das rondas</p>
              </div>
              {/* Visual bar */}
              <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden shrink-0">
                <div
                  className="h-full bg-red-400 rounded-full"
                  style={{ width: `${item.failRate}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
