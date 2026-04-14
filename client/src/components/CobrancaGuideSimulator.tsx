import { useState, useRef, useEffect } from "react";
import {
  X, Play, Pause, RotateCcw, ChevronRight,
  Phone, MessageCircle, FileText, AlertTriangle,
  CheckCircle2, Clock, Shield, ShieldAlert,
  Bell, Calendar, History, Users, Gavel
} from "lucide-react";

/* ---- Types ---- */
interface GuideStep {
  title: string;
  description: string;
  icon: typeof Phone;
  iconColor: string;
  bgColor: string;
  borderColor: string;
  details?: string[];
  highlight?: boolean;
  dayLabel?: string;
}

interface CobrancaGuideSimulatorProps {
  clienteName?: string;
  valorTotal?: number;
  diasAtraso?: number;
  onClose: () => void;
}

/* ---- Helpers ---- */
const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/* ---- Steps ---- */
function getCobrancaSteps(): GuideStep[] {
  return [
    {
      title: "Dia 1 — Primeiro Contato",
      description: "No 1º dia após o vencimento, o telefone começa a vibrar (piscar) na tela do responsável pela cobrança. A cobrança é obrigatória.",
      icon: Phone,
      iconColor: "text-blue-600",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-300",
      dayLabel: "DIA 1",
      details: [
        "O ícone do telefone pisca em azul na linha do título",
        "Clique no telefone para abrir o painel de contato",
        "Ligue para o cliente ou envie WhatsApp",
        "Registre o contato: tipo (Ligação/WhatsApp/E-mail), resumo do que foi conversado",
        "O telefone só para de vibrar quando a ação for registrada",
      ],
    },
    {
      title: "Registrar Contato",
      description: "Ao clicar no telefone, preencha os dados do contato realizado. Isso fica salvo no histórico do título.",
      icon: MessageCircle,
      iconColor: "text-emerald-600",
      bgColor: "bg-emerald-50",
      borderColor: "border-emerald-300",
      details: [
        "Selecione o tipo: Ligação, WhatsApp, E-mail ou Presencial",
        "Escreva um resumo breve: ex. 'Cliente prometeu pagar dia 20'",
        "Clique em Salvar — o contato é registrado com data, hora e operador",
        "O histórico completo fica visível no ícone de relógio (🕐)",
      ],
    },
    {
      title: "Dia 2 — Intervalo",
      description: "No dia 2 o telefone não vibra. É um dia de espera. Mas se o dia 1 não foi registrado, o telefone continua vibrando!",
      icon: Clock,
      iconColor: "text-slate-500",
      bgColor: "bg-slate-50",
      borderColor: "border-slate-300",
      dayLabel: "DIA 2",
      details: [
        "Se a ação do dia 1 foi registrada: telefone fica cinza (idle)",
        "Se a ação do dia 1 NÃO foi registrada: telefone continua piscando!",
        "Ações pendentes de dias anteriores não desaparecem",
      ],
    },
    {
      title: "Dia 3 — Segundo Contato",
      description: "No 3º dia, o telefone volta a vibrar. Nova cobrança obrigatória — o cliente precisa ser contatado novamente.",
      icon: Phone,
      iconColor: "text-amber-600",
      bgColor: "bg-amber-50",
      borderColor: "border-amber-300",
      dayLabel: "DIA 3",
      details: [
        "Telefone pisca novamente em azul",
        "Faça novo contato com o cliente",
        "Registre o que foi conversado",
        "Se o cliente fez promessa de pagamento, registre a data e valor prometido",
      ],
    },
    {
      title: "Alterar Status do Título",
      description: "Após cada contato, atualize o status do título para refletir a situação atual da cobrança.",
      icon: CheckCircle2,
      iconColor: "text-indigo-600",
      bgColor: "bg-indigo-50",
      borderColor: "border-indigo-300",
      details: [
        "Pendente → status inicial, sem ação",
        "Contatado → cliente foi contatado mas sem definição",
        "Em Negociação → cliente está negociando forma de pagamento",
        "Promessa de Pgto → cliente prometeu pagar (registre data e valor)",
        "Protestado → título enviado para protesto",
        "Jurídico → encaminhado para departamento jurídico",
      ],
    },
    {
      title: "Dia 4 — Intervalo",
      description: "Dia de espera entre cobranças. Verifique se há pendências dos dias anteriores.",
      icon: Clock,
      iconColor: "text-slate-500",
      bgColor: "bg-slate-50",
      borderColor: "border-slate-300",
      dayLabel: "DIA 4",
      details: [
        "Mesma regra do dia 2: se ações anteriores estão pendentes, telefone vibra",
        "Aproveite para verificar se promessas de pagamento foram cumpridas",
      ],
    },
    {
      title: "Dia 5 — Terceiro e Último Contato",
      description: "Último dia de cobrança por telefone. Após isso, o processo muda para decisão de protesto.",
      icon: Phone,
      iconColor: "text-red-600",
      bgColor: "bg-red-50",
      borderColor: "border-red-300",
      dayLabel: "DIA 5",
      highlight: true,
      details: [
        "Telefone pisca pela última vez na régua de cobrança",
        "Faça o contato final com o cliente",
        "Informe que o título será encaminhado para protesto se não houver pagamento",
        "Registre o contato e atualize o status",
      ],
    },
    {
      title: "Dia 6 — Preparação",
      description: "Dia de preparação antes da decisão de protesto. Revise o histórico de contatos.",
      icon: FileText,
      iconColor: "text-orange-600",
      bgColor: "bg-orange-50",
      borderColor: "border-orange-300",
      dayLabel: "DIA 6",
      details: [
        "Revise o histórico de contatos dos dias 1, 3 e 5",
        "Verifique se há promessas de pagamento pendentes",
        "Prepare a documentação para a decisão do dia 7",
      ],
    },
    {
      title: "Dia 7+ — Decisão de Protesto",
      description: "A partir do dia 7, o sistema exige uma decisão: Protesto Automático ou Não Protestar (com plano de ação).",
      icon: Gavel,
      iconColor: "text-red-700",
      bgColor: "bg-red-100",
      borderColor: "border-red-400",
      dayLabel: "DIA 7+",
      highlight: true,
      details: [
        "Opção 1: PROTESTO AUTOMÁTICO — título é encaminhado para protesto em cartório",
        "Opção 2: NÃO PROTESTAR — obrigatório criar um Plano de Ação justificando",
        "O Plano de Ação deve explicar por que não protestar e qual a estratégia",
        "Se escolher 'Não Protestar', um documento de cobrança é gerado automaticamente",
        "O ícone muda para documento (📄) indicando que há documento pendente",
      ],
    },
    {
      title: "Consultar Histórico",
      description: "Todo o histórico de contatos, mudanças de status e decisões fica salvo e pode ser consultado a qualquer momento.",
      icon: History,
      iconColor: "text-purple-600",
      bgColor: "bg-purple-50",
      borderColor: "border-purple-300",
      details: [
        "Clique no ícone de relógio (🕐) para ver todo o histórico",
        "Cada entrada mostra: data, tipo de contato, resumo e operador",
        "O histórico é permanente e não pode ser apagado",
        "Útil para auditoria e acompanhamento da cobrança",
      ],
    },
    {
      title: "Resumo da Régua de Cobrança",
      description: "Visão geral completa do processo de cobrança do Grupo Fox.",
      icon: Shield,
      iconColor: "text-emerald-700",
      bgColor: "bg-emerald-50",
      borderColor: "border-emerald-400",
      highlight: true,
      details: [
        "📱 Dia 1 → Primeiro contato obrigatório (telefone vibra)",
        "⏸️ Dia 2 → Intervalo (pendências anteriores continuam vibrando)",
        "📱 Dia 3 → Segundo contato obrigatório (telefone vibra)",
        "⏸️ Dia 4 → Intervalo",
        "📱 Dia 5 → Terceiro e último contato (telefone vibra)",
        "📋 Dia 6 → Preparação para decisão",
        "⚖️ Dia 7+ → Decisão: Protesto Automático ou Plano de Ação",
        "📊 Tudo fica salvo no histórico do título",
      ],
    },
  ];
}

