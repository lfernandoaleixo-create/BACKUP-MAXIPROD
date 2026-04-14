import { useState, useEffect, useMemo } from "react";
import { X, Eye, ExternalLink, CheckCircle2, AlertTriangle, Loader2, ClipboardList, Shield, ShieldCheck, ShieldAlert } from "lucide-react";
import { trpc } from "@/lib/trpc";

/* ---- Types ---- */
export type VerifySection = "faturamento" | "vendas" | "entradas" | "contas_pagas" | "recebiveis" | "inadimplencia" | "contas_receber_mes" | "contas_pagar_mes" | "a_faturar" | "amostra_bonif";

interface MaxiprodAutoVerifierProps {
  /** Title shown in the modal header */
  title: string;
  /** Subtitle / description */
  subtitle: string;
  /** Which section to verify */
  section: VerifySection;
  /** Period start date (YYYY-MM-DD) */
  startDate: string;
  /** Period end date (YYYY-MM-DD) */
  endDate: string;
  /** Value from the Manus dashboard */
  valorManus: number;
  /** Close handler */
  onClose: () => void;
}

const MAXIPROD_LOGIN_URL = "https://app.maxiprod.com.br";

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const sectionLabels: Record<string, string> = {
  faturamento: "Faturamento (NFs de Saida)",
  vendas: "Pedidos de Venda",
  entradas: "Entradas (Recebimentos)",
  contas_pagas: "Contas Pagas",
  recebiveis: "Contas a Receber",
  inadimplencia: "Inadimplencia (Titulos Vencidos)",
  contas_receber_mes: "Contas a Receber (Mes)",
  contas_pagar_mes: "Contas a Pagar (Mes)",
  a_faturar: "Pedidos A Faturar",
  amostra_bonif: "Amostra / Bonificacao",
};

/* ---- Passo a passo instructions for each section ---- */
function getVerificationSteps(section: VerifySection, startDate: string, endDate: string): { text: string; highlight?: boolean }[] {
  const [sy, sm, sd] = startDate.split("-");
  const [ey, em, ed] = endDate.split("-");
  const dateRange = `${sd}/${sm}/${sy} a ${ed}/${em}/${ey}`;

  const login = [
    { text: "Acesse o Maxiprod: app.maxiprod.com.br" },
    { text: "Login: lfernandoaleixo@gmail.com | Senha: Luizfernando7008*" },
  ];

  if (section === "faturamento") {
    return [
      ...login,
      { text: "Va em: Notas Fiscais → Notas Fiscais de Saida" },
      { text: `Emissao: ${dateRange}` },
      { text: 'Estado: apenas "Emitida" | Tipo: "Saida"' },
      { text: "IMPORTANTE: Exclua NFs de Amostra, Bonificacao, Devolucao, Remessa, Recusa, Transferencia, Cancelado", highlight: true },
      { text: "Aceite apenas NFs de produtos: Bambu, Madeira, Rojao, Serragem, Madeira/Fibra", highlight: true },
      { text: 'Some a coluna "Valor Total" das NFs filtradas' },
    ];
  }

  if (section === "vendas") {
    return [
      ...login,
      { text: "Va em: Vendas → Pedidos de Venda" },
      { text: `Data do pedido: ${dateRange}` },
      { text: "Exclua pedidos com estado: Cancelado" },
      { text: 'Some a coluna "Valor Liquido" de todos os pedidos' },
    ];
  }

  if (section === "entradas") {
    return [
      ...login,
      { text: "Va em: Financeiro → Contas a Receber" },
      { text: 'Estado: apenas "Recebidos"' },
      { text: `Liquidacao: ${dateRange}` },
      { text: "NOTA: O dashboard exclui transferencias entre empresas do grupo (Palitos Fox, Mesa Indust, Bambusa, Espetos Ind, Varetas)", highlight: true },
      { text: 'Some a coluna "Valor Recebido Liquido"' },
    ];
  }

  if (section === "contas_pagas") {
    return [
      ...login,
      { text: "Va em: Financeiro → Contas a Pagar" },
      { text: 'Estado: apenas "Pagos"' },
      { text: `Liquidacao: ${dateRange}` },
      { text: 'Some a coluna "Valor Pago Liquido"' },
    ];
  }

  if (section === "recebiveis" || section === "contas_receber_mes") {
    return [
      ...login,
      { text: "Va em: Financeiro → Contas a Receber" },
      { text: 'Estado: apenas "A receber" (em aberto)' },
      { text: `Vencimento: ${dateRange}` },
      { text: 'Clique em "Ocultar filtros" para ver o total no rodape da tabela' },
    ];
  }

  if (section === "contas_pagar_mes") {
    return [
      ...login,
      { text: "Va em: Financeiro → Contas a Pagar" },
      { text: 'Estado: apenas "A pagar" (em aberto)' },
      { text: `Vencimento: ${dateRange}` },
      { text: 'Clique em "Ocultar filtros" para ver o total no rodape da tabela' },
    ];
  }

  if (section === "inadimplencia") {
    return [
      ...login,
      { text: "Va em: Financeiro → Contas a Receber" },
      { text: 'Estado: apenas "A receber" (em aberto)' },
      { text: "Vencimento: ate o ultimo dia util anterior a hoje", highlight: true },
      { text: 'Verifique o total de titulos vencidos no rodape' },
    ];
  }

  if (section === "a_faturar") {
    return [
      ...login,
      { text: "Va em: Vendas → Pedidos de Venda" },
      { text: `Data do pedido: ${dateRange}` },
      { text: 'Filtrar por Estado do Item: "A faturar"' },
      { text: "Exclua pedidos com estado: Cancelado" },
      { text: 'Some a coluna "Valor Liquido" dos pedidos filtrados' },
    ];
  }

  if (section === "amostra_bonif") {
    return [
      ...login,
      { text: "Va em: Vendas → Pedidos de Venda" },
      { text: `Data do pedido: ${dateRange}` },
      { text: 'Filtrar por Estado Configuravel: "Amostra" e "Bonificacao"' },
      { text: "Exclua pedidos com estado: Cancelado" },
      { text: 'Some a coluna "Valor Liquido" dos pedidos filtrados' },
    ];
  }

  return login;
}

