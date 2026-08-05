/**
 * Parse box dimensions (Comprimento x Largura x Altura) from Maxiprod's descricaoComplementar field.
 *
 * Supported formats (case-insensitive, flexible spacing):
 *   - "42X24X39"            -> NxNxN (most common)
 *   - "45,5X13,5X29,5"     -> NxNxN with comma decimals
 *   - "415x280x405"        -> 3-digit integers = MILLIMETERS
 *   - "42 x 30 x 20"       -> with spaces
 *   - "42x30x20"           -> unicode x
 *   - "0,415x0,28x0,4"     -> values < 1 = METERS
 *   - "C=42, L=28, A=19"   -> C/L/A format
 *   - "C=42, L = 32,5, A =20" -> with spaces around =
 *   - "C=43, L=31, H=19"   -> H instead of A for height
 *   - "C42 L30 H20"        -> without = sign
 *   - "C 42 L 30 A 20"     -> with spaces
 *
 * Unit detection rule (based on integer digit count):
 *   - 3+ digits in integer part (e.g., 415, 280, 400) -> MILLIMETERS -> divide by 10 to get cm
 *   - 1-2 digits in integer part (e.g., 42, 28, 40, 41.5) -> CENTIMETERS -> use as-is
 *   - All values < 1 (e.g., 0.415, 0.28, 0.4) -> METERS -> multiply by 100 to get cm
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
  const nxnMatch = s.match(
    /(\d+(?:[.,]\d+)?)\s*[xX\u00d7]\s*(\d+(?:[.,]\d+)?)\s*[xX\u00d7]\s*(\d+(?:[.,]\d+)?)/
  );
  if (nxnMatch) {
    const c = parseFloat(nxnMatch[1].replace(",", "."));
    const l = parseFloat(nxnMatch[2].replace(",", "."));
    const a = parseFloat(nxnMatch[3].replace(",", "."));
    return normalizeToCm(c, l, a);
  }

  // Format 2: C=N, L=N, A=N or C=N, L=N, H=N
  const claMatch = s.match(
    /C\s*=?\s*(\d+(?:[.,]\d+)?)[\s,;]*L\s*=?\s*(\d+(?:[.,]\d+)?)[\s,;]*(?:A|H)\s*=?\s*(\d+(?:[.,]\d+)?)/i
  );
  if (claMatch) {
    const c = parseFloat(claMatch[1].replace(",", "."));
    const l = parseFloat(claMatch[2].replace(",", "."));
    const a = parseFloat(claMatch[3].replace(",", "."));
    return normalizeToCm(c, l, a);
  }

  // Format 3: "Comp: N, Larg: N, Alt: N" or similar verbose labels
  const verboseMatch = s.match(
    /(?:comp|compr)[.:=\s]*(\d+(?:[.,]\d+)?)[\s,;]*(?:larg)[.:=\s]*(\d+(?:[.,]\d+)?)[\s,;]*(?:alt)[.:=\s]*(\d+(?:[.,]\d+)?)/i
  );
  if (verboseMatch) {
    const c = parseFloat(verboseMatch[1].replace(",", "."));
    const l = parseFloat(verboseMatch[2].replace(",", "."));
    const a = parseFloat(verboseMatch[3].replace(",", "."));
    return normalizeToCm(c, l, a);
  }

  // Format 4: Just 3 numbers separated by spaces (last resort)
  const threeNumbers = s.match(/^(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)$/);
  if (threeNumbers) {
    const c = parseFloat(threeNumbers[1].replace(",", "."));
    const l = parseFloat(threeNumbers[2].replace(",", "."));
    const a = parseFloat(threeNumbers[3].replace(",", "."));
    return normalizeToCm(c, l, a);
  }

  return null;
}

/**
 * Normalize raw dimension values to centimeters based on digit-count heuristic.
 *
 * Rule:
 *   - If ANY value has 3+ digits in integer part (>=100) -> all values are in MILLIMETERS -> /10
 *   - If ALL values are < 1 (0.xxx format) -> all values are in METERS -> *100
 *   - Otherwise -> values are already in CENTIMETERS -> use as-is
 *
 * Examples:
 *   415, 280, 405 -> mm -> 41.5, 28.0, 40.5 cm
 *   42, 28, 40    -> cm -> 42, 28, 40 cm
 *   41.5, 28, 40  -> cm -> 41.5, 28, 40 cm
 *   0.415, 0.28, 0.40 -> m -> 41.5, 28, 40 cm
 */
function normalizeToCm(c: number, l: number, a: number): {
  comprimento: number;
  largura: number;
  altura: number;
} {
  // Check integer digit count: 3+ digits (>=100) means millimeters
  const isMillimeters = Math.floor(Math.abs(c)) >= 100 ||
                        Math.floor(Math.abs(l)) >= 100 ||
                        Math.floor(Math.abs(a)) >= 100;

  // All values < 1 means meters (0.415, 0.28, 0.4)
  const isMeters = c < 1 && l < 1 && a < 1;

  if (isMillimeters) {
    // 3+ digit integer part -> millimeters -> divide by 10
    return {
      comprimento: c / 10,
      largura: l / 10,
      altura: a / 10,
    };
  }

  if (isMeters) {
    // All values < 1 -> meters -> multiply by 100
    // Round to 4 decimal places to avoid floating point precision issues
    return {
      comprimento: Math.round(c * 100 * 10000) / 10000,
      largura: Math.round(l * 100 * 10000) / 10000,
      altura: Math.round(a * 100 * 10000) / 10000,
    };
  }

  // 1-2 digit integer part -> centimeters -> use as-is
  return {
    comprimento: c,
    largura: l,
    altura: a,
  };
}
