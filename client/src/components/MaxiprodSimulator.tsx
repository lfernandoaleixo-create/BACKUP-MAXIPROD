import { useState, useEffect, useRef } from "react";
import { X, Play, Pause, RotateCcw, ExternalLink, CheckCircle2, ChevronRight, Monitor, Mouse, Keyboard } from "lucide-react";

/* ---- Types ---- */
export interface SimulatorStep {
  /** What the user sees on the "screen" */
  screen: string;
  /** Action description shown below */
  action: string;
  /** Type of action for icon */
  actionType: "navigate" | "click" | "type" | "select" | "verify" | "result";
  /** Optional highlight color */
  highlight?: boolean;
  /** Optional typed value (shown with typing animation) */
  typedValue?: string;
  /** Optional field label being interacted with */
  fieldLabel?: string;
}

interface MaxiprodSimulatorProps {
  title: string;
  subtitle: string;
  steps: SimulatorStep[];
  maxiprodUrl: string;
  valorManus?: number;
  onClose: () => void;
}

/* ---- Helpers ---- */
const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const actionIcons: Record<string, typeof Monitor> = {
  navigate: Monitor,
  click: Mouse,
  type: Keyboard,
  select: Mouse,
  verify: CheckCircle2,
  result: CheckCircle2,
};