/* ---- Component ---- */
export default function MaxiprodAutoVerifier({
  title,
  subtitle,
  section,
  startDate,
  endDate,
  valorManus,
  onClose,
}: MaxiprodAutoVerifierProps) {
  const [showSteps, setShowSteps] = useState(true);

  // Auto-query Maxiprod via backend
  const { data: cpData, isLoading: cpLoading, error: cpError } = trpc.financial.getMaxiprodContraprova.useQuery(
    { section, startDate, endDate },
    { staleTime: 5 * 60 * 1000, retry: 1 }
  );

  const valorMaxiprod = cpData?.valorMaxiprod;
  const maxiprodLabel = cpData?.label;
  const maxiprodCount = cpData?.count;

  const divergencia = valorManus !== undefined && valorMaxiprod !== undefined
    ? Math.abs(valorManus - valorMaxiprod)
    : null;
  const hasDivergencia = divergencia !== null && divergencia > 1; // tolerancia R$1
  const confere = !cpLoading && !cpError && valorMaxiprod !== undefined && !hasDivergencia;

  const steps = useMemo(() => getVerificationSteps(section, startDate, endDate), [section, startDate, endDate]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                <Eye className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold text-base">{title}</h3>
                <p className="text-indigo-300 text-xs">{subtitle}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Values side by side */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="px-4 py-3 bg-white/10 rounded-lg border border-white/20">
              <span className="text-indigo-300 text-[10px] uppercase tracking-wider">Valor no Dashboard</span>
              <p className="text-white font-bold text-lg mt-0.5" style={{ textShadow: "0 0 15px rgba(34,211,238,0.4)" }}>
                {formatCurrency(valorManus)}
              </p>
            </div>
            <div className={`px-4 py-3 rounded-lg border ${
              cpLoading ? "bg-white/5 border-white/10" :
              hasDivergencia ? "bg-red-500/20 border-red-400/40" :
              confere ? "bg-emerald-500/20 border-emerald-400/40" :
              "bg-white/5 border-white/10"
            }`}>
              <span className="text-indigo-300 text-[10px] uppercase tracking-wider">Valor Maxiprod (API)</span>
              {cpLoading ? (
                <div className="flex items-center gap-2 mt-1.5">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-300" />
                  <span className="text-indigo-300 text-sm">Consultando Maxiprod...</span>
                </div>
              ) : cpError ? (
                <p className="text-red-300 text-sm mt-1">Erro na consulta</p>
              ) : valorMaxiprod !== undefined ? (
                <p className={`font-bold text-lg mt-0.5 ${hasDivergencia ? "text-red-300" : "text-emerald-300"}`}
                  style={{ textShadow: hasDivergencia ? "0 0 15px rgba(239,68,68,0.4)" : "0 0 15px rgba(52,211,153,0.4)" }}>
                  {formatCurrency(valorMaxiprod)}
                </p>
              ) : (
                <p className="text-white/50 text-sm mt-1">Indisponivel</p>
              )}
            </div>
          </div>

          {/* Result banner */}
          {confere && (
            <div className="mt-3 px-4 py-3 bg-emerald-500/25 rounded-lg border border-emerald-400/40 flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-emerald-300 flex-shrink-0" />
              <div>
                <p className="text-emerald-100 text-sm font-bold">Conferencia automatica com Maxiprod realizada. Os valores conferem!</p>
                {maxiprodLabel && <p className="text-emerald-300/70 text-[10px] mt-0.5">{maxiprodLabel}</p>}
              </div>
            </div>
          )}

          {hasDivergencia && (
            <div className="mt-3 px-4 py-3 bg-red-500/25 rounded-lg border border-red-400/40 flex items-center gap-3">
              <ShieldAlert className="w-6 h-6 text-red-300 flex-shrink-0" />
              <div>
                <p className="text-red-100 text-sm font-bold">Divergencia de {formatCurrency(divergencia!)} detectada!</p>
                {maxiprodLabel && <p className="text-red-300/70 text-[10px] mt-0.5">{maxiprodLabel}</p>}
              </div>
            </div>
          )}

          {cpLoading && (
            <div className="mt-3 px-4 py-3 bg-indigo-500/15 rounded-lg border border-indigo-400/30 flex items-center gap-3">
              <Shield className="w-5 h-5 text-indigo-300 flex-shrink-0 animate-pulse" />
              <p className="text-indigo-200 text-sm">Verificando valores com o Maxiprod em tempo real...</p>
            </div>
          )}
        </div>

        {/* Verification steps (collapsible) */}
        <div className="px-6 py-4">
          <button
            onClick={() => setShowSteps(!showSteps)}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Passo a passo para verificacao manual
              </span>
            </div>
            <span className="text-slate-400 text-xs">{showSteps ? "Recolher" : "Expandir"}</span>
          </button>

          {showSteps && (
            <div className="mt-3 space-y-2 max-h-[35vh] overflow-y-auto">
              {steps.map((st, idx) => (
                <div key={idx} className={`flex items-start gap-3 p-3 rounded-lg transition-all ${
                  st.highlight ? "bg-amber-50 border-2 border-amber-300 shadow-sm" : "bg-slate-50 border border-slate-200"
                }`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${
                    st.highlight ? "bg-amber-500 text-white shadow-md shadow-amber-500/30" : "bg-indigo-600 text-white"
                  }`}>{idx + 1}</div>
                  <p className={`text-sm leading-relaxed pt-0.5 ${
                    st.highlight ? "text-amber-800 font-semibold" : "text-slate-700"
                  }`}>{st.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <a href={MAXIPROD_LOGIN_URL} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-bold shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all hover:scale-[1.02]">
            <ExternalLink className="w-4 h-4" /> Abrir Maxiprod
          </a>
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 font-medium">Fechar</button>
        </div>
      </div>
    </div>
  );
}
