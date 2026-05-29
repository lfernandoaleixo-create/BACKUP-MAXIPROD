import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, Loader2, Eye, EyeOff } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useOperator } from "@/contexts/OperatorContext";
import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "sonner";

const LOGO_URL = "/manus-storage/grupo-fox-logo-colorida-transparent_d34e971e.png";
const LOGO_GOLD_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663487476806/TMh5HqmzfeBw9KakgJtjjo/grupo-fox-gold-dark_6da0c96d.png";
const APP_VERSION = "V.2.1.1";

const QUOTES = [
  { text: "A vitória pertence ao mais perseverante.", author: "Napoleão Bonaparte" },
  { text: "A força de vontade é o começo de toda grande conquista.", author: "Napoleon Hill" },
  { text: "Toda adversidade traz consigo a semente de um benefício equivalente.", author: "Napoleon Hill" },
  { text: "Não espere. O momento nunca será perfeito.", author: "Napoleon Hill" },
  { text: "O ponto de partida de toda conquista é o desejo.", author: "Napoleon Hill" },
  { text: "Antes de tentar vencer os outros, vença a si mesmo.", author: "Napoleon Hill" },
  { text: "Um objetivo é um sonho com prazo.", author: "Napoleon Hill" },
  { text: "Pense e enriqueça: a riqueza começa na mente.", author: "Napoleon Hill" },
  { text: "O sucesso não é final, o fracasso não é fatal: é a coragem de continuar que conta.", author: "Winston Churchill" },
  { text: "Tudo o que a mente pode conceber e acreditar, ela pode conquistar.", author: "Napoleon Hill" },
  { text: "A persistência é o caminho do êxito.", author: "Charles Chaplin" },
  { text: "Acredite que você pode, assim você já está no meio do caminho.", author: "Theodore Roosevelt" },
  { text: "Quem tem um porquê enfrenta qualquer como.", author: "Friedrich Nietzsche" },
  { text: "Disciplina é a ponte entre metas e conquistas.", author: "Jim Rohn" },
  { text: "A excelência não é um ato, mas um hábito.", author: "Aristóteles" },
  { text: "Não conte os dias, faça os dias contarem.", author: "Muhammad Ali" },
  { text: "A melhor maneira de prever o futuro é criá-lo.", author: "Peter Drucker" },
  { text: "Coragem não é a ausência do medo, mas o triunfo sobre ele.", author: "Nelson Mandela" },
  { text: "O avião decola contra o vento, não a favor dele.", author: "Henry Ford" },
  { text: "Seja a mudança que você deseja ver no mundo.", author: "Mahatma Gandhi" },
  { text: "Não importa o quão devagar você vá, desde que não pare.", author: "Confúcio" },
  { text: "A sorte favorece a mente preparada.", author: "Louis Pasteur" },
  { text: "Grandes coisas nunca vieram de zonas de conforto.", author: "Neil Strauss" },
  { text: "A imaginação é mais importante que o conhecimento.", author: "Albert Einstein" },
  { text: "O preço da grandeza é a responsabilidade.", author: "Winston Churchill" },
  { text: "Eu não falhei. Encontrei 10.000 maneiras que não funcionam.", author: "Thomas Edison" },
  { text: "O que não nos mata nos fortalece.", author: "Friedrich Nietzsche" },
  { text: "A mente que se abre a uma nova ideia jamais volta ao seu tamanho original.", author: "Albert Einstein" },
  { text: "O homem que move montanhas começa carregando pequenas pedras.", author: "Confúcio" },
  { text: "Trabalhe em silêncio, deixe o sucesso fazer barulho.", author: "Frank Ocean" },
  { text: "O segredo de ir em frente é começar.", author: "Mark Twain" },
  { text: "Nenhum vento sopra a favor de quem não sabe para onde ir.", author: "Sêneca" },
  { text: "O talento vence jogos, mas o trabalho em equipe ganha campeonatos.", author: "Michael Jordan" },
  { text: "A única maneira de fazer um excelente trabalho é amar o que você faz.", author: "Steve Jobs" },
  { text: "Dificuldades preparam pessoas comuns para destinos extraordinários.", author: "C.S. Lewis" },
  { text: "O sucesso vem para quem está ocupado demais para procurá-lo.", author: "Henry David Thoreau" },
  { text: "A paciência é amarga, mas seu fruto é doce.", author: "Aristóteles" },
  { text: "O futuro pertence a quem acredita na beleza de seus sonhos.", author: "Eleanor Roosevelt" },
  { text: "A persistência realiza o impossível.", author: "Provérbio Chinês" },
  { text: "Grandes empresas são construídas por quem se recusa a desistir.", author: "Howard Schultz" },
  { text: "Primeiro te ignoram, depois riem, depois lutam, e então você vence.", author: "Mahatma Gandhi" },
  { text: "A força não vem de vencer. Suas lutas desenvolvem suas forças.", author: "Arnold Schwarzenegger" },
  { text: "Sozinhos vamos mais rápido, juntos vamos mais longe.", author: "Provérbio Africano" },
  { text: "Você nunca é velho demais para sonhar um novo sonho.", author: "C.S. Lewis" },
  { text: "Transforme suas feridas em sabedoria.", author: "Oprah Winfrey" },
  { text: "Tudo o que você sempre quis está do outro lado do medo.", author: "George Addair" },
  { text: "Não é a espécie mais forte que sobrevive, mas a que melhor se adapta.", author: "Charles Darwin" },
  { text: "A liderança é cuidar daqueles que estão sob seu comando.", author: "Simon Sinek" },
  { text: "O fracasso é a oportunidade de começar de novo com mais inteligência.", author: "Henry Ford" },
  { text: "Nosso maior medo é sermos poderosos além da medida.", author: "Marianne Williamson" },
  { text: "O sucesso é a soma de pequenos esforços repetidos dia após dia.", author: "Robert Collier" },
  { text: "Não tenha medo de crescer lentamente. Tenha medo apenas de ficar parado.", author: "Provérbio Chinês" },
];

