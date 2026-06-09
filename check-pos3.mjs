import { createConnection } from 'mysql2/promise';
const url = process.env.DATABASE_URL;
const conn = await createConnection(url);

// Check POs that have products WITH quantity (complete data) vs without
const [rows] = await conn.execute(`
  SELECT ip.po_number,
    COUNT(ipp.id) as total_products,
    SUM(CASE WHEN ipp.quantidade IS NOT NULL AND ipp.quantidade > 0 THEN 1 ELSE 0 END) as with_qty,
    SUM(CASE WHEN ipp.quantidade IS NULL OR ipp.quantidade = 0 THEN 1 ELSE 0 END) as without_qty
  FROM import_pos ip 
  JOIN import_po_products ipp ON ipp.po_id = ip.id
  GROUP BY ip.id, ip.po_number
  HAVING without_qty > 0
  ORDER BY ip.po_number
`);
console.log("\nPOs with products missing QTD CX:");
console.log("PO | TOTAL | WITH_QTY | WITHOUT_QTY");
for (const r of rows) {
  console.log(`${r.po_number} | ${r.total_products} | ${r.with_qty} | ${r.without_qty}`);
}

// Also check what the spreadsheet source was
const [spreadsheets] = await conn.execute(`
  SELECT DISTINCT ip.po_number, ipp.description, ipp.product_code, ipp.quantidade, ipp.valor_usd, ipp.unid_caixa
  FROM import_pos ip 
  JOIN import_po_products ipp ON ipp.po_id = ip.id
  WHERE ip.po_number = 'PO01' AND (ipp.quantidade IS NULL OR ipp.quantidade = 0)
  LIMIT 10
`);
console.log("\nPO01 products WITHOUT qty:");
for (const r of spreadsheets) {
  console.log(`  ${r.description?.substring(0, 40)} | code:${r.product_code} | qty:${r.quantidade} | usd:${r.valor_usd} | un/cx:${r.unid_caixa}`);
}

await conn.end();
process.exit(0);
