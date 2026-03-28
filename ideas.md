# Brainstorm - Dashboard de Estoque Grupo Fox

## Contexto
Dashboard operacional para Fernando e seu time consultarem estoque de produtos disponíveis para venda nas 4 empresas do Grupo Fox (Palitos, Mesa, Espetos, Varetas). Precisa ser rápido, funcional e fácil de acessar.

---

<response>
<text>

## Ideia 1: Industrial Data Terminal

**Design Movement:** Neo-Brutalism industrial com influências de terminais de dados industriais

**Core Principles:**
- Densidade informacional alta com hierarquia clara
- Tipografia monospace para dados, sans-serif bold para títulos
- Contraste extremo para leitura rápida em ambiente fabril
- Sem decoração desnecessária — cada pixel serve a um propósito

**Color Philosophy:** Fundo escuro grafite (#1a1a2e) com acentos em amarelo industrial (#ffd60a) e verde operacional (#06d6a0). O amarelo transmite urgência e atenção, o verde indica disponibilidade. Texto em branco puro para máximo contraste.

**Layout Paradigm:** Grid assimétrico com sidebar fixa à esquerda contendo navegação por empresa. Área principal dividida em cards de dados com bordas grossas e cantos retos. Tabelas densas com linhas alternadas.

**Signature Elements:**
- Indicadores de status tipo semáforo (verde/amarelo/vermelho) para níveis de estoque
- Bordas grossas de 3px nos cards principais
- Números grandes em destaque para totais

**Interaction Philosophy:** Cliques diretos, sem animações longas. Filtros instantâneos. Hover com highlight forte.

**Animation:** Transições de 150ms, fade-in nos dados. Sem animações decorativas.

**Typography System:** JetBrains Mono para dados numéricos, Space Grotesk para títulos e navegação.

</text>
<probability>0.08</probability>
</response>

<response>
<text>

## Ideia 2: Clean Operations Dashboard

**Design Movement:** Swiss Design / International Typographic Style adaptado para dashboards operacionais

**Core Principles:**
- Grid rigoroso com espaçamento matemático
- Hierarquia tipográfica como principal ferramenta de design
- Cores funcionais — cada cor tem um significado claro
- Whitespace generoso para respiração visual

**Color Philosophy:** Base clara com off-white (#fafaf9) e stone tones. Primária em teal profundo (#0d9488) representando confiança e estabilidade industrial. Acentos em amber (#f59e0b) para alertas e rose (#e11d48) para itens críticos. Cards em branco puro com sombras sutis.

**Layout Paradigm:** Header fixo com seletor de empresa em tabs horizontais. Abaixo, grid de 12 colunas com cards de resumo no topo (KPIs) e tabela principal ocupando toda a largura. Sidebar colapsável com filtros avançados.

**Signature Elements:**
- KPI cards com micro-gráficos sparkline
- Badges coloridos por tipo de estoque (Revenda, Matéria-prima, etc.)
- Barra de progresso sutil mostrando proporção vendável vs não-vendável

**Interaction Philosophy:** Filtros em tempo real com debounce. Ordenação por coluna. Busca fuzzy por descrição. Transições suaves mas rápidas.

**Animation:** Entrada escalonada dos cards (stagger 50ms). Transições de 200ms em hover. Números animam ao trocar de empresa.

**Typography System:** DM Sans para interface e títulos, Tabular Lining figures para dados numéricos. Pesos: 400 body, 500 labels, 700 títulos.

</text>
<probability>0.06</probability>
</response>

<response>
<text>

## Ideia 3: Warm Industrial Workspace

**Design Movement:** Organic Modernism — design industrial com toques quentes e humanos

**Core Principles:**
- Paleta terrosa que remete à matéria-prima (bambu, madeira)
- Cantos levemente arredondados, nunca totalmente retos nem excessivamente redondos
- Sombras com tom quente em vez de cinza neutro
- Dados organizados em "estações de trabalho" visuais

**Color Philosophy:** Background em warm cream (#fef7ed), cards em branco com sombra amber sutil. Primária em deep forest (#1b4332) evocando bambu e natureza. Secundária em terracotta (#c2410c) para ações e destaques. A paleta conecta o digital ao produto físico da empresa.

**Layout Paradigm:** Layout em "L" — navegação vertical à esquerda com ícones das empresas, conteúdo principal à direita. Seção superior com overview visual (donut charts por tipo), seção inferior com tabela detalhada. Breakpoints responsivos para tablet.

**Signature Elements:**
- Ícones customizados para cada empresa (palito, mesa, espeto, vareta)
- Gradiente sutil de cream para white nos backgrounds
- Divisores com pattern sutil de textura de bambu

**Interaction Philosophy:** Hover com elevação suave dos cards. Click para expandir detalhes inline. Transição fluida entre empresas com slide horizontal.

**Animation:** Micro-animações em hover (scale 1.02, shadow increase). Entrada com fade-up suave (300ms). Números com count-up animation ao carregar.

**Typography System:** Outfit para títulos (weight 600-700), Inter para corpo e dados (weight 400-500). Tamanhos: 2xl para KPIs, lg para subtítulos, sm para dados de tabela.

</text>
<probability>0.07</probability>
</response>

---

## Decisão

**Escolhida: Ideia 2 — Clean Operations Dashboard (Swiss Design)**

Motivo: É a abordagem mais funcional e profissional para um dashboard operacional que será usado diariamente pelo time. A hierarquia tipográfica clara, o grid rigoroso e as cores funcionais facilitam a leitura rápida dos dados. O design Swiss é atemporal e não cansa visualmente com uso frequente.
