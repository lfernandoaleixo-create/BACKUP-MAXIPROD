import 'dotenv/config';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [ddData] = await conn.execute('SELECT dataJson FROM dashboard_data');

if (ddData.length > 0) {
  const items = JSON.parse(ddData[0].dataJson);
  const parents = items.filter(i => i.isChild !== true);
  const children = items.filter(i => i.isChild === true);
  console.log('Total:', items.length);
  console.log('Pais (parentOnlyItems):', parents.length);
  console.log('Filhos (isChild):', children.length);
  
  const visibleParents = parents;
  console.log('Visíveis pais (= parentOnlyItems no KPI):', visibleParents.length);
  
  // Grupos dos visíveis pais
  const grp = {};
  for (const i of visibleParents) {
    const g = i.grupo || 'SEM';
    grp[g] = (grp[g] || 0) + 1;
  }
  console.log('Grupos dos visíveis pais:', JSON.stringify(grp));
  
  // Estoque vs Sob Encomenda
  const [classRows] = await conn.execute('SELECT codigoItem, tipoDecodificado FROM stock_items');
  const classMap = new Map(classRows.map(r => [r.codigoItem, r.tipoDecodificado]));
  
  let estoque = 0, encomenda = 0, madeira = 0, other = 0;
  for (const i of visibleParents) {
    if (i.grupo === 'industrializacao') { madeira++; continue; }
    const tipo = classMap.get(i.codigoItem);
    if (tipo === 'estoque') estoque++;
    else if (tipo === 'encomenda') encomenda++;
    else other++;
  }
  console.log(`\nEstoque: ${estoque}, Sob Encomenda: ${encomenda}, Madeira: ${madeira}, Outros: ${other}`);
  console.log(`Soma: ${estoque + encomenda + madeira + other}`);
  
  // Listar os "outros" que não são estoque nem encomenda nem madeira
  console.log('\nProdutos "outros" (não classificados):');
  for (const i of visibleParents) {
    if (i.grupo === 'industrializacao') continue;
    const tipo = classMap.get(i.codigoItem);
    if (tipo !== 'estoque' && tipo !== 'encomenda') {
      console.log(`  ${i.codigoItem} | ${(i.descricaoItem || '').substring(0, 60)} | grupo: ${i.grupo} | tipo: ${tipo || 'N/A'} | est:${i.estoqueCx} ped:${i.pedidosCx} po:${i.poCx}`);
    }
  }
}

await conn.end();
