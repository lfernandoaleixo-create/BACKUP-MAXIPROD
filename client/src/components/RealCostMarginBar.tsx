/**
 * RealCostMarginBar - Second margin bar that calculates margin using real cost method
 * 
 * Formula: margem = (precoVenda - custo - impostos - frete - comissao - custosAdicionais) / precoVenda * 100
 * 
 * Shows alongside the interpolation bar for comparison.
 * Includes detailed tax breakdown per product.
 */


interface TaxBreakdown {
  icms: number;
  pis: number;
  cofins: number;
  irpj: number;
  csll: number;
  difal: number;
  total: number;
}

interface RealCostMarginBarProps {
  precoVenda: number;       // selling price per unit (R$)
  custoBox: number;         // cost per box (R$)
  fonte: string;            // cost source
  tipoProduto: string;      // "importado" | "industrializado"
  taxBreakdown: TaxBreakdown; // tax percentages for this product type
  fretePerc: number;        // frete % (editable)
  comissaoPerc: number;     // comissão % (editable)
  custosAdicionaisPerc: number; // custos adicionais % (editable)
  quantidade?: number;      // quantity of boxes (for dynamic total calculation)
}

export function RealCostMarginBar({
  precoVenda,
  custoBox,
  fonte,
  tipoProduto,
  taxBreakdown,
  fretePerc,
  comissaoPerc,
  custosAdicionaisPerc,
  quantidade = 1,
}: RealCostMarginBarProps) {
  // Details are always visible now (no toggle needed)

  // Calculate real margin
  const custoPerc = precoVenda > 0 ? (custoBox / precoVenda) * 100 : 0;
  const totalDeducoes = custoPerc + taxBreakdown.total + fretePerc + comissaoPerc + custosAdicionaisPerc;
  const margin = 100 - totalDeducoes;

  // Values in R$ per unit
  const impostosValor = precoVenda * (taxBreakdown.total / 100);
  const freteValor = precoVenda * (fretePerc / 100);
  const comissaoValor = precoVenda * (comissaoPerc / 100);
  const custosAdValor = precoVenda * (custosAdicionaisPerc / 100);
  const lucro = precoVenda - custoBox - impostosValor - freteValor - comissaoValor - custosAdValor;

  // Total values (dynamic with quantity)
  const qty = Math.max(1, quantidade);
  const totalVenda = precoVenda * qty;
  const totalCusto = custoBox * qty;
  const totalImpostos = impostosValor * qty;
  const totalFrete = freteValor * qty;
  const totalComissao = comissaoValor * qty;
  const totalCustosAd = custosAdValor * qty;
  const totalLucro = lucro * qty;

  // Display
  const displayMin = -5;
  const displayMax = 40;
  const clampedMargin = Math.max(displayMin, Math.min(displayMax, margin));
  const position = ((clampedMargin - displayMin) / (displayMax - displayMin)) * 100;

  const getMarginColor = (m: number) => {
    if (m < 0) return { text: "text-red-800", bg: "bg-red-100", label: "Prejuízo" };
    if (m < 15) return { text: "text-red-600", bg: "bg-red-50", label: "Crítico" };
    if (m < 20) return { text: "text-orange-600", bg: "bg-orange-50", label: "Baixo" };
    if (m < 25) return { text: "text-yellow-600", bg: "bg-yellow-50", label: "Médio" };
    if (m < 29) return { text: "text-green-600", bg: "bg-green-50", label: "Bom" };
    return { text: "text-blue-600", bg: "bg-blue-50", label: "Ótimo" };
  };

  const color = getMarginColor(margin);

  return (
    <div className="w-full mt-1 px-1">
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-[11px] font-black ${color.text}`}>
          📊 Custo Real: {margin.toFixed(1)}% ({color.label})
        </span>
        <span className="text-[9px] text-slate-500 font-medium">
          {tipoProduto === "importado" ? "🌍 Importado" : "🏭 Industrializado"}
        </span>

      </div>
      {/* Bar - thicker */}
      <div className="relative h-5 rounded-full overflow-visible bg-slate-100 border border-slate-200">
        <div className="absolute inset-0 rounded-full overflow-hidden flex">
          <div className="h-full bg-gradient-to-r from-red-700 via-red-500 to-red-400" style={{ width: "44.4%" }} />
          <div className="h-full bg-gradient-to-r from-orange-400 to-orange-500" style={{ width: "11.1%" }} />
          <div className="h-full bg-gradient-to-r from-yellow-400 to-yellow-500" style={{ width: "11.1%" }} />
          <div className="h-full bg-gradient-to-r from-green-400 to-green-500" style={{ width: "8.9%" }} />
          <div className="h-full bg-gradient-to-r from-blue-400 to-blue-600" style={{ width: "24.5%" }} />
        </div>
        {/* Arrow indicator */}
        <div
          className="absolute top-0 bottom-0 flex flex-col items-center transition-all duration-300"
          style={{ left: `${position}%`, transform: "translateX(-50%)" }}
        >
          <div className="-mt-1.5 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[7px] border-t-slate-900 drop-shadow-sm" />
          <div className="w-0.5 flex-1 bg-slate-900" />
        </div>
      </div>
      {/* Details - always visible, showing totals that update with quantity */}
      <div className={`mt-1.5 p-2 rounded-lg border text-[9px] ${color.bg} border-slate-200`}>
        {/* Header with quantity indicator */}
        {qty > 1 && (
          <div className="mb-1.5 pb-1 border-b border-slate-300 flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-700">📦 {qty} caixas</span>
            <span className="text-[10px] font-bold text-slate-800">Total Venda: R$ {totalVenda.toFixed(2)}</span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <div className="flex justify-between">
            <span className="text-slate-600">Preço Venda{qty > 1 ? ` (${qty}cx)` : ""}:</span>
            <span className="font-bold text-slate-800">R$ {totalVenda.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Custo ({fonte}):</span>
            <span className="font-bold text-red-600">-R$ {totalCusto.toFixed(2)} ({custoPerc.toFixed(1)}%)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">ICMS ({taxBreakdown.icms.toFixed(2)}%):</span>
            <span className="font-bold text-red-600">-R$ {(totalVenda * taxBreakdown.icms / 100).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">PIS ({taxBreakdown.pis.toFixed(3)}%):</span>
            <span className="font-bold text-red-600">-R$ {(totalVenda * taxBreakdown.pis / 100).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">COFINS ({taxBreakdown.cofins.toFixed(2)}%):</span>
            <span className="font-bold text-red-600">-R$ {(totalVenda * taxBreakdown.cofins / 100).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">IRPJ ({taxBreakdown.irpj.toFixed(2)}%):</span>
            <span className="font-bold text-red-600">-R$ {(totalVenda * taxBreakdown.irpj / 100).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">CSLL ({taxBreakdown.csll.toFixed(2)}%):</span>
            <span className="font-bold text-red-600">-R$ {(totalVenda * taxBreakdown.csll / 100).toFixed(2)}</span>
          </div>
          {taxBreakdown.difal > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-600">DIFAL ({taxBreakdown.difal.toFixed(2)}%):</span>
              <span className="font-bold text-red-600">-R$ {(totalVenda * taxBreakdown.difal / 100).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-slate-600">Frete ({fretePerc}%):</span>
            <span className="font-bold text-red-600">-R$ {totalFrete.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Comissão ({comissaoPerc}%):</span>
            <span className="font-bold text-red-600">-R$ {totalComissao.toFixed(2)}</span>
          </div>
          {custosAdicionaisPerc > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-600">Custos Adic. ({custosAdicionaisPerc}%):</span>
              <span className="font-bold text-red-600">-R$ {totalCustosAd.toFixed(2)}</span>
            </div>
          )}
          <div className="col-span-2 border-t border-slate-300 pt-1 mt-0.5 flex justify-between">
            <span className="text-[10px] text-slate-700 font-bold">Lucro Líquido{qty > 1 ? ` (${qty}cx)` : ""}:</span>
            <span className={`text-[11px] font-black ${totalLucro >= 0 ? "text-green-700" : "text-red-700"}`}>
              R$ {totalLucro.toFixed(2)} ({margin.toFixed(1)}%)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// UF selector and custos adicionais editor for the simulation
interface MarginSimulationParamsProps {
  comissao: number;
  frete: number;
  custosAdicionais: number;
  ufDestino: string;
  onComissaoChange: (v: number) => void;
  onFreteChange: (v: number) => void;
  onCustosAdicionaisChange: (v: number) => void;
  onUfDestinoChange: (v: string) => void;
}

const UF_LIST = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA",
  "MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN",
  "RO","RR","RS","SC","SE","SP","TO"
];

export function MarginSimulationParams({
  comissao,
  frete,
  custosAdicionais,
  ufDestino,
  onComissaoChange,
  onFreteChange,
  onCustosAdicionaisChange,
  onUfDestinoChange,
}: MarginSimulationParamsProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-1.5 mb-2">
      <span className="text-[9px] font-bold text-indigo-700">📊 Simulação Custo Real:</span>
      <div className="flex items-center gap-1">
        <span className="text-[9px] text-indigo-600 font-medium">UF Destino:</span>
        <select
          value={ufDestino}
          onChange={(e) => onUfDestinoChange(e.target.value)}
          className="px-1 py-0.5 text-[10px] font-bold border border-indigo-300 rounded bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        >
          {UF_LIST.map(uf => (
            <option key={uf} value={uf}>{uf}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-[9px] text-indigo-600 font-medium">Comissão:</span>
        <input
          type="text"
          inputMode="decimal"
          value={comissao}
          onChange={(e) => {
            const v = parseFloat(e.target.value.replace(",", "."));
            if (!isNaN(v)) onComissaoChange(v);
            else if (e.target.value === "") onComissaoChange(0);
          }}
          className="w-12 px-1 py-0.5 text-[10px] font-bold text-center border border-indigo-300 rounded bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
        <span className="text-[9px] text-indigo-600">%</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-[9px] text-indigo-600 font-medium">Frete:</span>
        <input
          type="text"
          inputMode="decimal"
          value={frete}
          onChange={(e) => {
            const v = parseFloat(e.target.value.replace(",", "."));
            if (!isNaN(v)) onFreteChange(v);
            else if (e.target.value === "") onFreteChange(0);
          }}
          className="w-12 px-1 py-0.5 text-[10px] font-bold text-center border border-indigo-300 rounded bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
        <span className="text-[9px] text-indigo-600">%</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-[9px] text-indigo-600 font-medium">Custos Adic.:</span>
        <input
          type="text"
          inputMode="decimal"
          value={custosAdicionais}
          onChange={(e) => {
            const v = parseFloat(e.target.value.replace(",", "."));
            if (!isNaN(v)) onCustosAdicionaisChange(v);
            else if (e.target.value === "") onCustosAdicionaisChange(0);
          }}
          className="w-12 px-1 py-0.5 text-[10px] font-bold text-center border border-indigo-300 rounded bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
        <span className="text-[9px] text-indigo-600">%</span>
      </div>
    </div>
  );
}
