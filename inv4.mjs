import 'dotenv/config';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// 1. Pedidos do 00161 (5000 cx com fator 1)
const [ped161] = await conn.execute(`
  SELECT codigoItem, descricao, quantidade, quantidadeUnEstoque, fatorConversao, estadoNota, cliente, numeroPedido
  FROM order_items WHERE codigoItem = '00161'
`);
console.log('=== PEDIDOS DO 00161 ===');
for (const o of ped161) {
  console.log(`Ped ${o.numeroPedido} | Qtd: ${o.quantidade} | UnEstoque: ${o.quantidadeUnEstoque} | Fator: ${o.fatorConversao} | ${o.estadoNota} | ${o.cliente}`);
}

// 2. Stock_items do 00161
const [stock161] = await conn.execute(`
  SELECT codigoItem, descricaoItem, quantidade, unidadeDeVendaFator, unidadeMedida
  FROM stock_items WHERE codigoItem = '00161'
`);
console.log('\n=== STOCK_ITEMS 00161 ===');
for (const s of stock161) console.log(JSON.stringify(s));

// 3. Comparar com 00468 (fator 20000)
const [stock468] = await conn.execute(`
  SELECT codigoItem, descricaoItem, quantidade, unidadeDeVendaFator, unidadeMedida
  FROM stock_items WHERE codigoItem = '00468'
`);
console.log('\n=== STOCK_ITEMS 00468 ===');
for (const s of stock468) console.log(JSON.stringify(s));

// 4. Verificar: para produtos com UM=CX e fator=1, o quantidadeUnEstoque 
// deveria ser interpretado como CAIXAS, não unidades
// Mas o stockProcessor trata como unidades e divide por fator (1), resultando em valor inflado

// 5. Verificar a sales_orders para comparar
const [sales437] = await conn.execute(`
  SELECT pedido, cliente, estadoItem, SUM(CAST(quantidade AS DECIMAL(18,2))) as qtdTotal, SUM(CAST(valorTotal AS DECIMAL(18,2))) as valTotal
  FROM sales_orders
  WHERE pedido = '437'
  GROUP BY pedido, cliente, estadoItem
`);
console.log('\n=== SALES_ORDERS PED 437 ===');
for (const s of sales437) console.log(JSON.stringify(s));

// 6. Verificar quantos pedidos existem na sales_orders vs order_items
const [salesCount] = await conn.execute(`
  SELECT estadoItem, COUNT(DISTINCT pedido) as pedidos, SUM(CAST(quantidade AS DECIMAL(18,2))) as qtdTotal
  FROM sales_orders
  WHERE estadoItem IN ('A faturar', 'Faturado parcial')
  GROUP BY estadoItem
`);
console.log('\n=== SALES_ORDERS A FATURAR ===');
for (const s of salesCount) console.log(`${s.estadoItem}: ${s.pedidos} pedidos, Qtd: ${Number(s.qtdTotal).toLocaleString('pt-BR')}`);

// 7. Total de caixas na sales_orders (que é o que o usuário espera)
const [salesTotal] = await conn.execute(`
  SELECT SUM(CAST(quantidade AS DECIMAL(18,2))) as qtdTotal
  FROM sales_orders
  WHERE estadoItem IN ('A faturar', 'Faturado parcial')
`);
console.log(`\nTotal CX em sales_orders (A faturar): ${Number(salesTotal[0].qtdTotal).toLocaleString('pt-BR')}`);

await conn.end();
