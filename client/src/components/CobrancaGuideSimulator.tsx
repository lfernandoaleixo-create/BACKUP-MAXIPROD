import { useState, useRef, useEffect } from "react";
import {
  X, Play, Pause, RotateCcw, ChevronRight,
  Phone, MessageCircle, FileText, AlertTriangle,
  CheckCircle2, Clock, Shield, ShieldAlert,
  Bell, Calendar, History, Users, Gavel, Mail
} from "lucide-react";

/* ---- Types ---- */
interface GuideStep {
  /** Numeração do item: "1", "1.1", "2", "3", "3.1", etc. */
  itemNumber: string;
  title: string;
  description: string;
  icon: typeof Phone;
  iconColor: string;
  bgColor: string;
  borderColor: string;
  details?: string[];
  highlight?: boolean;
  dayLabel?: string;
  /** Se é sub-item (1.1, 3.1, etc.) — indentado visualmente */
  isSubItem?: boolean;
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
      itemNumber: "1",
      title: "Dia 1 — WhatsApp + E-mail (Registro Formal)",
      description: "No 1º dia após o vencimento, o responsável pela cobrança deve enviar uma mensagem de cobrança via WhatsApp e um e-mail formal. Ambos servem como registro formal da cobrança.",
      icon: MessageCircle,
      iconColor: "text-green-600",
      bgColor: "bg-green-50",
      borderColor: "border-green-300",
      dayLabel: "DIA 1",
      highlight: true,
      details: [
        "📱 Enviar mensagem de cobrança via WhatsApp para o cliente",
        "📧 Enviar e-mail formal de cobrança com dados do título (valor, vencimento, referência)",
        "O WhatsApp e o e-mail servem como REGISTRO FORMAL da cobrança",
        "Salve prints do WhatsApp e cópia do e-mail como comprovante",
      ],
    },
    {
      itemNumber: "1.1",
      title: "Registrar Contato do Dia 1",
      description: "Ao clicar no telefone, registre as duas ações realizadas: WhatsApp e E-mail. Isso fica salvo no histórico do título como prova formal.",
      icon: CheckCircle2,
      iconColor: "text-emerald-600",
      bgColor: "bg-emerald-50",
      borderColor: "border-emerald-300",
      isSubItem: true,
      details: [
        "Registre o WhatsApp: tipo 'WhatsApp', resumo da mensagem enviada",
        "Registre o E-mail: tipo 'E-mail', resumo do conteúdo enviado",
        "Ambos ficam salvos com data, hora e operador responsável",
        "O telefone só para de vibrar quando AMBAS as ações forem registradas",
        "Esses registros servem como prova formal em caso de protesto ou ação judicial",
      ],
    },
    {
      itemNumber: "2",
      title: "Dia 2 — Intervalo",
      description: "No dia 2 o telefone não vibra. É um dia de espera. Mas se as ações do dia 1 não foram registradas, o telefone continua vibrando!",
      icon: Clock,
      iconColor: "text-slate-500",
      bgColor: "bg-slate-50",
      borderColor: "border-slate-300",
      dayLabel: "DIA 2",
      details: [
        "Se as ações do dia 1 foram registradas: telefone fica cinza (idle)",
        "Se as ações do dia 1 NÃO foram registradas: telefone continua piscando!",
        "Aproveite para verificar se o cliente respondeu ao WhatsApp ou e-mail",
      ],
    },
    {
      itemNumber: "3",
      title: "Dia 3 — Ligação + E-mail (2º Contato)",
      description: "No 3º dia, o telefone volta a vibrar. O responsável deve fazer uma LIGAÇÃO telefônica e enviar um novo e-mail de cobrança. A ligação é mais incisiva que o WhatsApp.",
      icon: Phone,
      iconColor: "text-amber-600",
      bgColor: "bg-amber-50",
      borderColor: "border-amber-300",
      dayLabel: "DIA 3",
      highlight: true,
      details: [
        "📞 Fazer LIGAÇÃO telefônica para o cliente — contato direto e pessoal",
        "📧 Enviar novo e-mail formal reforçando a cobrança",
        "Na ligação: cobrar o pagamento, ouvir justificativas, negociar prazo se necessário",
        "Se o cliente fez promessa de pagamento, registre a data e valor prometido",
        "Registre AMBAS as ações: tipo 'Ligação' + tipo 'E-mail'",
      ],
    },
    {
      itemNumber: "3.1",
      title: "Alterar Status do Título",
      description: "Após cada contato, atualize o status do título para refletir a situação atual da cobrança.",
      icon: CheckCircle2,
      iconColor: "text-indigo-600",
      bgColor: "bg-indigo-50",
      borderColor: "border-indigo-300",
      isSubItem: true,
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
      itemNumber: "4",
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
        "Verifique se o cliente respondeu aos e-mails ou ligações anteriores",
      ],
    },
    {
      itemNumber: "5",
      title: "Dia 5 — Ligação + E-mail (Último Contato)",
      description: "Último dia de cobrança antes da decisão de protesto. O responsável deve fazer uma LIGAÇÃO final e enviar o último e-mail formal, informando sobre o possível protesto.",
      icon: Phone,
      iconColor: "text-red-600",
      bgColor: "bg-red-50",
      borderColor: "border-red-300",
      dayLabel: "DIA 5",
      highlight: true,
      details: [
        "📞 Fazer LIGAÇÃO telefônica FINAL — informar que o título será protestado se não houver pagamento",
        "📧 Enviar e-mail formal FINAL com aviso de protesto iminente",
        "Na ligação: ser firme, informar consequências do protesto (SPC/Serasa)",
        "Registre AMBAS as ações: tipo 'Ligação' + tipo 'E-mail'",
        "Este é o ÚLTIMO contato antes da decisão de protesto no dia 7",
      ],
    },
    {
      itemNumber: "6",
      title: "Dia 6 — Preparação",
      description: "Dia de preparação antes da decisão de protesto. Revise o histórico completo de contatos.",
      icon: FileText,
      iconColor: "text-orange-600",
      bgColor: "bg-orange-50",
      borderColor: "border-orange-300",
      dayLabel: "DIA 6",
      details: [
        "Revise o histórico de contatos: Dia 1 (WhatsApp + E-mail), Dia 3 (Ligação + E-mail), Dia 5 (Ligação + E-mail)",
        "Verifique se há promessas de pagamento pendentes",
        "Prepare a documentação para a decisão do dia 7",
        "Confirme que todos os 6 registros formais foram feitos (2 por dia de cobrança)",
      ],
    },
    {
      itemNumber: "7",
      title: "Dia 7+ — Decisão de Protesto",
      description: "A partir do dia 7, o sistema exige uma decisão: Com Protesto (Cartório) ou Não Protestar (com plano de ação).",
      icon: Gavel,
      iconColor: "text-red-700",
      bgColor: "bg-red-100",
      borderColor: "border-red-400",
      dayLabel: "DIA 7+",
      highlight: true,
      details: [
        "Opção 1: COM PROTESTO (CARTÓRIO) — título é encaminhado para protesto em cartório",
        "Opção 2: NÃO PROTESTAR — obrigatório criar um Plano de Ação justificando",
        "O Plano de Ação deve explicar por que não protestar e qual a estratégia",
        "Se escolher 'Não Protestar', um documento de cobrança é gerado automaticamente",
        "O documento registra todas as 6 ações formais realizadas nos dias 1, 3 e 5",
        "O ícone muda para documento (📄) indicando que há documento pendente",
      ],
    },
    {
      itemNumber: "7.1",
      title: "Consultar Histórico",
      description: "Todo o histórico de contatos, mudanças de status e decisões fica salvo e pode ser consultado a qualquer momento.",
      icon: History,
      iconColor: "text-purple-600",
      bgColor: "bg-purple-50",
      borderColor: "border-purple-300",
      isSubItem: true,
      details: [
        "Clique no ícone de relógio (🕐) para ver todo o histórico",
        "Cada entrada mostra: data, tipo de contato (WhatsApp/E-mail/Ligação), resumo e operador",
        "O histórico é permanente e não pode ser apagado",
        "Útil para auditoria e acompanhamento da cobrança",
        "Os registros de WhatsApp e E-mail servem como prova formal",
      ],
    },
    {
      itemNumber: "✓",
      title: "Resumo da Régua de Cobrança",
      description: "Visão geral completa do processo de cobrança do Grupo Fox — com canais formais definidos por dia.",
      icon: Shield,
      iconColor: "text-emerald-700",
      bgColor: "bg-emerald-50",
      borderColor: "border-emerald-400",
      highlight: true,
      details: [
        "📱📧 Dia 1 → WhatsApp + E-mail (registro formal da cobrança)",
        "⏸️ Dia 2 → Intervalo (pendências anteriores continuam vibrando)",
        "📞📧 Dia 3 → Ligação + E-mail (2º contato, mais incisivo)",
        "⏸️ Dia 4 → Intervalo",
        "📞📧 Dia 5 → Ligação + E-mail (último contato, aviso de protesto)",
        "📋 Dia 6 → Preparação para decisão (revisão dos 6 registros formais)",
        "⚖️ Dia 7+ → Decisão: Com Protesto (Cartório) ou Plano de Ação",
        "📊 Tudo fica salvo no histórico do título como prova formal",
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

          {/* Channel legend */}
          <div className="mt-3 flex gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-500/20 rounded-md border border-green-400/30">
              <MessageCircle className="w-3 h-3 text-green-400" />
              <span className="text-[10px] text-green-300 font-medium">Dia 1: WhatsApp</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/20 rounded-md border border-blue-400/30">
              <Mail className="w-3 h-3 text-blue-400" />
              <span className="text-[10px] text-blue-300 font-medium">Dias 1,3,5: E-mail</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 rounded-md border border-amber-400/30">
              <Phone className="w-3 h-3 text-amber-400" />
              <span className="text-[10px] text-amber-300 font-medium">Dias 3,5: Ligação</span>
            </div>
          </div>
        </div>

        {/* Main content area */}
        <div className="px-6 py-4 flex-shrink-0">
          <div className={`${step.bgColor} rounded-xl border-2 ${step.borderColor} overflow-hidden ${step.isSubItem ? "ml-6" : ""}`}>
            {/* Day label */}
            {step.dayLabel && (
              <div className={`px-4 py-1.5 ${step.highlight ? "bg-red-200/60" : "bg-white/60"} border-b ${step.borderColor}`}>
                <span className={`text-xs font-bold uppercase tracking-wider ${step.highlight ? "text-red-700" : "text-slate-600"}`}>
                  {step.dayLabel}
                </span>
              </div>
            )}

            <div className="p-5">
              {/* Step title with icon and item number */}
              <div className="flex items-start gap-3 mb-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  step.highlight ? "bg-red-600 shadow-md shadow-red-500/30" : "bg-white shadow-sm"
                }`}>
                  <StepIcon className={`w-5 h-5 ${step.highlight ? "text-white" : step.iconColor}`} />
                </div>
                <div>
                  <h4 className={`font-bold text-base ${step.highlight ? "text-red-800" : "text-slate-800"}`}>
                    <span className="text-slate-400 font-mono mr-1.5">{step.itemNumber}.</span>
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
            <p className="text-xs text-slate-500 font-medium">{step.itemNumber}. {step.title}</p>
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
                  s.isSubItem ? "pl-8" : ""
                } ${
                  idx === currentStep
                    ? "bg-red-600/30 border border-red-500/50 text-red-200"
                    : idx < currentStep
                    ? "text-slate-500 hover:bg-slate-800"
                    : "text-slate-600 hover:bg-slate-800"
                }`}
              >
                <div className={`min-w-[28px] h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold px-1 ${
                  idx === currentStep ? "bg-red-500 text-white" :
                  idx < currentStep ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-400"
                }`}>
                  {idx < currentStep ? "✓" : s.itemNumber}
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