/* ---- Component ---- */
export default function MaxiprodSimulator({
  title,
  subtitle,
  steps,
  maxiprodUrl,
  valorManus,
  onClose,
}: MaxiprodSimulatorProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [typingText, setTypingText] = useState("");
  const [typingComplete, setTypingComplete] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const progress = ((currentStep + 1) / steps.length) * 100;

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
    return () => {
      if (typingRef.current) clearTimeout(typingRef.current);
    };
  }, [currentStep, step?.typedValue]);

  // Auto-advance
  useEffect(() => {
    if (!isPlaying || isLastStep) return;
    const delay = step?.typedValue ? (step.typedValue.length * 60 + 2000) : 2500;
    timerRef.current = setTimeout(() => {
      setCurrentStep((s) => Math.min(s + 1, steps.length - 1));
    }, delay);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentStep, isPlaying, isLastStep, step]);

  const handleRestart = () => {
    setCurrentStep(0);
    setIsPlaying(true);
  };

  const handleStepClick = (idx: number) => {
    setCurrentStep(idx);
    setIsPlaying(false);
  };

  const ActionIcon = actionIcons[step?.actionType || "navigate"];

  // No divergencia check needed - simulator is instantaneous, no API comparison
  // valorMaxiprod is not used anymore

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-700" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 px-6 py-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                <Monitor className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm">{title}</h3>
                <p className="text-indigo-300 text-xs">{subtitle}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-white/60 hover:text-white transition-colors p-1">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Dashboard value */}
          {valorManus != null && (
            <div className="mt-3">
              <div className="px-4 py-2.5 bg-white/10 rounded-lg border border-white/20 flex items-center justify-between">
                <span className="text-indigo-300 text-xs uppercase tracking-wider">Valor no Dashboard</span>
                <p className="text-white font-bold text-lg" style={{ textShadow: "0 0 15px rgba(34,211,238,0.4)" }}>
                  {formatCurrency(valorManus)}
                </p>
              </div>
              <p className="text-indigo-400/60 text-[10px] mt-1.5 text-center">Siga o passo a passo abaixo para conferir este valor no Maxiprod</p>
            </div>
          )}
        </div>

        {/* Simulated Screen */}
        <div className="px-6 py-4">
          <div className="bg-white rounded-xl border-2 border-slate-300 overflow-hidden shadow-inner">
            {/* Browser-like top bar */}
            <div className="bg-slate-100 px-4 py-2 flex items-center gap-2 border-b border-slate-200">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-emerald-400" />
              </div>
              <div className="flex-1 bg-white rounded-md px-3 py-1 text-xs text-slate-500 border border-slate-200 ml-2 truncate">
                app.maxiprod.com.br
              </div>
            </div>

            {/* Screen content */}
            <div className="p-5 min-h-[160px] flex flex-col justify-center relative">
              {/* Step screen content */}
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
                        <span className="inline-block w-0.5 h-4 bg-indigo-500 ml-0.5 animate-pulse" />
                      )}
                    </div>
                  </div>
                )}

                {/* Result highlight */}
                {step?.actionType === "result" && (
                  <div className="mt-3 mx-auto max-w-xs bg-emerald-50 border-2 border-emerald-300 rounded-lg px-4 py-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
                    <p className="text-sm font-bold text-emerald-700">Valor encontrado!</p>
                  </div>
                )}
              </div>

              {/* Animated cursor */}
              {step?.actionType === "click" && (
                <div className="absolute bottom-4 right-8 animate-bounce">
                  <Mouse className="w-5 h-5 text-indigo-500 drop-shadow-lg" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action description + progress */}
        <div className="px-6 pb-2">
          <div className={`flex items-center gap-3 p-3 rounded-lg ${
            step?.highlight ? "bg-amber-500/20 border border-amber-500/40" : "bg-slate-800 border border-slate-700"
          }`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              step?.highlight ? "bg-amber-500 shadow-md shadow-amber-500/30" : "bg-indigo-600"
            }`}>
              <ActionIcon className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-400 uppercase tracking-wider">
                Passo {currentStep + 1} de {steps.length}
              </p>
              <p className={`text-sm font-medium ${step?.highlight ? "text-amber-200" : "text-white"}`}>
                {step?.action}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Step timeline (clickable) */}
        <div className="px-6 py-3 max-h-[140px] overflow-y-auto">
          <div className="space-y-1">
            {steps.map((s, idx) => (
              <button
                key={idx}
                onClick={() => handleStepClick(idx)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-left transition-all text-xs ${
                  idx === currentStep
                    ? "bg-indigo-600/30 border border-indigo-500/50 text-indigo-200"
                    : idx < currentStep
                    ? "text-slate-500 hover:bg-slate-800"
                    : "text-slate-600 hover:bg-slate-800"
                }`}
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${
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
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-700 flex items-center justify-between">
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
                onClick={() => { setCurrentStep(s => Math.min(s + 1, steps.length - 1)); }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
              >
                Próximo <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <a
            href={maxiprodUrl}
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

/* ---- Step generators for each card type ---- */

export function getSalesSteps(section: string, periodStart: string, periodEnd: string, valorManus?: number): SimulatorStep[] {
  const [sy, sm, sd] = periodStart.split("-");
  const [ey, em, ed] = periodEnd.split("-");
  const dateRange = `${sd}/${sm}/${sy} a ${ed}/${em}/${ey}`;

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
      { screen: "Filtros de Pedidos de Venda\nAplicando período...", action: `Definir data do pedido: ${dateRange}`, actionType: "type", fieldLabel: "Data do Pedido", typedValue: dateRange },
      { screen: "Filtros aplicados\nExcluindo pedidos cancelados...", action: "Excluir pedidos com estado: Cancelado", actionType: "select", highlight: true },
      { screen: "Resultado da pesquisa\nSomando valor líquido de todos os pedidos...", action: "Somar coluna 'Valor Líquido' de todos os pedidos", actionType: "verify" },
      { screen: `Total de Vendas no Período\n${valorManus != null ? formatCurrency(valorManus) : "R$ ---"}`, action: "Compare o total com o valor do Dashboard", actionType: "result", highlight: true },
    ];
  }

  if (section === "faturamento") {
    return [
      ...loginSteps,
      { screen: "Menu Principal\n→ Notas Fiscais → Notas Fiscais de Saída", action: "Navegar para Notas Fiscais → NFs de Saída", actionType: "navigate" },
      { screen: "Filtros de Notas Fiscais\nAplicando período de emissão...", action: `Definir emissão: ${dateRange}`, actionType: "type", fieldLabel: "Emissão", typedValue: dateRange },
      { screen: "Filtros\nEstado: Emitida | Tipo: Saída", action: 'Selecionar Estado: "Emitida" e Tipo: "Saída"', actionType: "select" },
      { screen: "IMPORTANTE!\nExcluir NFs com estado configurável:\nAmostra, Bonificação, Devolução,\nRemessa, Recusa, Transferência, Cancelado", action: "Excluir NFs de Amostra, Bonificação, Devolução, Remessa, Recusa, Transferência, Cancelado", actionType: "select", highlight: true },
      { screen: "Filtro de produtos\nAceitar apenas: Bambu, Madeira, Rojão,\nSerragem, Madeira/Fibra e variações", action: "Aceitar apenas NFs de produtos do grupo (Bambu, Madeira, Rojão, etc.)", actionType: "select", highlight: true },
      { screen: "Resultado da pesquisa\nSomando valores das NFs filtradas...", action: "Somar coluna 'Valor Total' das NFs", actionType: "verify" },
      { screen: `Total Faturado no Período\n${valorManus != null ? formatCurrency(valorManus) : "R$ ---"}`, action: "Compare o total com o valor do Dashboard", actionType: "result", highlight: true },
    ];
  }

  if (section === "a_faturar") {
    return [
      ...loginSteps,
      { screen: "Menu Principal\n→ Vendas → Pedidos de Venda", action: "Navegar para Vendas → Pedidos de Venda", actionType: "navigate" },
      { screen: "Filtros de Pedidos de Venda\nAplicando período...", action: `Definir data do pedido: ${dateRange}`, actionType: "type", fieldLabel: "Data do Pedido", typedValue: dateRange },
      { screen: "Filtros\nEstado do Item: A Faturar", action: 'Filtrar por Estado do Item: "A faturar"', actionType: "select" },
      { screen: "Excluindo cancelados...", action: "Excluir pedidos com estado: Cancelado", actionType: "select", highlight: true },
      { screen: "Resultado da pesquisa\nSomando valor líquido dos pedidos A Faturar...", action: "Somar coluna 'Valor Líquido' dos pedidos filtrados", actionType: "verify" },
      { screen: `Total A Faturar no Período\n${valorManus != null ? formatCurrency(valorManus) : "R$ ---"}\n\nNota: Este é um subconjunto do total de vendas`, action: "Compare com o valor do Dashboard (subconjunto de vendas)", actionType: "result", highlight: true },
    ];
  }

  if (section === "amostra_bonif") {
    return [
      ...loginSteps,
      { screen: "Menu Principal\n→ Vendas → Pedidos de Venda", action: "Navegar para Vendas → Pedidos de Venda", actionType: "navigate" },
      { screen: "Filtros de Pedidos de Venda\nAplicando período...", action: `Definir data do pedido: ${dateRange}`, actionType: "type", fieldLabel: "Data do Pedido", typedValue: dateRange },
      { screen: "Filtros\nEstado Configurável: Amostra + Bonificação", action: 'Filtrar por Estado Configurável: "Amostra" e "Bonificação"', actionType: "select" },
      { screen: "Excluindo cancelados...", action: "Excluir pedidos com estado: Cancelado", actionType: "select", highlight: true },
      { screen: "Resultado da pesquisa\nSomando valor líquido dos pedidos\nde Amostra e Bonificação...", action: "Somar coluna 'Valor Líquido' dos pedidos filtrados", actionType: "verify" },
      { screen: `Total Amostra/Bonificação\n${valorManus != null ? formatCurrency(valorManus) : "R$ ---"}\n\nNota: Este é um subconjunto do total de vendas`, action: "Compare com o valor do Dashboard (subconjunto de vendas)", actionType: "result", highlight: true },
    ];
  }

  // fallback
  return loginSteps;
}

