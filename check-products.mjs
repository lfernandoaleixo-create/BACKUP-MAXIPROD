import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const connection = await mysql.createConnection(DATABASE_URL);

// Check stock_items for these products
const [stockRows] = await connection.execute(
  `SELECT codigoItem, descricaoItem, grupoCodigo, descricaoGrupo, quantidade, custoUnitario, unidadeDeVendaFator 
   FROM stock_items WHERE codigoItem IN ('00051', '00406', '00407', '00408')`
);
console.log('\n=== STOCK ITEMS ===');
console.table(stockRows);

// Check import_po_products for these codes
const [poProducts] = await connection.execute(
  `SELECT pp.product_code, pp.description, pp.quantidade, pp.valor_caixa_brl, pp.preco_mil_unid, pp.unid_caixa, pp.valor_usd, pp.valor_po_cheia,
          po.po_number, po.navigation_status, po.container_name, po.is_from_spreadsheet
   FROM import_po_products pp
   JOIN import_pos po ON pp.po_id = po.id
   WHERE pp.product_code IN ('00051', '00406', '00407', '00408')
   ORDER BY pp.product_code, po.created_at DESC`
);
console.log('\n=== PO PRODUCTS (exact match) ===');
console.table(poProducts);

// Also check if they exist with different formatting
const [poProductsLike] = await connection.execute(
  `SELECT pp.product_code, pp.description, pp.valor_caixa_brl, po.po_number, po.navigation_status
   FROM import_po_products pp
   JOIN import_pos po ON pp.po_id = po.id
   WHERE pp.product_code LIKE '%051%' OR pp.product_code LIKE '%406%' OR pp.product_code LIKE '%407%' OR pp.product_code LIKE '%408%'
   ORDER BY pp.product_code`
);
console.log('\n=== PO PRODUCTS (LIKE match) ===');
console.table(poProductsLike);

// Check all POs and their statuses
const [allPos] = await connection.execute(
  `SELECT id, po_number, container_name, navigation_status, supplier_id, is_from_spreadsheet 
   FROM import_pos ORDER BY created_at DESC LIMIT 20`
);
console.log('\n=== RECENT POs ===');
console.table(allPos);

await connection.end();
