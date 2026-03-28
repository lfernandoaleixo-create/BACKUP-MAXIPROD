/*
 * Stock data - Grupo Fox Dashboard
 * Data collected: 2026-03-10
 * Cruzamento: Estoque (Grupos 20/21) x Pedidos de Venda (Aprovados + A aprovar)
 * Regras:
 *   - Produtos BAMBU: estoque real do Maxiprod
 *   - Produtos INDUSTRIALIZADOS: estoque = pedidos (sem negativo)
 *   - Chave de cruzamento: tipo + medidas + variante
 */

export interface StockItem {
  stockKey: string;
  produto: string;         // Nome limpo do produto
  medida: string;          // Ex: "4,5 x 280 mm"
  variante: string;        // Ex: "Meia Ponta", "Casca Verde", "Ponta/Chanfro"
  categoria: string;       // Ex: "Espetos de Bambu", "Palitos de Unha"
  tipo: "BAMBU" | "INDUSTRIALIZADO" | "BAMBU_SEM_ESTOQUE";
  codigos: string[];       // Códigos no Maxiprod
  unidadesPorCaixa: number | null;
  estoqueUn: number;
  estoqueCx: number | null;
  pedidosUn: number;
  pedidosCx: number | null;
  disponivelUn: number;
  disponivelCx: number | null;
  empresa: string;
}

export interface CompanyData {
  id: string;
  nome: string;
  nomeCompleto: string;
  cnpj: string;
  itens: StockItem[];
}

// Helper to format stock key into readable product name
function formatProduto(key: string): { produto: string; medida: string; variante: string; categoria: string } {
  const parts = key.split("|");
  const type = parts[0];
  const dims = parts[1] || "";
  const variant = parts[2] || "";

  let produto = "";
  let medida = "";
  let variante = "";
  let categoria = "";

  // Format dimensions
  if (dims && dims !== "UNKNOWN" && dims !== "PADRAO" && dims !== "ZERADO" && dims !== "20CM" && dims !== "INDIVIDUAL" && !dims.includes("KG")) {
    const [d, l] = dims.split("x");
    medida = `${d.replace(".", ",")} x ${l} mm`;
  }

  switch (type) {
    case "ESPETO":
      produto = "Espeto de Bambu";
      categoria = "Espetos de Bambu";
      break;
    case "ESPETO_QUEIJO":
      produto = "Espeto p/ Queijo Coalho";
      categoria = "Espetos Queijo Coalho";
      break;
    case "PALITO_DENTE":
      produto = "Palito de Dente";
      categoria = "Palitos de Dente";
      if (dims === "INDIVIDUAL") {
        variante = "Embalado Individualmente";
        medida = "";
      } else {
        medida = "20x25x100";
      }
      break;
    case "PALITO_UNHA":
      produto = "Palito de Unha / Manicure";
      categoria = "Palitos de Unha";
      break;
    case "HASHI":
      produto = "Hashi de Bambu";
      categoria = "Hashi";
      medida = "20 cm";
      break;
    case "VARETA_BAMBU":
      produto = "Vareta de Bambu";
      categoria = "Varetas de Bambu";
      if (dims?.includes("KG")) {
        medida = "3,0 x 350 mm (PCT 30KG)";
      }
      break;
    case "VARETA_FIBRA":
      produto = "Vareta Difusora de Fibra";
      categoria = "Varetas Difusoras (Fibra)";
      break;
    case "VARETA_MULTIUSO":
      produto = "Vareta Multiuso";
      categoria = "Varetas Multiuso";
      break;
    case "VARETA_AROMATIZADOR":
      produto = "Vareta Aromatizador";
      categoria = "Varetas Aromatizador";
      break;
    case "PALITO_KAFTA":
      produto = "Palito de Bambu p/ Kafta";
      categoria = "Palitos Kafta";
      medida = "4x6 25cm";
      break;
    default:
      produto = type.replace(/_/g, " ");
      categoria = "Outros";
  }

  // Format variant
  switch (variant) {
    case "MEIA_PONTA":
      variante = "Meia Ponta";
      break;
    case "CASCA_VERDE":
      variante = "Casca Verde";
      break;
    case "ZECA":
      variante = "Marca ZECA";
      break;
    case "BAMBUSA":
      variante = "Marca BAMBUSA";
      break;
    case "PONTA_CHANFRO":
      variante = "Ponta/Chanfro";
      break;
    case "PONTA_PONTA":
      variante = "Ponta/Ponta";
      break;
    case "SEM_PONTA":
      variante = "Sem Ponta";
      break;
    case "INDIVIDUAL":
      variante = "Embalado Individualmente";
      break;
  }

  return { produto, medida, variante, categoria };
}