/* ---- Component ---- */
export default function CobrancaGuideSimulator({
  clienteName,
  valorTotal,
  diasAtraso,
  onClose,
}: CobrancaGuideSimulatorProps) {
  const steps = getCobrancaSteps();
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const progress = ((currentStep + 1) / steps.length) * 100;

  // Auto-advance
  useEffect(() => {
    if (!isPlaying || isLastStep) return;
    const delay = step?.details ? 4000 : 3000;
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

  const StepIcon = step?.icon || Phone;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden border border-slate-700 flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-red-950 via-slate-900 to-amber-950 px-6 py-4 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-400 to-amber-500 flex items-center justify-center shadow-lg shadow-red-500/30">
                <Bell className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm">Guia de Cobrança — Processo Completo</h3>
                <p className="text-amber-300 text-xs">
                  Régua de cobrança do Grupo Fox
                  {clienteName && <span> · {clienteName}</span>}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-white/60 hover:text-white transition-colors p-1">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Context info */}
          {(valorTotal != null || diasAtraso != null) && (
            <div className="mt-3 flex gap-2">
              {valorTotal != null && (
                <div className="px-4 py-2 bg-white/10 rounded-lg border border-white/20 flex-1">
                  <span className="text-red-300 text-[10px] uppercase tracking-wider">Valor em Aberto</span>
                  <p className="text-white font-bold text-lg">{formatCurrency(valorTotal)}</p>
                </div>
              )}
              {diasAtraso != null && (
                <div className={`px-4 py-2 rounded-lg border flex-1 ${
                  diasAtraso <= 5 ? "bg-amber-500/20 border-amber-400/40" :
                  diasAtraso <= 15 ? "bg-orange-500/20 border-orange-400/40" :
                  "bg-red-500/20 border-red-400/40"
                }`}>
                  <span className="text-amber-300 text-[10px] uppercase tracking-wider">Dias em Atraso</span>
                  <p className={`font-bold text-lg ${
                    diasAtraso <= 5 ? "text-amber-300" : diasAtraso <= 15 ? "text-orange-300" : "text-red-300"
                  }`}>{diasAtraso} dias</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Main content area */}
        <div className="px-6 py-4 flex-shrink-0">
          <div className={`${step.bgColor} rounded-xl border-2 ${step.borderColor} overflow-hidden`}>
            {/* Day label */}
            {step.dayLabel && (
              <div className={`px-4 py-1.5 ${step.highlight ? "bg-red-200/60" : "bg-white/60"} border-b ${step.borderColor}`}>
                <span className={`text-xs font-bold uppercase tracking-wider ${step.highlight ? "text-red-700" : "text-slate-600"}`}>
                  {step.dayLabel}
                </span>
              </div>
            )}

            <div className="p-5">
              {/* Step title with icon */}
              <div className="flex items-start gap-3 mb-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  step.highlight ? "bg-red-600 shadow-md shadow-red-500/30" : "bg-white shadow-sm"
                }`}>
                  <StepIcon className={`w-5 h-5 ${step.highlight ? "text-white" : step.iconColor}`} />
                </div>
                <div>
                  <h4 className={`font-bold text-base ${step.highlight ? "text-red-800" : "text-slate-800"}`}>
                    {step.title}
                  </h4>
                  <p className="text-sm text-slate-600 mt-1 leading-relaxed">{step.description}</p>
                </div>
              </div>

              {/* Details list */}
              {step.details && (
                <div className="mt-3 space-y-1.5 pl-13">
                  {step.details.map((detail, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-slate-700 leading-relaxed">{detail}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-6 pb-2 flex-shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs text-slate-400">
              Passo {currentStep + 1} de {steps.length}
            </p>
            <p className="text-xs text-slate-500 font-medium">{step.title}</p>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-red-500 to-amber-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Step timeline (scrollable) */}
        <div className="px-6 py-3 max-h-[140px] overflow-y-auto flex-shrink-0">
          <div className="space-y-1">
            {steps.map((s, idx) => (
              <button
                key={idx}
                onClick={() => handleStepClick(idx)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-left transition-all text-xs ${
                  idx === currentStep
                    ? "bg-red-600/30 border border-red-500/50 text-red-200"
                    : idx < currentStep
                    ? "text-slate-500 hover:bg-slate-800"
                    : "text-slate-600 hover:bg-slate-800"
                }`}
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${
                  idx === currentStep ? "bg-red-500 text-white" :
                  idx < currentStep ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-400"
                }`}>
                  {idx < currentStep ? "✓" : idx + 1}
                </div>
                <span className="truncate">{s.title}</span>
                {s.dayLabel && (
                  <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    s.highlight ? "bg-red-500/30 text-red-300" : "bg-slate-700 text-slate-400"
                  }`}>{s.dayLabel}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-700 flex items-center justify-between flex-shrink-0">
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
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-medium transition-colors"
              >
                Próximo <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white font-medium transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
