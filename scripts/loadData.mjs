/**
 * Script to load collected Maxiprod JSON data into the database
 * Usage: node scripts/loadData.mjs
 */
import { readFileSync } from 'fs';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

async function main() {
  const connection = await mysql.createConnection(DATABASE_URL);
  
  try {
    // Read JSON files
    const stockData = JSON.parse(readFileSync(resolve(__dirname, '..', 'stock_data.json'), 'utf-8'));
    const orderData = JSON.parse(readFileSync(resolve(__dirname, '..', 'order_data.json'), 'utf-8'));
    
    console.log(`Loaded ${stockData.length} stock items and ${orderData.length} order items from JSON`);
    
    // Clear existing data
    await connection.execute('DELETE FROM stock_items');
    await connection.execute('DELETE FROM order_items');
    await connection.execute('DELETE FROM dashboard_data');
    console.log('Cleared existing data');
    
    // Insert stock items
    for (const item of stockData) {
      await connection.execute(
        `INSERT INTO stock_items (codigoItem, descricaoItem, quantidade, unidadeMedida, custoUnitario, custoTotal, codigoGrupo, descricaoGrupo, codigoSuperGrupo, descricaoSuperGrupo, empresaDona, estoqueLocal, tipoDecodificado, maxiprodId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.CodigoItem || '',
          item.DescricaoItem || '',
          String(item.Quantidade || 0),
          item.UnidadeMedida || '',
          String(item.CustoUnitario || 0),
          String(item.Custo1 || 0),
          item.CodigoGrupo || '',
          item.DescricaoGrupo || '',
          item.CodigoSuperGrupo || '',
          item.DescricaoSuperGrupo || '',
          item.EmpresaDonaApelido || '',
          item.EstoqueGrid || '',
          item.TipoDecodificado || '',
          item.Id || null,
        ]
      );
    }
    console.log(`Inserted ${stockData.length} stock items`);
    
    // Insert order items
    for (const item of orderData) {
      await connection.execute(
        `INSERT INTO order_items (codigoItem, descricao, quantidade, unidadeMedida, estadoNota, estadoItem, numeroPedido, cliente, dataEmissao, valorUnitario, valorTotal, codigoGrupo, empresaDona, fatorConversao, quantidadeUnEstoque, maxiprodId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.CodItem || item.CodigoItem || '',
          item.Descricao || '',
          String(item.Quantidade || 0),
          item.CodigoUnidadeMedida || item.UnidadeMedida || '',
          item.EstadoNotaFiscalDecodificado || '',
          item.EstadoDecodificado || '',
          item.NumeroNota || '',
          item.ApelidoRemetenteDest || '',
          item.DataEmissao || '',
          String(item.ValorUnitarioMoedaOriginal || 0),
          String(item.ValorTotalMoedaOriginal || 0),
          item.CodigoGrupo || '',
          '', // empresaDona - orders are per company session
          item.FatorConversao ? String(item.FatorConversao) : null,
          item.QuantidadeUnidadeEstoque ? String(item.QuantidadeUnidadeEstoque) : null,
          item.Id || null,
        ]
      );
    }
    console.log(`Inserted ${orderData.length} order items`);
    
    // Update scraper status to show data was loaded
    await connection.execute('DELETE FROM scraper_status');
    await connection.execute(
      `INSERT INTO scraper_status (isConnected, lastSyncAt, lastSyncStatus, lastError, needsMfa) VALUES (?, NOW(), ?, NULL, ?)`,
      [true, `OK - ${stockData.length} estoque, ${orderData.length} pedidos (dados carregados)`, false]
    );
    console.log('Updated scraper status');
    
    console.log('Data loaded successfully! The stock processor will compute dashboard data on next server restart.');
  } finally {
    await connection.end();
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
