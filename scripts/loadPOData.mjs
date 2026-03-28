import fs from 'fs';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const poData = JSON.parse(fs.readFileSync('./data/po_data.json', 'utf-8'));
  console.log(`Loaded ${poData.length} PO items from JSON`);

  const connection = await mysql.createConnection(process.env.DATABASE_URL);

  // Clear existing PO data
  await connection.execute('DELETE FROM purchase_order_items');
  console.log('Cleared existing PO data');

  // Insert PO items
  let inserted = 0;
  for (const item of poData) {
    // Parse Maxiprod date format: /Date(1776999600000)/
    const parseDate = (dateStr) => {
      if (!dateStr) return null;
      const match = dateStr.match(/\/Date\((\d+)\)\//);
      if (match) {
        const d = new Date(parseInt(match[1]));
        return d.toISOString().split('T')[0]; // YYYY-MM-DD
      }
      return null;
    };

    await connection.execute(
      `INSERT INTO purchase_order_items 
       (descricao, quantidade, quantidadeUnEstoque, fatorConversao, unidadeMedida, unidadeMedidaEstoque,
        dataEntrega, dataEmissao, estadoPedido, estadoItem, fornecedor, valorTotal, valorUnitario,
        numeroPedido, numeroItem, codigoGrupo, codigoCFOP, empresaDona, maxiprodId)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.Descricao,
        item.Quantidade,
        item.QuantidadeUnidadeEstoque || null,
        item.FatorConversao || null,
        item.CodigoUnidadeMedida || null,
        item.CodigoUnidadeMedidaEstoque || null,
        parseDate(item.DataEntrega),
        parseDate(item.DataEmissao),
        item.EstadoNotaFiscalDecodificado || null,
        item.EstadoDecodificado || null,
        item.ApelidoRemetenteDest || null,
        item.ValorTotalComDesconto || null,
        item.ValorUnitarioMoedaOriginal || null,
        item.NumeroNota || null,
        item.Numero || null,
        item.CodigoGrupo || null,
        item.CodigoCFOP || null,
        'PALITOS INDUSTRIA', // Current company
        item.IdItem || null
      ]
    );
    inserted++;
  }

  console.log(`Inserted ${inserted} PO items`);

  // Verify
  const [rows] = await connection.execute('SELECT COUNT(*) as cnt FROM purchase_order_items');
  console.log(`Verification: ${rows[0].cnt} PO items in database`);

  // Show summary
  const [summary] = await connection.execute(`
    SELECT descricao, SUM(quantidade) as totalQty, unidadeMedida, dataEntrega, estadoItem
    FROM purchase_order_items
    GROUP BY descricao, unidadeMedida, dataEntrega, estadoItem
    ORDER BY dataEntrega
    LIMIT 10
  `);
  console.log('\nSample PO items:');
  for (const row of summary) {
    console.log(`  ${row.descricao.substring(0, 60)}: ${row.totalQty} ${row.unidadeMedida} - Entrega: ${row.dataEntrega} (${row.estadoItem})`);
  }

  await connection.end();
}

main().catch(console.error);