// === RAW DATA ===
interface RawStockData {
  stockKey: string;
  codigos: string[];
  tipo: "BAMBU" | "INDUSTRIALIZADO" | "BAMBU_SEM_ESTOQUE";
  estoqueUn: number;
  pedidosUn: number;
  disponivelUn: number;
  upb: number | null;
  estoqueCx: number | null;
  pedidosCx: number | null;
  disponivelCx: number | null;
}

const rawData: RawStockData[] = [
  // === ESPETOS DE BAMBU ===
  { stockKey: "ESPETO|3.5x120", codigos: ["00135"], tipo: "BAMBU", estoqueUn: 1450000, pedidosUn: 70000, disponivelUn: 1380000, upb: 10000, estoqueCx: 145, pedidosCx: 7, disponivelCx: 138 },
  { stockKey: "ESPETO|3.5x180", codigos: ["00133"], tipo: "BAMBU", estoqueUn: 540000, pedidosUn: 50000, disponivelUn: 490000, upb: 10000, estoqueCx: 54, pedidosCx: 5, disponivelCx: 49 },
  { stockKey: "ESPETO|4.0x200", codigos: ["00116"], tipo: "BAMBU", estoqueUn: 2450000, pedidosUn: 0, disponivelUn: 2450000, upb: 5000, estoqueCx: 490, pedidosCx: 0, disponivelCx: 490 },
  { stockKey: "ESPETO|4.0x200|MEIA_PONTA", codigos: ["00117"], tipo: "BAMBU", estoqueUn: 1425000, pedidosUn: 0, disponivelUn: 1425000, upb: 5000, estoqueCx: 285, pedidosCx: 0, disponivelCx: 285 },
  { stockKey: "ESPETO|4.0x220", codigos: ["00115"], tipo: "BAMBU", estoqueUn: 3555000, pedidosUn: 65000, disponivelUn: 3490000, upb: 5000, estoqueCx: 711, pedidosCx: 13, disponivelCx: 698 },
  { stockKey: "ESPETO|4.0x220|MEIA_PONTA", codigos: ["00114"], tipo: "BAMBU", estoqueUn: 740000, pedidosUn: 0, disponivelUn: 740000, upb: 5000, estoqueCx: 148, pedidosCx: 0, disponivelCx: 148 },
  // ZECA 4,0x250 - estoque separado (embalagem marca do cliente)
  { stockKey: "ESPETO|4.0x250|ZECA", codigos: ["00269"], tipo: "BAMBU", estoqueUn: 3640000, pedidosUn: 0, disponivelUn: 3640000, upb: 5000, estoqueCx: 728, pedidosCx: 0, disponivelCx: 728 },
  // Genérico 4,0x250 - sem estoque próprio, pedidos ficam negativos
  { stockKey: "ESPETO|4.0x250", codigos: [], tipo: "BAMBU_SEM_ESTOQUE", estoqueUn: 0, pedidosUn: 5250000, disponivelUn: -5250000, upb: 5000, estoqueCx: 0, pedidosCx: 1050, disponivelCx: -1050 },
  { stockKey: "ESPETO|4.0x250|MEIA_PONTA", codigos: ["00178"], tipo: "BAMBU", estoqueUn: 70000, pedidosUn: 210000, disponivelUn: -140000, upb: 5000, estoqueCx: 14, pedidosCx: 42, disponivelCx: -28 },
  // ZECA 4,0x280 - estoque separado (embalagem marca do cliente)
  { stockKey: "ESPETO|4.0x280|ZECA", codigos: ["00270"], tipo: "BAMBU", estoqueUn: 2520000, pedidosUn: 0, disponivelUn: 2520000, upb: 5000, estoqueCx: 504, pedidosCx: 0, disponivelCx: 504 },
  // Genérico 4,0x280 - estoque do item 00126
  { stockKey: "ESPETO|4.0x280", codigos: ["00126"], tipo: "BAMBU", estoqueUn: 575000, pedidosUn: 240000, disponivelUn: 335000, upb: 5000, estoqueCx: 115, pedidosCx: 48, disponivelCx: 67 },
  { stockKey: "ESPETO|4.0x300", codigos: ["00125"], tipo: "BAMBU", estoqueUn: 3250000, pedidosUn: 260000, disponivelUn: 2990000, upb: 5000, estoqueCx: 650, pedidosCx: 52, disponivelCx: 598 },
  { stockKey: "ESPETO|4.5x250", codigos: ["00123"], tipo: "BAMBU", estoqueUn: 1765000, pedidosUn: 395000, disponivelUn: 1370000, upb: 5000, estoqueCx: 353, pedidosCx: 79, disponivelCx: 274 },
  { stockKey: "ESPETO|4.5x250|MEIA_PONTA", codigos: ["00122"], tipo: "BAMBU", estoqueUn: 1520000, pedidosUn: 10000, disponivelUn: 1510000, upb: 5000, estoqueCx: 304, pedidosCx: 2, disponivelCx: 302 },
  { stockKey: "ESPETO|4.5x280", codigos: ["00118"], tipo: "BAMBU", estoqueUn: 7265000, pedidosUn: 185000, disponivelUn: 7080000, upb: 5000, estoqueCx: 1453, pedidosCx: 37, disponivelCx: 1416 },
  { stockKey: "ESPETO|4.5x300", codigos: ["00179"], tipo: "BAMBU", estoqueUn: 3730000, pedidosUn: 175000, disponivelUn: 3555000, upb: 5000, estoqueCx: 746, pedidosCx: 35, disponivelCx: 711 },
  { stockKey: "ESPETO|4.5x300|CASCA_VERDE", codigos: ["00192"], tipo: "BAMBU", estoqueUn: 2500000, pedidosUn: 50000, disponivelUn: 2450000, upb: 5000, estoqueCx: 500, pedidosCx: 10, disponivelCx: 490 },
  { stockKey: "ESPETO|5.0x280", codigos: ["00134"], tipo: "BAMBU", estoqueUn: 480000, pedidosUn: 0, disponivelUn: 480000, upb: 5000, estoqueCx: 96, pedidosCx: 0, disponivelCx: 96 },
  { stockKey: "ESPETO|5.0x300", codigos: ["00121"], tipo: "BAMBU", estoqueUn: 5000, pedidosUn: 310000, disponivelUn: -305000, upb: 5000, estoqueCx: 1, pedidosCx: 62, disponivelCx: -61 },
  { stockKey: "ESPETO|5.0x330", codigos: ["00120"], tipo: "BAMBU", estoqueUn: 880000, pedidosUn: 5000, disponivelUn: 875000, upb: 5000, estoqueCx: 176, pedidosCx: 1, disponivelCx: 175 },
  { stockKey: "ESPETO|5.0x350", codigos: ["00119"], tipo: "BAMBU", estoqueUn: 2490000, pedidosUn: 0, disponivelUn: 2490000, upb: 5000, estoqueCx: 498, pedidosCx: 0, disponivelCx: 498 },
  // === ESPETO CASCA VERDE SEM ESTOQUE ===
  { stockKey: "ESPETO|4.5x250|CASCA_VERDE", codigos: [], tipo: "BAMBU_SEM_ESTOQUE", estoqueUn: 0, pedidosUn: 500000, disponivelUn: -500000, upb: 5000, estoqueCx: 0, pedidosCx: 100, disponivelCx: -100 },
  // === PALITOS DE DENTE ===
  { stockKey: "PALITO_DENTE|PADRAO", codigos: ["00211"], tipo: "BAMBU", estoqueUn: 28950000, pedidosUn: 55000, disponivelUn: 28895000, upb: 50000, estoqueCx: 579, pedidosCx: 1, disponivelCx: 578 },
  { stockKey: "PALITO_DENTE|INDIVIDUAL", codigos: ["00213"], tipo: "BAMBU", estoqueUn: 14900000, pedidosUn: 700000, disponivelUn: 14200000, upb: 50000, estoqueCx: 298, pedidosCx: 14, disponivelCx: 284 },
  // === PALITOS DE UNHA ===
  { stockKey: "PALITO_UNHA|4.0x125|PONTA_CHANFRO", codigos: ["00201"], tipo: "BAMBU", estoqueUn: 6620000, pedidosUn: 2420000, disponivelUn: 4200000, upb: 10000, estoqueCx: 662, pedidosCx: 242, disponivelCx: 420 },
  { stockKey: "PALITO_UNHA|4.0x125|PONTA_PONTA", codigos: ["00113"], tipo: "BAMBU", estoqueUn: 460000, pedidosUn: 0, disponivelUn: 460000, upb: 10000, estoqueCx: 46, pedidosCx: 0, disponivelCx: 46 },
  { stockKey: "PALITO_UNHA|5.0x140|PONTA_CHANFRO", codigos: ["00202"], tipo: "BAMBU", estoqueUn: 3800000, pedidosUn: 20000, disponivelUn: 3780000, upb: 10000, estoqueCx: 380, pedidosCx: 2, disponivelCx: 378 },
  { stockKey: "PALITO_UNHA|5.0x140|PONTA_PONTA", codigos: ["00197"], tipo: "BAMBU", estoqueUn: 3960000, pedidosUn: 0, disponivelUn: 3960000, upb: 10000, estoqueCx: 396, pedidosCx: 0, disponivelCx: 396 },
  { stockKey: "PALITO_UNHA|5.0x160|PONTA_PONTA", codigos: ["00132"], tipo: "BAMBU", estoqueUn: 940000, pedidosUn: 0, disponivelUn: 940000, upb: 10000, estoqueCx: 94, pedidosCx: 0, disponivelCx: 94 },
  { stockKey: "PALITO_UNHA|5.0x180|PONTA_PONTA", codigos: ["00204"], tipo: "BAMBU", estoqueUn: 1060000, pedidosUn: 125000, disponivelUn: 935000, upb: 5000, estoqueCx: 212, pedidosCx: 25, disponivelCx: 187 },
  // === HASHI ===
  { stockKey: "HASHI|20CM", codigos: ["00200"], tipo: "BAMBU", estoqueUn: 146000, pedidosUn: 36000, disponivelUn: 110000, upb: 2000, estoqueCx: 73, pedidosCx: 18, disponivelCx: 55 },
  // === VARETAS DE BAMBU ===
  { stockKey: "VARETA_BAMBU|3.0x350|KG", codigos: ["00207"], tipo: "BAMBU", estoqueUn: 300, pedidosUn: 0, disponivelUn: 300, upb: null, estoqueCx: null, pedidosCx: null, disponivelCx: null },
  { stockKey: "VARETA_BAMBU|4.0x350", codigos: ["00208"], tipo: "BAMBU", estoqueUn: 2320000, pedidosUn: 125000, disponivelUn: 2195000, upb: 10000, estoqueCx: 232, pedidosCx: 13, disponivelCx: 220 },
  // === VARETA FIBRA ===
  { stockKey: "VARETA_FIBRA|3.0x200", codigos: ["00212"], tipo: "BAMBU", estoqueUn: 15100000, pedidosUn: 0, disponivelUn: 15100000, upb: 20000, estoqueCx: 755, pedidosCx: 0, disponivelCx: 755 },
  // === VARETAS MULTIUSO ===
  { stockKey: "VARETA_MULTIUSO|3.8x200", codigos: ["00210"], tipo: "BAMBU", estoqueUn: 660000, pedidosUn: 65000, disponivelUn: 595000, upb: 10000, estoqueCx: 66, pedidosCx: 7, disponivelCx: 60 },
  { stockKey: "VARETA_MULTIUSO|3.8x250", codigos: ["00209"], tipo: "BAMBU", estoqueUn: 740000, pedidosUn: 0, disponivelUn: 740000, upb: 10000, estoqueCx: 74, pedidosCx: 0, disponivelCx: 74 },
  // === PALITO KAFTA (estoque zerado) ===
  { stockKey: "PALITO_KAFTA|ZERADO", codigos: [], tipo: "BAMBU_SEM_ESTOQUE", estoqueUn: 0, pedidosUn: 250, disponivelUn: -250, upb: 5000, estoqueCx: 0, pedidosCx: 0, disponivelCx: 0 },
  // === INDUSTRIALIZADOS ===
  { stockKey: "ESPETO_QUEIJO|3.5x200", codigos: [], tipo: "INDUSTRIALIZADO", estoqueUn: 100000, pedidosUn: 100000, disponivelUn: 0, upb: 10000, estoqueCx: 10, pedidosCx: 10, disponivelCx: 0 },
  { stockKey: "ESPETO_QUEIJO|4.0x200", codigos: [], tipo: "INDUSTRIALIZADO", estoqueUn: 2160025, pedidosUn: 2160025, disponivelUn: 0, upb: 10000, estoqueCx: 216, pedidosCx: 216, disponivelCx: 0 },
  { stockKey: "VARETA_AROMATIZADOR|3.5x200", codigos: [], tipo: "INDUSTRIALIZADO", estoqueUn: 500000, pedidosUn: 500000, disponivelUn: 0, upb: 10000, estoqueCx: 50, pedidosCx: 50, disponivelCx: 0 },
  { stockKey: "VARETA_AROMATIZADOR|4.0x180", codigos: [], tipo: "INDUSTRIALIZADO", estoqueUn: 3600002, pedidosUn: 3600002, disponivelUn: 0, upb: 10000, estoqueCx: 360, pedidosCx: 360, disponivelCx: 0 },
  { stockKey: "VARETA_AROMATIZADOR|4.0x200", codigos: [], tipo: "INDUSTRIALIZADO", estoqueUn: 10000, pedidosUn: 10000, disponivelUn: 0, upb: 10000, estoqueCx: 1, pedidosCx: 1, disponivelCx: 0 },
  { stockKey: "VARETA_AROMATIZADOR|4.0x250", codigos: [], tipo: "INDUSTRIALIZADO", estoqueUn: 1380004, pedidosUn: 1380004, disponivelUn: 0, upb: 10000, estoqueCx: 138, pedidosCx: 138, disponivelCx: 0 },
  { stockKey: "VARETA_AROMATIZADOR|4.0x300", codigos: [], tipo: "INDUSTRIALIZADO", estoqueUn: 5000, pedidosUn: 5000, disponivelUn: 0, upb: 5000, estoqueCx: 1, pedidosCx: 1, disponivelCx: 0 },
  { stockKey: "VARETA_AROMATIZADOR|4.0x350", codigos: [], tipo: "INDUSTRIALIZADO", estoqueUn: 5000, pedidosUn: 5000, disponivelUn: 0, upb: 5000, estoqueCx: 1, pedidosCx: 1, disponivelCx: 0 },
  { stockKey: "OUTRO|3.5x200", codigos: [], tipo: "INDUSTRIALIZADO", estoqueUn: 7202, pedidosUn: 7202, disponivelUn: 0, upb: null, estoqueCx: null, pedidosCx: null, disponivelCx: null },
  { stockKey: "OUTRO|7.0x1000", codigos: [], tipo: "INDUSTRIALIZADO", estoqueUn: 1000, pedidosUn: 1000, disponivelUn: 0, upb: null, estoqueCx: null, pedidosCx: null, disponivelCx: null },
  { stockKey: "OUTRO|UNKNOWN", codigos: [], tipo: "INDUSTRIALIZADO", estoqueUn: 101, pedidosUn: 101, disponivelUn: 0, upb: null, estoqueCx: null, pedidosCx: null, disponivelCx: null },
];

