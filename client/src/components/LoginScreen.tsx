import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, Loader2, Eye, EyeOff } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useOperator } from "@/contexts/OperatorContext";
import { toast } from "sonner";

const LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663411930072/4HdUM8rZGtZWDcoLipqmEj/grupo_fox_logo_ai_transparent_7e0dd68e.png";
const APP_VERSION = "V.1.1.1";

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

function getWeeklyQuote() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const dayOfWeek = startOfYear.getDay();
  const daysToFirstMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
  const firstMonday = new Date(now.getFullYear(), 0, 1 + daysToFirstMonday);
  let weekNum = 0;
  if (now >= firstMonday) {
    const diffDays = Math.floor((now.getTime() - firstMonday.getTime()) / (1000 * 60 * 60 * 24));
    weekNum = Math.floor(diffDays / 7);
  }
  const index = (now.getFullYear() * 53 + weekNum) % QUOTES.length;
  return QUOTES[index];
}

export default function LoginScreen() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useOperator();
  const validateMutation = trpc.settings.validateOperator.useMutation();
  const [quote] = useState(() => getWeeklyQuote());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      toast.error("Digite sua senha");
      return;
    }
    try {
      const result = await validateMutation.mutateAsync({ password: password.trim() });
      if (result.success && result.operator) {
        login(result.operator, result.granularPermissions || {});
        toast.success(`Bem-vindo, ${result.operator.name}!`);
      } else {
        toast.error("Senha incorreta");
        setPassword("");
      }
    } catch {
      toast.error("Erro ao validar senha");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/30 to-slate-100 flex flex-col items-center pt-[6vh] px-4">
      {/* Frase motivacional */}
      <div className="text-center px-4 mb-2">
        <p
          className="text-slate-600 italic max-w-xl mx-auto"
          style={{
            fontFamily: "'Playfair Display', 'Georgia', serif",
            fontSize: "clamp(1rem, 2vw, 1.25rem)",
            lineHeight: 1.4,
          }}
        >
          &ldquo;{quote.text}&rdquo;
        </p>
        <p
          className="mt-1 text-teal-600 font-medium tracking-wide"
          style={{
            fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
            fontSize: "0.8rem",
          }}
        >
          &mdash; {quote.author}
        </p>
      </div>

      {/* Logo */}
      <div className="mb-2 flex justify-center">
        <img
          src={LOGO_URL}
          alt="Grupo Fox"
          className="h-auto block"
          style={{
            width: "min(320px, 70vw)",
            filter: "saturate(1.3) contrast(1.1) drop-shadow(0 10px 20px rgba(0,80,0,0.2)) drop-shadow(0 4px 8px rgba(0,0,0,0.1))",
            transform: "perspective(800px) rotateX(2deg) translateX(14px)",
            transition: "transform 0.3s ease, filter 0.3s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "perspective(800px) rotateX(0deg) scale(1.04) translateX(14px)";
            e.currentTarget.style.filter = "saturate(1.5) contrast(1.15) drop-shadow(0 14px 28px rgba(0,80,0,0.25)) drop-shadow(0 6px 12px rgba(0,0,0,0.12))";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "perspective(800px) rotateX(2deg) translateX(14px)";
            e.currentTarget.style.filter = "saturate(1.3) contrast(1.1) drop-shadow(0 10px 20px rgba(0,80,0,0.2)) drop-shadow(0 4px 8px rgba(0,0,0,0.1))";
          }}
        />
      </div>

      {/* Login Card */}
      <div
        className="w-72 bg-white/90 backdrop-blur-sm rounded-2xl border border-white/60 px-6 py-5"
        style={{
          boxShadow: "0 20px 40px rgba(0,0,0,0.08), 0 8px 16px rgba(0,0,0,0.06), 0 0 0 1px rgba(255,255,255,0.5) inset",
        }}
      >
        <div className="text-center mb-4">
          <div
            className="w-10 h-10 bg-gradient-to-br from-teal-400 to-teal-600 rounded-full flex items-center justify-center mx-auto mb-2"
            style={{ boxShadow: "0 4px 12px rgba(13,148,136,0.35)" }}
          >
            <Lock className="w-5 h-5 text-white" />
          </div>
          <p className="text-sm text-slate-500 font-medium">Digite sua senha para acessar</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha"
              className="h-11 text-center text-base pr-10 rounded-xl border-slate-200 focus:border-teal-400 focus:ring-teal-400/20"
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
            className="w-full h-11 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white font-semibold text-sm rounded-xl transition-all duration-200"
            style={{ boxShadow: "0 4px 12px rgba(13,148,136,0.3)" }}
          >
            {validateMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              "Entrar"
            )}
          </Button>
        </form>
      </div>

      <p className="mt-3 text-xs text-slate-400 font-mono tracking-wider">{APP_VERSION}</p>
    </div>
  );
}
