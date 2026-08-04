/**
 * Parse box dimensions (Comprimento × Largura × Altura) from Maxiprod's descricaoComplementar field.
 *
 * Supported formats (case-insensitive, flexible spacing):
 *   - "42X24X39"          → NxNxN (most common)
 *   - "45,5X13,5X29,5"   → NxNxN with comma decimals
 *   - "415x280x405"      → lowercase x
 *   - "42 x 30 x 20"     → with spaces
 *   - "42×30×20"          → unicode ×
 *   - "C=42, L=28, A=19"  → C/L/A format
 *   - "C=42, L = 32,5, A =20" → with spaces around =
 *   - "C=43, L=31, H=19"  → H instead of A for height
 *   - "C42 L30 H20"       → without = sign
 *   - "C 42 L 30 A 20"    → with spaces
 *
 * @returns { comprimento, largura, altura } in centimeters, or null if unparseable
 */
export function parseDimensions(dimStr: string | null | undefined): {
  comprimento: number;
  largura: number;
  altura: number;
} | null {
  if (!dimStr || !dimStr.trim()) return null;

  const s = dimStr.trim();

  // Format 1: NxNxN (most common for Grupo Fox)
  // Matches: "42X24X39", "45,5X13,5X29,5", "415x280x405", "42 x 30 x 20", "42×30×20"
  const nxnMatch = s.match(
    /(\d+(?:[.,]\d+)?)\s*[xX×]\s*(\d+(?:[.,]\d+)?)\s*[xX×]\s*(\d+(?:[.,]\d+)?)/
  );
  if (nxnMatch) {
    return {
      comprimento: parseFloat(nxnMatch[1].replace(",", ".")),
      largura: parseFloat(nxnMatch[2].replace(",", ".")),
      altura: parseFloat(nxnMatch[3].replace(",", ".")),
    };
  }

  // Format 2: C=N, L=N, A=N or C=N, L=N, H=N (with flexible spacing and separators)
  // Matches: "C=42, L= 28, A= 19", "C=42, L = 32,5, A =20", "C=43, L=31, H=19"
  const claMatch = s.match(
    /C\s*=?\s*(\d+(?:[.,]\d+)?)[\s,;]*L\s*=?\s*(\d+(?:[.,]\d+)?)[\s,;]*(?:A|H)\s*=?\s*(\d+(?:[.,]\d+)?)/i
  );
  if (claMatch) {
    return {
      comprimento: parseFloat(claMatch[1].replace(",", ".")),
      largura: parseFloat(claMatch[2].replace(",", ".")),
      altura: parseFloat(claMatch[3].replace(",", ".")),
    };
  }

  // Format 3: "Comp: N, Larg: N, Alt: N" or similar verbose labels
  const verboseMatch = s.match(
    /(?:comp|compr)[.:=\s]*(\d+(?:[.,]\d+)?)[\s,;]*(?:larg)[.:=\s]*(\d+(?:[.,]\d+)?)[\s,;]*(?:alt)[.:=\s]*(\d+(?:[.,]\d+)?)/i
  );
  if (verboseMatch) {
    return {
      comprimento: parseFloat(verboseMatch[1].replace(",", ".")),
      largura: parseFloat(verboseMatch[2].replace(",", ".")),
      altura: parseFloat(verboseMatch[3].replace(",", ".")),
    };
  }

  // Format 4: Just 3 numbers separated by spaces (last resort)
  // e.g., "42 30 20" - assumes C L A order
  const threeNumbers = s.match(/^(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)$/);
  if (threeNumbers) {
    return {
      comprimento: parseFloat(threeNumbers[1].replace(",", ".")),
      largura: parseFloat(threeNumbers[2].replace(",", ".")),
      altura: parseFloat(threeNumbers[3].replace(",", ".")),
    };
  }

  return null;
}
