import { useState, useEffect, useRef, useMemo } from "react";
import { X, Eye, ExternalLink, Monitor, Mouse, Keyboard, CheckCircle2, Play, Pause, RotateCcw, ChevronRight, AlertTriangle, User } from "lucide-react";

/* ---- Types ---- */
interface TutorialStep {
  screen: string;
  action: string;
  actionType: "navigate" | "click" | "type" | "select" | "verify" | "result";
  highlight?: boolean;
  typedValue?: string;
  fieldLabel?: string;
}

interface DecisaoCobrancaTutorialProps {
  clienteName: string;
  vendedorName: string;
  onClose: () => void;
}

const MAXIPROD_LOGIN_URL = "https://app.maxiprod.com.br";

const actionIcons: Record<string, typeof Monitor> = {
  navigate: Monitor,
  click: Mouse,
  type: Keyboard,
  select: Mouse,
  verify: CheckCircle2,
  result: CheckCircle2,
};

/* ---- Step generator ---- */
function getTutorialSteps(clienteName: string, vendedorName: string): TutorialStep[] {
  return [
    {
      screen: "Acessando Maxiprod...\napp.maxiprod.com.br",
      action: "Abrir o Maxiprod no navegador",
      actionType: "navigate",
    },
    {
      screen: "Tela de Login do Maxiprod",
      action: `Preencher seu e-mail de acesso (login do ${vendedorName})`,
      actionType: "type",
      fieldLabel: "E-mail",
      typedValue: `seu-email@empresa.com.br`,
    },
    {
      screen: "Tela de Login do Maxiprod",
      action: "Preencher sua senha pessoal",
      actionType: "type",
      fieldLabel: "Senha",
      typedValue: "sua-senha-pessoal",
    },
    {
      screen: "Entrando no sistema...\nLogin realizado com sucesso!",
      action: "Clicar em Entrar",
      actionType: "click",
    },
    {
      screen: "Menu Principal\n→ CRM → Clientes",
      action: "Navegar para CRM → Clientes",
      actionType: "navigate",
    },
    {
      screen: `Tela de Clientes\nBuscando: ${clienteName}`,
      action: `Buscar o cliente: ${clienteName}`,
      actionType: "type",
      fieldLabel: "Buscar Cliente",
      typedValue: clienteName,
    },
    {
      screen: `Cliente encontrado!\n${clienteName}\nAbrindo cadastro...`,
      action: "Clicar no nome do cliente para abrir o cadastro",
      actionType: "click",
    },
    {
      screen: "Cadastro do Cliente\n→ Campos adicionais\n→ Grupo: COBRANÇA",
      action: 'Localizar e expandir "Campos adicionais do grupo COBRANÇA"',
      actionType: "click",
      highlight: true,
    },
    {
      screen: "Campos adicionais - COBRANÇA\n\n▸ SITUAÇÃO: (vazio)\n▸ Observações\n▸ Anotações",
      action: 'Clicar no campo "SITUAÇÃO" para abrir as opções',
      actionType: "click",
      highlight: true,
    },
    {
      screen: "SITUAÇÃO - Opções:\n\n✓ (vazio)\n◉ COM PROTESTO\n◉ SEM PROTESTO",
      action: "Escolher a decisão de cobrança: COM PROTESTO ou SEM PROTESTO",
      actionType: "select",
      highlight: true,
    },
    {
      screen: "SITUAÇÃO: COM PROTESTO ✓\n\nSalvando alteração...",
      action: "Confirmar e salvar a decisão de cobrança",
      actionType: "click",
    },
    {
      screen: `✅ Decisão de cobrança preenchida!\n\nCliente: ${clienteName}\nSITUAÇÃO: Definida\nVendedor responsável: ${vendedorName}`,
      action: "Decisão de cobrança registrada com sucesso!",
      actionType: "result",
      highlight: true,
    },
  ];
}

/* ---- Ensure animation styles ---- */
let stylesInjected = false;
function ensureStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement("style");
  style.textContent = `
    @keyframes dct-gradient-shift {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
    @keyframes dct-cursor-blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
    }
    @keyframes dct-value-count {
      0% { opacity: 0; transform: scale(0.8); }
      50% { transform: scale(1.05); }
      100% { opacity: 1; transform: scale(1); }
    }
    @keyframes dct-check-bounce {
      0% { transform: scale(0); }
      50% { transform: scale(1.2); }
      70% { transform: scale(0.9); }
      100% { transform: scale(1); }
    }
    @keyframes dct-pulse-amber {
      0%, 100% { box-shadow: 0 0 15px rgba(245,158,11,0.3), 0 0 30px rgba(245,158,11,0.1); }
      50% { box-shadow: 0 0 25px rgba(245,158,11,0.5), 0 0 50px rgba(245,158,11,0.2); }
    }
    .dct-gradient-bg {
      background: linear-gradient(135deg, #78350f, #92400e, #b45309, #78350f);
      background-size: 400% 400%;
      animation: dct-gradient-shift 8s ease infinite;
    }
    .dct-glow-amber { animation: dct-pulse-amber 2s ease-in-out infinite; }
    .dct-value-appear { animation: dct-value-count 0.6s ease-out forwards; }
    .dct-check-bounce { animation: dct-check-bounce 0.5s ease-out forwards; }
  `;
  document.head.appendChild(style);
}