export function getFinancialSteps(section: string, periodStart: string, periodEnd: string, valorManus?: number): SimulatorStep[] {
  const [sy, sm, sd] = periodStart.split("-");
  const [ey, em, ed] = periodEnd.split("-");
  const dateRange = `${sd}/${sm}/${sy} a ${ed}/${em}/${ey}`;

  const loginSteps: SimulatorStep[] = [
    { screen: "Acessando Maxiprod...\napp.maxiprod.com.br", action: "Abrir o Maxiprod no navegador", actionType: "navigate" },
    { screen: "Tela de Login do Maxiprod", action: "Preencher e-mail de acesso", actionType: "type", fieldLabel: "E-mail", typedValue: "lfernandoaleixo@gmail.com" },
    { screen: "Tela de Login do Maxiprod", action: "Preencher senha", actionType: "type", fieldLabel: "Senha", typedValue: "Luizfernando7008*" },
    { screen: "Entrando no sistema...\nLogin realizado com sucesso!", action: "Clicar em Entrar", actionType: "click" },
  ];

  if (section === "entradas") {
    return [
      ...loginSteps,
      { screen: "Menu Principal\n→ Financeiro → Contas a Receber", action: "Navegar para Financeiro → Contas a Receber", actionType: "navigate" },
      { screen: "Filtros de Contas a Receber\nEstado: Recebidos", action: 'Selecionar Estado: apenas "Recebidos"', actionType: "select" },
      { screen: "Filtros\nAplicando período de liquidação...", action: `Definir liquidação: ${dateRange}`, actionType: "type", fieldLabel: "Liquidação", typedValue: dateRange },
      { screen: "IMPORTANTE!\nO Dashboard exclui transferências entre\nempresas do grupo:\nPalitos Fox, Mesa Indust, Bambusa,\nEspetos Ind, Varetas", action: "Dashboard exclui transferências entre empresas do grupo", actionType: "select", highlight: true },
      { screen: "Resultado da pesquisa\nSomando valor recebido líquido...", action: "Somar coluna 'Valor Recebido Líquido'", actionType: "verify" },
      { screen: `Total Entradas no Período\n${valorManus != null ? formatCurrency(valorManus) : "R$ ---"}`, action: "Compare o total com o valor do Dashboard", actionType: "result", highlight: true },
    ];
  }

  if (section === "faturamento") {
    return [
      ...loginSteps,
      { screen: "Menu Principal\n→ Notas Fiscais → Notas Fiscais de Saída", action: "Navegar para Notas Fiscais → NFs de Saída", actionType: "navigate" },
      { screen: "Filtros de Notas Fiscais\nAplicando período de emissão...", action: `Definir emissão: ${dateRange}`, actionType: "type", fieldLabel: "Emissão", typedValue: dateRange },
      { screen: "Filtros\nEstado: Emitida | Tipo: Saída", action: 'Selecionar Estado: "Emitida" e Tipo: "Saída"', actionType: "select" },
      { screen: "IMPORTANTE!\nExcluir NFs com estado configurável:\nAmostra, Bonificação, Devolução,\nRemessa, Recusa, Transferência, Cancelado", action: "Excluir NFs de Amostra, Bonificação, Devolução, Remessa, Recusa, Transferência, Cancelado", actionType: "select", highlight: true },
      { screen: "Resultado da pesquisa\nSomando valores das NFs filtradas...", action: "Somar coluna 'Valor Total' das NFs", actionType: "verify" },
      { screen: `Total Faturado no Período\n${valorManus != null ? formatCurrency(valorManus) : "R$ ---"}`, action: "Compare o total com o valor do Dashboard", actionType: "result", highlight: true },
    ];
  }

  if (section === "vendas") {
    return [
      ...loginSteps,
      { screen: "Menu Principal\n→ Vendas → Pedidos de Venda", action: "Navegar para Vendas → Pedidos de Venda", actionType: "navigate" },
      { screen: "Filtros de Pedidos de Venda\nAplicando período...", action: `Definir data do pedido: ${dateRange}`, actionType: "type", fieldLabel: "Data do Pedido", typedValue: dateRange },
      { screen: "Excluindo cancelados...", action: "Excluir pedidos com estado: Cancelado", actionType: "select", highlight: true },
      { screen: "Resultado da pesquisa\nSomando valor líquido de todos os pedidos...", action: "Somar coluna 'Valor Líquido' de todos os pedidos", actionType: "verify" },
      { screen: `Total Vendas no Período\n${valorManus != null ? formatCurrency(valorManus) : "R$ ---"}`, action: "Compare o total com o valor do Dashboard", actionType: "result", highlight: true },
    ];
  }

  if (section === "contas_pagas") {
    return [
      ...loginSteps,
      { screen: "Menu Principal\n→ Financeiro → Contas a Pagar", action: "Navegar para Financeiro → Contas a Pagar", actionType: "navigate" },
      { screen: "Filtros de Contas a Pagar\nEstado: Pagos", action: 'Selecionar Estado: apenas "Pagos"', actionType: "select" },
      { screen: "Filtros\nAplicando período de liquidação...", action: `Definir liquidação: ${dateRange}`, actionType: "type", fieldLabel: "Liquidação", typedValue: dateRange },
      { screen: "Excluindo cancelados...", action: "Excluir contas com estado: Cancelado", actionType: "select", highlight: true },
      { screen: "Resultado da pesquisa\nSomando valor pago líquido...", action: "Somar coluna 'Valor Pago Líquido'", actionType: "verify" },
      { screen: `Total Contas Pagas no Período\n${valorManus != null ? formatCurrency(valorManus) : "R$ ---"}`, action: "Compare o total com o valor do Dashboard", actionType: "result", highlight: true },
    ];
  }

  return loginSteps;
}