function processData(): StockItem[] {
  return rawData.map(item => {
    const { produto, medida, variante, categoria } = formatProduto(item.stockKey);
    return {
      stockKey: item.stockKey,
      produto,
      medida,
      variante,
      categoria,
      tipo: item.tipo,
      codigos: item.codigos,
      unidadesPorCaixa: item.upb,
      estoqueUn: item.estoqueUn,
      estoqueCx: item.estoqueCx,
      pedidosUn: item.pedidosUn,
      pedidosCx: item.pedidosCx,
      disponivelUn: item.disponivelUn,
      disponivelCx: item.disponivelCx,
      empresa: "PALITOS INDUSTRIA",
    };
  });
}

const allItems = processData();

export const companies: CompanyData[] = [
  {
    id: "palitos",
    nome: "Palitos Industria",
    nomeCompleto: "PALITOS INDUSTRIA E COMERCIO LTDA",
    cnpj: "36.562.762/0001-29",
    itens: allItems,
  },
  {
    id: "mesa",
    nome: "Mesa Industria",
    nomeCompleto: "MESA INDUSTRIA",
    cnpj: "52.888.511/0001-95",
    itens: [],
  },
  {
    id: "espetos",
    nome: "Espetos Industria",
    nomeCompleto: "ESPETOS INDUSTRIA E COMERCIO LTDA",
    cnpj: "50.128.808/0001-27",
    itens: [],
  },
  {
    id: "varetas",
    nome: "Varetas Industria",
    nomeCompleto: "VARETAS INDUSTRIA",
    cnpj: "45.558.059/0001-38",
    itens: [],
  },
];

export function getAllItems(): StockItem[] {
  return companies.flatMap(c => c.itens);
}

export function getBambuItems(): StockItem[] {
  return allItems.filter(i => i.tipo === "BAMBU" || i.tipo === "BAMBU_SEM_ESTOQUE");
}

export function getIndustrializadoItems(): StockItem[] {
  return allItems.filter(i => i.tipo === "INDUSTRIALIZADO");
}

export function getCategories(items: StockItem[]): string[] {
  const cats = new Set<string>();
  items.forEach(i => cats.add(i.categoria));
  return Array.from(cats).sort();
}
