/**
 * SerasaConsulta - Componente de consulta de crédito Serasa
 * 
 * Botão vermelho "Consultar Serasa" que:
 * 1. Pede confirmação de senha do operador
 * 2. Faz a consulta via API
 * 3. Exibe resultado em card verde (OK) ou vermelho (pendências)
 * 
 * Também mostra "Última consulta feita há X dias" quando há histórico.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Shield, ShieldAlert, ShieldCheck, X, Lock, AlertTriangle, CheckCircle2, Building2, Phone, Mail, MapPin, Users, TrendingUp, Clock, FileSearch } from "lucide-react";

interface SerasaConsultaProps {
  documento: string; // CPF ou CNPJ do cliente
  clienteNome: string;
  operadorName: string; // Nome do operador logado
  salesOrderRequestId?: number;
  compact?: boolean; // Modo compacto para exibição na Vitória
}

export function SerasaConsulta({ documento, clienteNome, operadorName, salesOrderRequestId, compact = false }: SerasaConsultaProps) {
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [password, setPassword] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [resultData, setResultData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

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
        setShowResult(true);
        setShowPasswordDialog(false);
        setPassword("");
        setError(null);
        // Invalidate última consulta
        ultimaConsulta.refetch();
      } else {
        setError(data.error || "Erro desconhecido");
      }
    },
    onError: (err) => {
      setError(err.message || "Erro ao consultar Serasa");
    },
  });

  const handleConsultar = () => {
    if (!password.trim()) {
      setError("Digite sua senha");
      return;
    }
    setError(null);

    const docLimpo = documento.replace(/[.\-\/]/g, "");
    const tipoPessoa = docLimpo.length <= 11 ? "PF" : "PJ";

    consultarMutation.mutate({
      documento: docLimpo,
      tipoPessoa,
      operadorName,
      operadorPassword: password,
      ...(salesOrderRequestId ? { salesOrderRequestId } : {}),
    });
  };

  // Se não autorizado, não mostra nada (ou mostra apenas última consulta no modo compact)
  if (!authCheck.data?.authorized && !compact) {
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
    return null;
  }

  // Modo compacto (para Vitória) - mostra apenas última consulta
  if (compact) {
    if (ultimaConsulta.data?.found) {
      return (
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Clock className="w-3 h-3" />
          <span>Última consulta Serasa: <strong className={ultimaConsulta.data.consulta?.diasDesdeConsulta && ultimaConsulta.data.consulta.diasDesdeConsulta > 30 ? "text-amber-600" : ""}>{ultimaConsulta.data.consulta?.tempoTexto}</strong></span>
          {ultimaConsulta.data.consulta?.aprovado ? (
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          ) : (
            <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
          )}
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
        <AlertTriangle className="w-3 h-3" />
        <span>Nenhuma consulta Serasa realizada para este cliente</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Última consulta info */}
      {ultimaConsulta.data?.found && !showResult && (
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
      {!showResult && (
        <button
          onClick={() => { setShowPasswordDialog(true); setError(null); setPassword(""); }}
          disabled={!documento || documento.length < 11}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
        >
          <Shield className="w-4 h-4" />
          Consultar Serasa
        </button>
      )}

      {/* Dialog de Senha */}
      {showPasswordDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999]" onClick={() => setShowPasswordDialog(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Confirmar Consulta</h3>
                  <p className="text-[10px] text-slate-500">Esta consulta é paga e afeta o score</p>
                </div>
              </div>
              <button onClick={() => setShowPasswordDialog(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-[11px] text-amber-800 dark:text-amber-200">
                  <p className="font-bold">Atenção!</p>
                  <p>Consultas ao Serasa são <strong>pagas</strong> e afetam o <strong>score do cliente</strong>. Confirme digitando sua senha.</p>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-xs text-slate-600 dark:text-slate-300 mb-1">
                Cliente: <strong>{clienteNome || documento}</strong>
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                Documento: <strong>{documento}</strong>
              </p>
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 block">
                Sua senha ({operadorName}):
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleConsultar()}
                placeholder="Digite sua senha..."
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                autoFocus
              />
            </div>

            {error && (
              <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setShowPasswordDialog(false)}
                className="flex-1 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConsultar}
                disabled={consultarMutation.isPending || !password.trim()}
                className="flex-1 px-3 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:bg-red-300 rounded-lg transition-colors flex items-center justify-center gap-1"
              >
                {consultarMutation.isPending ? (
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
      )}

      {/* Resultado da Consulta */}
      {showResult && resultData && (
        <SerasaResultCard resultado={resultData} onClose={() => setShowResult(false)} />
      )}
    </div>
  );
}

/**
 * Card de resultado da consulta Serasa
 */
function SerasaResultCard({ resultado, onClose }: { resultado: any; onClose: () => void }) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const isAprovado = resultado.aprovado;

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return "—";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const formatDoc = (doc: string) => {
    if (!doc) return "";
    const clean = doc.replace(/\D/g, "");
    if (clean.length === 11) return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    if (clean.length === 14) return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    return doc;
  };

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
        {/* Score e Resumo */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="bg-white dark:bg-slate-700/50 rounded-xl p-3 text-center shadow-sm">
            <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Score</p>
            <p className={`text-xl font-black ${
              (resultado.score || 0) >= 700 ? "text-emerald-600" :
              (resultado.score || 0) >= 400 ? "text-amber-600" : "text-red-600"
            }`}>{resultado.score || "—"}</p>
            <p className="text-[9px] text-slate-400">de 1000</p>
          </div>
          <div className="bg-white dark:bg-slate-700/50 rounded-xl p-3 text-center shadow-sm">
            <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Pontualidade</p>
            <p className="text-xl font-black text-slate-800 dark:text-slate-100">
              {resultado.pontualidade ? `${resultado.pontualidade}%` : "—"}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-700/50 rounded-xl p-3 text-center shadow-sm">
            <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Limite Crédito</p>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{formatCurrency(resultado.limiteCredito)}</p>
          </div>
          <div className="bg-white dark:bg-slate-700/50 rounded-xl p-3 text-center shadow-sm">
            <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Renda/Faturamento</p>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{formatCurrency(resultado.rendaEstimada)}</p>
          </div>
        </div>

        {/* Pendências */}
        {resultado.totalPendencias > 0 && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
            <h4 className="text-xs font-bold text-red-800 dark:text-red-200 mb-2 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              Pendências Encontradas ({resultado.totalPendencias})
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              {resultado.temProtesto && (
                <div className="bg-red-100 dark:bg-red-900/30 rounded-lg p-2">
                  <p className="font-bold text-red-700 dark:text-red-300">Protestos</p>
                  <p className="text-red-600 dark:text-red-400">
                    {resultado.pendencias?.protestos?.quantidade || 0} registro(s) - {formatCurrency(resultado.pendencias?.protestos?.valor || 0)}
                  </p>
                </div>
              )}
              {resultado.temRgi && (
                <div className="bg-red-100 dark:bg-red-900/30 rounded-lg p-2">
                  <p className="font-bold text-red-700 dark:text-red-300">Registros (RGI)</p>
                  <p className="text-red-600 dark:text-red-400">
                    {resultado.pendencias?.rgi?.quantidade || 0} registro(s) - {formatCurrency(resultado.pendencias?.rgi?.valor || 0)}
                  </p>
                </div>
              )}
              {resultado.temChequeSemFundo && (
                <div className="bg-red-100 dark:bg-red-900/30 rounded-lg p-2">
                  <p className="font-bold text-red-700 dark:text-red-300">Cheques sem Fundo</p>
                  <p className="text-red-600 dark:text-red-400">
                    {resultado.pendencias?.chequesSemFundo?.quantidade || 0} registro(s)
                  </p>
                </div>
              )}
            </div>
            {/* Detalhes dos protestos */}
            {resultado.pendencias?.protestos?.registros?.length > 0 && (
              <div className="mt-2">
                <button 
                  onClick={() => setExpandedSection(expandedSection === "protestos" ? null : "protestos")}
                  className="text-[10px] text-red-600 dark:text-red-400 underline"
                >
                  {expandedSection === "protestos" ? "Ocultar detalhes" : "Ver detalhes dos protestos"}
                </button>
                {expandedSection === "protestos" && (
                  <div className="mt-1 space-y-1">
                    {resultado.pendencias.protestos.registros.map((r: any, i: number) => (
                      <div key={i} className="text-[10px] text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/10 rounded p-1.5">
                        {r.dataOcorrencia && <span>{r.dataOcorrencia} • </span>}
                        {r.valor && <span>{formatCurrency(parseFloat(r.valor))} • </span>}
                        {r.cartorio && <span>{r.cartorio} • </span>}
                        {r.cidade && <span>{r.cidade}/{r.uf}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Análise IA */}
        {resultado.analiseIA && (
          <div className={`rounded-xl p-3 border ${
            resultado.analiseAprovada 
              ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800" 
              : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
          }`}>
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              Análise de Crédito (IA Serasa)
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{resultado.analiseIA}</p>
          </div>
        )}

        {/* Dados Cadastrais */}
        {resultado.cadastro && (
          <div className="bg-white dark:bg-slate-700/30 rounded-xl p-3 border border-slate-200 dark:border-slate-600">
            <button 
              onClick={() => setExpandedSection(expandedSection === "cadastro" ? null : "cadastro")}
              className="w-full flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200"
            >
              <span className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" />
                Dados Cadastrais
              </span>
              <span className="text-[10px] text-slate-400">{expandedSection === "cadastro" ? "▲" : "▼"}</span>
            </button>
            {expandedSection === "cadastro" && (
              <div className="mt-2 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] text-slate-400">Razão Social</p>
                    <p className="font-medium">{resultado.cadastro.nome}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400">Documento</p>
                    <p className="font-medium">{formatDoc(resultado.cadastro.documento || resultado.documento)}</p>
                  </div>
                  {resultado.cadastro.situacao && (
                    <div>
                      <p className="text-[10px] text-slate-400">Situação</p>
                      <p className={`font-medium ${resultado.cadastro.situacao === "ATIVA" ? "text-emerald-600" : "text-red-600"}`}>
                        {resultado.cadastro.situacao}
                      </p>
                    </div>
                  )}
                  {resultado.cadastro.porte && (
                    <div>
                      <p className="text-[10px] text-slate-400">Porte</p>
                      <p className="font-medium">{resultado.cadastro.porte}</p>
                    </div>
                  )}
                  {resultado.cadastro.capitalSocial && (
                    <div>
                      <p className="text-[10px] text-slate-400">Capital Social</p>
                      <p className="font-medium">{formatCurrency(resultado.cadastro.capitalSocial)}</p>
                    </div>
                  )}
                  {resultado.cadastro.atividadePrincipal && (
                    <div className="col-span-2">
                      <p className="text-[10px] text-slate-400">Atividade Principal</p>
                      <p className="font-medium">{resultado.cadastro.atividadePrincipal}</p>
                    </div>
                  )}
                </div>

                {/* Contatos */}
                {(resultado.cadastro.emails?.length > 0 || resultado.cadastro.telefones?.length > 0) && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-600">
                    {resultado.cadastro.emails?.length > 0 && (
                      <div className="flex items-center gap-1 mb-1">
                        <Mail className="w-3 h-3 text-slate-400" />
                        <span>{resultado.cadastro.emails.join(", ")}</span>
                      </div>
                    )}
                    {resultado.cadastro.telefones?.length > 0 && (
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{resultado.cadastro.telefones.join(", ")}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Endereços */}
                {resultado.cadastro.enderecos?.length > 0 && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-600">
                    <p className="text-[10px] text-slate-400 mb-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> Endereços</p>
                    {resultado.cadastro.enderecos.map((end: any, i: number) => (
                      <p key={i} className="text-[10px] text-slate-500 dark:text-slate-400">
                        {end.logradouro}{end.numero ? `, ${end.numero}` : ""}{end.complemento ? ` - ${end.complemento}` : ""} • {end.bairro} • {end.cidade}/{end.uf} • CEP {end.cep}
                      </p>
                    ))}
                  </div>
                )}

                {/* Quadro Societário */}
                {resultado.cadastro.quadroSociatario?.length > 0 && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-600">
                    <p className="text-[10px] text-slate-400 mb-1 flex items-center gap-1"><Users className="w-3 h-3" /> Quadro Societário</p>
                    {resultado.cadastro.quadroSociatario.map((s: any, i: number) => (
                      <div key={i} className="text-[10px] text-slate-500 dark:text-slate-400">
                        <span className="font-medium">{s.nome}</span> • {s.descricaos} • {s.participacao}%
                      </div>
                    ))}
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
      {/* Filtro de período */}
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

      {/* Totais */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white dark:bg-slate-700/50 rounded-xl p-3 text-center shadow-sm border border-slate-200 dark:border-slate-600">
          <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Total Consultas</p>
          <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{Number(data.totais?.total || 0)}</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 text-center shadow-sm border border-emerald-200 dark:border-emerald-800">
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase">Aprovadas</p>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{Number(data.totais?.aprovadas || 0)}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 text-center shadow-sm border border-red-200 dark:border-red-800">
          <p className="text-[10px] text-red-600 dark:text-red-400 uppercase">Reprovadas</p>
          <p className="text-2xl font-black text-red-600 dark:text-red-400">{Number(data.totais?.reprovadas || 0)}</p>
        </div>
      </div>

      {/* Por Operador */}
      {data.porOperador.length > 0 && (
        <div className="bg-white dark:bg-slate-700/30 rounded-xl p-4 border border-slate-200 dark:border-slate-600">
          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-3">Consultas por Operador</h4>
          <div className="space-y-2">
            {data.porOperador.map((op: any, i: number) => (
              <div key={i} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-2">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{op.operadorName}</span>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-slate-500">{Number(op.totalConsultas)} consultas</span>
                  <span className="text-emerald-600">{Number(op.consultasAprovadas)} ✓</span>
                  <span className="text-red-600">{Number(op.consultasReprovadas)} ✗</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Últimas consultas */}
      {data.ultimasConsultas.length > 0 && (
        <div className="bg-white dark:bg-slate-700/30 rounded-xl p-4 border border-slate-200 dark:border-slate-600">
          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-3">Últimas Consultas</h4>
          <div className="space-y-1.5">
            {data.ultimasConsultas.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  {c.aprovado ? (
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
                  )}
                  <div>
                    <p className="text-[11px] font-medium text-slate-700 dark:text-slate-200">
                      {c.clienteNome || c.clienteDocumento}
                    </p>
                    <p className="text-[9px] text-slate-400">
                      {c.operadorName} • {new Date(c.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-[10px] font-bold ${(c.score || 0) >= 700 ? "text-emerald-600" : (c.score || 0) >= 400 ? "text-amber-600" : "text-red-600"}`}>
                    Score: {c.score || "—"}
                  </p>
                  {c.totalPendencias > 0 && (
                    <p className="text-[9px] text-red-500">{c.totalPendencias} pendência(s)</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.porOperador.length === 0 && data.ultimasConsultas.length === 0 && (
        <div className="text-center py-8 text-slate-400 dark:text-slate-500">
          <Shield className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="text-xs">Nenhuma consulta Serasa realizada neste período</p>
        </div>
      )}
    </div>
  );
}
