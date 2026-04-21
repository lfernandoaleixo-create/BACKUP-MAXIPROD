// Test extractBaseName logic with actual product names - UPDATED

function extractBaseName(desc) {
  let result = desc;
  // Remove "C/ NNN [x NNN] UNID." patterns (with optional multiplier)
  result = result.replace(/\s*C\/\s*[\d.]+\s*([xX]\s*[\d.]+)?\s*(UNID\.?|UN\.?)/gi, '');
  // Remove "FLOW-PACK NNN [x NNN] UNID." patterns
  result = result.replace(/\s*-?\s*FLOW-?PACK\s*[\d.]+\s*([xX]\s*[\d.]+)?\s*(UNID\.?|UN\.?)/gi, '');
  // Remove "EMBALADO INDIVIDUALMENTE C/ NNN x NNN UNID."
  result = result.replace(/\s*EMBALADO\s+INDIVIDUALMENTE/gi, '');
  // Remove "(EMB. TRANSPARENTE)" and similar parenthetical notes
  result = result.replace(/\s*\(EMB\.?\s*TRANSPARENTE\)/gi, '');
  // Normalize spaces around "MM" ("125MM" → "125 MM")
  result = result.replace(/(\d)MM/gi, '$1 MM');
  // Collapse whitespace
  result = result.replace(/\s+/g, ' ').trim().toUpperCase();
  return result;
}

const ECOMMERCE_NAME_ALIASES = {
  'VARETA AROMATIZADOR FIBRA 3,0 X 200': 'VARETA DE FIBRA PARA AROMATIZADOR DE 3,0 X 200 MM PRETA',
};

function resolveBaseName(desc) {
  let baseName = extractBaseName(desc);
  for (const [aliasKey, aliasTarget] of Object.entries(ECOMMERCE_NAME_ALIASES)) {
    if (baseName.startsWith(aliasKey)) {
      baseName = aliasTarget;
      break;
    }
  }
  return baseName;
}

const products = [
  // Palito Manicure Duas Pontas 4,0 x 125mm
  "PALITO DE MANICURE DUAS PONTAS BAMBU 4,0 X 125 MM C/ 100 X 100 UNID.  (EMB. TRANSPARENTE)",
  "PALITO DE MANICURE DUAS PONTAS BAMBU 4,0 X 125MM C/ 10.000 UNID.",
  "PALITO DE MANICURE DUAS PONTAS BAMBU 4,0 X 125 MM C/ 500 UNID.",
  "PALITO DE MANICURE DUAS PONTAS BAMBU 4,0 X 125 MM C/ 100 UNID.",
  
  // Palito Manicure Ponta/Chanfro 4,0 x 125mm
  "PALITO DE MANICURE PONTA/CHANFRO BAMBU 4,0 X 125 MM C/ 100 X 100 UNID. (EMB. TRANSPARENTE)",
  "PALITO DE MANICURE PONTA/CHANFRO BAMBU 4,0 X 125 MM C/ 200 X100 UNID. (EMB. TRANSPARENTE)",
  "PALITO DE MANICURE PONTA/CHANFRO BAMBU 4,0 X 125 MM C/ 10.000 UNID.",
  "PALITO DE MANICURE PONTA/CHANFRO BAMBU 4,0 X 125 MM C/ 100 UNID.",
  "PALITO DE MANICURE PONTA/CHANFRO BAMBU 4,0 X 125 MM C/ 500 UNID.",
  
  // Vareta Fibra (different naming!)
  "VARETA DE FIBRA PARA AROMATIZADOR DE 3,0 X 200 MM C/ 20.000 UNID. PRETA",
  "VARETA AROMATIZADOR FIBRA 3,0 X 200 MM-FLOW-PACK 500 x 10 UNID.",
  "VARETA AROMATIZADOR FIBRA 3,0 X 200 MM-FLOW-PACK 50 UNID.",
  "VARETA AROMATIZADOR FIBRA 3,0 X 200 MM-FLOW-PACK 200 UNID.",
];

console.log("=== resolveBaseName results ===");
const groups = {};
for (const p of products) {
  const bn = resolveBaseName(p);
  console.log(`  "${p}"`);
  console.log(`  → "${bn}"\n`);
  if (!groups[bn]) groups[bn] = [];
  groups[bn].push(p);
}

console.log("\n=== GROUPS ===");
for (const [key, items] of Object.entries(groups)) {
  console.log(`\nGroup: "${key}" (${items.length} items)`);
  items.forEach(i => console.log(`  - ${i}`));
}
