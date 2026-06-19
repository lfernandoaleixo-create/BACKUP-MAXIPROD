/**
 * Ingest data extracted from Maxiprod browser sessions into the database.
 * 
 * Usage: node server/ingestBrowserData.mjs [stockFile] [orderItemsFile] [poItemsFile] [salesOrdersFile]
 * 
 * This script reads JSON files extracted from the Maxiprod browser and inserts
 * them into the database tables, then triggers the stock processor.
 */
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/mysql2';
import { sql } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const db = drizzle(DATABASE_URL);

// Parse Brazilian number format: "1.234,56" -> 1234.56
function parseBrNumber(str) {
  if (!str || str === '—' || str === '-' || str === '') return '0';
  return str.replace(/\./g, '').replace(',', '.');
}

function esc(val) {
  if (val === null || val === undefined) return 'NULL';
  const escaped = String(val).replace(/'/g, "''").replace(/\\/g, '\\\\');
  return `'${escaped}'`;
}

async function ingestStock(filePath) {
  const fs = await import('fs');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  console.log(`[Ingest] Loading ${data.length} stock items from ${filePath}`);

  // Only delete items that have a maxiprodId (from Maxiprod sync) to preserve manually added products
  // Note: ingestBrowserData doesn't set maxiprodId, so we delete all and re-insert
  // Manual products (00522-00527 etc) will need to be re-inserted if this script is run
  await db.execute(sql`DELETE FROM stock_items`);

  for (let i = 0; i < data.length; i += 20) {
    const batch = data.slice(i, i + 20);
    const values = batch.map(item => `(
      ${esc(item.item)},
      ${esc(item.descricao)},
      ${parseBrNumber(item.qtd)},
      ${esc(item.unid)},
      ${parseBrNumber(item.custoUnit)},
      ${parseBrNumber(item.custoTotal)},
      ${esc(item.grupo)},
      ${esc('')},
      ${esc(item.superGrupo)},
      ${esc('')},
      ${esc(item.empresa || 'PALITOS INDUSTRIA')},
      ${esc('')},
      ${esc(item.tipoEstoque || '')},
      NULL,
      NOW()
    )`).join(',');

    await db.execute(sql.raw(`INSERT INTO stock_items 
      (codigoItem, descricaoItem, quantidade, unidadeMedida, custoUnitario, custoTotal, 
       codigoGrupo, descricaoGrupo, codigoSuperGrupo, descricaoSuperGrupo, 
       empresaDona, estoqueLocal, tipoDecodificado, maxiprodId, collectedAt) 
      VALUES ${values}`));
  }
  console.log(`[Ingest] Inserted ${data.length} stock items`);
}

async function ingestOrderItems(filePath) {
  const fs = await import('fs');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  console.log(`[Ingest] Loading ${data.length} order items from ${filePath}`);

  await db.execute(sql`DELETE FROM order_items`);

  for (let i = 0; i < data.length; i += 20) {
    const batch = data.slice(i, i + 20);
    const values = batch.map(item => `(
      ${esc(item.item || '')},
      ${esc(item.descricao || '')},
      ${parseBrNumber(item.quantidade)},
      ${esc(item.unid || 'CX')},
      ${esc(item.estado || '')},
      ${esc(item.estadoItem || '')},
      ${esc(item.pedido || '')},
      ${esc(item.cliente || '')},
      ${esc(item.emissao || '')},
      ${parseBrNumber(item.valorUn)},
      ${parseBrNumber(item.valorTotal)},
      ${esc(item.grupo || '')},
      ${esc('PALITOS INDUSTRIA')},
      NULL,
      NULL,
      NULL,
      NOW()
    )`).join(',');

    await db.execute(sql.raw(`INSERT INTO order_items 
      (codigoItem, descricao, quantidade, unidadeMedida, estadoNota, estadoItem,
       numeroPedido, cliente, dataEmissao, valorUnitario, valorTotal,
       codigoGrupo, empresaDona, fatorConversao, quantidadeUnEstoque, maxiprodId, collectedAt) 
      VALUES ${values}`));
  }
  console.log(`[Ingest] Inserted ${data.length} order items`);
}

async function ingestPOItems(filePath) {
  const fs = await import('fs');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  console.log(`[Ingest] Loading ${data.length} PO items from ${filePath}`);

  await db.execute(sql`DELETE FROM purchase_order_items`);

  for (let i = 0; i < data.length; i += 20) {
    const batch = data.slice(i, i + 20);
    const values = batch.map(item => {
      const fator = parseBrNumber(item.fatorConversao);
      const qtdUnEstoque = parseBrNumber(item.quantidadeUnEstoque);
      return `(
        ${esc(item.descricao || '')},
        ${parseBrNumber(item.quantidade)},
        ${qtdUnEstoque},
        ${fator},
        ${esc(item.unidade || 'CX')},
        ${esc(item.unidadeEstoque || 'un')},
        ${esc(item.entrega || '')},
        ${esc(item.emissao || '')},
        ${esc(item.estadoPedido || '')},
        ${esc(item.estadoItem || '')},
        ${esc(item.fornecedor || '')},
        ${parseBrNumber(item.valorTotal)},
        ${parseBrNumber(item.valorUnitario)},
        ${esc(item.pedido || '')},
        ${esc(item.referencia || '')},
        ${item.numero ? parseInt(item.numero) : 'NULL'},
        ${esc(item.grupo || '')},
        NULL,
        ${esc('PALITOS INDUSTRIA')},
        NULL,
        NOW()
      )`;
    }).join(',');

    await db.execute(sql.raw(`INSERT INTO purchase_order_items 
      (descricao, quantidade, quantidadeUnEstoque, fatorConversao,
       unidadeMedida, unidadeMedidaEstoque, dataEntrega, dataEmissao,
       estadoPedido, estadoItem, fornecedor, valorTotal, valorUnitario,
       numeroPedido, referencia, numeroItem, codigoGrupo, codigoCFOP,
       empresaDona, maxiprodId, collectedAt) 
      VALUES ${values}`));
  }
  console.log(`[Ingest] Inserted ${data.length} PO items`);
}

// Convert Brazilian date format DD/MM/YY to ISO YYYY-MM-DD
function parseBrDate(dateStr) {
  if (!dateStr) return null;
  // Format: DD/MM/YY
  const parts = dateStr.split('/');
  if (parts.length !== 3) return dateStr;
  const day = parts[0].padStart(2, '0');
  const month = parts[1].padStart(2, '0');
  let year = parts[2];
  // Convert 2-digit year to 4-digit
  if (year.length === 2) {
    year = parseInt(year) > 50 ? '19' + year : '20' + year;
  }
  return `${year}-${month}-${day}`;
}

async function ingestSalesOrders(filePath) {
  const fs = await import('fs');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  console.log(`[Ingest] Loading ${data.length} sales order items from ${filePath}`);

  await db.execute(sql`DELETE FROM sales_orders`);

  for (let i = 0; i < data.length; i += 20) {
    const batch = data.slice(i, i + 20);
    const values = batch.map(item => {
      const isoEmissao = parseBrDate(item.emissao);
      const isoEntrega = parseBrDate(item.entrega);
      return `(
        ${esc(isoEmissao)},
        ${esc(isoEntrega)},
        NULL,
        ${esc(item.pedido || '')},
        ${esc(item.cliente || '')},
        NULL,
        ${esc(item.uf || '')},
        ${esc(item.descricao || '')},
        ${esc(item.estadoItem || '')},
        ${parseBrNumber(item.quantidade)},
        ${parseBrNumber(item.valorUn)},
        ${parseBrNumber(item.valorTotal)},
        NULL,
        ${parseBrNumber(item.vlAFaturar)},
        NULL,
        ${esc(item.grupo || '')},
        NULL,
        ${esc('PALITOS INDUSTRIA')},
        ${esc('')},
        ${esc(item.equipe || '')},
        NULL,
        NOW()
      )`;
    }).join(',');

    await db.execute(sql.raw(`INSERT INTO sales_orders 
      (dataEmissao, dataEntrega, dataAprovacao, pedido, cliente, clienteApelido,
       uf, descricao, estadoItem, quantidade, valorUnitario, valorTotal,
       valorContabil, valorFaturar, fatorConversao, codigoGrupo, idGrupoItem,
       empresa, representante, segmento, regiao, collectedAt) 
      VALUES ${values}`));
  }
  console.log(`[Ingest] Inserted ${data.length} sales order items`);
}

async function updateScraperStatus(stockCount, orderCount, poCount, salesCount) {
  const existing = await db.execute(sql`SELECT id FROM scraper_status LIMIT 1`);
  const rows = existing[0];
  
  const statusMsg = `OK ${stockCount}est ${orderCount}ped ${poCount}PO ${salesCount}vnd`;
  
  if (Array.isArray(rows) && rows.length > 0) {
    await db.execute(sql`UPDATE scraper_status SET 
      isConnected = 1, 
      lastSyncAt = NOW(), 
      lastSyncStatus = ${statusMsg},
      lastError = NULL,
      needsMfa = 0
      WHERE id = ${rows[0].id}`);
  } else {
    await db.execute(sql`INSERT INTO scraper_status 
      (isConnected, lastSyncAt, lastSyncStatus, lastError, needsMfa) 
      VALUES (1, NOW(), ${statusMsg}, NULL, 0)`);
  }
  console.log('[Ingest] Scraper status updated');
}

async function main() {
  const args = process.argv.slice(2);
  const stockFile = args[0] || '/home/ubuntu/Downloads/maxiprod_stock_data.json';
  const orderItemsFile = args[1] || '/home/ubuntu/Downloads/maxiprod_order_items.json';
  const poItemsFile = args[2] || '/home/ubuntu/Downloads/maxiprod_po_items.json';
  const salesOrdersFile = args[3] || '/home/ubuntu/Downloads/maxiprod_order_items.json';

  const fs = await import('fs');

  let stockCount = 0, orderCount = 0, poCount = 0, salesCount = 0;

  if (fs.existsSync(stockFile)) {
    await ingestStock(stockFile);
    stockCount = JSON.parse(fs.readFileSync(stockFile, 'utf-8')).length;
  }

  if (fs.existsSync(orderItemsFile)) {
    await ingestOrderItems(orderItemsFile);
    orderCount = JSON.parse(fs.readFileSync(orderItemsFile, 'utf-8')).length;
  }

  if (fs.existsSync(poItemsFile)) {
    await ingestPOItems(poItemsFile);
    poCount = JSON.parse(fs.readFileSync(poItemsFile, 'utf-8')).length;
  }

  if (fs.existsSync(salesOrdersFile)) {
    await ingestSalesOrders(salesOrdersFile);
    salesCount = JSON.parse(fs.readFileSync(salesOrdersFile, 'utf-8')).length;
  }

  await updateScraperStatus(stockCount, orderCount, poCount, salesCount);

  console.log('[Ingest] Done! Now triggering stock processor via API...');
  
  try {
    const resp = await fetch('http://localhost:3000/api/trpc/dashboard.reprocess', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const result = await resp.json();
    console.log('[Ingest] Reprocess result:', JSON.stringify(result));
  } catch (e) {
    console.log('[Ingest] Could not trigger reprocess via API, will need manual trigger');
  }

  process.exit(0);
}

main().catch(err => {
  console.error('[Ingest] Fatal error:', err);
  process.exit(1);
});