function getDailyQuote() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
  const index = (now.getFullYear() * 365 + dayOfYear) % QUOTES.length;
  return QUOTES[index];
}

/** Wave animation component for "Seja bem-vindo(a)" - loops continuously */
function WaveText({ text, isDark }: { text: string; isDark: boolean }) {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAnimate(true), 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <span className="inline-flex flex-wrap justify-center" aria-label={text}>
      {text.split("").map((char, i) => (
        <span
          key={i}
          className="inline-block"
          style={{
            animation: animate ? `wave-letter 2s ease-in-out ${i * 0.07}s infinite` : "none",
            color: isDark ? "#DAA520" : "#0d9488",
            textShadow: isDark ? "0 0 12px rgba(255,215,0,0.6), 0 2px 4px rgba(184,134,11,0.4)" : "none",
          }}
        >
          {char === " " ? "\u00A0" : char}
        </span>
      ))}
    </span>
  );
}

export default function LoginScreen() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useOperator();
  const validateMutation = trpc.settings.validateOperator.useMutation();
  const [quote] = useState(() => getDailyQuote());
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      toast.error("Digite sua senha");
      return;
    }
    try {
      const result = await validateMutation.mutateAsync({ password: password.trim() });
      if (result.success && result.loginType === "operator" && result.operator) {
        login(result.operator, result.granularPermissions || {});
        toast.success(`Bem-vindo, ${result.operator.name}!`);
      } else if (result.success && result.loginType === "seller" && result.seller) {
        // Seller login - store session and redirect to seller area
        sessionStorage.setItem("sellerSession", JSON.stringify(result.seller));
        toast.success(`Bem-vindo, ${result.seller.name}!`);
        window.location.href = "/vendedor";
      } else if (result.error) {
        toast.error(result.error);
        setPassword("");
      } else {
        toast.error("Senha incorreta");
        setPassword("");
      }
    } catch {
      toast.error("Erro ao validar senha");
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center pt-[5vh] px-4"
      style={{
        background: isDark
          ? "#000000"
          : "linear-gradient(135deg, #f8fafc 0%, #ecfdf5 30%, #f1f5f9 100%)",
        // 4K text rendering
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
        textRendering: "optimizeLegibility",
      }}
    >
      {/* Frase motivacional */}
      <div className="text-center px-4 mb-3">
        <p
          className="italic max-w-xl mx-auto"
          style={{
            fontFamily: "'Playfair Display', 'Georgia', serif",
            fontSize: "clamp(1rem, 2vw, 1.25rem)",
            lineHeight: 1.4,
            letterSpacing: "0.01em",
            ...(isDark ? {
              background: "linear-gradient(90deg, #B8860B, #FFD700, #DAA520, #FFD700, #B8860B)",
              backgroundSize: "200% 100%",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              textShadow: "none",
              filter: "drop-shadow(0 0 6px rgba(255,215,0,0.3))",
            } : {
              color: "#475569",
            }),
          }}
        >
          &ldquo;{quote.text}&rdquo;
        </p>
        <p
          className="mt-1.5 font-semibold tracking-wide"
          style={{
            fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
            fontSize: "0.8rem",
            ...(isDark ? {
              color: "#DAA520",
              textShadow: "0 0 8px rgba(218,165,32,0.4)",
            } : {
              color: "#0d9488",
            }),
          }}
        >
          &mdash; {quote.author}
        </p>
      </div>

      {/* Logo */}
      <div className="mb-2 flex justify-center">
        <img
          src={isDark ? LOGO_GOLD_URL : LOGO_URL}
          alt="Grupo Fox"
          className={`h-auto block ${isDark ? '' : 'login-logo mix-blend-multiply'}`}
          style={{
            width: isDark ? "min(340px, 75vw)" : "min(320px, 70vw)",
            transform: "perspective(800px) rotateX(2deg)",
            transition: "transform 0.3s ease, filter 0.3s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "perspective(800px) rotateX(0deg) scale(1.04)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "perspective(800px) rotateX(2deg)";
          }}
        />
      </div>

      {/* "Seja bem-vindo(a)" wave text */}
      <div className="mb-4 text-center">
        <h2
          style={{
            fontFamily: "'Playfair Display', 'Georgia', serif",
            fontSize: "clamp(1.4rem, 3.5vw, 1.9rem)",
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          <WaveText text="Seja bem-vindo(a)" isDark={isDark} />
        </h2>
      </div>

      {/* Login Card */}
      <div
        className="w-72 backdrop-blur-sm rounded-2xl px-6 py-5"
        style={{
          background: isDark
            ? "rgba(15, 15, 15, 0.9)"
            : "rgba(255, 255, 255, 0.92)",
          border: isDark
            ? "1px solid rgba(218, 165, 32, 0.25)"
            : "1px solid rgba(255, 255, 255, 0.6)",
          boxShadow: isDark
            ? "0 20px 40px rgba(0,0,0,0.5), 0 0 30px rgba(218,165,32,0.08), inset 0 1px 0 rgba(218,165,32,0.1)"
            : "0 20px 40px rgba(0,0,0,0.08), 0 8px 16px rgba(0,0,0,0.06), 0 0 0 1px rgba(255,255,255,0.5) inset",
        }}
      >
        <div className="text-center mb-4">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2"
            style={{
              background: isDark
                ? "linear-gradient(135deg, #B8860B, #DAA520)"
                : "linear-gradient(135deg, #14b8a6, #0d9488)",
              boxShadow: isDark
                ? "0 4px 12px rgba(218,165,32,0.4)"
                : "0 4px 12px rgba(13,148,136,0.35)",
            }}
          >
            <Lock className="w-5 h-5 text-white" />
          </div>
          <p
            className="text-sm font-medium"
            style={{ color: isDark ? "#a3a3a3" : "#64748b" }}
          >
            Digite sua senha para acessar
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha"
              className="h-11 text-center text-base pr-10 rounded-xl"
              style={{
                background: isDark ? "#1a1a1a" : "#ffffff",
                border: isDark ? "1px solid rgba(218,165,32,0.3)" : "1px solid #e2e8f0",
                color: isDark ? "#ffffff" : "#1e293b",
              }}
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <Button
            type="submit"
            disabled={validateMutation.isPending || !password.trim()}
            className="w-full h-11 text-white font-semibold text-sm rounded-xl transition-all duration-200"
            style={{
              background: isDark
                ? "linear-gradient(135deg, #B8860B, #DAA520, #B8860B)"
                : "linear-gradient(135deg, #14b8a6, #0d9488)",
              boxShadow: isDark
                ? "0 4px 12px rgba(218,165,32,0.35)"
                : "0 4px 12px rgba(13,148,136,0.3)",
            }}
          >
            {validateMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              "Entrar"
            )}
          </Button>
        </form>
      </div>

      <p
        className="mt-3 text-xs font-mono tracking-wider"
        style={{ color: isDark ? "#ffffff" : "#94a3b8" }}
      >
        {APP_VERSION}
      </p>
    </div>
  );
}
