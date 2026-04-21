import { getDb } from "./server/db.ts";
import { stockItems } from "./drizzle/schema.ts";

const db = await getDb();
const items = await db.select({
  codigoItem: stockItems.codigoItem,
  descricaoItem: stockItems.descricaoItem,
  quantidade: stockItems.quantidade,
  unidadeMedida: stockItems.unidadeMedida,
  grupoCodigo: stockItems.grupoCodigo,
  superGrupoCodigo: stockItems.superGrupoCodigo,
}).from(stockItems);

// Filter for palito manicure duas pontas 4,0 x 125
const palito125dp = items.filter(i => i.descricaoItem && i.descricaoItem.includes('MANICURE DUAS PONTAS') && i.descricaoItem.includes('125'));
console.log('=== PALITO MANICURE DUAS PONTAS 125mm ===');
palito125dp.forEach(i => console.log(JSON.stringify(i)));

// Filter for palito manicure ponta/chanfro 4,0 x 125
const palito125pc = items.filter(i => i.descricaoItem && i.descricaoItem.includes('PONTA/CHANFRO') && i.descricaoItem.includes('125'));
console.log('\n=== PALITO MANICURE PONTA/CHANFRO 125mm ===');
palito125pc.forEach(i => console.log(JSON.stringify(i)));

// Filter for vareta aromatizador fibra
const fibra = items.filter(i => i.descricaoItem && i.descricaoItem.includes('AROMATIZADOR FIBRA'));
console.log('\n=== VARETA AROMATIZADOR FIBRA ===');
fibra.forEach(i => console.log(JSON.stringify(i)));

// Filter for vareta fibra 200mm preta (the parent)
const fibra200 = items.filter(i => i.descricaoItem && i.descricaoItem.includes('FIBRA PARA AROMATIZADOR'));
console.log('\n=== VARETA DE FIBRA PARA AROMATIZADOR ===');
fibra200.forEach(i => console.log(JSON.stringify(i)));

// All PC items in import
const pcItems = items.filter(i => i.unidadeMedida === 'PC');
console.log('\n=== ALL PC ITEMS ===');
pcItems.forEach(i => console.log(JSON.stringify(i)));

process.exit(0);
