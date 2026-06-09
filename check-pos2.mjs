import { createConnection } from 'mysql2/promise';
const url = process.env.DATABASE_URL;
const conn = await createConnection(url);

// Check POs that have products but many without quantity (incomplete data)
const [rows] = await conn.execute(`
  SELECT ip.po_number, ipp.description, ipp.product_code, ipp.quantidade, ipp.valor_usd, ipp.unid_caixa, ipp.ncm
  FROM import_pos ip 
  JOIN import_po_products ipp ON ipp.po_id = ip.id
  WHERE ip.po_number IN ('PO01', 'PO11', 'PO15', 'PO16', 'PO17', 'PO19', 'PO21', 'PO22', 'PO23', 'PO27')
  ORDER BY ip.po_number, ipp.id
`);
console.log("\nProducts in POs with incomplete data:");
console.log("PO | DESCRIPTION | CODE | QTD | USD | UN/CX | NCM");
for (const r of rows) {
  console.log(`${r.po_number} | ${(r.description || '').substring(0, 30)} | ${r.product_code || '-'} | ${r.quantidade || '-'} | ${r.valor_usd || '-'} | ${r.unid_caixa || '-'} | ${r.ncm || '-'}`);
}
await conn.end();
process.exit(0);
