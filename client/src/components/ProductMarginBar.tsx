/**
 * ProductMarginBar - Inline margin indicator per product during order creation
 * 
 * Shows a colored gradient bar with indicator showing where the product's margin falls:
 * - Red: 0% to 14.99%
 * - Orange: 15% to 19.99%
 * - Yellow: 20% to 24.99%
 * - Green: 25% to 28.99%
 * - Blue: 29%+
 * 
 * Calculation: margin = (precoVenda - custo - impostos - frete - comissao) / precoVenda * 100
 */

interface ProductMarginBarProps {
  margin: number; // percentage (e.g., 25.5 means 25.5%)
  custoBox: number; // cost per box in R$
  precoVenda: number; // selling price per box in R$
  fonte?: string; // cost source (Projetado, Real, Estimativa)
  desconto?: number; // discount percentage given
}

export function ProductMarginBar({ margin, custoBox, precoVenda, fonte, desconto }: ProductMarginBarProps) {
  // Clamp margin for display purposes (show from -5% to 40%)
  const displayMin = -5;
  const displayMax = 40;
  const clampedMargin = Math.max(displayMin, Math.min(displayMax, margin));
  const position = ((clampedMargin - displayMin) / (displayMax - displayMin)) * 100;

  // Determine color based on margin
  const getMarginColor = (m: number) => {
    if (m < 0) return { text: "text-red-800 dark:text-red-300", label: "Prejuízo" };
    if (m < 15) return { text: "text-red-600 dark:text-red-400", label: "Crítico" };
    if (m < 20) return { text: "text-orange-600 dark:text-orange-400", label: "Baixo" };
    if (m < 25) return { text: "text-yellow-600 dark:text-yellow-400", label: "Médio" };
    if (m < 29) return { text: "text-green-600 dark:text-green-400", label: "Bom" };
    return { text: "text-blue-600 dark:text-blue-400", label: "Ótimo" };
  };

  const color = getMarginColor(margin);

  return (
    <div className="w-full mt-1.5 px-1">
      <div className="flex items-center gap-2 mb-0.5">
        <span className={`text-[9px] font-black ${color.text}`}>
          Margem: {margin.toFixed(1)}% ({color.label})
        </span>
        {desconto !== undefined && desconto > 0 && (
          <span className="text-[8px] text-slate-500 dark:text-slate-400 font-medium">
            Desc: {desconto.toFixed(1)}%
          </span>
        )}
        {fonte && custoBox > 0 && (
          <span className="text-[8px] text-slate-400 dark:text-slate-500 font-medium">
            Custo {fonte}: R$ {custoBox.toFixed(2)}/cx
          </span>
        )}
      </div>
      {/* Bar container */}
      <div className="relative h-3 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600">
        {/* Color segments */}
        <div className="absolute inset-0 flex">
          {/* Red: -5% to 15% → occupies (15-(-5))/(40-(-5)) = 20/45 = 44.4% of bar */}
          <div className="h-full bg-gradient-to-r from-red-700 via-red-500 to-red-400" style={{ width: "44.4%" }} />
          {/* Orange: 15% to 20% → 5/45 = 11.1% */}
          <div className="h-full bg-gradient-to-r from-orange-400 to-orange-500" style={{ width: "11.1%" }} />
          {/* Yellow: 20% to 25% → 5/45 = 11.1% */}
          <div className="h-full bg-gradient-to-r from-yellow-400 to-yellow-500" style={{ width: "11.1%" }} />
          {/* Green: 25% to 29% → 4/45 = 8.9% */}
          <div className="h-full bg-gradient-to-r from-green-400 to-green-500" style={{ width: "8.9%" }} />
          {/* Blue: 29% to 40% → 11/45 = 24.4% */}
          <div className="h-full bg-gradient-to-r from-blue-400 to-blue-600" style={{ width: "24.5%" }} />
        </div>
        {/* Indicator marker */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-slate-900 dark:bg-white transition-all duration-300"
          style={{ left: `${position}%` }}
        >
          <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-slate-900 dark:bg-white rounded-full border-2 border-white dark:border-slate-900 shadow-md" />
        </div>
      </div>
      {/* Scale labels - positioned exactly at color boundaries */}
      <div className="relative mt-0.5 h-3">
        {/* 0% at left edge: position = (0-(-5))/(40-(-5)) = 5/45 = 11.1% */}
        <span className="absolute text-[7px] text-red-500 font-bold -translate-x-1/2" style={{ left: "11.1%" }}>0%</span>
        {/* 15% at red/orange boundary: (15-(-5))/45 = 44.4% */}
        <span className="absolute text-[7px] text-orange-500 font-bold -translate-x-1/2" style={{ left: "44.4%" }}>15%</span>
        {/* 20% at orange/yellow boundary: (20-(-5))/45 = 55.6% */}
        <span className="absolute text-[7px] text-yellow-600 font-bold -translate-x-1/2" style={{ left: "55.6%" }}>20%</span>
        {/* 25% at yellow/green boundary: (25-(-5))/45 = 66.7% */}
        <span className="absolute text-[7px] text-green-500 font-bold -translate-x-1/2" style={{ left: "66.7%" }}>25%</span>
        {/* 29% at green/blue boundary: (29-(-5))/45 = 75.6% */}
        <span className="absolute text-[7px] text-blue-500 font-bold -translate-x-1/2" style={{ left: "75.6%" }}>29%</span>
      </div>
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
