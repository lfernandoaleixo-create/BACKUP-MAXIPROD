/**
 * SerasaConsulta - Componente de consulta de crédito Serasa
 * 
 * Fluxo:
 * 1. Botão vermelho "Consultar Serasa"
 * 2. Pergunta "Consultar Serasa?" com botões Sim/Não
 * 3. Se Sim: pede senha (nome do operador) para registrar quem solicitou
 * 4. Executa consulta e exibe resultado
 * 5. Se senha foi "Guilherme": mostra opção de apagar consulta (modo teste)
 * 
 * Também mostra "Última consulta feita há X dias" quando há histórico.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Shield, ShieldAlert, ShieldCheck, X, Lock, AlertTriangle, CheckCircle2, Building2, Phone, Mail, MapPin, Users, TrendingUp, Clock, FileSearch, Trash2, ChevronDown, ChevronUp, Calendar, Briefcase, DollarSign, CreditCard, Activity, Hash } from "lucide-react";
import { toast } from "sonner";

interface SerasaConsultaProps {
  documento: string; // CPF ou CNPJ do cliente
  clienteNome: string;
  operadorName: string; // Nome do operador logado
  salesOrderRequestId?: number;
  compact?: boolean; // Modo compacto para exibição na Vitória
}

export function SerasaConsulta({ documento, clienteNome, operadorName, salesOrderRequestId, compact = false }: SerasaConsultaProps) {
  const [step, setStep] = useState<"idle" | "confirm" | "password" | "loading" | "result">("idle");
  const [password, setPassword] = useState("");
  const [resultData, setResultData] = useState<any>(null);
  const [consultaId, setConsultaId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usedPassword, setUsedPassword] = useState<string>(""); // Track which password was used

  // Verificar autorização
  const authCheck = trpc.serasa.checkAuthorization.useQuery(
    { operadorName },
    { enabled: !!operadorName }
  );

  // Última consulta para este documento
  const ultimaConsulta = trpc.serasa.ultimaConsulta.useQuery(
    { documento },
    { enabled: !!documento && documento.length >= 11 }
  );

  // Mutation para consultar
  const consultarMutation = trpc.serasa.consultar.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setResultData(data.resultado);
        setConsultaId(data.consultaId ? Number(data.consultaId) : null);
        setStep("result");
        setError(null);
        // Invalidate última consulta
        ultimaConsulta.refetch();
      } else {
        setError(data.error || "Erro desconhecido");
        setStep("password");
      }
    },
    onError: (err) => {
      setError(err.message || "Erro ao consultar Serasa");
      setStep("password");
    },
  });

  // Mutation para apagar consulta (apenas Guilherme)
  const deleteMutation = trpc.serasa.deleteConsulta.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Consulta apagada do histórico (modo teste)");
        setStep("idle");
        setResultData(null);
        setConsultaId(null);
        ultimaConsulta.refetch();
      } else {
        toast.error(data.error || "Erro ao apagar");
      }
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao apagar consulta");
    },
  });

  const handleConsultar = () => {
    if (!password.trim()) {
      setError("Digite sua senha (seu nome)");
      return;
    }
    setError(null);
    setUsedPassword(password.trim());
    setStep("loading");

    const docLimpo = documento.replace(/[.\-\/]/g, "");
    const tipoPessoa = docLimpo.length <= 11 ? "PF" : "PJ";

    consultarMutation.mutate({
      documento: docLimpo,
      tipoPessoa,
      operadorName: password.trim(), // O nome digitado na senha É o operador que solicitou
      operadorPassword: password.trim(),
      ...(salesOrderRequestId ? { salesOrderRequestId } : {}),
    });
  };

  const handleDelete = () => {
    if (!consultaId) return;
    deleteMutation.mutate({
      consultaId,
      operadorPassword: usedPassword,
    });
  };

  const resetFlow = () => {
    setStep("idle");
    setPassword("");
    setError(null);
    setResultData(null);
    setConsultaId(null);
    setUsedPassword("");
  };

  // ─── CONFIRMATION DIALOG ───────────────────────────────────────────────
  const confirmDialogJSX = step === "confirm" ? (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999]" onClick={resetFlow}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <Shield className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Consultar Serasa?</h3>
              <p className="text-[10px] text-slate-500">Esta consulta é paga e afeta o score</p>
            </div>
          </div>
          <button onClick={resetFlow} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-[11px] text-amber-800 dark:text-amber-200">
              <p className="font-bold">Atenção!</p>
              <p>Consultas ao Serasa são <strong>pagas</strong> e podem afetar o <strong>score do cliente</strong>.</p>
            </div>
          </div>
        </div>
        <div className="mb-4">
          <p className="text-xs text-slate-600 dark:text-slate-300 mb-1">
            Cliente: <strong>{clienteNome || documento}</strong>
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Documento: <strong>{documento}</strong>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={resetFlow}
            className="flex-1 px-4 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors"
          >
            Não
          </button>
          <button
            onClick={() => setStep("password")}
            className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            Sim
          </button>
        </div>
      </div>
    </div>
  ) : null;

  // ─── PASSWORD DIALOG ───────────────────────────────────────────────────
  const passwordDialogJSX = (step === "password" || step === "loading") ? (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999]" onClick={resetFlow}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <Lock className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Identificação</h3>
              <p className="text-[10px] text-slate-500">Digite seu nome para registrar a consulta</p>
            </div>
          </div>
          <button onClick={resetFlow} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="mb-4">
          <p className="text-xs text-slate-600 dark:text-slate-300 mb-1">
            Cliente: <strong>{clienteNome || documento}</strong>
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            Documento: <strong>{documento}</strong>
          </p>
          <label className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 block">
            Sua senha (seu nome):
          </label>
          <input
            type="text" autoComplete="off" data-form-type="other"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleConsultar()}
            placeholder="Digite seu nome..."
            className="input-masked w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
            autoFocus
            disabled={step === "loading"}
          />
          <p className="text-[9px] text-slate-400 mt-1">
            A consulta ficará registrada no seu nome nas métricas
          </p>
        </div>
        {error && (
          <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={resetFlow}
            className="flex-1 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
            disabled={step === "loading"}
          >
            Cancelar
          </button>
          <button
            onClick={handleConsultar}
            disabled={step === "loading" || !password.trim()}
            className="flex-1 px-3 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:bg-red-300 rounded-lg transition-colors flex items-center justify-center gap-1"
          >
            {step === "loading" ? (
              <>
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Consultando...
              </>
            ) : (
              <>
                <FileSearch className="w-3.5 h-3.5" />
                Consultar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  // Se não autorizado, não mostra nada (ou mostra apenas última consulta no modo compact)
  if (!authCheck.data?.authorized) {
    // Mostra apenas a info de última consulta se existir
    if (ultimaConsulta.data?.found) {
      return (
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Clock className="w-3 h-3" />
          <span>Última consulta Serasa: <strong>{ultimaConsulta.data.consulta?.tempoTexto}</strong></span>
          {ultimaConsulta.data.consulta?.aprovado ? (
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">(OK)</span>
          ) : (
            <span className="text-red-600 dark:text-red-400 font-medium">(Pendências)</span>
          )}
        </div>
      );
    }
    if (compact) {
      return (
        <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-3 h-3" />
          <span>Nenhuma consulta Serasa realizada para este cliente</span>
        </div>
      );
    }
    return null;
  }

  // Modo compacto - mostra última consulta + botão menor
  if (compact) {
    return (
      <div className="space-y-2">
        {ultimaConsulta.data?.found ? (
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Clock className="w-3 h-3" />
            <span>Última consulta Serasa: <strong className={ultimaConsulta.data.consulta?.diasDesdeConsulta && ultimaConsulta.data.consulta.diasDesdeConsulta > 30 ? "text-amber-600" : ""}>{ultimaConsulta.data.consulta?.tempoTexto}</strong></span>
            {ultimaConsulta.data.consulta?.aprovado ? (
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-3 h-3" />
            <span>Nenhuma consulta Serasa realizada para este cliente</span>
          </div>
        )}
        {step !== "result" && (
          <button
            onClick={() => { setStep("confirm"); setError(null); setPassword(""); }}
            disabled={!documento || documento.length < 11}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 disabled:bg-slate-300 disabled:from-slate-300 disabled:to-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all duration-300 shadow-[0_0_12px_rgba(239,68,68,0.5)] hover:shadow-[0_0_20px_rgba(239,68,68,0.7)] hover:scale-[1.02] active:scale-95"
          >
            <Shield className="w-4 h-4" />
            Consultar Serasa
          </button>
        )}
        {confirmDialogJSX}
        {passwordDialogJSX}
        {step === "result" && resultData && (
          <div className="space-y-2">
            <SerasaResultCard resultado={resultData} onClose={resetFlow} />
            {/* Botão apagar - apenas se a senha usada foi "Guilherme" */}
            {usedPassword.toLowerCase() === "guilherme" && consultaId && (
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                {deleteMutation.isPending ? "Apagando..." : "Apagar consulta (modo teste)"}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Última consulta info */}
      {ultimaConsulta.data?.found && step !== "result" && (
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 rounded-lg">
          <Clock className="w-3 h-3 flex-shrink-0" />
          <span>Última consulta: <strong>{ultimaConsulta.data.consulta?.tempoTexto}</strong> por {ultimaConsulta.data.consulta?.operadorName}</span>
          {ultimaConsulta.data.consulta?.aprovado ? (
            <span className="ml-auto flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <ShieldCheck className="w-3 h-3" /> OK
            </span>
          ) : (
            <span className="ml-auto flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
              <ShieldAlert className="w-3 h-3" /> Pendências
            </span>
          )}
        </div>
      )}

      {/* Botão Consultar */}
      {step !== "result" && (
        <button
          onClick={() => { setStep("confirm"); setError(null); setPassword(""); }}
          disabled={!documento || documento.length < 11}
          className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 disabled:bg-slate-300 disabled:from-slate-300 disabled:to-slate-300 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-all duration-300 shadow-[0_0_15px_rgba(239,68,68,0.5)] hover:shadow-[0_0_25px_rgba(239,68,68,0.7)] hover:scale-[1.02] active:scale-95"
        >
          <Shield className="w-5 h-5" />
          Consultar Serasa
        </button>
      )}

      {/* Dialogs */}
      {confirmDialogJSX}
      {passwordDialogJSX}

      {/* Resultado da Consulta */}
      {step === "result" && resultData && (
        <div className="space-y-2">
          <SerasaResultCard resultado={resultData} onClose={resetFlow} />
          {/* Botão apagar - apenas se a senha usada foi "Guilherme" */}
          {usedPassword.toLowerCase() === "guilherme" && consultaId && (
            <button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              {deleteMutation.isPending ? "Apagando..." : "Apagar consulta (modo teste)"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Card de resultado da consulta Serasa - EXIBE TODOS OS DADOS DA API
 */
function SerasaResultCard({ resultado, onClose }: { resultado: any; onClose: () => void }) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["cadastro"]));
  const isAprovado = resultado.aprovado;

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const isSectionOpen = (section: string) => expandedSections.has(section);

  const formatCurrency = (value: number | string | null) => {
    if (value === null || value === undefined) return "—";
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(num)) return "—";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
  };

  const formatDoc = (doc: string) => {
    if (!doc) return "";
    const clean = doc.replace(/\D/g, "");
    if (clean.length === 11) return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    if (clean.length === 14) return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    return doc;
  };

  const formatPhone = (phone: string) => {
    if (!phone) return "";
    const clean = phone.replace(/\D/g, "");
    if (clean.length === 11) return `(${clean.slice(0,2)}) ${clean.slice(2,7)}-${clean.slice(7)}`;
    if (clean.length === 10) return `(${clean.slice(0,2)}) ${clean.slice(2,6)}-${clean.slice(6)}`;
    if (clean.length === 9) return `${clean.slice(0,5)}-${clean.slice(5)}`;
    if (clean.length === 8) return `${clean.slice(0,4)}-${clean.slice(4)}`;
    return phone;
  };

  // Section header component
  const SectionHeader = ({ id, icon: Icon, title, badge }: { id: string; icon: any; title: string; badge?: string | number }) => (
    <div
      className="flex items-center justify-between px-3 py-2.5 bg-slate-50 dark:bg-slate-700/50 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
      onClick={() => toggleSection(id)}
    >
      <p className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" /> {title}
        {badge !== undefined && badge !== null && (
          <span className="ml-1 px-1.5 py-0.5 text-[9px] bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-full font-medium">{badge}</span>
        )}
      </p>
      {isSectionOpen(id) ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
    </div>
  );

  return (
    <div className={`rounded-2xl overflow-hidden shadow-lg border-2 transition-all ${
      isAprovado 
        ? "border-emerald-400 dark:border-emerald-600 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/30 dark:to-slate-800" 
        : "border-red-400 dark:border-red-600 bg-gradient-to-br from-red-50 to-white dark:from-red-950/30 dark:to-slate-800"
    }`}>
      {/* Header */}
      <div className={`px-4 py-3 flex items-center justify-between ${
        isAprovado 
          ? "bg-emerald-500 dark:bg-emerald-700" 
          : "bg-red-500 dark:bg-red-700"
      }`}>
        <div className="flex items-center gap-2">
          {isAprovado ? (
            <ShieldCheck className="w-5 h-5 text-white" />
          ) : (
            <ShieldAlert className="w-5 h-5 text-white" />
          )}
          <div>
            <h3 className="text-sm font-bold text-white">
              {isAprovado ? "Cliente Aprovado" : "Cliente com Pendências"}
            </h3>
            <p className="text-[10px] text-white/80">
              Relatório GOLD Serasa • {new Date(resultado.timestamp).toLocaleString("pt-BR")}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="text-white/80 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* Score, Pontualidade, Pendências, Limite */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="bg-white dark:bg-slate-700/50 rounded-xl p-3 text-center shadow-sm">
            <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Score</p>
            <p className={`text-xl font-black ${
              (resultado.score || 0) >= 700 ? "text-emerald-600" :
              (resultado.score || 0) >= 400 ? "text-amber-600" : "text-red-600"
            }`}>{resultado.score || "—"}</p>
            <p className="text-[9px] text-slate-400">
              {(resultado.score || 0) >= 700 ? "Excelente" : (resultado.score || 0) >= 400 ? "Regular" : "Crítico"}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-700/50 rounded-xl p-3 text-center shadow-sm">
            <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Pontualidade</p>
            <p className="text-xl font-black text-slate-700 dark:text-slate-200">{resultado.pontualidade ?? "—"}%</p>
            <p className="text-[9px] text-slate-400">Pagamentos em dia</p>
          </div>
          <div className="bg-white dark:bg-slate-700/50 rounded-xl p-3 text-center shadow-sm">
            <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Pendências</p>
            <p className={`text-xl font-black ${resultado.totalPendencias > 0 ? "text-red-600" : "text-emerald-600"}`}>
              {resultado.totalPendencias}
            </p>
            <p className="text-[9px] text-slate-400">Registros negativos</p>
          </div>
          <div className="bg-white dark:bg-slate-700/50 rounded-xl p-3 text-center shadow-sm">
            <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Limite Crédito</p>
            <p className="text-lg font-black text-slate-700 dark:text-slate-200">{formatCurrency(resultado.limiteCredito)}</p>
            <p className="text-[9px] text-slate-400">Sugerido Serasa</p>
          </div>
        </div>

        {/* Análise IA */}
        {resultado.analiseIA && (
          <div className={`rounded-xl p-3 border ${isAprovado ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800" : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"}`}>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> Análise Inteligente
            </p>
            <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">{resultado.analiseIA}</p>
          </div>
        )}

        {/* ═══ DADOS CADASTRAIS ═══ */}
        {resultado.cadastro && (
          <div className="border border-slate-200 dark:border-slate-600 rounded-xl overflow-hidden">
            <SectionHeader id="cadastro" icon={Building2} title="Dados Cadastrais" />
            {isSectionOpen("cadastro") && (
              <div className="p-3 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <p><strong>Nome:</strong> {resultado.cadastro.nome}</p>
                    {resultado.cadastro.documento && <p><strong>Documento:</strong> {formatDoc(resultado.cadastro.documento)}</p>}
                    {resultado.cadastro.dataNascimento && (
                      <p className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <strong>{resultado.tipoPessoa === "PJ" ? "Fundação:" : "Nascimento:"}</strong> {resultado.cadastro.dataNascimento}
                      </p>
                    )}
                    {resultado.cadastro.situacao && (
                      <p><strong>Situação:</strong> <span className={resultado.cadastro.situacao === "ATIVA" ? "text-emerald-600 font-medium" : "text-red-600 font-medium"}>{resultado.cadastro.situacao}</span></p>
                    )}
                    {resultado.cadastro.porte && <p><strong>Porte:</strong> {resultado.cadastro.porte}</p>}
                  </div>
                  <div className="space-y-1.5">
                    {resultado.cadastro.atividadePrincipal && (
                      <p className="flex items-start gap-1">
                        <Briefcase className="w-3 h-3 text-slate-400 mt-0.5 flex-shrink-0" />
                        <span><strong>Atividade:</strong> {resultado.cadastro.atividadePrincipal}</span>
                      </p>
                    )}
                    {resultado.cadastro.capitalSocial != null && resultado.cadastro.capitalSocial > 0 && (
                      <p className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3 text-slate-400" />
                        <strong>Capital Social:</strong> {formatCurrency(resultado.cadastro.capitalSocial)}
                      </p>
                    )}
                    {resultado.cadastro.faturamentoPresumido != null && resultado.cadastro.faturamentoPresumido > 0 && (
                      <p className="flex items-center gap-1">
                        <Activity className="w-3 h-3 text-slate-400" />
                        <strong>Faturamento Presumido:</strong> {formatCurrency(resultado.cadastro.faturamentoPresumido)}
                      </p>
                    )}
                    {resultado.cadastro.rendaEstimada != null && resultado.cadastro.rendaEstimada > 0 && (
                      <p className="flex items-center gap-1">
                        <CreditCard className="w-3 h-3 text-slate-400" />
                        <strong>Renda Estimada:</strong> {formatCurrency(resultado.cadastro.rendaEstimada)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ TELEFONES ═══ */}
        {resultado.cadastro?.telefones?.length > 0 && (
          <div className="border border-slate-200 dark:border-slate-600 rounded-xl overflow-hidden">
            <SectionHeader id="telefones" icon={Phone} title="Telefones" badge={resultado.cadastro.qntTelefones || resultado.cadastro.telefones.length} />
            {isSectionOpen("telefones") && (
              <div className="p-3 space-y-1.5">
                {resultado.cadastro.telefones.map((tel: any, i: number) => {
                  const phoneStr = typeof tel === "string" ? tel : (tel.ddd ? `(${tel.ddd}) ${tel.numero}` : tel.numero || "");
                  return (
                    <div key={i} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <Phone className="w-3 h-3 text-blue-500 flex-shrink-0" />
                      <span className="font-mono">{typeof tel === "string" ? formatPhone(tel) : phoneStr}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══ E-MAILS ═══ */}
        {resultado.cadastro?.emails?.length > 0 && (
          <div className="border border-slate-200 dark:border-slate-600 rounded-xl overflow-hidden">
            <SectionHeader id="emails" icon={Mail} title="E-mails" badge={resultado.cadastro.qntEmails || resultado.cadastro.emails.length} />
            {isSectionOpen("emails") && (
              <div className="p-3 space-y-1.5">
                {resultado.cadastro.emails.map((email: any, i: number) => {
                  const emailStr = typeof email === "string" ? email : (email.email || email);
                  return (
                    <div key={i} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <Mail className="w-3 h-3 text-purple-500 flex-shrink-0" />
                      <span className="font-mono lowercase">{emailStr}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══ ENDEREÇOS ═══ */}
        {resultado.cadastro?.enderecos?.length > 0 && (
          <div className="border border-slate-200 dark:border-slate-600 rounded-xl overflow-hidden">
            <SectionHeader id="enderecos" icon={MapPin} title="Endereços" badge={resultado.cadastro.qntEnderecos || resultado.cadastro.enderecos.length} />
            {isSectionOpen("enderecos") && (
              <div className="p-3 space-y-3">
                {resultado.cadastro.enderecos.map((end: any, i: number) => (
                  <div key={i} className="bg-slate-50 dark:bg-slate-700/30 rounded-lg p-2.5 text-xs text-slate-600 dark:text-slate-300">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3 h-3 text-rose-500 mt-0.5 flex-shrink-0" />
                      <div className="space-y-0.5">
                        <p className="font-medium">
                          {end.logradouro}{end.numero ? `, ${end.numero}` : ""}
                          {end.complemento ? ` - ${end.complemento}` : ""}
                        </p>
                        <p className="text-slate-500 dark:text-slate-400">
                          {end.bairro} • {end.cidade}/{end.uf}
                        </p>
                        <p className="text-slate-400 font-mono text-[10px]">CEP: {end.cep}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ QUADRO SOCIETÁRIO ═══ */}
        {resultado.cadastro?.quadroSociatario?.length > 0 && (
          <div className="border border-slate-200 dark:border-slate-600 rounded-xl overflow-hidden">
            <SectionHeader id="socios" icon={Users} title="Quadro Societário" badge={resultado.cadastro.qntQuadroSociatario || resultado.cadastro.quadroSociatario.length} />
            {isSectionOpen("socios") && (
              <div className="p-3 space-y-2">
                {resultado.cadastro.quadroSociatario.map((socio: any, i: number) => (
                  <div key={i} className="bg-slate-50 dark:bg-slate-700/30 rounded-lg p-2.5 text-xs text-slate-600 dark:text-slate-300">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="w-3 h-3 text-indigo-500 flex-shrink-0" />
                        <div>
                          <p className="font-bold text-slate-700 dark:text-slate-200">{socio.nome}</p>
                          <p className="text-[10px] text-slate-400">{socio.descricaos || socio.descricao || "Sócio"}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-indigo-600 dark:text-indigo-400">{socio.participacao}%</p>
                        {socio.documento && (
                          <p className="text-[9px] text-slate-400 font-mono">{formatDoc(socio.documento)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ PENDÊNCIAS DETALHADAS ═══ */}
        {resultado.totalPendencias > 0 && resultado.pendencias && (
          <div className="border border-red-200 dark:border-red-800 rounded-xl overflow-hidden">
            <SectionHeader id="pendencias" icon={AlertTriangle} title="Pendências Detalhadas" badge={resultado.totalPendencias} />
            {isSectionOpen("pendencias") && (
              <div className="p-3 space-y-2">
                {resultado.pendencias.rgi?.quantidade > 0 && (
                  <div className="bg-red-50 dark:bg-red-900/10 rounded-lg p-2.5 border border-red-100 dark:border-red-900/30">
                    <p className="text-[11px] font-bold text-red-700 dark:text-red-300 mb-1">
                      RGI (Registros): {resultado.pendencias.rgi.quantidade} • {formatCurrency(resultado.pendencias.rgi.valor)}
                    </p>
                    {resultado.pendencias.rgi.registros?.length > 0 && (
                      <div className="space-y-1 mt-2">
                        {resultado.pendencias.rgi.registros.map((r: any, i: number) => (
                          <p key={i} className="text-[10px] text-red-600 dark:text-red-400">
                            {r.credor} • {formatCurrency(r.valor)} • {r.dataOcorrencia}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {resultado.pendencias.protestos?.quantidade > 0 && (
                  <div className="bg-red-50 dark:bg-red-900/10 rounded-lg p-2.5 border border-red-100 dark:border-red-900/30">
                    <p className="text-[11px] font-bold text-red-700 dark:text-red-300 mb-1">
                      Protestos: {resultado.pendencias.protestos.quantidade} • {formatCurrency(resultado.pendencias.protestos.valor)}
                    </p>
                    {resultado.pendencias.protestos.registros?.length > 0 && (
                      <div className="space-y-1 mt-2">
                        {resultado.pendencias.protestos.registros.map((r: any, i: number) => (
                          <p key={i} className="text-[10px] text-red-600 dark:text-red-400">
                            {r.cartorio || r.credor} • {formatCurrency(r.valor)} • {r.dataOcorrencia}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {resultado.pendencias.chequesSemFundo?.quantidade > 0 && (
                  <div className="bg-red-50 dark:bg-red-900/10 rounded-lg p-2.5 border border-red-100 dark:border-red-900/30">
                    <p className="text-[11px] font-bold text-red-700 dark:text-red-300">
                      Cheques sem Fundo: {resultado.pendencias.chequesSemFundo.quantidade}
                    </p>
                    {resultado.pendencias.chequesSemFundo.registros?.length > 0 && (
                      <div className="space-y-1 mt-2">
                        {resultado.pendencias.chequesSemFundo.registros.map((r: any, i: number) => (
                          <p key={i} className="text-[10px] text-red-600 dark:text-red-400">
                            {r.banco || r.credor} • {r.agencia} • {r.dataOcorrencia}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Valor total pendências */}
        {resultado.valorTotalPendencias > 0 && (
          <div className="text-center py-2">
            <p className="text-[10px] text-slate-400 uppercase">Valor Total em Pendências</p>
            <p className="text-lg font-black text-red-600">{formatCurrency(resultado.valorTotalPendencias)}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * SerasaMetricas - Painel de métricas para gestores
 */
export function SerasaMetricas() {
  const [periodo, setPeriodo] = useState<"7d" | "30d" | "90d" | "all">("30d");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "pendencias" | "aprovadas">("todos");
  const metricas = trpc.serasa.metricas.useQuery({ periodo });

  if (metricas.isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-20 bg-slate-200 dark:bg-slate-700 rounded-xl" />
        <div className="h-40 bg-slate-200 dark:bg-slate-700 rounded-xl" />
      </div>
    );
  }

  const data = metricas.data;
  if (!data) return null;

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">Período:</span>
          {(["7d", "30d", "90d", "all"] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={`px-2.5 py-1 text-[10px] font-medium rounded-full transition-colors ${
                periodo === p 
                  ? "bg-red-600 text-white" 
                  : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
              }`}
            >
              {p === "7d" ? "7 dias" : p === "30d" ? "30 dias" : p === "90d" ? "90 dias" : "Tudo"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">Status:</span>
          {(["todos", "pendencias", "aprovadas"] as const).map(s => (
            <button
              key={s}
              onClick={() => setFiltroStatus(s)}
              className={`px-2.5 py-1 text-[10px] font-medium rounded-full transition-colors ${
                filtroStatus === s 
                  ? "bg-red-600 text-white" 
                  : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
              }`}
            >
              {s === "todos" ? "Todos" : s === "pendencias" ? "Com Pendências" : "Aprovadas"}
            </button>
          ))}
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white dark:bg-slate-700/50 rounded-xl p-3 text-center shadow-sm border border-slate-200 dark:border-slate-600">
          <p className="text-[10px] text-slate-400 uppercase">Total</p>
          <p className="text-xl font-black text-slate-700 dark:text-slate-200">{(data.totais as any)?.total || 0}</p>
        </div>
        <div className="bg-white dark:bg-slate-700/50 rounded-xl p-3 text-center shadow-sm border border-slate-200 dark:border-slate-600">
          <p className="text-[10px] text-slate-400 uppercase">Aprovadas</p>
          <p className="text-xl font-black text-emerald-600">{(data.totais as any)?.aprovadas || 0}</p>
        </div>
        <div className="bg-white dark:bg-slate-700/50 rounded-xl p-3 text-center shadow-sm border border-slate-200 dark:border-slate-600">
          <p className="text-[10px] text-slate-400 uppercase">Reprovadas</p>
          <p className="text-xl font-black text-red-600">{(data.totais as any)?.reprovadas || 0}</p>
        </div>
      </div>

      {/* Por operador */}
      {(data.porOperador as any[])?.length > 0 && (
        <div className="bg-white dark:bg-slate-700/50 rounded-xl p-3 shadow-sm border border-slate-200 dark:border-slate-600">
          <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">Por Operador</p>
          <div className="space-y-2">
            {(data.porOperador as any[]).map((op: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-200">{op.operadorName}</span>
                <div className="flex items-center gap-3">
                  <span className="text-slate-500">{op.totalConsultas} consultas</span>
                  <span className="text-emerald-600">{op.consultasAprovadas} OK</span>
                  <span className="text-red-600">{op.consultasReprovadas} pend.</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Últimas consultas */}
      {data.ultimasConsultas?.length > 0 && (
        <div className="bg-white dark:bg-slate-700/50 rounded-xl p-3 shadow-sm border border-slate-200 dark:border-slate-600">
          <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">Últimas Consultas</p>
          <div className="space-y-1.5">
            {data.ultimasConsultas
              .filter((c: any) => {
                if (filtroStatus === "todos") return true;
                if (filtroStatus === "aprovadas") return c.aprovado;
                return !c.aprovado;
              })
              .map((c: any) => (
              <div key={c.id} className="flex items-center justify-between text-[11px] py-1 border-b border-slate-100 dark:border-slate-600 last:border-0">
                <div className="flex items-center gap-2">
                  {c.aprovado ? <ShieldCheck className="w-3 h-3 text-emerald-500" /> : <ShieldAlert className="w-3 h-3 text-red-500" />}
                  <span className="font-medium text-slate-700 dark:text-slate-200">{c.clienteNome || c.clienteDocumento}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <span>{c.operadorName}</span>
                  <span>{new Date(c.createdAt).toLocaleDateString("pt-BR")}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
