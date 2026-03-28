/**
 * Load NF sales data (notas fiscais de saida) into the database
 * for average price calculation
 */
import { readFileSync } from 'fs';
import mysql from 'mysql2/promise';
import { config } from 'dotenv';

config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

async function main() {
  const raw = JSON.parse(readFileSync('nf_sales_data.json', 'utf-8'));
  console.log(`Loaded ${raw.length} NF items from JSON`);

  const url = new URL(DATABASE_URL);
  const conn = await mysql.createConnection({
    host: url.hostname,
    port: parseInt(url.port) || 3306,
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1),
    ssl: { rejectUnauthorized: true },
  });

  await conn.execute('DELETE FROM sales_invoice_items');
  console.log('Cleared existing NF data');

  let inserted = 0;
  for (const item of raw) {
    let dataEmissao = null;
    if (item.DataEmissao) {
      const match = item.DataEmissao.match(/\/Date\((\d+)\)\//);
      if (match) {
        const d = new Date(parseInt(match[1]));
        dataEmissao = d.toISOString().split('T')[0];
      }
    }

    await conn.execute(
      `INSERT INTO sales_invoice_items 
       (codigoItem, descricao, quantidade, quantidadeUnEstoque, fatorConversao,
        unidadeMedida, unidadeMedidaEstoque, valorUnitario, valorTotal, 
        valorTotalComDesconto, dataEmissao, codigoGrupo, codigoCFOP, empresaDona)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.CodItem || '',
        item.Descricao || '',
        item.Quantidade || 0,
        item.QuantidadeUnidadeEstoque || null,
        item.FatorConversao || null,
        item.CodigoUnidadeMedida || null,
        item.CodigoUnidadeMedidaEstoque || null,
        item.ValorUnitarioMoedaOriginal || null,
        item.ValorTotalMoedaOriginal || null,
        item.ValorTotalComDesconto || null,
        dataEmissao,
        item.CodigoGrupo || null,
        item.CodigoCFOP || null,
        item.EmpresaDonaApelido || null,
      ]
    );
    inserted++;
  }

  console.log(`Inserted ${inserted} NF items`);
  await conn.end();
}

main().catch(console.error);
