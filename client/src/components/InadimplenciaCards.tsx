/**
import { flexMatch, flexMatchMultiple } from "@shared/flexSearch";
 * Componente unificado de Inadimplência
 * Card único com abas internas: Evolução (gráfico) e Clientes (tabela)
 * Usado tanto na aba Financeiro quanto na aba Vendas
 */

import React, { useState, useMemo, useRef, useCallback } from "react";
import { useOperator } from "@/contexts/OperatorContext";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  Loader2,
  BarChart3,
  Users,
  ChevronRight,
  ChevronDown,
  X,
  Search,
  ArrowUpDown,
  Filter,
  Eye,
  ExternalLink,
  ClipboardList,
  ChevronUp,
  CheckCircle2,
  DollarSign,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import MaxiprodAutoVerifier from "@/components/MaxiprodAutoVerifier";

const MAXIPROD_AUTHORIZED_OPERATORS = ["Guilherme", "Fernando", "Bruno"];
const MAXIPROD_LOGIN_URL = "https://app.maxiprod.com.br/";

/* ---- Helpers ---- */
function formatCurrency(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

function formatCurrencyShort(n: number): string {
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `R$ ${(n / 1_000).toFixed(1)}K`;
  return formatCurrency(n);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = dateStr.split("T")[0];
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = dateStr.split("T")[0];
  const venc = new Date(d + "T12:00:00");
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.floor((venc.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/* ---- Painel de detalhes do mês selecionado ---- */
function MesDetalhePanel({ mes, clienteFilter, grupo, crmSegmento }: { mes: string; clienteFilter: string; grupo?: string; crmSegmento?: string }) {
  const { data, isLoading } = trpc.financial.getInadimplenciaDetalhesMes.useQuery(
    { mes, clienteFilter: clienteFilter || undefined, grupo: grupo || undefined, crmSegmento: crmSegmento || undefined }
  );

  const formatMonth = (m: string) => {
    const [y, mo] = m.split("-");
    const months = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
    return `${months[parseInt(mo, 10) - 1]} ${y}`;
  };

  const formatDateShort = (d: string) => {
    if (!d) return "";
    const [_y, m, day] = d.split("-");
    return `${day}/${m}`;
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-4 h-4 animate-spin text-red-400" />
    </div>
  );

  if (!data || data.titulos.length === 0) return (
    <div className="flex items-center justify-center h-full text-xs text-slate-400">
      Sem títulos neste mês
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50">
        <p className="text-xs font-semibold text-slate-700">{formatMonth(mes)}</p>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-sm font-bold text-red-700">{formatCurrency(data.total)}</span>
          <span className="text-[10px] text-slate-400">{data.count} título{data.count !== 1 ? "s" : ""}</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {data.titulos.map((t: any, i: number) => (
          <div key={i} className={`px-3 py-1.5 flex items-center justify-between gap-2 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/30"} hover:bg-red-50/40 transition-colors`}>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-slate-700 truncate" title={t.cliente}>{t.cliente}</p>
              <p className="text-[9px] text-slate-400">{formatDateShort(t.vencimento)}{t.referenteA ? ` · ${t.referenteA.split(" ref. ")[1] || t.referenteA}` : ""}</p>
            </div>
            <span className="text-[11px] font-semibold text-red-700 whitespace-nowrap">{formatCurrency(t.valor)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- Aba Evolução (gráfico de barras + série histórica) ---- */
function EvolucaoTab({ chartFilter, setChartFilter, searchInput, setSearchInput, grupo, crmSegmento }: {
  chartFilter: string;
  setChartFilter: (v: string) => void;
  searchInput: string;
  setSearchInput: (v: string) => void;
  grupo?: string;
  crmSegmento?: string;
}) {
  const queryInput = useMemo(() => {
    const params: { clienteFilter?: string; grupo?: string; crmSegmento?: string } = {};
    if (chartFilter) params.clienteFilter = chartFilter;
    if (grupo && grupo !== "all") params.grupo = grupo;
    if (crmSegmento && crmSegmento !== "all") params.crmSegmento = crmSegmento;
    return Object.keys(params).length > 0 ? params : undefined;
  }, [chartFilter, grupo, crmSegmento]);
  const { data: timeline, isLoading } = trpc.financial.getInadimplenciaTimeline.useQuery(queryInput);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredDot, setHoveredDot] = useState<number | null>(null);

  const formatMonth = (mes: string) => {
    const [y, m] = mes.split("-");
    const months = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
    return `${months[parseInt(m, 10) - 1]}/${y.slice(2)}`;
  };

  const chartData = useMemo(() => {
    if (!timeline || timeline.length === 0) return [];
    let accumulated = 0;
    return timeline.map((point: any) => {
      accumulated += point.total;
      return {
        mes: point.mes,
        label: formatMonth(point.mes),
        valor: point.total,
        acumulado: accumulated,
        count: point.count,
      };
    });
  }, [timeline]);

  useMemo(() => {
    if (chartData.length > 0 && selectedIdx === null) {
      setSelectedIdx(chartData.length - 1);
    }
  }, [chartData]);

  const svgWidth = 420;
  const svgHeight = 220;
  const paddingLeft = 50;
  const paddingRight = 10;
  const paddingTop = 15;
  const paddingBottom = 30;
  const chartW = svgWidth - paddingLeft - paddingRight;
  const chartH = svgHeight - paddingTop - paddingBottom;

  const maxVal = useMemo(() => {
    if (chartData.length === 0) return 1;
    return Math.max(...chartData.map((d: any) => d.valor), 1);
  }, [chartData]);

  const bars = useMemo(() => {
    if (chartData.length === 0) return [];
    const barW = Math.min(22, Math.max(8, (chartW - (chartData.length - 1) * 4) / chartData.length));
    const gap = Math.min(4, (chartW - chartData.length * barW) / Math.max(chartData.length - 1, 1));
    const totalBarsWidth = chartData.length * barW + (chartData.length - 1) * gap;
    const offsetX = paddingLeft + (chartW - totalBarsWidth) / 2;
    return chartData.map((d: any, i: number) => {
      const x = offsetX + i * (barW + gap);
      const h = Math.max((d.valor / maxVal) * chartH, 2);
      const y = paddingTop + chartH - h;
      return { x, y, w: barW, h, ...d };
    });
  }, [chartData, chartW, chartH, maxVal]);

  const gridLines = useMemo(() => {
    const lines = [];
    const steps = 3;
    for (let i = 0; i <= steps; i++) {
      const val = (maxVal / steps) * i;
      const y = paddingTop + chartH - (val / maxVal) * chartH;
      lines.push({ y, val });
    }
    return lines;
  }, [maxVal, chartH]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-red-400" />
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <p className="text-xs text-slate-400 text-center py-8">{chartFilter ? `Nenhum dado para "${chartFilter}"` : "Sem dados"}</p>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row">
      {/* Lado esquerdo: Gráfico */}
      <div className="lg:w-[55%] p-4 lg:border-r border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="text-xs font-semibold text-slate-600">
              {chartFilter ? `Evolução — ${chartFilter.toUpperCase()}` : "Evolução Mensal"}
            </h4>
            <p className="text-[9px] text-slate-400 mt-0.5">Clique em uma barra para ver detalhes · <span className="text-red-600/70">Linha = acumulado</span></p>
          </div>
        </div>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto"
        >
          <defs>
            <linearGradient id="inadBarDefault" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fcd34d" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.6" />
            </linearGradient>
            <linearGradient id="inadBarActive" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {gridLines.map((line, i) => (
            <g key={i}>
              <line x1={paddingLeft} y1={line.y} x2={svgWidth - paddingRight} y2={line.y} stroke="#f1f5f9" strokeWidth="0.5" />
              <text x={paddingLeft - 5} y={line.y + 3} textAnchor="end" fill="#94a3b8" fontSize="7" fontFamily="system-ui">
                {line.val >= 1000 ? `${(line.val / 1000).toFixed(0)}K` : line.val.toFixed(0)}
              </text>
            </g>
          ))}

          {/* Bars */}
          {bars.map((bar, i) => {
            const isActive = selectedIdx === i;
            return (
              <g key={i} className="cursor-pointer" onClick={() => setSelectedIdx(i)}>
                <rect
                  x={bar.x} y={bar.y} width={bar.w} height={Math.max(bar.h, 2)}
                  rx={bar.w > 12 ? 4 : 2}
                  fill={isActive ? "url(#inadBarActive)" : "url(#inadBarDefault)"}
                  opacity={selectedIdx !== null && !isActive ? 0.45 : 1}
                  style={{ transition: "all 0.2s ease" }}
                />
                {isActive && (
                  <text x={bar.x + bar.w / 2} y={bar.y - 5} textAnchor="middle" fill="#92400e" fontSize="7.5" fontWeight="600" fontFamily="system-ui">
                    {formatCurrencyShort(bar.valor)}
                  </text>
                )}
                <text
                  x={bar.x + bar.w / 2} y={paddingTop + chartH + 14}
                  textAnchor="middle"
                  fill={isActive ? "#92400e" : "#94a3b8"}
                  fontSize="6.5" fontWeight={isActive ? "600" : "400"} fontFamily="system-ui"
                  style={{ transition: "fill 0.2s ease" }}
                >
                  {bar.label}
                </text>
                {isActive && (
                  <circle cx={bar.x + bar.w / 2} cy={paddingTop + chartH + 21} r="1.5" fill="#f59e0b" />
                )}
              </g>
            );
          })}

          {/* Trend line */}
          {bars.length > 1 && (() => {
            const maxAcum = bars.reduce((s: number, b: any) => s + b.valor, 0) || 1;
            const normalizedPoints = bars.map((bar: any, i: number) => {
              const acumAtI = bars.slice(0, i + 1).reduce((s: number, b: any) => s + b.valor, 0);
              const y = paddingTop + chartH - (acumAtI / maxAcum) * (chartH - 5);
              return { x: bar.x + bar.w / 2, y };
            });
            const pathD = normalizedPoints.map((p: any, i: number) => {
              if (i === 0) return `M ${p.x} ${p.y}`;
              const prev = normalizedPoints[i - 1];
              const cpx = (prev.x + p.x) / 2;
              return `C ${cpx} ${prev.y}, ${cpx} ${p.y}, ${p.x} ${p.y}`;
            }).join(" ");
            const acumValues = bars.map((_: any, i: number) =>
              bars.slice(0, i + 1).reduce((s: number, b: any) => s + b.valor, 0)
            );
            return (
              <g>
                <path d={pathD} fill="none" stroke="#92400e" strokeWidth="1" strokeOpacity="0.5" strokeLinecap="round" strokeLinejoin="round" />
                {normalizedPoints.map((p: any, i: number) => (
                  <g key={`dot-${i}`}>
                    <circle cx={p.x} cy={p.y} r="10" fill="transparent" onMouseEnter={() => setHoveredDot(i)} onMouseLeave={() => setHoveredDot(null)} onTouchStart={(e) => { e.preventDefault(); setHoveredDot(hoveredDot === i ? null : i); }} className="cursor-pointer" style={{ pointerEvents: "all" }} />
                    <circle
                      cx={p.x} cy={p.y}
                      r={hoveredDot === i ? 4 : 2.5}
                      fill="#92400e"
                      fillOpacity={hoveredDot === i ? 0.8 : 0.5}
                      stroke={hoveredDot === i ? "#fef3c7" : "none"}
                      strokeWidth={hoveredDot === i ? 1.5 : 0}
                      style={{ transition: "all 0.15s ease", pointerEvents: "none" }}
                    />
                    {hoveredDot === i && (
                      <g style={{ pointerEvents: "none" }}>
                        <rect x={p.x - 40} y={p.y - 24} width="80" height="18" rx="4" fill="#292524" fillOpacity="0.9" />
                        <text x={p.x} y={p.y - 12} textAnchor="middle" fill="#fef3c7" fontSize="7.5" fontWeight="600" fontFamily="system-ui">
                          {formatCurrencyShort(acumValues[i])}
                        </text>
                      </g>
                    )}
                  </g>
                ))}
              </g>
            );
          })()}
        </svg>
      </div>

      {/* Lado direito: Detalhes do mês */}
      <div className="lg:w-[45%] bg-slate-50/30 flex flex-col" style={{ minHeight: "280px", maxHeight: "340px" }}>
        <div className="px-3 py-2 border-b border-slate-200 bg-gradient-to-r from-red-50 to-red-100/50">
          <p className="text-[10px] text-red-600 font-medium uppercase tracking-wider">
            {chartFilter ? `Série — ${chartFilter.toUpperCase()}` : "Série Histórica"}
          </p>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-lg font-bold text-red-800">
              {formatCurrency(chartData.reduce((sum: number, d: any) => sum + d.valor, 0))}
            </span>
            <span className="text-[10px] text-red-600/70">
              {chartData.reduce((sum: number, d: any) => sum + d.count, 0)} títulos · {chartData.length} meses
            </span>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          {selectedIdx !== null && chartData[selectedIdx] ? (
            <MesDetalhePanel
              mes={chartData[selectedIdx].mes}
              clienteFilter={chartFilter}
              grupo={grupo}
              crmSegmento={crmSegmento}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12">
              <BarChart3 className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-xs">Selecione um mês no gráfico</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---- Aba Clientes (tabela ranqueada) ---- */
/**
 * Seção de títulos resolvidos/pagos para um cliente específico.
 * Busca dados do getResolvedTitles e filtra pelo nome do cliente.
 */
function ClienteResolvedSection({ clienteName }: { clienteName: string }) {
  const { data: resolvedData } = trpc.financial.getResolvedTitles.useQuery({ sortOrder: 'newest', sortBy: 'resolvedAt', sortDir: 'desc' });
  const [expanded, setExpanded] = useState(false);

  const clienteResolved = useMemo(() => {
    if (!resolvedData?.titles) return [];
    const normalizedName = clienteName.toUpperCase().trim();
    return resolvedData.titles.filter(t => (t.cliente || '').toUpperCase().trim() === normalizedName);
  }, [resolvedData, clienteName]);

  if (clienteResolved.length === 0) return null;

  const totalValor = clienteResolved.reduce((sum, t) => sum + t.valorAReceber, 0);

  return (
    <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/60 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-emerald-100/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span className="text-[11px] font-bold text-emerald-800">Pagos / Resolvidos</span>
          <span className="bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{clienteResolved.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-emerald-700">{formatCurrency(totalValor)}</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-emerald-500" /> : <ChevronDown className="w-3.5 h-3.5 text-emerald-500" />}
        </div>
      </button>
      {expanded && (
        <div className="border-t border-emerald-200">
          <div className="bg-white rounded-b overflow-hidden">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-emerald-50 border-b border-emerald-100">
                  <th className="px-3 py-1.5 text-left text-emerald-700 font-semibold">Data Resolução</th>
                  <th className="px-3 py-1.5 text-left text-emerald-700 font-semibold">Vencimento</th>
                  <th className="px-3 py-1.5 text-center text-emerald-700 font-semibold">Dias Atraso</th>
                  <th className="px-3 py-1.5 text-right text-emerald-700 font-semibold">Valor</th>
                  <th className="px-3 py-1.5 text-left text-emerald-700 font-semibold">Documento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-50">
                {clienteResolved.map((t, i) => (
                  <tr key={i} className="hover:bg-emerald-50/50">
                    <td className="px-3 py-1.5 text-emerald-800 font-medium">
                      {t.resolvedAt ? new Date(t.resolvedAt).toLocaleDateString('pt-BR') : '-'}
                    </td>
                    <td className="px-3 py-1.5 text-slate-600">
                      {t.vencimento ? formatDate(t.vencimento) : '-'}
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <span className="inline-flex items-center justify-center min-w-[28px] px-1 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                        {t.diasAtrasoNaResolucao || 0}d
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right font-semibold text-emerald-700">{formatCurrency(t.valorAReceber)}</td>
                    <td className="px-3 py-1.5 text-slate-500 truncate max-w-[150px]">{t.documento || t.empresa || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 bg-emerald-50/80 border-t border-emerald-100 flex items-center justify-between">
            <span className="text-[10px] text-emerald-600">
              {clienteResolved.length} título{clienteResolved.length !== 1 ? 's' : ''} recuperado{clienteResolved.length !== 1 ? 's' : ''} da inadimplência
            </span>
            <span className="text-[10px] font-bold text-emerald-700">Total: {formatCurrency(totalValor)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

type SortFieldClientes = "valor" | "data" | "titulos" | "vendedor";
type SortDirClientes = "asc" | "desc";

function ClientesTab({ grupo, crmSegmento }: { grupo?: string; crmSegmento?: string }) {
  const queryInput = useMemo(() => {
    const params: { grupo?: string; crmSegmento?: string } = {};
    if (grupo && grupo !== "all") params.grupo = grupo;
    if (crmSegmento && crmSegmento !== "all") params.crmSegmento = crmSegmento;
    return Object.keys(params).length > 0 ? params : undefined;
  }, [grupo, crmSegmento]);
  const { data: clientes, isLoading } = trpc.financial.getClientesInadimplentes.useQuery(queryInput);
  const { data: resolvedAllData } = trpc.financial.getResolvedTitles.useQuery({ sortOrder: 'newest', sortBy: 'resolvedAt', sortDir: 'desc' });
  const [expandedCliente, setExpandedCliente] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [vendedorFilter, setVendedorFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortFieldClientes>("valor");
  const [sortDir, setSortDir] = useState<SortDirClientes>("desc");
  const [pagosDialogCliente, setPagosDialogCliente] = useState<string | null>(null);

  // Resolved titles for the selected client in the dialog
  const pagosDialogTitles = useMemo(() => {
    if (!pagosDialogCliente || !resolvedAllData?.titles) return [];
    const normalizedName = pagosDialogCliente.toUpperCase().trim();
    return resolvedAllData.titles.filter(t => (t.cliente || '').toUpperCase().trim() === normalizedName);
  }, [pagosDialogCliente, resolvedAllData]);
  const pagosDialogTotal = useMemo(() => pagosDialogTitles.reduce((sum, t) => sum + t.valorAReceber, 0), [pagosDialogTitles]);

  const totalGeral = useMemo(() => {
    if (!clientes) return 0;
    return clientes.reduce((sum: number, c: any) => sum + c.total, 0);
  }, [clientes]);

  // Map of client name -> resolved count
  const resolvedCountMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!resolvedAllData?.titles) return map;
    for (const t of resolvedAllData.titles) {
      const name = (t.cliente || '').toUpperCase().trim();
      map.set(name, (map.get(name) || 0) + 1);
    }
    return map;
  }, [resolvedAllData]);

  // Lista de vendedores atualiza automaticamente com novos vendedores do Maxiprod
  // GILSON sempre aparece no filtro mesmo que não tenha clientes inadimplentes ainda
  const vendedoresUnicos = useMemo(() => {
    if (!clientes) return ["GILSON"];
    const set = new Set<string>();
    set.add("GILSON");
    for (const c of clientes) {
      if (c.vendedor) set.add(c.vendedor);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [clientes]);

  const enrichedClientes = useMemo(() => {
    if (!clientes) return [];
    return clientes.map((c: any) => {
      const oldest = c.titulos.reduce((min: string | null, t: any) => {
        if (!t.vencimento) return min;
        if (!min) return t.vencimento;
        return t.vencimento < min ? t.vencimento : min;
      }, null as string | null);
      return { ...c, oldestDate: oldest };
    });
  }, [clientes]);

  const filteredClientes = useMemo(() => {
    let result = [...enrichedClientes];

    if (vendedorFilter && vendedorFilter !== "all") {
      if (vendedorFilter === "__sem_vendedor__") {
        result = result.filter((c: any) => !c.vendedor);
      } else {
        result = result.filter((c: any) => c.vendedor === vendedorFilter);
      }
    }

    if (searchTerm.trim()) {
      result = result.filter((c: any) =>
        flexMatchMultiple([c.cliente, c.vendedor || ""], searchTerm)
      );
    }

    result.sort((a: any, b: any) => {
      let cmp = 0;
      switch (sortField) {
        case "valor": cmp = a.total - b.total; break;
        case "titulos": cmp = a.count - b.count; break;
        case "data": cmp = (a.oldestDate || "9999").localeCompare(b.oldestDate || "9999"); break;
        case "vendedor": cmp = (a.vendedor || "zzz").localeCompare(b.vendedor || "zzz"); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [enrichedClientes, searchTerm, vendedorFilter, sortField, sortDir]);

  const handleSort = (field: SortFieldClientes) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortFieldClientes }) => (
    <ArrowUpDown className={`w-3 h-3 inline ml-0.5 ${sortField === field ? "text-red-600" : "text-slate-300"}`} />
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-red-400" />
      </div>
    );
  }

  if (!clientes || clientes.length === 0) {
    return <p className="text-xs text-slate-400 text-center py-4">Nenhum cliente inadimplente</p>;
  }

  return (
    <>
      {/* Barra de busca e filtro por vendedor */}
      <div className="px-4 py-3 bg-red-50/30 border-b border-red-100">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input
              placeholder="Buscar cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-8 text-xs bg-white"
            />
          </div>
          <Select value={vendedorFilter} onValueChange={setVendedorFilter}>
            <SelectTrigger className="w-full sm:w-[200px] h-8 text-xs bg-white">
              <div className="flex items-center gap-1.5">
                <Filter className="w-3 h-3 text-slate-400" />
                <SelectValue placeholder="Vendedor" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Vendedores</SelectItem>
              {vendedoresUnicos.map((v) => (
                <SelectItem key={v} value={v}>{v}</SelectItem>
              ))}
              <SelectItem value="__sem_vendedor__">Sem vendedor</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(searchTerm || (vendedorFilter && vendedorFilter !== "all")) && (
          <div className="flex items-center justify-between mt-2">
            <p className="text-[10px] text-slate-400">
              {filteredClientes.length} de {clientes.length} clientes
              {vendedorFilter && vendedorFilter !== "all" && (
                <span className="ml-1">
                  · Vendedor: <span className="font-semibold text-red-600">
                    {vendedorFilter === "__sem_vendedor__" ? "Sem vendedor" : vendedorFilter}
                  </span>
                </span>
              )}
            </p>
            {(searchTerm || vendedorFilter !== "all") && (
              <button
                onClick={() => { setSearchTerm(""); setVendedorFilter("all"); }}
                className="text-[10px] text-slate-400 hover:text-red-600 transition-colors flex items-center gap-0.5"
              >
                <X className="w-3 h-3" /> Limpar filtros
              </button>
            )}
          </div>
        )}
      </div>
      <div className="max-h-[500px] overflow-y-auto overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        <table className="min-w-[600px] w-full text-xs">
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-2 text-left text-slate-500 font-semibold w-8">#</th>
              <th className="px-3 py-2 text-left text-slate-500 font-semibold">Cliente</th>
              <th className="px-3 py-2 text-center text-emerald-600 font-semibold whitespace-nowrap">Pagos</th>
              <th className="px-3 py-2 text-left text-slate-500 font-semibold cursor-pointer hover:text-red-600 select-none" onClick={() => handleSort("vendedor")}>
                Vendedor <SortIcon field="vendedor" />
              </th>
              <th className="px-3 py-2 text-right text-slate-500 font-semibold cursor-pointer hover:text-red-600 select-none" onClick={() => handleSort("valor")}>
                Falta Pagar <SortIcon field="valor" />
              </th>

              <th className="px-3 py-2 text-center text-slate-500 font-semibold cursor-pointer hover:text-red-600 select-none" onClick={() => handleSort("titulos")}>
                Títulos <SortIcon field="titulos" />
              </th>
              <th className="px-3 py-2 text-center text-slate-500 font-semibold cursor-pointer hover:text-red-600 select-none" onClick={() => handleSort("data")}>
                Mais Antigo <SortIcon field="data" />
              </th>
              <th className="px-3 py-2 text-right text-slate-500 font-semibold">% do Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {filteredClientes.map((c: any, idx: number) => {
              const pct = totalGeral > 0 ? (c.total / totalGeral) * 100 : 0;
              const clienteKey = c.cliente;
              const isExpanded = expandedCliente === clienteKey;
              const diasAntigo = c.oldestDate ? daysUntil(c.oldestDate) : null;
              return (
                <React.Fragment key={clienteKey}>
                  <tr
                    className={`transition-colors cursor-pointer ${isExpanded ? "bg-red-50" : "hover:bg-slate-50 dark:hover:bg-slate-700"}`}
                    onClick={() => setExpandedCliente(isExpanded ? null : clienteKey)}
                  >
                    <td className="px-4 py-2.5 text-slate-400 font-mono">{idx + 1}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <ChevronRight className={`w-4 h-4 text-red-600 transition-transform flex-shrink-0 ${isExpanded ? "rotate-90" : ""}`} />
                        <span className="font-medium text-slate-800 truncate max-w-[240px]" title={c.cliente}>{c.cliente}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {(() => {
                        const count = resolvedCountMap.get(c.cliente.toUpperCase().trim()) || 0;
                        return count > 0 ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); setPagosDialogCliente(c.cliente); }}
                            className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-200 hover:border-emerald-300 hover:scale-110 transition-all cursor-pointer"
                            title={`Ver ${count} título(s) pago(s) de ${c.cliente}`}
                          >{count}</button>
                        ) : (
                          <span className="text-slate-300">—</span>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-2.5">
                      {c.vendedor ? (
                        <span className="text-slate-600 text-[11px] truncate max-w-[160px] block" title={c.vendedor}>{c.vendedor}</span>
                      ) : (
                        <span className="text-slate-300 text-[11px] italic">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="font-bold text-red-700">{formatCurrency(c.total)}</span>
                    </td>

                    <td className="px-3 py-2.5 text-center">
                      <Badge className="bg-red-100 text-red-700 text-[10px] border-0">{c.count}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {c.oldestDate ? (
                        <div>
                          <span className="text-slate-700">{formatDate(c.oldestDate)}</span>
                          {diasAntigo !== null && diasAntigo < 0 && (
                            <span className="text-red-500 text-[10px] ml-1">({Math.abs(diasAntigo)}d)</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-red-500 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                        <span className="text-slate-500 w-10 text-right">{pct.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={8} className="p-0">
                        <div className="bg-red-50/60 border-t border-red-100 px-6 py-3">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-[11px] font-bold text-red-700">
                              Títulos vencidos — {c.cliente}
                            </h4>
                            <span className="text-[10px] text-red-600">
                              {c.count} título(s) • Total: {formatCurrency(c.total)}
                            </span>
                          </div>
                          <div className="bg-white rounded border border-red-100 overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                            <table className="min-w-[500px] w-full text-[11px]">
                              <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200">
                                  <th className="px-3 py-1.5 text-left text-slate-500 font-semibold">Vencimento</th>
                                  <th className="px-3 py-1.5 text-left text-slate-500 font-semibold">Dias</th>
                                  <th className="px-3 py-1.5 text-right text-slate-500 font-semibold">Valor</th>
                                  <th className="px-3 py-1.5 text-left text-slate-500 font-semibold">Referência</th>
                                  <th className="px-3 py-1.5 text-center text-slate-500 font-semibold">Parcela</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                                {c.titulos.map((t: any, i: number) => {
                                  const dias = daysUntil(t.vencimento);
                                  return (
                                    <tr key={i} className="hover:bg-red-50/50">
                                      <td className="px-3 py-1.5 text-slate-700">{formatDate(t.vencimento)}</td>
                                      <td className="px-3 py-1.5">
                                        {dias !== null && dias < 0 ? (
                                          <span className="text-red-600 font-semibold">{Math.abs(dias)}d atr.</span>
                                        ) : (
                                          <span className="text-slate-400">—</span>
                                        )}
                                      </td>
                                      <td className="px-3 py-1.5 text-right font-semibold text-red-700">{formatCurrency(t.valor)}</td>
                                      <td className="px-3 py-1.5 text-slate-500 truncate max-w-[200px]">{t.referenteA || t.documento || "—"}</td>
                                      <td className="px-3 py-1.5 text-center text-slate-400">{t.parcela || "—"}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          {/* Pagos/Resolvidos deste cliente */}
                          <ClienteResolvedSection clienteName={c.cliente} />
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {filteredClientes.length === 0 && (searchTerm || vendedorFilter !== "all") && (
        <p className="text-xs text-slate-400 text-center py-4">
          Nenhum cliente encontrado
          {searchTerm && <> para "{searchTerm}"</>}
          {vendedorFilter !== "all" && <> (vendedor: {vendedorFilter === "__sem_vendedor__" ? "sem vendedor" : vendedorFilter})</>}
        </p>
      )}

      {/* Dialog de Títulos Pagos/Resolvidos */}
      <Dialog open={!!pagosDialogCliente} onOpenChange={(open) => { if (!open) setPagosDialogCliente(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="w-5 h-5" />
              Títulos Pagos — {pagosDialogCliente}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            {pagosDialogTitles.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">Nenhum título resolvido encontrado.</p>
            ) : (
              <>
                <div className="flex items-center justify-between px-1 py-2 mb-2">
                  <span className="text-xs text-emerald-600 font-medium">
                    {pagosDialogTitles.length} título{pagosDialogTitles.length !== 1 ? 's' : ''} recuperado{pagosDialogTitles.length !== 1 ? 's' : ''}
                  </span>
                  <span className="text-sm font-bold text-emerald-700">
                    Total: {formatCurrency(pagosDialogTotal)}
                  </span>
                </div>
                <div className="bg-white rounded-lg border border-emerald-200 overflow-x-auto -mx-1 px-1" style={{ WebkitOverflowScrolling: 'touch' }}>
                  <table className="min-w-[700px] w-full text-xs">
                    <thead>
                      <tr className="bg-emerald-50 border-b border-emerald-100">
                        <th className="px-3 py-2 text-left text-emerald-700 font-semibold">Data Resolução</th>
                        <th className="px-3 py-2 text-left text-emerald-700 font-semibold">Vencimento</th>
                        <th className="px-3 py-2 text-center text-emerald-700 font-semibold">Dias Atraso</th>
                        <th className="px-3 py-2 text-right text-emerald-700 font-semibold">Valor</th>
                        <th className="px-3 py-2 text-left text-emerald-700 font-semibold">Documento</th>
                        <th className="px-3 py-2 text-left text-emerald-700 font-semibold">Empresa</th>
                        <th className="px-3 py-2 text-left text-emerald-700 font-semibold">Vendedor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-50">
                      {pagosDialogTitles.map((t, i) => (
                        <tr key={i} className="hover:bg-emerald-50/50">
                          <td className="px-3 py-2 text-emerald-800 font-medium">
                            {t.resolvedAt ? new Date(t.resolvedAt).toLocaleDateString('pt-BR') : '—'}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {t.vencimento ? formatDate(t.vencimento) : '—'}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className="inline-flex items-center justify-center min-w-[28px] px-1 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                              {t.diasAtrasoNaResolucao || 0}d
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-emerald-700">{formatCurrency(t.valorAReceber)}</td>
                          <td className="px-3 py-2 text-slate-500 truncate max-w-[120px]" title={t.documento || ''}>{t.documento || '—'}</td>
                          <td className="px-3 py-2 text-slate-500 truncate max-w-[100px]" title={t.empresa || ''}>{t.empresa || '—'}</td>
                          <td className="px-3 py-2 text-slate-500 truncate max-w-[100px]" title={t.vendedor || ''}>{t.vendedor || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ---- Card Unificado de Inadimplência ---- */
type ActiveTab = "evolucao" | "clientes";

/* ============================================================
   Modal de Contraprova Maxiprod para Inadimplência
   ============================================================ */
function MaxiprodVerifyModalInadimplencia({
  onClose,
  context,
}: {
  onClose: () => void;
  context: {
    valorManus?: number;
    valorMaxiprod?: number;
    maxiprodLoading?: boolean;
  };
}) {
  const steps = useMemo(() => {
    const s: { step: number; text: string; highlight?: boolean }[] = [];
    let n = 1;
    s.push({ step: n++, text: "Acesse o Maxiprod: app.maxiprod.com.br" });
    s.push({ step: n++, text: "Login: lfernandoaleixo@gmail.com | Senha: Luizfernando7008*" });
    s.push({ step: n++, text: "Vá em: Financeiro \u2192 Contas a receber" });
    s.push({ step: n++, text: 'Estado: marque apenas "A receber"' });
    s.push({ step: n++, text: 'Vencimento: até a data de hoje (apenas vencidos)' });
    s.push({ step: n++, text: 'NOTA: O dashboard considera apenas títulos vencidos com estado "A receber"', highlight: true });
    if (context.valorManus !== undefined) {
      s.push({ step: n++, text: `Compare o total com o valor da Manus: ${formatCurrency(context.valorManus)}`, highlight: true });
    }
    return s;
  }, [context]);

  const divergencia = context.valorManus !== undefined && context.valorMaxiprod !== undefined
    ? Math.abs(context.valorManus - context.valorMaxiprod)
    : null;
  const hasDivergencia = divergencia !== null && divergencia > 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-red-950 via-slate-900 to-red-950 px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/30">
                <Eye className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold text-base">Contraprova Maxiprod</h3>
                <p className="text-red-300 text-xs">Inadimplência (Títulos Vencidos)</p>
              </div>
            </div>
            <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="px-4 py-2.5 bg-white/10 rounded-lg border border-white/20">
              <span className="text-red-300 text-[10px] uppercase tracking-wider">Valor na Manus</span>
              <p className="text-white font-bold text-lg" style={{ textShadow: "0 0 15px rgba(239,68,68,0.4)" }}>
                {context.valorManus !== undefined ? formatCurrency(context.valorManus) : "-"}
              </p>
            </div>
            <div className={`px-4 py-2.5 rounded-lg border ${
              context.maxiprodLoading ? "bg-white/5 border-white/10" :
              hasDivergencia ? "bg-red-500/20 border-red-400/40" : "bg-emerald-500/20 border-emerald-400/40"
            }`}>
              <span className="text-red-300 text-[10px] uppercase tracking-wider">Valor Maxiprod (API)</span>
              {context.maxiprodLoading ? (
                <div className="flex items-center gap-2 mt-1">
                  <Loader2 className="w-4 h-4 animate-spin text-red-300" />
                  <span className="text-red-300 text-sm">Consultando...</span>
                </div>
              ) : context.valorMaxiprod !== undefined ? (
                <p className={`font-bold text-lg ${hasDivergencia ? "text-red-300" : "text-emerald-300"}`}
                  style={{ textShadow: hasDivergencia ? "0 0 15px rgba(239,68,68,0.4)" : "0 0 15px rgba(52,211,153,0.4)" }}>
                  {formatCurrency(context.valorMaxiprod)}
                </p>
              ) : (
                <p className="text-white/50 text-sm mt-1">Indisponível</p>
              )}
            </div>
          </div>
          {hasDivergencia && (
            <div className="mt-2 px-4 py-2 bg-red-500/20 rounded-lg border border-red-400/30 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-300 flex-shrink-0" />
              <span className="text-red-200 text-xs font-semibold">
                Divergência de {formatCurrency(divergencia!)} detectada! Solicite autorização para corrigir.
              </span>
            </div>
          )}
          {!hasDivergencia && context.valorMaxiprod !== undefined && !context.maxiprodLoading && (
            <div className="mt-2 px-4 py-2 bg-emerald-500/20 rounded-lg border border-emerald-400/30 flex items-center gap-2">
              <span className="text-emerald-200 text-xs font-semibold">Valores conferem! Sem divergência.</span>
            </div>
          )}
        </div>
        <div className="px-6 py-5 max-h-[50vh] overflow-y-auto space-y-2.5">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <ClipboardList className="w-4 h-4" /> Passo a passo para verificação
          </div>
          {steps.map(st => (
            <div key={st.step} className={`flex items-start gap-3 p-3 rounded-lg transition-all ${
              st.highlight ? "bg-amber-50 border-2 border-amber-300 shadow-sm" : "bg-slate-50 dark:bg-slate-800/50 border border-slate-200"
            }`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                st.highlight ? "bg-amber-500 text-white shadow-md shadow-amber-500/30" : "bg-red-600 text-white"
              }`}>{st.step}</div>
              <p className={`text-sm leading-relaxed pt-0.5 ${
                st.highlight ? "text-amber-800 font-semibold" : "text-slate-700"
              }`}>{st.text}</p>
            </div>
          ))}
        </div>
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 flex items-center justify-between">
          <a href={MAXIPROD_LOGIN_URL} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-red-600 to-red-700 text-white text-sm font-bold shadow-lg shadow-red-500/30 hover:shadow-red-500/50 transition-all hover:scale-[1.02]">
            <ExternalLink className="w-4 h-4" /> Abrir Maxiprod
          </a>
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 font-medium">Fechar</button>
        </div>
      </div>
    </div>
  );
}

export function InadimplenciaCard({ summary, grupo, crmSegmento }: { summary: any; grupo?: string; crmSegmento?: string }) {
  const { operator } = useOperator();
  const canVerifyMaxiprod = operator && MAXIPROD_AUTHORIZED_OPERATORS.includes(operator.name);
  const [collapsed, setCollapsed] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>("evolucao");
  const [chartFilter, setChartFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [showVerifyModal, setShowVerifyModal] = useState(false);

  // Contraprova: consultar total de vencidos no Maxiprod
  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }, []);
  const { data: cpInadimplencia, isLoading: cpInadimplenciaLoading } = trpc.financial.getMaxiprodContraprova.useQuery(
    { section: "inadimplencia", startDate: "2020-01-01", endDate: today },
    { enabled: !!canVerifyMaxiprod }
  );

  // Buscar clientes para mostrar contagem no header
  const clientesQueryInput = useMemo(() => {
    const params: { grupo?: string; crmSegmento?: string } = {};
    if (grupo && grupo !== "all") params.grupo = grupo;
    if (crmSegmento && crmSegmento !== "all") params.crmSegmento = crmSegmento;
    return Object.keys(params).length > 0 ? params : undefined;
  }, [grupo, crmSegmento]);
  const { data: clientes } = trpc.financial.getClientesInadimplentes.useQuery(clientesQueryInput);

  // Buscar timeline para totais filtrados
  const timelineQueryInput = useMemo(() => {
    const params: { clienteFilter?: string; grupo?: string; crmSegmento?: string } = {};
    if (chartFilter) params.clienteFilter = chartFilter;
    if (grupo && grupo !== "all") params.grupo = grupo;
    if (crmSegmento && crmSegmento !== "all") params.crmSegmento = crmSegmento;
    return Object.keys(params).length > 0 ? params : undefined;
  }, [chartFilter, grupo, crmSegmento]);
  const { data: timeline } = trpc.financial.getInadimplenciaTimeline.useQuery(timelineQueryInput);

  const hasGrupoCrmFilter = (grupo && grupo !== "all") || (crmSegmento && crmSegmento !== "all");
  const filteredTotals = useMemo(() => {
    if (!hasGrupoCrmFilter || !timeline) return null;
    const total = timeline.reduce((sum: number, p: any) => sum + (p.total || 0), 0);
    const count = timeline.reduce((sum: number, p: any) => sum + (p.count || 0), 0);
    return { total, count };
  }, [hasGrupoCrmFilter, timeline]);

  const displayCount = filteredTotals ? filteredTotals.count : summary.receber.vencidas.count;
  const displayTotal = filteredTotals ? filteredTotals.total : summary.receber.vencidas.total;
  const clientesCount = clientes ? clientes.length : 0;

  // Somatórios: Total Original, Já Pago, Falta Pagar
  const totaisClientes = useMemo(() => {
    if (!clientes) return { totalOriginal: 0, totalPago: 0, faltaPagar: 0 };
    const totalOriginal = clientes.reduce((sum: number, c: any) => sum + (c.totalOriginal || 0), 0);
    const totalPago = clientes.reduce((sum: number, c: any) => sum + (c.totalPago || 0), 0);
    const faltaPagar = clientes.reduce((sum: number, c: any) => sum + c.total, 0);
    return { totalOriginal, totalPago, faltaPagar };
  }, [clientes]);

  return (
    <div className="bg-red-50/40 rounded-lg border border-red-200 shadow-sm overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex flex-col md:flex-row md:items-center md:justify-between px-3 md:px-5 py-3 md:py-4 hover:bg-red-50/70 transition-colors gap-2"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-2 md:gap-3 flex-wrap">
          <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 text-red-600" />
          <h3 className="text-xs md:text-sm font-semibold text-slate-700 uppercase tracking-wide">Inadimplência</h3>
          <Badge variant="outline" className="text-[10px] md:text-xs">{displayCount} títulos</Badge>
          <Badge variant="outline" className="text-[10px] md:text-xs">{clientesCount} clientes</Badge>
          {hasGrupoCrmFilter && <Badge className="bg-red-100 text-red-700 text-[10px] border-0">Filtrado</Badge>}
        </div>
        <div className="flex items-center gap-2 md:gap-4 flex-wrap justify-end">
          {/* Contraprova Maxiprod inline */}
          {canVerifyMaxiprod && cpInadimplencia && !cpInadimplenciaLoading && (
            <div className="flex flex-col items-end mr-1 md:mr-2" onClick={e => e.stopPropagation()}>
              <span className="text-[8px] md:text-[9px] text-slate-400 uppercase tracking-wider leading-none">Maxiprod</span>
              <span className={`text-[10px] md:text-xs font-semibold ${
                Math.abs(totaisClientes.faltaPagar - cpInadimplencia.valorMaxiprod) > 1 ? "text-red-600" : "text-emerald-600"
              }`}>{formatCurrency(cpInadimplencia.valorMaxiprod)}</span>
              {Math.abs(totaisClientes.faltaPagar - cpInadimplencia.valorMaxiprod) > 1 ? (
                <span className="text-[8px] md:text-[9px] text-red-500 font-bold flex items-center gap-0.5">
                  <AlertTriangle className="w-2.5 h-2.5" /> Dif: {formatCurrency(Math.abs(totaisClientes.faltaPagar - cpInadimplencia.valorMaxiprod))}
                </span>
              ) : (
                <span className="text-[8px] md:text-[9px] text-emerald-500 font-semibold">Confere</span>
              )}
            </div>
          )}
          {canVerifyMaxiprod && (
            <button
              onClick={e => { e.stopPropagation(); setShowVerifyModal(true); }}
              className="p-1.5 rounded-lg hover:bg-red-100 transition-colors group" title="Verificar no Maxiprod"
            >
              <Eye className="w-4 h-4 text-red-400 group-hover:text-red-600" />
            </button>
          )}
          <div className="flex items-center gap-2 md:gap-3 text-right">
            <div className="flex flex-col items-end">
              <span className="text-[8px] md:text-[9px] text-red-500 uppercase tracking-wider leading-none">Falta Pagar</span>
              <span className="text-xs md:text-sm font-bold text-red-700">{formatCurrency(totaisClientes.faltaPagar)}</span>
            </div>
          </div>
          {collapsed ? <ChevronRight className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {/* Modal de Contraprova - Dinâmico com vídeo animado */}
      {showVerifyModal && (
        <MaxiprodAutoVerifier
          title="Contraprova Maxiprod"
          subtitle="Inadimplência (Títulos Vencidos)"
          section="inadimplencia"
          startDate="2020-01-01"
          endDate={today}
          valorManus={totaisClientes.faltaPagar || 0}
          onClose={() => setShowVerifyModal(false)}
        />
      )}

      {!collapsed && (
        <div className="border-t border-red-200">
          {/* Tabs */}
          <div className="flex items-center border-b border-red-100 bg-red-50/30">
            <button
              className={`flex items-center gap-2 px-5 py-2.5 text-xs font-medium transition-all border-b-2 ${
                activeTab === "evolucao"
                  ? "border-red-500 text-red-700 bg-white/50"
                  : "border-transparent text-slate-500 hover:text-red-600 hover:bg-white/30"
              }`}
              onClick={() => setActiveTab("evolucao")}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Evolução
            </button>
            <button
              className={`flex items-center gap-2 px-5 py-2.5 text-xs font-medium transition-all border-b-2 ${
                activeTab === "clientes"
                  ? "border-red-500 text-red-700 bg-white/50"
                  : "border-transparent text-slate-500 hover:text-red-600 hover:bg-white/30"
              }`}
              onClick={() => setActiveTab("clientes")}
            >
              <Users className="w-3.5 h-3.5" />
              Clientes ({clientesCount})
            </button>

            {/* Filtros de cliente (compartilhados, visíveis na aba Evolução) */}
            {activeTab === "evolucao" && (
              <div className="flex items-center gap-2 ml-auto pr-4">
                <div className="relative min-w-[180px] max-w-[240px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
                  <Input
                    placeholder="Filtrar por cliente..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") setChartFilter(searchInput.trim()); }}
                    className="pl-8 h-7 text-xs bg-white border-slate-200"
                  />
                </div>
                <button
                  onClick={() => {
                    if (chartFilter === "keure") { setChartFilter(""); setSearchInput(""); }
                    else { setChartFilter("keure"); setSearchInput("keure"); }
                  }}
                  className={`px-3 py-1 rounded-md text-[10px] font-medium transition-all border ${
                    chartFilter === "keure"
                      ? "bg-red-500 text-white border-red-500 shadow-sm"
                      : "bg-white text-slate-500 border-slate-200 hover:border-red-300 hover:text-red-600"
                  }`}
                >
                  Keure
                </button>
                <button
                  onClick={() => {
                    if (chartFilter === "johnson") { setChartFilter(""); setSearchInput(""); }
                    else { setChartFilter("johnson"); setSearchInput("johnson"); }
                  }}
                  className={`px-3 py-1 rounded-md text-[10px] font-medium transition-all border ${
                    chartFilter === "johnson"
                      ? "bg-blue-500 text-white border-blue-500 shadow-sm"
                      : "bg-white text-slate-500 border-slate-200 hover:border-blue-300 hover:text-blue-600"
                  }`}
                >
                  Johnson
                </button>
                {chartFilter && (
                  <button
                    onClick={() => { setChartFilter(""); setSearchInput(""); }}
                    className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-red-600 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Tab Content */}
          {activeTab === "evolucao" && (
            <EvolucaoTab
              chartFilter={chartFilter}
              setChartFilter={setChartFilter}
              searchInput={searchInput}
              setSearchInput={setSearchInput}
              grupo={grupo}
              crmSegmento={crmSegmento}
            />
          )}
          {activeTab === "clientes" && (
            <ClientesTab grupo={grupo} crmSegmento={crmSegmento} />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * @deprecated Use InadimplenciaCard instead - now unified with tabs
 * Kept for backward compatibility during migration
 */
export function ClientesInadimplentesCard({ grupo, crmSegmento }: { grupo?: string; crmSegmento?: string } = {}) {
  // This component is now integrated into InadimplenciaCard
  // Return null to avoid duplicate rendering
  return null;
}
