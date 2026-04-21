import { getDb } from "./server/db.ts";
import { stockItems } from "./drizzle/schema.ts";

const db = await getDb();
const items = await db.select({
  codigoItem: stockItems.codigoItem,
  descricaoItem: stockItems.descricaoItem,
  quantidade: stockItems.quantidade,
  unidadeMedida: stockItems.unidadeMedida,
}).from(stockItems);

// Filter for ponta/chanfro 125
const chanfro125 = items.filter(i => i.descricaoItem && i.descricaoItem.includes('PONTA/CHANFRO') && i.descricaoItem.includes('125'));
console.log('=== PONTA/CHANFRO 125mm ===');
chanfro125.forEach(i => {
  // Extract units per box
  const match = i.descricaoItem.match(/C\/\s*([\d.]+)\s*(?:[xX]\s*([\d.]+))?\s*(?:UNID|UN)/i);
  let upb = 0;
  if (match) {
    const n1 = parseFloat(match[1].replace(/\./g, ''));
    const n2 = match[2] ? parseFloat(match[2].replace(/\./g, '')) : 1;
    upb = n1 * n2;
  }
  console.log(`  ${i.codigoItem} | ${i.descricaoItem} | qty=${i.quantidade} | un=${i.unidadeMedida} | upb=${upb}`);
});

process.exit(0);
