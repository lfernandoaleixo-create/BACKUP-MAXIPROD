/**
 * Fix valorCaixaBrl values in the database to match the Excel spreadsheet.
 * Matches products by PO number + description similarity.
 */

import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { eq, and, like, sql } from 'drizzle-orm';
import fs from 'fs';

// Read the correct values from JSON
const correctValues = JSON.parse(fs.readFileSync('/home/ubuntu/po_valor_caixa_correto.json', 'utf8'));

// Database connection
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const connection = await mysql.createConnection(DATABASE_URL);

// Helper to normalize descriptions for matching
function normalizeDesc(desc) {
  return desc.toUpperCase().trim()
    .replace(/\s+/g, ' ')
    .replace(/\./g, '')
    .replace(/,/g, ',')
    .replace(/\s*X\s*/g, ' X ')
    .replace(/C\/\s*/g, 'C/ ')
    .trim();
}

function similarity(a, b) {
  const na = normalizeDesc(a);
  const nb = normalizeDesc(b);
  if (na === nb) return 1.0;
  // Check if one contains the other
  if (na.includes(nb) || nb.includes(na)) return 0.9;
  // Check first 40 chars
  if (na.substring(0, 40) === nb.substring(0, 40)) return 0.85;
  // Check first 30 chars
  if (na.substring(0, 30) === nb.substring(0, 30)) return 0.7;
  return 0;
}

let totalUpdated = 0;
let totalSkipped = 0;
let totalNotFound = 0;
let mismatches = [];

for (const [sheetName, products] of Object.entries(correctValues)) {
  // Convert sheet name to DB po_number
  const dbPoNumber = sheetName === '001' ? 'PO01' : sheetName;
  
  // Get PO id from DB
  const [poRows] = await connection.execute(
    'SELECT id FROM import_pos WHERE po_number = ?',
    [dbPoNumber]
  );
  
  if (poRows.length === 0) {
    console.log(`  [${dbPoNumber}] PO not found in DB, skipping`);
    continue;
  }
  
  const poId = poRows[0].id;
  
  // Get all products for this PO from DB
  const [dbProducts] = await connection.execute(
    'SELECT id, description, valor_caixa_brl, preco_mil_unid FROM import_po_products WHERE po_id = ? ORDER BY id',
    [poId]
  );
  
  if (dbProducts.length === 0) {
    console.log(`  [${dbPoNumber}] No products in DB, skipping`);
    continue;
  }
  
  let poUpdated = 0;
  let poSkipped = 0;
  
  // Match each spreadsheet product to a DB product
  const usedDbIds = new Set();
  
  for (const spreadsheetProduct of products) {
    if (!spreadsheetProduct.valor_caixa_brl || spreadsheetProduct.valor_caixa_brl === 0) {
      poSkipped++;
      continue;
    }
    
    // Find best matching DB product
    let bestMatch = null;
    let bestScore = 0;
    
    for (const dbProd of dbProducts) {
      if (usedDbIds.has(dbProd.id)) continue;
      
      const score = similarity(spreadsheetProduct.description, dbProd.description);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = dbProd;
      }
    }
    
    if (!bestMatch || bestScore < 0.7) {
      console.log(`  [${dbPoNumber}] NOT FOUND: "${spreadsheetProduct.description.substring(0, 50)}" (best score: ${bestScore.toFixed(2)})`);
      totalNotFound++;
      continue;
    }
    
    usedDbIds.add(bestMatch.id);
    
    // Check if value differs
    const currentValue = bestMatch.valor_caixa_brl ? parseFloat(bestMatch.valor_caixa_brl) : 0;
    const correctValue = spreadsheetProduct.valor_caixa_brl;
    
    if (Math.abs(currentValue - correctValue) < 0.01) {
      poSkipped++;
      continue; // Already correct
    }
    
    // Update the value
    let updateSql = 'UPDATE import_po_products SET valor_caixa_brl = ?';
    let params = [correctValue.toFixed(6)];
    
    if (spreadsheetProduct.preco_mil_unid) {
      updateSql += ', preco_mil_unid = ?';
      params.push(spreadsheetProduct.preco_mil_unid.toFixed(6));
    }
    
    updateSql += ' WHERE id = ?';
    params.push(bestMatch.id);
    
    await connection.execute(updateSql, params);
    
    mismatches.push({
      po: dbPoNumber,
      desc: spreadsheetProduct.description.substring(0, 50),
      old: currentValue,
      new: correctValue,
    });
    
    poUpdated++;
  }
  
  totalUpdated += poUpdated;
  totalSkipped += poSkipped;
  
  if (poUpdated > 0) {
    console.log(`  [${dbPoNumber}] Updated ${poUpdated} products, skipped ${poSkipped} (already correct or NULL)`);
  }
}

console.log(`\n=== SUMMARY ===`);
console.log(`Total updated: ${totalUpdated}`);
console.log(`Total already correct: ${totalSkipped}`);
console.log(`Total not found in DB: ${totalNotFound}`);

if (mismatches.length > 0) {
  console.log(`\n=== MISMATCHES FIXED ===`);
  for (const m of mismatches.slice(0, 30)) {
    console.log(`  [${m.po}] ${m.desc} | OLD: R$ ${m.old.toFixed(2)} → NEW: R$ ${m.new.toFixed(2)}`);
  }
  if (mismatches.length > 30) {
    console.log(`  ... and ${mismatches.length - 30} more`);
  }
}

await connection.end();