export function getReceivablesSteps(context: {
  empresa?: string;
  mes?: string;
  contaLabel?: string;
  formaCobranca?: string;
  statusFilter?: string;
  valorManus?: number;
}): SimulatorStep[] {
  const loginSteps: SimulatorStep[] = [
    { screen: "Acessando Maxiprod...\napp.maxiprod.com.br", action: "Abrir o Maxiprod no navegador", actionType: "navigate" },
    { screen: "Tela de Login do Maxiprod", action: "Preencher e-mail de acesso", actionType: "type", fieldLabel: "E-mail", typedValue: "lfernandoaleixo@gmail.com" },
    { screen: "Tela de Login do Maxiprod", action: "Preencher senha", actionType: "type", fieldLabel: "Senha", typedValue: "Luizfernando7008*" },
    { screen: "Entrando no sistema...\nLogin realizado com sucesso!", action: "Clicar em Entrar", actionType: "click" },
  ];

  const steps: SimulatorStep[] = [...loginSteps];

  steps.push({ screen: "Menu Principal\n\u2192 Financeiro \u2192 Contas a Receber", action: "Navegar para Financeiro \u2192 Contas a Receber", actionType: "navigate" });
  steps.push({ screen: "Filtros de Contas a Receber\nEstado: A receber", action: 'Selecionar Estado: apenas "A receber"', actionType: "select" });

  if (context.mes) {
    const [y, m] = context.mes.split("-");
    const lastDay = new Date(Number(y), Number(m), 0).getDate();
    const dateRange = `01/${m}/${y} a ${lastDay}/${m}/${y}`;
    steps.push({ screen: `Filtros\nAplicando per\u00edodo de vencimento...\n${dateRange}`, action: `Definir vencimento: ${dateRange}`, actionType: "type", fieldLabel: "Vencimento", typedValue: dateRange });
  }

  if (context.empresa) {
    steps.push({ screen: `Filtros\nSelecionando empresa: ${context.empresa}`, action: `Selecionar empresa: "${context.empresa}"`, actionType: "select" });
  }

  if (context.formaCobranca && context.formaCobranca !== "TODOS") {
    steps.push({ screen: `Filtros\nForma de cobran\u00e7a: ${context.formaCobranca}`, action: `Filtrar por forma de cobran\u00e7a: "${context.formaCobranca}"`, actionType: "select" });
  }

  if (context.contaLabel) {
    const bankMatch = context.contaLabel.match(/^(\w+)/);
    if (bankMatch) {
      steps.push({ screen: `Filtros\nBanco: ${bankMatch[1]}\nConta: ${context.contaLabel}`, action: `Filtrar por banco "${bankMatch[1]}" e conta correspondente`, actionType: "select" });
    }
  }

  steps.push({ screen: 'Clique em "Ocultar filtros"\npara ver o total no rodap\u00e9 da tabela', action: 'Clicar em "Ocultar filtros" para ver o total', actionType: "click" });
  steps.push({ screen: "Resultado da pesquisa\nSomando valor total a receber...", action: "Verificar total no rodap\u00e9 da tabela", actionType: "verify" });

  const valorText = context.valorManus != null ? formatCurrency(context.valorManus) : "R$ ---";
  steps.push({ screen: `Total Contas a Receber\n${valorText}`, action: "Compare o total do Maxiprod com o valor do Dashboard", actionType: "result", highlight: true });

  return steps;
}
