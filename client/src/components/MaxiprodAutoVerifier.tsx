import { useState, useEffect, useMemo, useRef } from "react";
import { X, Eye, ExternalLink, CheckCircle2, AlertTriangle, Loader2, ClipboardList, Shield, ShieldCheck, ShieldAlert, Monitor, Mouse, Keyboard, Play, Pause, RotateCcw, ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc";

/* ---- Types ---- */
export type VerifySection = "faturamento" | "vendas" | "entradas" | "contas_pagas" | "recebiveis" | "inadimplencia" | "contas_receber_mes" | "contas_pagar_mes" | "a_faturar" | "amostra_bonif" | "vendas_faturado";

interface SimulatorStep {
  screen: string;
  action: string;
  actionType: "navigate" | "click" | "type" | "select" | "verify" | "result";
  highlight?: boolean;
  typedValue?: string;
  fieldLabel?: string;
}

interface MaxiprodAutoVerifierProps {
  title: string;
  subtitle: string;
  section: VerifySection;
  startDate: string;
  endDate: string;
  valorManus: number;
  onClose: () => void;
  // Filtros opcionais para seção "recebiveis" (empresa + conta bancária)
  empresaNome?: string;
  bancoNome?: string;
  contaNumero?: string;
  // Filtros de status e forma de cobrança
  statusFilter?: "TODOS" | "VENCIDO" | "A_VENCER";
  formaFilter?: "TODOS" | "PIX" | "Boleto" | "Cheque" | "Depósito" | "Dinheiro";
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
  vendas_faturado: "Pedidos de Venda Faturados",
};

const actionIcons: Record<string, typeof Monitor> = {
  navigate: Monitor,
  click: Mouse,
  type: Keyboard,
  select: Mouse,
  verify: CheckCircle2,
  result: CheckCircle2,
};

/* ---- Animated step generators ---- */
function getAnimatedSteps(section: VerifySection, startDate: string, endDate: string, valorManus?: number): SimulatorStep[] {
  const [sy, sm, sd] = startDate.split("-");
  const [ey, em, ed] = endDate.split("-");
  const dateRange = `${sd}/${sm}/${sy} a ${ed}/${em}/${ey}`;
  const valorText = valorManus != null ? formatCurrency(valorManus) : "R$ ---";

  const loginSteps: SimulatorStep[] = [
    { screen: "Acessando Maxiprod...\napp.maxiprod.com.br", action: "Abrir o Maxiprod no navegador", actionType: "navigate" },
    { screen: "Tela de Login do Maxiprod", action: "Preencher e-mail de acesso", actionType: "type", fieldLabel: "E-mail", typedValue: "lfernandoaleixo@gmail.com" },
    { screen: "Tela de Login do Maxiprod", action: "Preencher senha", actionType: "type", fieldLabel: "Senha", typedValue: "Luizfernando7008*" },
    { screen: "Entrando no sistema...\nLogin realizado com sucesso!", action: "Clicar em Entrar", actionType: "click" },
  ];

  if (section === "vendas") {
    return [
      ...loginSteps,
      { screen: "Menu Principal\n→ Vendas → Pedidos de Venda", action: "Navegar para Vendas → Pedidos de Venda", actionType: "navigate" },
      { screen: "Filtros de Pedidos de Venda\nAplicando periodo...", action: `Definir data do pedido: ${dateRange}`, actionType: "type", fieldLabel: "Data do Pedido", typedValue: dateRange },
      { screen: "Filtros aplicados\nExcluindo pedidos cancelados...", action: "Excluir pedidos com estado: Cancelado", actionType: "select", highlight: true },
      { screen: "Resultado da pesquisa\nSomando valor liquido de todos os pedidos...", action: "Somar coluna 'Valor Liquido' de todos os pedidos", actionType: "verify" },
      { screen: `Total de Vendas no Periodo\n${valorText}`, action: "Compare o total com o valor do Dashboard", actionType: "result", highlight: true },
    ];
  }

  if (section === "faturamento") {
    return [
      ...loginSteps,
      { screen: "Menu Principal\n→ Notas Fiscais → Notas Fiscais de Saida", action: "Navegar para Notas Fiscais → NFs de Saida", actionType: "navigate" },
      { screen: "Filtros de Notas Fiscais\nAplicando periodo de emissao...", action: `Definir emissao: ${dateRange}`, actionType: "type", fieldLabel: "Emissao", typedValue: dateRange },
      { screen: "Filtros\nEstado: Emitida | Tipo: Saida", action: 'Selecionar Estado: "Emitida" e Tipo: "Saida"', actionType: "select" },
      { screen: "IMPORTANTE!\nExcluir NFs com estado configuravel:\nAmostra, Bonificacao, Devolucao,\nRemessa, Recusa, Transferencia, Cancelado", action: "Excluir NFs de Amostra, Bonificacao, Devolucao, Remessa, Recusa, Transferencia, Cancelado", actionType: "select", highlight: true },
      { screen: "Filtro de produtos\nAceitar apenas: Bambu, Madeira, Rojao,\nSerragem, Madeira/Fibra e variacoes", action: "Aceitar apenas NFs de produtos do grupo (Bambu, Madeira, Rojao, etc.)", actionType: "select", highlight: true },
      { screen: "Resultado da pesquisa\nSomando valores das NFs filtradas...", action: "Somar coluna 'Valor Total' das NFs", actionType: "verify" },
      { screen: `Total Faturado no Periodo\n${valorText}`, action: "Compare o total com o valor do Dashboard", actionType: "result", highlight: true },
    ];
  }

  if (section === "entradas") {
    return [
      ...loginSteps,
      { screen: "Menu Principal\n→ Financeiro → Contas a Receber", action: "Navegar para Financeiro → Contas a Receber", actionType: "navigate" },
      { screen: "Filtros de Contas a Receber\nEstado: Recebidos", action: 'Selecionar Estado: apenas "Recebidos"', actionType: "select" },
      { screen: "Filtros\nAplicando periodo de liquidacao...", action: `Definir liquidacao: ${dateRange}`, actionType: "type", fieldLabel: "Liquidacao", typedValue: dateRange },
      { screen: "IMPORTANTE!\nO Dashboard exclui transferencias entre\nempresas do grupo:\nPalitos Fox, Mesa Indust, Bambusa,\nEspetos Ind, Varetas", action: "Dashboard exclui transferencias entre empresas do grupo", actionType: "select", highlight: true },
      { screen: "Resultado da pesquisa\nSomando valor recebido liquido...", action: "Somar coluna 'Valor Recebido Liquido'", actionType: "verify" },
      { screen: `Total Entradas no Periodo\n${valorText}`, action: "Compare o total com o valor do Dashboard", actionType: "result", highlight: true },
    ];
  }

  if (section === "contas_pagas") {
    return [
      ...loginSteps,
      { screen: "Menu Principal\n→ Financeiro → Contas a Pagar", action: "Navegar para Financeiro → Contas a Pagar", actionType: "navigate" },
      { screen: "Filtros de Contas a Pagar\nEstado: Pagos", action: 'Selecionar Estado: apenas "Pagos"', actionType: "select" },
      { screen: "Filtros\nAplicando periodo de liquidacao...", action: `Definir liquidacao: ${dateRange}`, actionType: "type", fieldLabel: "Liquidacao", typedValue: dateRange },
      { screen: "Excluindo cancelados...", action: "Excluir contas com estado: Cancelado", actionType: "select", highlight: true },
      { screen: "Resultado da pesquisa\nSomando valor pago liquido...", action: "Somar coluna 'Valor Pago Liquido'", actionType: "verify" },
      { screen: `Total Contas Pagas no Periodo\n${valorText}`, action: "Compare o total com o valor do Dashboard", actionType: "result", highlight: true },
    ];
  }

  if (section === "recebiveis" || section === "contas_receber_mes") {
    return [
      ...loginSteps,
      { screen: "Menu Principal\n→ Financeiro → Contas a Receber", action: "Navegar para Financeiro → Contas a Receber", actionType: "navigate" },
      { screen: "Filtros de Contas a Receber\nEstado: A receber (em aberto)", action: 'Selecionar Estado: apenas "A receber"', actionType: "select" },
      { screen: `Filtros\nAplicando periodo de vencimento...\n${dateRange}`, action: `Definir vencimento: ${dateRange}`, actionType: "type", fieldLabel: "Vencimento", typedValue: dateRange },
      { screen: 'Clique em "Ocultar filtros"\npara ver o total no rodape da tabela', action: 'Clicar em "Ocultar filtros" para ver o total', actionType: "click" },
      { screen: "Resultado da pesquisa\nSomando valor total a receber...", action: "Verificar total no rodape da tabela", actionType: "verify" },
      { screen: `Total Contas a Receber\n${valorText}`, action: "Compare o total do Maxiprod com o valor do Dashboard", actionType: "result", highlight: true },
    ];
  }

  if (section === "contas_pagar_mes") {
    return [
      ...loginSteps,
      { screen: "Menu Principal\n→ Financeiro → Contas a Pagar", action: "Navegar para Financeiro → Contas a Pagar", actionType: "navigate" },
      { screen: "Filtros de Contas a Pagar\nEstado: A pagar (em aberto)", action: 'Selecionar Estado: apenas "A pagar"', actionType: "select" },
      { screen: `Filtros\nAplicando periodo de vencimento...\n${dateRange}`, action: `Definir vencimento: ${dateRange}`, actionType: "type", fieldLabel: "Vencimento", typedValue: dateRange },
      { screen: 'Clique em "Ocultar filtros"\npara ver o total no rodape da tabela', action: 'Clicar em "Ocultar filtros" para ver o total', actionType: "click" },
      { screen: "Resultado da pesquisa\nSomando valor total a pagar...", action: "Verificar total no rodape da tabela", actionType: "verify" },
      { screen: `Total Contas a Pagar\n${valorText}`, action: "Compare o total do Maxiprod com o valor do Dashboard", actionType: "result", highlight: true },
    ];
  }

  if (section === "inadimplencia") {
    return [
      ...loginSteps,
      { screen: "Menu Principal\n→ Financeiro → Contas a Receber", action: "Navegar para Financeiro → Contas a Receber", actionType: "navigate" },
      { screen: "Filtros de Contas a Receber\nEstado: A receber (em aberto)", action: 'Selecionar Estado: apenas "A receber"', actionType: "select" },
      { screen: "IMPORTANTE!\nVencimento: ate o ultimo dia util\nanterior a data de hoje", action: "Definir vencimento ate o ultimo dia util anterior a hoje", actionType: "select", highlight: true },
      { screen: "Resultado da pesquisa\nVerificando titulos vencidos...", action: "Verificar total de titulos vencidos no rodape", actionType: "verify" },
      { screen: `Total Inadimplencia\n${valorText}`, action: "Compare o total do Maxiprod com o valor do Dashboard", actionType: "result", highlight: true },
    ];
  }

  if (section === "a_faturar") {
    return [
      ...loginSteps,
      { screen: "Menu Principal\n→ Vendas → Pedidos de Venda", action: "Navegar para Vendas → Pedidos de Venda", actionType: "navigate" },
      { screen: "Filtros de Pedidos de Venda\nAplicando periodo...", action: `Definir data do pedido: ${dateRange}`, actionType: "type", fieldLabel: "Data do Pedido", typedValue: dateRange },
      { screen: 'Filtros\nEstado do Item: A Faturar', action: 'Filtrar por Estado do Item: "A faturar"', actionType: "select" },
      { screen: "Excluindo cancelados...", action: "Excluir pedidos com estado: Cancelado", actionType: "select", highlight: true },
      { screen: "Resultado da pesquisa\nSomando valor liquido dos pedidos A Faturar...", action: "Somar coluna 'Valor Liquido' dos pedidos filtrados", actionType: "verify" },
      { screen: `Total A Faturar no Periodo\n${valorText}`, action: "Compare com o valor do Dashboard", actionType: "result", highlight: true },
    ];
  }

  if (section === "vendas_faturado") {
    return [
      ...loginSteps,
      { screen: "Menu Principal\n\u2192 Vendas \u2192 Pedidos de Venda", action: "Navegar para Vendas \u2192 Pedidos de Venda", actionType: "navigate" },
      { screen: "Filtros de Pedidos de Venda\nAplicando periodo...", action: `Definir data do pedido: ${dateRange}`, actionType: "type", fieldLabel: "Data do Pedido", typedValue: dateRange },
      { screen: 'Filtros\nEstado do Item: Faturado', action: 'Filtrar por Estado do Item: "Faturado"', actionType: "select" },
      { screen: "Excluindo cancelados e Digitacao...", action: "Excluir pedidos com estado: Cancelado e Digitacao", actionType: "select", highlight: true },
      { screen: "Resultado da pesquisa\nSomando valor liquido dos pedidos Faturados...", action: "Somar coluna 'Valor Liquido' dos pedidos filtrados", actionType: "verify" },
      { screen: `Total Vendas Faturadas\n${valorText}`, action: "Compare com o valor do Dashboard", actionType: "result", highlight: true },
    ];
  }

  if (section === "amostra_bonif") {
    return [
      ...loginSteps,
      { screen: "Menu Principal\n→ Vendas → Pedidos de Venda", action: "Navegar para Vendas → Pedidos de Venda", actionType: "navigate" },
      { screen: "Filtros de Pedidos de Venda\nAplicando periodo...", action: `Definir data do pedido: ${dateRange}`, actionType: "type", fieldLabel: "Data do Pedido", typedValue: dateRange },
      { screen: 'Filtros\nEstado Configuravel: Amostra + Bonificacao', action: 'Filtrar por Estado Configuravel: "Amostra" e "Bonificacao"', actionType: "select" },
      { screen: "Excluindo cancelados...", action: "Excluir pedidos com estado: Cancelado", actionType: "select", highlight: true },
      { screen: "Resultado da pesquisa\nSomando valor liquido dos pedidos\nde Amostra e Bonificacao...", action: "Somar coluna 'Valor Liquido' dos pedidos filtrados", actionType: "verify" },
      { screen: `Total Amostra/Bonificacao\n${valorText}`, action: "Compare com o valor do Dashboard", actionType: "result", highlight: true },
    ];
  }

  return loginSteps;
}

/* ---- Animated CSS keyframes ---- */
const STYLE_ID = "maxiprod-verifier-animations";
function ensureAnimationStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes mp-gradient-shift {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
    @keyframes mp-shimmer {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }
    @keyframes mp-pulse-glow {
      0%, 100% { box-shadow: 0 0 15px rgba(52,211,153,0.3), 0 0 30px rgba(52,211,153,0.1); }
      50% { box-shadow: 0 0 25px rgba(52,211,153,0.5), 0 0 50px rgba(52,211,153,0.2); }
    }
    @keyframes mp-pulse-glow-red {
      0%, 100% { box-shadow: 0 0 15px rgba(239,68,68,0.3), 0 0 30px rgba(239,68,68,0.1); }
      50% { box-shadow: 0 0 25px rgba(239,68,68,0.5), 0 0 50px rgba(239,68,68,0.2); }
    }
    @keyframes mp-float {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-3px); }
    }
    @keyframes mp-scan-line {
      0% { top: 0%; opacity: 0; }
      10% { opacity: 1; }
      90% { opacity: 1; }
      100% { top: 100%; opacity: 0; }
    }
    @keyframes mp-value-count {
      0% { opacity: 0; transform: scale(0.8); }
      50% { transform: scale(1.05); }
      100% { opacity: 1; transform: scale(1); }
    }
    @keyframes mp-check-bounce {
      0% { transform: scale(0); }
      50% { transform: scale(1.2); }
      70% { transform: scale(0.9); }
      100% { transform: scale(1); }
    }
    @keyframes mp-cursor-blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
    }
    .mp-gradient-bg {
      background: linear-gradient(135deg, #1e1b4b, #0f172a, #3b0764, #1e1b4b, #0f172a);
      background-size: 400% 400%;
      animation: mp-gradient-shift 8s ease infinite;
    }
    .mp-shimmer-overlay { position: relative; overflow: hidden; }
    .mp-shimmer-overlay::after {
      content: '';
      position: absolute; top: 0; left: 0; right: 0; bottom: 0;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent);
      animation: mp-shimmer 3s ease-in-out infinite;
    }
    .mp-float { animation: mp-float 3s ease-in-out infinite; }
    .mp-glow-green { animation: mp-pulse-glow 2s ease-in-out infinite; }
    .mp-glow-red { animation: mp-pulse-glow-red 2s ease-in-out infinite; }
    .mp-value-appear { animation: mp-value-count 0.6s ease-out forwards; }
    .mp-check-bounce { animation: mp-check-bounce 0.5s ease-out forwards; }
    .mp-scan-line {
      position: absolute; left: 0; right: 0; height: 2px;
      background: linear-gradient(90deg, transparent, rgba(99,102,241,0.6), transparent);
      animation: mp-scan-line 2s ease-in-out infinite;
    }
  `;
  document.head.appendChild(style);
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
  empresaNome,
  bancoNome,
  contaNumero,
  statusFilter,
  formaFilter,
}: MaxiprodAutoVerifierProps) {
  const [showResult, setShowResult] = useState(false);

  // Simulator state
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [typingText, setTypingText] = useState("");
  const [typingComplete, setTypingComplete] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { ensureAnimationStyles(); }, []);

  // Auto-query Maxiprod via backend (inclui filtros de empresa/conta/status/forma para recebiveis)
  const queryInput = useMemo(() => {
    const base: { section: VerifySection; startDate: string; endDate: string; empresaNome?: string; bancoNome?: string; contaNumero?: string; statusFilter?: "TODOS" | "VENCIDO" | "A_VENCER"; formaFilter?: "TODOS" | "PIX" | "Boleto" | "Cheque" | "Depósito" | "Dinheiro" } = { section, startDate, endDate };
    if (empresaNome) base.empresaNome = empresaNome;
    if (bancoNome) base.bancoNome = bancoNome;
    if (contaNumero) base.contaNumero = contaNumero;
    if (statusFilter && statusFilter !== "TODOS") base.statusFilter = statusFilter;
    if (formaFilter && formaFilter !== "TODOS") base.formaFilter = formaFilter;
    return base;
  }, [section, startDate, endDate, empresaNome, bancoNome, contaNumero, statusFilter, formaFilter]);

  const { data: cpData, isLoading: cpLoading, error: cpError } = trpc.financial.getMaxiprodContraprova.useQuery(
    queryInput,
    { staleTime: 5 * 60 * 1000, retry: 1 }
  );

  const valorMaxiprod = cpData?.valorMaxiprod;
  const maxiprodLabel = cpData?.label;

  const divergencia = valorManus !== undefined && valorMaxiprod !== undefined
    ? Math.abs(valorManus - valorMaxiprod)
    : null;
  const hasDivergencia = divergencia !== null && divergencia > 1;
  const confere = !cpLoading && !cpError && valorMaxiprod !== undefined && !hasDivergencia;

  useEffect(() => {
    if (!cpLoading && (confere || hasDivergencia)) {
      const timer = setTimeout(() => setShowResult(true), 300);
      return () => clearTimeout(timer);
    }
  }, [cpLoading, confere, hasDivergencia]);

  // Animated steps
  const animSteps = useMemo(() => getAnimatedSteps(section, startDate, endDate, valorManus), [section, startDate, endDate, valorManus]);
  const step = animSteps[currentStep];
  const isLastStep = currentStep === animSteps.length - 1;
  const progress = ((currentStep + 1) / animSteps.length) * 100;

  // Typing animation
  useEffect(() => {
    if (step?.typedValue) {
      setTypingText("");
      setTypingComplete(false);
      let i = 0;
      const val = step.typedValue;
      const typeNext = () => {
        if (i < val.length) {
          setTypingText(val.slice(0, i + 1));
          i++;
          typingRef.current = setTimeout(typeNext, 60);
        } else {
          setTypingComplete(true);
        }
      };
      typingRef.current = setTimeout(typeNext, 400);
    } else {
      setTypingText("");
      setTypingComplete(true);
    }
    return () => { if (typingRef.current) clearTimeout(typingRef.current); };
  }, [currentStep, step?.typedValue]);

  // Auto-advance
  useEffect(() => {
    if (!isPlaying || isLastStep) return;
    const delay = step?.typedValue ? (step.typedValue.length * 60 + 2000) : 2500;
    timerRef.current = setTimeout(() => {
      setCurrentStep((s) => Math.min(s + 1, animSteps.length - 1));
    }, delay);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [currentStep, isPlaying, isLastStep, step, animSteps.length]);

  const handleRestart = () => { setCurrentStep(0); setIsPlaying(true); };
  const handleStepClick = (idx: number) => { setCurrentStep(idx); setIsPlaying(false); };

  const ActionIcon = actionIcons[step?.actionType || "navigate"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-700 max-h-[95vh] overflow-y-auto" onClick={e => e.stopPropagation()}
        style={{ animation: "mp-value-count 0.3s ease-out" }}>

        {/* Header - animated gradient */}
        <div className="mp-gradient-bg mp-shimmer-overlay px-6 py-5 relative">
          {cpLoading && <div className="mp-scan-line" />}

          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30 ${cpLoading ? "mp-float" : ""}`}>
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
          <div className="mt-4 grid grid-cols-2 gap-2 relative z-10">
            <div className="px-4 py-3 bg-white/10 rounded-lg border border-white/20 backdrop-blur-sm">
              <span className="text-indigo-300 text-[10px] uppercase tracking-wider">Valor no Dashboard</span>
              <p className="text-white font-bold text-lg mt-0.5 mp-value-appear" style={{ textShadow: "0 0 15px rgba(34,211,238,0.4)" }}>
                {formatCurrency(valorManus)}
              </p>
            </div>
            <div className={`px-4 py-3 rounded-lg border backdrop-blur-sm transition-all duration-700 ${
              cpLoading ? "bg-white/5 border-white/10" :
              hasDivergencia ? "bg-red-500/20 border-red-400/40 mp-glow-red" :
              confere ? "bg-emerald-500/20 border-emerald-400/40 mp-glow-green" :
              "bg-white/5 border-white/10"
            }`}>
              <span className="text-indigo-300 text-[10px] uppercase tracking-wider">Valor Maxiprod (API)</span>
              {cpLoading ? (
                <div className="flex items-center gap-2 mt-1.5">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-300" />
                  <span className="text-indigo-300 text-sm">Consultando...</span>
                </div>
              ) : cpError ? (
                <p className="text-red-300 text-sm mt-1">Erro na consulta</p>
              ) : valorMaxiprod !== undefined ? (
                <p className={`font-bold text-lg mt-0.5 mp-value-appear ${hasDivergencia ? "text-red-300" : "text-emerald-300"}`}
                  style={{ textShadow: hasDivergencia ? "0 0 15px rgba(239,68,68,0.4)" : "0 0 15px rgba(52,211,153,0.4)" }}>
                  {formatCurrency(valorMaxiprod)}
                </p>
              ) : (
                <p className="text-white/50 text-sm mt-1">Indisponivel</p>
              )}
            </div>
          </div>

          {/* Result banner */}
          <div className="relative z-10">
            {showResult && confere && (
              <div className="mt-3 px-4 py-3 bg-emerald-500/25 rounded-lg border border-emerald-400/40 flex items-center gap-3 mp-glow-green"
                style={{ animation: "mp-value-count 0.5s ease-out" }}>
                <div className="mp-check-bounce"><ShieldCheck className="w-6 h-6 text-emerald-300 flex-shrink-0" /></div>
                <div>
                  <p className="text-emerald-100 text-sm font-bold">Conferencia automatica com Maxiprod realizada. Os valores conferem!</p>
                  {maxiprodLabel && <p className="text-emerald-300/70 text-[10px] mt-0.5">{maxiprodLabel}</p>}
                </div>
              </div>
            )}
            {showResult && hasDivergencia && (
              <div className="mt-3 px-4 py-3 bg-red-500/25 rounded-lg border border-red-400/40 flex items-center gap-3 mp-glow-red"
                style={{ animation: "mp-value-count 0.5s ease-out" }}>
                <div className="mp-check-bounce"><ShieldAlert className="w-6 h-6 text-red-300 flex-shrink-0" /></div>
                <div>
                  <p className="text-red-100 text-sm font-bold">Divergencia de {formatCurrency(divergencia!)} detectada!</p>
                  {maxiprodLabel && <p className="text-red-300/70 text-[10px] mt-0.5">{maxiprodLabel}</p>}
                </div>
              </div>
            )}
            {cpLoading && (
              <div className="mt-3 px-4 py-3 bg-indigo-500/15 rounded-lg border border-indigo-400/30 flex items-center gap-3">
                <Shield className="w-5 h-5 text-indigo-300 flex-shrink-0 animate-pulse" />
                <div className="flex items-center gap-2">
                  <p className="text-indigo-200 text-sm">Verificando valores com o Maxiprod em tempo real</p>
                  <span className="flex gap-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ============ ANIMATED SIMULATOR VIDEO ============ */}
        <div className="px-5 pt-4 pb-2">
          <div className="bg-white rounded-xl border-2 border-slate-300 overflow-hidden shadow-inner">
            {/* Browser-like top bar */}
            <div className="bg-slate-100 px-4 py-2 flex items-center gap-2 border-b border-slate-200">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              </div>
              <div className="flex-1 bg-white rounded-md px-3 py-1 text-xs text-slate-500 border border-slate-200 ml-2 truncate">
                app.maxiprod.com.br
              </div>
            </div>

            {/* Screen content */}
            <div className="p-4 min-h-[120px] flex flex-col justify-center relative">
              <div className="text-center">
                <p className="text-sm text-slate-700 font-medium leading-relaxed whitespace-pre-line">
                  {step?.screen}
                </p>

                {/* Typing animation field */}
                {step?.typedValue && (
                  <div className="mt-3 mx-auto max-w-xs">
                    {step.fieldLabel && (
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 text-left">{step.fieldLabel}</p>
                    )}
                    <div className="bg-slate-50 border-2 border-indigo-400 rounded-lg px-3 py-2 text-left flex items-center">
                      <span className="text-sm text-slate-800 font-mono">{typingText}</span>
                      {!typingComplete && (
                        <span className="inline-block w-0.5 h-4 bg-indigo-500 ml-0.5" style={{ animation: "mp-cursor-blink 0.8s infinite" }} />
                      )}
                    </div>
                  </div>
                )}

                {/* Result highlight */}
                {step?.actionType === "result" && (
                  <div className="mt-3 mx-auto max-w-sm bg-emerald-50 border-2 border-emerald-300 rounded-lg px-4 py-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
                    <p className="text-sm font-bold text-emerald-700 text-center leading-snug">Valor do Dashboard da Manus<br/>confere com o Maxiprod</p>
                  </div>
                )}
              </div>

              {/* Animated cursor */}
              {step?.actionType === "click" && (
                <div className="absolute bottom-3 right-6 animate-bounce">
                  <Mouse className="w-4 h-4 text-indigo-500 drop-shadow-lg" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action description + progress */}
        <div className="px-5 pb-2">
          <div className={`flex items-center gap-3 p-2.5 rounded-lg ${
            step?.highlight ? "bg-amber-500/20 border border-amber-500/40" : "bg-slate-800 border border-slate-700"
          }`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
              step?.highlight ? "bg-amber-500 shadow-md shadow-amber-500/30" : "bg-indigo-600"
            }`}>
              <ActionIcon className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                Passo {currentStep + 1} de {animSteps.length}
              </p>
              <p className={`text-xs font-medium ${step?.highlight ? "text-amber-200" : "text-white"}`}>
                {step?.action}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-2 h-1 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Step timeline (clickable) */}
        <div className="px-5 py-2 max-h-[120px] overflow-y-auto">
          <div className="space-y-0.5">
            {animSteps.map((s, idx) => (
              <button
                key={idx}
                onClick={() => handleStepClick(idx)}
                className={`w-full flex items-center gap-2 px-2.5 py-1 rounded-md text-left transition-all text-[11px] ${
                  idx === currentStep
                    ? "bg-indigo-600/30 border border-indigo-500/50 text-indigo-200"
                    : idx < currentStep
                    ? "text-slate-500 hover:bg-slate-800"
                    : "text-slate-600 hover:bg-slate-800"
                }`}
              >
                <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-[9px] font-bold ${
                  idx === currentStep ? "bg-indigo-500 text-white" :
                  idx < currentStep ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-400"
                }`}>
                  {idx < currentStep ? "✓" : idx + 1}
                </div>
                <span className="truncate">{s.action}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium transition-colors"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {isPlaying ? "Pausar" : "Continuar"}
            </button>
            <button
              onClick={handleRestart}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reiniciar
            </button>
            {!isPlaying && !isLastStep && (
              <button
                onClick={() => setCurrentStep(s => Math.min(s + 1, animSteps.length - 1))}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
              >
                Proximo <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <a
            href={MAXIPROD_LOGIN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all hover:scale-[1.02]"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Abrir Maxiprod
          </a>
        </div>
      </div>
    </div>
  );
}