/* ---- Component ---- */
export default function DecisaoCobrancaTutorial({
  clienteName,
  vendedorName,
  onClose,
}: DecisaoCobrancaTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [typingText, setTypingText] = useState("");
  const [typingComplete, setTypingComplete] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { ensureStyles(); }, []);

  const animSteps = useMemo(() => getTutorialSteps(clienteName, vendedorName), [clienteName, vendedorName]);
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
      <div className="bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-amber-700/50 max-h-[95vh] overflow-y-auto" onClick={e => e.stopPropagation()}
        style={{ animation: "dct-value-count 0.3s ease-out" }}>

        {/* Header */}
        <div className="dct-gradient-bg px-6 py-5 relative">
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                <Eye className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold text-base">Como preencher a Decisão de Cobrança</h3>
                <p className="text-amber-200/80 text-xs">Tutorial passo a passo no Maxiprod</p>
              </div>
            </div>
            <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Context info */}
          <div className="mt-4 grid grid-cols-2 gap-2 relative z-10">
            <div className="px-4 py-3 bg-white/10 rounded-lg border border-white/20 backdrop-blur-sm">
              <span className="text-amber-200/70 text-[10px] uppercase tracking-wider flex items-center gap-1">
                <User className="w-3 h-3" /> Cliente
              </span>
              <p className="text-white font-bold text-sm mt-0.5 break-words">{clienteName}</p>
            </div>
            <div className="px-4 py-3 bg-white/10 rounded-lg border border-white/20 backdrop-blur-sm">
              <span className="text-amber-200/70 text-[10px] uppercase tracking-wider flex items-center gap-1">
                <User className="w-3 h-3" /> Vendedor Responsável
              </span>
              <p className="text-white font-bold text-sm mt-0.5">{vendedorName}</p>
            </div>
          </div>

          {/* Alert */}
          <div className="mt-3 px-4 py-3 bg-amber-500/20 rounded-lg border border-amber-400/40 flex items-center gap-3 dct-glow-amber relative z-10">
            <AlertTriangle className="w-5 h-5 text-amber-300 flex-shrink-0" />
            <div>
              <p className="text-amber-100 text-xs font-bold">Este cliente está sem decisão de cobrança!</p>
              <p className="text-amber-200/70 text-[10px] mt-0.5">Siga o passo a passo abaixo para preencher no Maxiprod</p>
            </div>
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
                    <div className="bg-slate-50 border-2 border-amber-400 rounded-lg px-3 py-2 text-left flex items-center">
                      <span className="text-sm text-slate-800 font-mono">{typingText}</span>
                      {!typingComplete && (
                        <span className="inline-block w-0.5 h-4 bg-amber-500 ml-0.5" style={{ animation: "dct-cursor-blink 0.8s infinite" }} />
                      )}
                    </div>
                  </div>
                )}

                {/* Result highlight */}
                {step?.actionType === "result" && (
                  <div className="mt-3 mx-auto max-w-sm bg-emerald-50 border-2 border-emerald-300 rounded-lg px-4 py-3">
                    <div className="dct-check-bounce">
                      <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
                    </div>
                    <p className="text-sm font-bold text-emerald-700 text-center leading-snug">Decisão de cobrança<br/>preenchida com sucesso!</p>
                  </div>
                )}
              </div>

              {/* Animated cursor */}
              {step?.actionType === "click" && (
                <div className="absolute bottom-3 right-6 animate-bounce">
                  <Mouse className="w-4 h-4 text-amber-500 drop-shadow-lg" />
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
              step?.highlight ? "bg-amber-500 shadow-md shadow-amber-500/30" : "bg-amber-700"
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
              className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500"
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
                    ? "bg-amber-600/30 border border-amber-500/50 text-amber-200"
                    : idx < currentStep
                    ? "text-slate-500 hover:bg-slate-800"
                    : "text-slate-600 hover:bg-slate-800"
                }`}
              >
                <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-[9px] font-bold ${
                  idx === currentStep ? "bg-amber-500 text-white" :
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
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium transition-colors"
              >
                Próximo <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <a
            href={MAXIPROD_LOGIN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 text-white text-xs font-bold shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 transition-all hover:scale-[1.02]"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Abrir Maxiprod
          </a>
        </div>
      </div>
    </div>
  );
}
