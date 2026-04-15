import 'dotenv/config';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [ddData] = await conn.execute('SELECT dataJson FROM dashboard_data');

if (ddData.length > 0) {
  const items = JSON.parse(ddData[0].dataJson);
  console.log('Total produtos no dashboard_data:', items.length);
  
  // Contar por grupo
  const groups = {};
  for (const item of items) {
    const g = item.grupo || 'SEM GRUPO';
    if (!(g in groups)) groups[g] = { count: 0, estoqueCx: 0 };
    groups[g].count++;
    groups[g].estoqueCx += item.estoqueCx ?? 0;
  }
  console.log('\nProdutos por grupo:');
  for (const [g, v] of Object.entries(groups).sort((a,b) => b[1].count - a[1].count)) {
    console.log(`  ${g}: ${v.count} produtos, ${v.estoqueCx} cx`);
  }
  
  // Contar por segmento
  const segs = {};
  for (const item of items) {
    const s = item.segmento || 'SEM SEGMENTO';
    if (!(s in segs)) segs[s] = { count: 0, estoqueCx: 0 };
    segs[s].count++;
    segs[s].estoqueCx += item.estoqueCx ?? 0;
  }
  console.log('\nProdutos por segmento:');
  for (const [s, v] of Object.entries(segs).sort((a,b) => b[1].count - a[1].count)) {
    console.log(`  ${s}: ${v.count} produtos, ${v.estoqueCx} cx`);
  }
  
  // Verificar quais estão no stock_items (classificados) vs não
  // stock_items não tem coluna classificacao - usar o campo grupo do dashboard_data
  const [siRows] = await conn.execute('SELECT DISTINCT codigoItem FROM stock_items');
  const siSet = new Set(siRows.map(r => r.codigoItem));
  
  let inStock = 0, inSobEncomenda = 0, notClassified = 0, poOnly = 0;
  const notClassifiedItems = [];
  
  for (const item of items) {
    const inStockItems = siSet.has(item.codigoItem);
    if (inStockItems) {
      inStock++;
    } else {
      notClassified++;
      notClassifiedItems.push({
        codigo: item.codigoItem,
        desc: (item.descricaoItem || '').substring(0, 50),
        estoqueCx: item.estoqueCx,
        pedidosCx: item.pedidosCx,
        poCx: item.poCx,
        grupo: item.grupo,
      });
    }
  }
  
  console.log('\n--- Classificação ---');
  console.log(`Em stock_items: ${inStock}`);
  console.log(`NÃO em stock_items (extras): ${notClassified}`);
  console.log(`\nTotal: ${inStock} + ${notClassified} = ${inStock + notClassified}`);
  
  console.log('\nProdutos NÃO classificados (primeiros 30):');
  for (const item of notClassifiedItems.slice(0, 30)) {
    console.log(`  ${item.codigo} | ${item.desc} | est:${item.estoqueCx} ped:${item.pedidosCx} po:${item.poCx} | ${item.grupo}`);
  }
  
  // Verificar de onde vêm (estoque no Maxiprod, pedidos, POs)
  const withStock = notClassifiedItems.filter(i => i.estoqueCx > 0);
  const withOrders = notClassifiedItems.filter(i => i.pedidosCx > 0);
  const withPO = notClassifiedItems.filter(i => i.poCx > 0);
  const onlyPO = notClassifiedItems.filter(i => (i.estoqueCx ?? 0) === 0 && (i.pedidosCx ?? 0) === 0 && (i.poCx ?? 0) > 0);
  
  console.log(`\nNão classificados com estoque: ${withStock.length}`);
  console.log(`Não classificados com pedidos: ${withOrders.length}`);
  console.log(`Não classificados com PO: ${withPO.length}`);
  console.log(`Não classificados SÓ com PO (sem estoque/pedidos): ${onlyPO.length}`);
}

await conn.end();
