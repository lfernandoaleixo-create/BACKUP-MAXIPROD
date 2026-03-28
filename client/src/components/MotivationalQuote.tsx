import { useMemo } from "react";

// Frases curtas (max 2 linhas) de autores estrangeiros de referência mundial
// Priorizando Napoleon Hill e outros grandes pensadores
const QUOTES = [
  { text: "A excelência não é um ato, mas um hábito.", author: "Aristóteles" },
  { text: "A vitória pertence ao mais perseverante.", author: "Napoleão Bonaparte" },
  { text: "O sucesso não é final, o fracasso não é fatal: é a coragem de continuar que conta.", author: "Winston Churchill" },
  { text: "A persistência é o caminho do êxito.", author: "Charles Chaplin" },
  { text: "Acredite que você pode, assim você já está no meio do caminho.", author: "Theodore Roosevelt" },
  { text: "Não tenha medo de crescer lentamente. Tenha medo apenas de ficar parado.", author: "Provérbio Chinês" },
  { text: "Quem tem um porquê enfrenta qualquer como.", author: "Friedrich Nietzsche" },
  { text: "Disciplina é a ponte entre metas e conquistas.", author: "Jim Rohn" },
  { text: "Não conte os dias, faça os dias contarem.", author: "Muhammad Ali" },
  { text: "Tudo o que a mente pode conceber e acreditar, ela pode conquistar.", author: "Napoleon Hill" },
  { text: "A melhor maneira de prever o futuro é criá-lo.", author: "Peter Drucker" },
  { text: "Coragem não é a ausência do medo, mas o triunfo sobre ele.", author: "Nelson Mandela" },
  { text: "O avião decola contra o vento, não a favor dele.", author: "Henry Ford" },
  { text: "A força de vontade é o começo de toda grande conquista.", author: "Napoleon Hill" },
  { text: "Seja a mudança que você deseja ver no mundo.", author: "Mahatma Gandhi" },
  { text: "Não importa o quão devagar você vá, desde que não pare.", author: "Confúcio" },
  { text: "A sorte favorece a mente preparada.", author: "Louis Pasteur" },
  { text: "Grandes coisas nunca vieram de zonas de conforto.", author: "Neil Strauss" },
  { text: "A imaginação é mais importante que o conhecimento.", author: "Albert Einstein" },
  { text: "O preço da grandeza é a responsabilidade.", author: "Winston Churchill" },
  { text: "Eu não falhei. Encontrei 10.000 maneiras que não funcionam.", author: "Thomas Edison" },
  { text: "Toda adversidade traz consigo a semente de um benefício equivalente.", author: "Napoleon Hill" },
  { text: "O que não nos mata nos fortalece.", author: "Friedrich Nietzsche" },
  { text: "A mente que se abre a uma nova ideia jamais volta ao seu tamanho original.", author: "Albert Einstein" },
  { text: "O homem que move montanhas começa carregando pequenas pedras.", author: "Confúcio" },
  { text: "Trabalhe em silêncio, deixe o sucesso fazer barulho.", author: "Frank Ocean" },
  { text: "O segredo de ir em frente é começar.", author: "Mark Twain" },
  { text: "Nenhum vento sopra a favor de quem não sabe para onde ir.", author: "Sêneca" },
  { text: "O talento vence jogos, mas o trabalho em equipe ganha campeonatos.", author: "Michael Jordan" },
  { text: "Antes de tentar vencer os outros, vença a si mesmo.", author: "Napoleon Hill" },
  { text: "A única maneira de fazer um excelente trabalho é amar o que você faz.", author: "Steve Jobs" },
  { text: "Dificuldades preparam pessoas comuns para destinos extraordinários.", author: "C.S. Lewis" },
  { text: "O sucesso vem para quem está ocupado demais para procurá-lo.", author: "Henry David Thoreau" },
  { text: "A paciência é amarga, mas seu fruto é doce.", author: "Aristóteles" },
  { text: "Não espere. O momento nunca será perfeito.", author: "Napoleon Hill" },
  { text: "O futuro pertence a quem acredita na beleza de seus sonhos.", author: "Eleanor Roosevelt" },
  { text: "A persistência realiza o impossível.", author: "Provérbio Chinês" },
  { text: "Grandes empresas são construídas por quem se recusa a desistir.", author: "Howard Schultz" },
  { text: "Primeiro te ignoram, depois riem, depois lutam, e então você vence.", author: "Mahatma Gandhi" },
  { text: "O ponto de partida de toda conquista é o desejo.", author: "Napoleon Hill" },
  { text: "A força não vem de vencer. Suas lutas desenvolvem suas forças.", author: "Arnold Schwarzenegger" },
  { text: "Sozinhos vamos mais rápido, juntos vamos mais longe.", author: "Provérbio Africano" },
  { text: "Você nunca é velho demais para sonhar um novo sonho.", author: "C.S. Lewis" },
  { text: "Pense e enriqueça: a riqueza começa na mente.", author: "Napoleon Hill" },
  { text: "Transforme suas feridas em sabedoria.", author: "Oprah Winfrey" },
  { text: "Tudo o que você sempre quis está do outro lado do medo.", author: "George Addair" },
  { text: "Não é a espécie mais forte que sobrevive, mas a que melhor se adapta.", author: "Charles Darwin" },
  { text: "A liderança é cuidar daqueles que estão sob seu comando.", author: "Simon Sinek" },
  { text: "O fracasso é a oportunidade de começar de novo com mais inteligência.", author: "Henry Ford" },
  { text: "Um objetivo é um sonho com prazo.", author: "Napoleon Hill" },
  { text: "Nosso maior medo é sermos poderosos além da medida.", author: "Marianne Williamson" },
  { text: "O sucesso é a soma de pequenos esforços repetidos dia após dia.", author: "Robert Collier" },
];

function getMondayWeekNumber(): number {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const dayOfWeek = startOfYear.getDay();
  const daysToFirstMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
  const firstMonday = new Date(now.getFullYear(), 0, 1 + daysToFirstMonday);
  
  if (now < firstMonday) return 0;
  
  const diffMs = now.getTime() - firstMonday.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7);
}

export default function MotivationalQuote() {
  const quote = useMemo(() => {
    const weekNum = getMondayWeekNumber();
    const year = new Date().getFullYear();
    const index = (year * 53 + weekNum) % QUOTES.length;
    return QUOTES[index];
  }, []);

  return (
    <div className="w-full text-center px-4">
      <blockquote
        className="max-w-2xl mx-auto"
        style={{ fontFamily: "'Playfair Display', 'Georgia', serif" }}
      >
        <p
          className="text-slate-600 italic"
          style={{
            fontSize: "clamp(1rem, 2vw, 1.3rem)",
            lineHeight: 1.5,
            letterSpacing: "0.01em",
          }}
        >
          &ldquo;{quote.text}&rdquo;
        </p>
        <footer
          className="mt-1.5 text-teal-600 font-medium tracking-wide"
          style={{
            fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
            fontSize: "clamp(0.75rem, 1.2vw, 0.85rem)",
            letterSpacing: "0.05em",
          }}
        >
          &mdash; {quote.author}
        </footer>
      </blockquote>
    </div>
  );
}
