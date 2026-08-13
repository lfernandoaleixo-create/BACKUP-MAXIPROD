/**
 * RealCostMarginBar - Second margin bar that calculates margin using real cost method
 * 
 * Formula: margem = (precoVenda - custo - impostos - frete - comissao - custosAdicionais) / precoVenda * 100
 * 
 * Same visual style as ProductMarginBar (solid colors, divider lines, h-7).
 * Details are inside a collapsible card.
 * 
 * Colors: <15% red, 15-20% orange, 20-25% yellow, 25-29% green, >29% blue
 */

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

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
  nfPercentFator?: number | null; // Tipo de Faturamento: null/100=nota cheia, 0=sem NF, 50=50%, 33=1/3, 25=25%, 20=20%
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
  nfPercentFator,
}: RealCostMarginBarProps) {
  const [expanded, setExpanded] = useState(false);

  // Calculate real margin
  const custoPerc = precoVenda > 0 ? (custoBox / precoVenda) * 100 : 0;
  const effectiveNfFactor = (nfPercentFator ?? 100) / 100;
  const totalDeducoes = custoPerc + (taxBreakdown.total * effectiveNfFactor) + fretePerc + comissaoPerc + custosAdicionaisPerc;
  const margin = 100 - totalDeducoes;

  // Values in R$ per unit
  const impostosValor = precoVenda * (taxBreakdown.total / 100) * effectiveNfFactor;
  const freteValor = precoVenda * (fretePerc / 100);
  const comissaoValor = precoVenda * (comissaoPerc / 100);
  const custosAdValor = precoVenda * (custosAdicionaisPerc / 100);
  const lucro = precoVenda - custoBox - impostosValor - freteValor - comissaoValor - custosAdValor;

  // Total values (dynamic with quantity)
  const qty = Math.max(1, quantidade);
  const totalVenda = precoVenda * qty;
  const totalCusto = custoBox * qty;
  const totalFrete = freteValor * qty;
  const totalComissao = comissaoValor * qty;
  const totalCustosAd = custosAdValor * qty;
  const totalLucro = lucro * qty;

  // Bar position: range -5% to 40%
  const displayMin = -5;
  const displayMax = 40;
  const clampedMargin = Math.max(displayMin, Math.min(displayMax, margin));
  const position = ((clampedMargin - displayMin) / (displayMax - displayMin)) * 100;

  // Segment widths for -5 to 40 range (total 45):
  // Red: -5 to 15 = 20/45 = 44.4%
  // Orange: 15 to 20 = 5/45 = 11.1%
  // Yellow: 20 to 25 = 5/45 = 11.1%
  // Green: 25 to 29 = 4/45 = 8.9%
  // Blue: 29 to 40 = 11/45 = 24.5%

  const getMarginColor = (m: number) => {
    if (m < 15) return { text: "text-red-700 dark:text-red-300", label: "Crítico" };
    if (m < 20) return { text: "text-orange-700 dark:text-orange-300", label: "Comissão Baixa" };
    if (m < 25) return { text: "text-yellow-700 dark:text-yellow-300", label: "Comissão Média" };
    if (m < 29) return { text: "text-green-700 dark:text-green-300", label: "Comissão Média-Alta" };
    return { text: "text-blue-700 dark:text-blue-300", label: "Comissão Alta" };
  };

  const color = getMarginColor(margin);

  return (
    <div className="w-full mt-1.5">
      {/* Clickable header with bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left"
      >
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[11px] font-black ${color.text}`}>
            📊 {margin.toFixed(1)}% ({color.label})
          </span>
          <span className="text-[9px] text-slate-500 font-medium">
            {tipoProduto === "importado" ? "🌍" : "🏭"}
          </span>
          {expanded ? (
            <ChevronUp className="w-3 h-3 text-slate-400 ml-auto" />
          ) : (
            <ChevronDown className="w-3 h-3 text-slate-400 ml-auto" />
          )}
        </div>
        {/* Bar - same style as ProductMarginBar, centered */}
        <div className="relative w-52 sm:w-64">
          <div className="relative h-7 rounded-full overflow-visible border-2 border-slate-300 dark:border-slate-500 shadow-sm">
            {/* Solid color segments: -5→15(red), 15→20(orange), 20→25(yellow), 25→29(green), 29→40(blue) */}
            <div className="absolute inset-0 rounded-full overflow-hidden flex">
              <div className="h-full bg-red-500" style={{ width: "44.4%" }} />
              <div className="h-full bg-orange-500" style={{ width: "11.1%" }} />
              <div className="h-full bg-yellow-400" style={{ width: "11.1%" }} />
              <div className="h-full bg-green-500" style={{ width: "8.9%" }} />
              <div className="h-full bg-blue-500" style={{ width: "24.5%" }} />
            </div>
            {/* Divider lines at 15%, 20%, 25%, 29% boundaries */}
            <div className="absolute top-0 bottom-0 w-[2px] bg-white/90 dark:bg-slate-900/70" style={{ left: "44.4%" }} />
            <div className="absolute top-0 bottom-0 w-[2px] bg-white/90 dark:bg-slate-900/70" style={{ left: "55.5%" }} />
            <div className="absolute top-0 bottom-0 w-[2px] bg-white/90 dark:bg-slate-900/70" style={{ left: "66.6%" }} />
            <div className="absolute top-0 bottom-0 w-[2px] bg-white/90 dark:bg-slate-900/70" style={{ left: "75.5%" }} />
            {/* Indicator arrow */}
            <div
              className="absolute flex flex-col items-center"
              style={{ left: `${position}%`, transform: "translateX(-50%)", top: "-7px", bottom: "-3px" }}
            >
              <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-slate-900 dark:border-t-white" />
              <div className="w-[3px] flex-1 bg-slate-900 dark:bg-white rounded-full" />
            </div>
          </div>
          {/* Margin numbers at dividers */}
          <div className="relative w-full h-4 mt-0.5">
            <span className="absolute text-[9px] font-black text-slate-600 dark:text-slate-300" style={{ left: "44.4%", transform: "translateX(-50%)" }}>15%</span>
            <span className="absolute text-[9px] font-black text-slate-600 dark:text-slate-300" style={{ left: "55.5%", transform: "translateX(-50%)" }}>20%</span>
            <span className="absolute text-[9px] font-black text-slate-600 dark:text-slate-300" style={{ left: "66.6%", transform: "translateX(-50%)" }}>25%</span>
            <span className="absolute text-[9px] font-black text-slate-600 dark:text-slate-300" style={{ left: "75.5%", transform: "translateX(-50%)" }}>29%</span>
          </div>
        </div>
      </button>

      {/* Collapsible details card */}
      {expanded && (
        <div className="mt-1.5 p-2 rounded-lg border text-[9px] bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 animate-in slide-in-from-top-1">
          {/* Header with quantity indicator */}
          {qty > 1 && (
            <div className="mb-1.5 pb-1 border-b border-slate-300 dark:border-slate-600 flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">📦 {qty} caixas</span>
              <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200">Total Venda: R$ {totalVenda.toFixed(2)}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Preço Venda{qty > 1 ? ` (${qty}cx)` : ""}:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">R$ {totalVenda.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Custo ({fonte}):</span>
              <span className="font-bold text-red-600">-R$ {totalCusto.toFixed(2)} ({custoPerc.toFixed(1)}%)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">ICMS ({taxBreakdown.icms.toFixed(2)}%):</span>
              <span className="font-bold text-red-600">-R$ {(totalVenda * taxBreakdown.icms / 100 * effectiveNfFactor).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">PIS ({taxBreakdown.pis.toFixed(3)}%):</span>
              <span className="font-bold text-red-600">-R$ {(totalVenda * taxBreakdown.pis / 100 * effectiveNfFactor).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">COFINS ({taxBreakdown.cofins.toFixed(2)}%):</span>
              <span className="font-bold text-red-600">-R$ {(totalVenda * taxBreakdown.cofins / 100 * effectiveNfFactor).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">IRPJ ({taxBreakdown.irpj.toFixed(2)}%):</span>
              <span className="font-bold text-red-600">-R$ {(totalVenda * taxBreakdown.irpj / 100 * effectiveNfFactor).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">CSLL ({taxBreakdown.csll.toFixed(2)}%):</span>
              <span className="font-bold text-red-600">-R$ {(totalVenda * taxBreakdown.csll / 100 * effectiveNfFactor).toFixed(2)}</span>
            </div>
            {taxBreakdown.difal > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">DIFAL ({taxBreakdown.difal.toFixed(2)}%):</span>
                <span className="font-bold text-red-600">-R$ {(totalVenda * taxBreakdown.difal / 100 * effectiveNfFactor).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Frete ({fretePerc}%):</span>
              <span className="font-bold text-red-600">-R$ {totalFrete.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Comissão ({comissaoPerc}%):</span>
              <span className="font-bold text-red-600">-R$ {totalComissao.toFixed(2)}</span>
            </div>
            {custosAdicionaisPerc > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Custos Adic. ({custosAdicionaisPerc}%):</span>
                <span className="font-bold text-red-600">-R$ {totalCustosAd.toFixed(2)}</span>
              </div>
            )}
            <div className="col-span-2 border-t border-slate-300 dark:border-slate-600 pt-1 mt-0.5 flex justify-between">
              <span className="text-[10px] text-slate-700 dark:text-slate-300 font-bold">Lucro Líquido{qty > 1 ? ` (${qty}cx)` : ""}:</span>
              <span className={`text-[11px] font-black ${totalLucro >= 0 ? "text-green-700" : "text-red-700"}`}>
                R$ {totalLucro.toFixed(2)} ({margin.toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>
      )}
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
  nfPercent?: number | null;
  onNfPercentClick?: () => void;
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
  nfPercent,
  onNfPercentClick,
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
      {onNfPercentClick && (
        <button
          onClick={onNfPercentClick}
          className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 border border-amber-300 hover:bg-amber-200 transition-colors"
          title="Tipo de Faturamento"
        >
          <span className="text-[9px] text-amber-700 font-bold">Tipo de Faturamento</span>
          {nfPercent !== undefined && nfPercent !== null && (
            <span className="text-[10px] font-bold text-amber-800 ml-0.5">
              — {nfPercent === 0 ? "Zap0" : nfPercent === 100 ? "Zap1" : nfPercent === 50 ? "Zap2" : nfPercent === 33 ? "Zap3" : nfPercent === 25 ? "Zap4" : "Zap5"}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
