/**
 * ProductMarginBar - Barra de margem inline por produto
 * 
 * Lógica baseada no DESCONTO dado a partir do preço mostrado:
 * - Azul: desconto < 20% (gordura/crédito - vendeu acima do Preço Alto)
 * - Verde: desconto 20% a 23% (Preço Alto = ponto zero)
 * - Amarelo: desconto 23% a 27%
 * - Laranja: desconto 27% a 32%
 * - Vermelho: desconto > 32% (prejuízo pesado)
 * 
 * Fronteiras:
 * - 20% desc = verde/azul (Preço Alto = ZERO, nem ganhou nem perdeu)
 * - 23% desc = amarelo/verde
 * - 27% desc = laranja/amarelo
 * - 32% desc = vermelho/laranja
 * 
 * Preço Alto = preço modelo. Vender nele = zero. Acima = crédito. Abaixo = débito.
 */

interface ProductMarginBarProps {
  desconto: number; // discount percentage given (e.g., 25.5 means 25.5%)
  showValues?: boolean; // whether to show numeric values (controlled per seller)
}

export function ProductMarginBar({ desconto, showValues = true }: ProductMarginBarProps) {
  // Determine which color zone the discount falls into
  const getZone = (d: number): { color: string; bg: string; label: string; textColor: string } => {
    if (d >= 32) return { color: "bg-red-500", bg: "bg-red-100 dark:bg-red-900/30", label: "Crítico", textColor: "text-red-700 dark:text-red-300" };
    if (d >= 27) return { color: "bg-orange-500", bg: "bg-orange-100 dark:bg-orange-900/30", label: "Baixo", textColor: "text-orange-700 dark:text-orange-300" };
    if (d >= 23) return { color: "bg-yellow-500", bg: "bg-yellow-100 dark:bg-yellow-900/30", label: "Médio", textColor: "text-yellow-700 dark:text-yellow-300" };
    if (d >= 20) return { color: "bg-green-500", bg: "bg-green-100 dark:bg-green-900/30", label: "Zero", textColor: "text-green-700 dark:text-green-300" };
    return { color: "bg-blue-500", bg: "bg-blue-100 dark:bg-blue-900/30", label: "Gordura", textColor: "text-blue-700 dark:text-blue-300" };
  };

  const zone = getZone(desconto);

  // Calculate indicator position on the bar
  // Bar represents 0% to 40% discount range
  // Segments: Blue(0-20) | Green(20-23) | Yellow(23-27) | Orange(27-32) | Red(32-40)
  const barMin = 0;
  const barMax = 40;
  const clampedDesc = Math.max(barMin, Math.min(barMax, desconto));
  const position = (clampedDesc / barMax) * 100;

  // Segment widths (proportional to their discount range within 0-40):
  // Blue: 0-20 = 20/40 = 50%
  // Green: 20-23 = 3/40 = 7.5%
  // Yellow: 23-27 = 4/40 = 10%
  // Orange: 27-32 = 5/40 = 12.5%
  // Red: 32-40 = 8/40 = 20%

  return (
    <div className="flex items-center gap-2 min-w-0">
      {/* Compact color bar */}
      <div className="relative w-24 sm:w-28 h-3 rounded-full overflow-visible flex-shrink-0 border border-slate-200 dark:border-slate-600">
        {/* Solid color segments */}
        <div className="absolute inset-0 rounded-full overflow-hidden flex">
          <div className="h-full bg-blue-500" style={{ width: "50%" }} />
          <div className="h-full bg-green-500" style={{ width: "7.5%" }} />
          <div className="h-full bg-yellow-500" style={{ width: "10%" }} />
          <div className="h-full bg-orange-500" style={{ width: "12.5%" }} />
          <div className="h-full bg-red-500" style={{ width: "20%" }} />
        </div>
        {/* Indicator arrow */}
        <div
          className="absolute top-0 bottom-0 flex flex-col items-center"
          style={{ left: `${position}%`, transform: "translateX(-50%)" }}
        >
          <div className="-mt-1 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] border-t-slate-900 dark:border-t-white" />
          <div className="w-0.5 flex-1 bg-slate-900 dark:bg-white" />
        </div>
      </div>
      {/* Numeric values - only shown if allowed */}
      {showValues && (
        <span className={`text-sm font-black tabular-nums whitespace-nowrap ${zone.textColor}`}>
          {desconto.toFixed(1)}%
        </span>
      )}
    </div>
  );
}

interface MarginParamsEditorProps {
  comissao: number;
  frete: number;
  onComissaoChange: (v: number) => void;
  onFreteChange: (v: number) => void;
}

export function MarginParamsEditor({ comissao, frete, onComissaoChange, onFreteChange }: MarginParamsEditorProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg px-3 py-1.5 mb-2">
      <span className="text-[9px] font-bold text-blue-700 dark:text-blue-300">⚙️ Parâmetros Margem:</span>
      <div className="flex items-center gap-1">
        <span className="text-[9px] text-blue-600 dark:text-blue-400 font-medium">Comissão:</span>
        <input
          type="text"
          inputMode="decimal"
          value={comissao}
          onChange={(e) => {
            const v = parseFloat(e.target.value.replace(",", "."));
            if (!isNaN(v)) onComissaoChange(v);
            else if (e.target.value === "") onComissaoChange(0);
          }}
          className="w-12 px-1 py-0.5 text-[10px] font-bold text-center border border-blue-300 dark:border-blue-600 rounded bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <span className="text-[9px] text-blue-600 dark:text-blue-400 font-medium">%</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-[9px] text-blue-600 dark:text-blue-400 font-medium">Frete:</span>
        <input
          type="text"
          inputMode="decimal"
          value={frete}
          onChange={(e) => {
            const v = parseFloat(e.target.value.replace(",", "."));
            if (!isNaN(v)) onFreteChange(v);
            else if (e.target.value === "") onFreteChange(0);
          }}
          className="w-12 px-1 py-0.5 text-[10px] font-bold text-center border border-blue-300 dark:border-blue-600 rounded bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <span className="text-[9px] text-blue-600 dark:text-blue-400 font-medium">%</span>
      </div>
    </div>
  );
}
