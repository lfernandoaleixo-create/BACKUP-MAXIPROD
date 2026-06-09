import { createConnection } from 'mysql2/promise';
const url = process.env.DATABASE_URL;
const conn = await createConnection(url);
const [rows] = await conn.execute(`
  SELECT ip.id, ip.po_number, ip.container_name, ip.supplier_id, s.name as supplier_name,
    COUNT(ipp.id) as product_count,
    SUM(CASE WHEN ipp.quantidade IS NOT NULL AND ipp.quantidade > 0 THEN 1 ELSE 0 END) as products_with_qty
  FROM import_pos ip 
  LEFT JOIN import_po_products ipp ON ipp.po_id = ip.id
  LEFT JOIN import_suppliers s ON ip.supplier_id = s.id
  GROUP BY ip.id, ip.po_number, ip.container_name, ip.supplier_id, s.name
  ORDER BY ip.po_number
`);
console.log("PO_NUMBER | CONTAINER | SUPPLIER | PRODUCTS | WITH_QTY");
console.log("---------|-----------|----------|----------|--------");
for (const r of rows) {
  console.log(`${r.po_number} | ${r.container_name || '-'} | ${r.supplier_name || '-'} | ${r.product_count} | ${r.products_with_qty}`);
}
console.log(`\nTotal POs: ${rows.length}`);
console.log(`POs with 0 products: ${rows.filter(r => r.product_count === 0).length}`);
console.log(`POs with products but no qty: ${rows.filter(r => r.product_count > 0 && r.products_with_qty === 0).length}`);
await conn.end();
process.exit(0);
