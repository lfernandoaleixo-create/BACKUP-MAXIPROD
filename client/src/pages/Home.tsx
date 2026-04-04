/**
 * Dashboard Grupo Fox - ESPELHO FIEL DO MAXIPROD
 * 
 * REGRA FUNDAMENTAL: O dashboard exibe os dados EXATAMENTE como vêm do Maxiprod.
 * Mesmas descrições, mesmos códigos, mesmas quantidades.
 * Sem processamento de nomes, sem filtros manuais de grupo.
 */

import React, { useState, useMemo, useRef, Fragment, useCallback } from "react";
import { toast } from "sonner";
import { useOperator } from "@/contexts/OperatorContext";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Package,
  Search,
  AlertTriangle,
  ArrowUpDown,
  Factory,
  Leaf,
  TrendingDown,
  ShoppingCart,
  CheckCircle2,
  Wifi,
  WifiOff,
  RefreshCw,
  Loader2,
  Ship,
  Truck,
  TrendingUp,
  CalendarDays,
  BarChart3,
  Settings,
  ChevronDown,
  ChevronUp,
  Anchor,
  MapPin,
  DollarSign,
  Boxes,
  ClipboardList,
  Lock,
  Eye,
  EyeOff,
  TreePine,
  Hammer,
  Clock,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import TopNav from "@/components/TopNav";

// Types matching the NEW backend ProcessedItem (espelho fiel)
interface POLote {
  numeroPedido: string;
  referenciaPO: string; // Número da PO do fornecedor (ex: PO62, PO65)
  quantidade: number;
  quantidadeUn: number;
  dataEntrega: string;
  fornecedor: string;
}

interface PedidoCliente {
  cliente: string;
  quantidadeCx: number;
  quantidadeUn: number;
  status: string;
  estadoConfiguravel?: string;
  crmSegmento?: string;
}

interface StockItem {
  codigoItem: string;
  descricaoItem: string; // descrição EXATA do Maxiprod
  unidadeMedida: string;
  grupoCodigo: string;
  superGrupoCodigo: string;
  descricaoGrupo: string;
  empresaDona: string;
  estoqueUn: number;
  estoqueCx: number | null;
  unidadesPorCaixa: number | null;
  pedidosUn: number;
  pedidosCx: number | null;
  pedidosPorCliente?: PedidoCliente[];
  disponivelUn: number;
  disponivelCx: number | null;
  poCx: number | null;
  poUn: number;
  poEntregas: string[];
  poFornecedores: string[];
  poLotes: POLote[];
  projetadoUn: number;
  projetadoCx: number | null;
  segmento: "bambu" | "industrializado";
  grupo: "industrializacao" | "importacao_revenda" | "importacao_mp" | "outros";
  subgrupo: "bambu" | "fibra" | "madeira" | "madeira_importada" | "varetas" | "espetos" | "palitos" | "maquina_espetinho" | "outros";
  isKgProduct: boolean;
  estadoConfiguravel: string | null;
  segmentosCRM: string[];
  // Variações (produto pai/filho)
  isParent?: boolean;
  isChild?: boolean;
  parentCode?: string | null;
  variants?: {
    codigoItem: string;
    descricaoItem: string;
    conversionFactor: number;
    pedidosCx: number | null;
    pedidosUn: number;
    pedidosPorCliente: PedidoCliente[];
    unidadesPorCaixa: number | null;
  }[];
  variantConversionFactor?: number | null;
  // Pedidos próprios do pai (antes de somar variações)
  pedidosCxProprio?: number | null;
  pedidosUnProprio?: number;
  pedidosPorClienteProprio?: PedidoCliente[];
}

type SortField = "descricaoItem" | "comprimento" | "estoqueCx" | "pedidosCx" | "disponivelCx" | "poCx" | "projetadoCx";
type SortDir = "asc" | "desc";

/** Extrai o comprimento (número depois do X) da descrição do produto.
 *  Ex: "ESPETO DE BAMBU 4,0 X 250 MM" -> 250
 *  Ex: "PALITO DE MANICURE 5,0 X 140 MM" -> 140
 *  Retorna 0 se não encontrar.
 */
function extractComprimento(descricao: string): number {
  // Procura padrão: X seguido de espaço e número (com ou sem vírgula)
  const match = descricao.match(/X\s+(\d+(?:,\d+)?)/i);
  if (match) {
    return parseFloat(match[1].replace(',', '.'));
  }
  return 0;
}

function formatNumber(n: number | null): string {
  if (n === null || n === undefined) return "\u2014";
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function formatCurrency(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

function formatCurrencyCompact(n: number): string {
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`;
  if (n >= 1_000) return `R$ ${(n / 1_000).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}K`;
  return formatCurrency(n);
}

/**
 * Returns the display unit for a stock item.
 * For kg products: "kg" instead of "un" or "cx"
 * For regular products: "cx" if has box conversion, "un" otherwise
 */
function getUnit(item: StockItem, hasCx: boolean): string {
  if (item.isKgProduct) return "kg";
  return hasCx ? "cx" : "un";
}

/**
 * For kg products, PO "caixas" are actually sacos (bags).
 * Returns the label for PO quantities.
 */
function getPOUnit(item: StockItem): string {
  if (item.isKgProduct) return "kg";
  return "cx";
}

/**
 * For kg products, get the PO quantity in kg instead of sacos.
 * poUn already has the kg value from the backend.
 */
function getPODisplayQty(item: StockItem): number {
  if (item.isKgProduct) return item.poUn;
  return item.poCx ?? 0;
}

function timeAgo(date: Date | string | null): string {
  if (!date) return "Nunca";
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return `${diff}s atras`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min atras`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atras`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/* --- Connection Status Card --- */
function ConnectionStatusCard() {
  const { data: status, isLoading } = trpc.dashboard.getStatus.useQuery(undefined, {
    refetchInterval: 15000,
  });
  const forceSync = trpc.dashboard.forceSync.useMutation();
  const utils = trpc.useUtils();
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSync = async () => {
    setSyncResult(null);
    try {
      const result = await forceSync.mutateAsync();
      setSyncResult({ success: result.success, message: result.message });
      utils.dashboard.getStatus.invalidate();
      utils.dashboard.getData.invalidate();
      utils.sales.getAnalytics.invalidate();
      setTimeout(() => setSyncResult(null), 5000);
    } catch (err: any) {
      setSyncResult({ success: false, message: err.message || "Erro desconhecido" });
      setTimeout(() => setSyncResult(null), 5000);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm animate-pulse">
        <div className="h-6 bg-slate-100 rounded w-48" />
      </div>
    );
  }

  const isConnected = status?.isConnected ?? false;
  const isSyncing = forceSync.isPending;

  return (
    <div className={`rounded-lg border p-3 shadow-sm ${
      isConnected ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            isSyncing ? "bg-blue-500 animate-pulse" : isConnected ? "bg-emerald-500" : "bg-slate-400"
          }`}>
            {isSyncing ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : isConnected ? <Wifi className="w-4 h-4 text-white" /> : <WifiOff className="w-4 h-4 text-white" />}
          </div>
          <div>
            <p className={`text-sm font-semibold ${
              isSyncing ? "text-blue-800" : isConnected ? "text-emerald-800" : "text-slate-600"
            }`}>
              {isSyncing ? "Sincronizando com Maxiprod..." : isConnected ? "Conectado ao Maxiprod" : "Aguardando sincronizacao"}
            </p>
            <p className="text-xs text-slate-500">
              {isSyncing ? (
                "Buscando dados via API GraphQL..."
              ) : status?.lastSyncAt ? (
                <>
                  Ultima atualizacao: {timeAgo(status.lastSyncAt)}
                  {status?.lastSyncStatus && status.lastSyncStatus !== "error" && (
                    <span className="ml-2 text-slate-400">({status.lastSyncStatus})</span>
                  )}
                </>
              ) : (
                "Nenhuma sincronizacao realizada — clique em Sincronizar"
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {syncResult && (
            <span className={`text-xs flex items-center gap-1 ${
              syncResult.success ? "text-emerald-600" : "text-red-600"
            }`}>
              {syncResult.success ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
              {syncResult.success ? "Sincronizado!" : "Erro"}
            </span>
          )}
          <Button
            variant={isConnected ? "outline" : "default"}
            size="sm"
            onClick={handleSync}
            disabled={isSyncing}
            className={`text-xs ${!isConnected ? "bg-teal-600 hover:bg-teal-700 text-white" : ""}`}
          >
            {isSyncing ? (
              <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Sincronizando...</>
            ) : (
              <><RefreshCw className="w-3 h-3 mr-1" /> Sincronizar</>
            )}
          </Button>
        </div>
      </div>
      {syncResult && !syncResult.success && (
        <p className="text-xs text-red-500 mt-2 pl-11">{syncResult.message}</p>
      )}
    </div>
  );
}

/* --- Badges --- */
function StatusBadge({ projetado, estReg }: { projetado: number | null; estReg: number | null }) {
  if (projetado === null) return <Badge variant="outline" className="text-xs">—</Badge>;
  if (estReg !== null && estReg > 0) {
    // Projetado <= estoque regulador = COMPRA (vermelho, pulsante)
    if (projetado <= estReg) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge className="bg-red-100 text-red-700 text-xs border-0 animate-pulse cursor-pointer">COMPRA</Badge>
          </TooltipTrigger>
          <TooltipContent side="top" className="bg-red-50 border-red-200 text-red-700 font-medium text-xs">
            Abaixo do Est. Regulador
          </TooltipContent>
        </Tooltip>
      );
    }
    // Projetado até 20% acima do estoque regulador = CUIDADO (rosa)
    if (projetado <= estReg * 1.2) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge className="bg-pink-100 text-pink-700 text-xs border-0 cursor-pointer">CUIDADO</Badge>
          </TooltipTrigger>
          <TooltipContent side="top" className="bg-pink-50 border-pink-200 text-pink-700 font-medium text-xs">
            20% acima do Est. Regulador
          </TooltipContent>
        </Tooltip>
      );
    }
    // Projetado até 40% acima do estoque regulador = ATENÇÃO (laranja)
    if (projetado <= estReg * 1.4) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge className="bg-orange-100 text-orange-700 text-xs border-0 cursor-pointer">ATENÇÃO</Badge>
          </TooltipTrigger>
          <TooltipContent side="top" className="bg-orange-50 border-orange-200 text-orange-700 font-medium text-xs">
            40% acima do Est. Regulador
          </TooltipContent>
        </Tooltip>
      );
    }
  }
  return <Badge className="bg-emerald-100 text-emerald-700 text-xs border-0">OK</Badge>;
}

function GrupoBadge({ grupo, subgrupo }: { grupo: string; subgrupo: string }) {
  const GRUPO_STYLES: Record<string, { bg: string; text: string; icon: React.ElementType; label: string }> = {
    importacao_revenda: { bg: "bg-teal-100", text: "text-teal-700", icon: Ship, label: "Revenda" },
    industrializacao: { bg: "bg-violet-100", text: "text-violet-700", icon: Factory, label: "Industrialização" },
    importacao_mp: { bg: "bg-amber-100", text: "text-amber-700", icon: Truck, label: "Import. MP" },
    outros: { bg: "bg-slate-100", text: "text-slate-600", icon: Package, label: "Outros" },
  };
  const SUBGRUPO_LABELS: Record<string, string> = {
    bambu: "Bambu", fibra: "Fibra", madeira: "Madeira",
    madeira_importada: "Madeira Importada",
    varetas: "Varetas", espetos: "Espetos", palitos: "Palitos",
    maquina_espetinho: "Máq. Espetinho",
    outros: "",
  };
  const style = GRUPO_STYLES[grupo] || GRUPO_STYLES.outros;
  const Icon = style.icon;
  const subLabel = SUBGRUPO_LABELS[subgrupo];
  return (
    <Badge className={`${style.bg} ${style.text} text-xs border-0 max-w-full truncate whitespace-nowrap`} title={`${style.label}${subLabel ? ` / ${subLabel}` : ""}`}>
      <Icon className="w-3 h-3 mr-1 flex-shrink-0" /><span className="truncate">{style.label}{subLabel ? ` / ${subLabel}` : ""}</span>
    </Badge>
  );
}

// Keep old SegmentoBadge for backward compat
function SegmentoBadge({ segmento }: { segmento: string }) {
  if (segmento === "industrializado") {
    return <Badge className="bg-violet-100 text-violet-700 text-xs border-0"><Factory className="w-3 h-3 mr-1" />Industrializado</Badge>;
  }
  return <Badge className="bg-teal-100 text-teal-700 text-xs border-0"><Leaf className="w-3 h-3 mr-1" />Bambu</Badge>;
}

/* --- KPI Card --- */
const kpiStyles: Record<string, { iconBg: string; iconColor: string; bar: string }> = {
  teal:    { iconBg: "bg-teal-50",    iconColor: "text-teal-600",    bar: "bg-gradient-to-r from-teal-400 to-teal-600" },
  orange:  { iconBg: "bg-orange-50",  iconColor: "text-orange-600",  bar: "bg-gradient-to-r from-orange-400 to-orange-600" },
  emerald: { iconBg: "bg-emerald-50", iconColor: "text-emerald-600", bar: "bg-gradient-to-r from-emerald-400 to-emerald-600" },
  blue:    { iconBg: "bg-blue-50",    iconColor: "text-blue-600",    bar: "bg-gradient-to-r from-blue-400 to-blue-600" },
  indigo:  { iconBg: "bg-indigo-50",  iconColor: "text-indigo-600",  bar: "bg-gradient-to-r from-indigo-400 to-indigo-600" },
  red:     { iconBg: "bg-red-50",     iconColor: "text-red-600",     bar: "bg-gradient-to-r from-red-400 to-red-600" },
  pink:    { iconBg: "bg-pink-50",    iconColor: "text-pink-600",    bar: "bg-gradient-to-r from-pink-400 to-pink-600" },
  amber:   { iconBg: "bg-amber-50",   iconColor: "text-amber-600",   bar: "bg-gradient-to-r from-amber-400 to-amber-600" },
  slate:   { iconBg: "bg-slate-50",   iconColor: "text-slate-500",   bar: "bg-gradient-to-r from-slate-300 to-slate-400" },
};

function KPICard({ label, value, sub, icon: Icon, theme, onClick }: { 
  label: string; value: string; sub?: string; icon: React.ElementType; 
  theme: keyof typeof kpiStyles;
  onClick?: () => void;
}) {
  const s = kpiStyles[theme];
  return (
    <div className={`group relative bg-white rounded-xl border border-slate-100 overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${onClick ? 'cursor-pointer' : ''}`} onClick={onClick}>
      <div className={`h-1 ${s.bar}`} />
      <div className="px-4 py-3.5">
        <div className="flex items-start justify-between mb-3">
          <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider leading-tight max-w-[100px]">{label}</p>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.iconBg} transition-transform group-hover:scale-110`}>
            <Icon className={`w-[18px] h-[18px] ${s.iconColor}`} />
          </div>
        </div>
        <p className="text-[26px] font-extrabold text-slate-900 tracking-tight leading-none">{value}</p>
        {sub && <p className="text-[11px] text-slate-400 mt-2 font-medium">{sub}</p>}
      </div>
    </div>
  );
}

/* --- PO Cell with Lotes Detail --- */
function POCell({ item }: { item: StockItem }) {
  const poCx = item.poCx ?? 0;
  
  if (poCx === 0) {
    return <span className="text-slate-300 text-sm">{"\u2014"}</span>;
  }

  const lotes = item.poLotes || [];
  const fornecedores = item.poFornecedores || [];
  const isKg = item.isKgProduct;
  const poDisplayQty = getPODisplayQty(item);
  const poUnit = getPOUnit(item);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="cursor-help">
          <span className="font-semibold text-sm text-blue-600">
            {formatNumber(poDisplayQty)} {poUnit}
          </span>
          {lotes.length > 0 && (
            <div className="text-xs text-blue-400 flex items-center gap-0.5 mt-0.5">
              <CalendarDays className="w-3 h-3 flex-shrink-0" />
              <span className="truncate max-w-[120px]">
                {lotes.length === 1 
                  ? `${lotes[0].referenciaPO || 'PO'} - ${lotes[0].dataEntrega}` 
                  : `${lotes.length} POs: ${lotes.map(l => l.referenciaPO || 'PO').join(', ')}`
                }
              </span>
            </div>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-[380px] p-0 bg-white text-slate-800 border border-slate-200 shadow-xl">
        <div className="p-3 space-y-2">
          <p className="font-semibold text-sm flex items-center gap-1.5">
            <Ship className="w-4 h-4 text-blue-500" />
            Pedidos de Compra (PO)
          </p>
          <p className="text-xs text-slate-500">
            Total: <strong className="text-slate-800">{formatNumber(poDisplayQty)} {poUnit}</strong> a receber
            {isKg && <span className="ml-1">({formatNumber(poCx)} sacos)</span>}
          </p>
          {lotes.length > 0 && (
            <div className="border border-slate-200 rounded overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-2 py-1 text-left font-medium">PO</th>
                    <th className="px-2 py-1 text-left font-medium">Entrega</th>
                    <th className="px-2 py-1 text-right font-medium">Qtd ({poUnit})</th>
                    {isKg && <th className="px-2 py-1 text-right font-medium">Sacos</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {lotes.map((lote, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-2 py-1 font-semibold text-blue-700">
                        {lote.referenciaPO || lote.numeroPedido || "?"}
                      </td>
                      <td className="px-2 py-1 font-medium text-blue-600">
                        <div className="flex items-center gap-1">
                          <Truck className="w-3 h-3 flex-shrink-0" />
                          {lote.dataEntrega || "Sem data"}
                        </div>
                      </td>
                      <td className="px-2 py-1 text-right font-semibold">
                        {isKg ? formatNumber(lote.quantidadeUn) : formatNumber(lote.quantidade)}
                      </td>
                      {isKg && (
                        <td className="px-2 py-1 text-right text-slate-500">
                          {formatNumber(lote.quantidade)}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {fornecedores.length > 0 && (
            <p className="text-xs text-slate-500">
              Fornecedor: {fornecedores.join(", ")}
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/* --- Stock Table --- */
function StockTable({ items, search, segmentoFilter, grupoFilter, subgrupoFilter, crmSegmentoFilter, sort, sortDir, onSort, priceMap, showFinancial, pricingOverrides, enableCompraRule }: {
  items: StockItem[];
  search: string;
  segmentoFilter: string;
  grupoFilter?: string;
  subgrupoFilter?: string;
  crmSegmentoFilter?: string;
  sort: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
  priceMap?: PriceMap;
  showFinancial?: boolean;
  pricingOverrides?: Array<{ codigoItem: string; vendaMensal: number | null; fatorMultiplicacao: string | null; prazoCompraDias: number | null }>;
  enableCompraRule?: boolean;
}) {
  const [prodColWidth, setProdColWidth] = useState(380);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  const resizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = prodColWidth;

    const handleMouseMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const diff = ev.clientX - startXRef.current;
      const newWidth = Math.max(200, Math.min(800, startWidthRef.current + diff));
      setProdColWidth(newWidth);
    };

    const handleMouseUp = () => {
      resizingRef.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const filtered = useMemo(() => {
    // Filtrar itens filhos (variações) - eles só aparecem quando o pai está expandido
    let result = items.filter(i => !i.isChild);

    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (i) =>
          (i.descricaoItem || "").toLowerCase().includes(s) ||
          (i.codigoItem || "").toLowerCase().includes(s) ||
          (i.descricaoGrupo || "").toLowerCase().includes(s)
      );
    }

    if (segmentoFilter && segmentoFilter !== "all") {
      result = result.filter((i) => i.segmento === segmentoFilter);
    }

    if (grupoFilter && grupoFilter !== "all") {
      result = result.filter((i) => i.grupo === grupoFilter);
    }

    if (subgrupoFilter && subgrupoFilter !== "all") {
      result = result.filter((i) => i.subgrupo === subgrupoFilter);
    }

    if (crmSegmentoFilter && crmSegmentoFilter !== "all") {
      result = result.filter((i) => i.segmentosCRM?.includes(crmSegmentoFilter));
    }

    result.sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;

      switch (sort) {
        case "comprimento": {
          const aComp = extractComprimento(a.descricaoItem || "");
          const bComp = extractComprimento(b.descricaoItem || "");
          const diff = sortDir === "asc" ? aComp - bComp : bComp - aComp;
          // Se mesmo comprimento, ordena por descrição
          if (diff !== 0) return diff;
          return (a.descricaoItem || "").localeCompare(b.descricaoItem || "");
        }
        case "descricaoItem":
          aVal = a.descricaoItem || "";
          bVal = b.descricaoItem || "";
          return sortDir === "asc" ? (aVal as string).localeCompare(bVal as string) : (bVal as string).localeCompare(aVal as string);
        case "estoqueCx":
          aVal = a.estoqueCx ?? a.estoqueUn;
          bVal = b.estoqueCx ?? b.estoqueUn;
          break;
        case "pedidosCx":
          aVal = a.pedidosCx ?? a.pedidosUn;
          bVal = b.pedidosCx ?? b.pedidosUn;
          break;
        case "disponivelCx":
          aVal = a.disponivelCx ?? a.disponivelUn;
          bVal = b.disponivelCx ?? b.disponivelUn;
          break;
        case "poCx":
          aVal = a.poCx ?? 0;
          bVal = b.poCx ?? 0;
          break;
        case "projetadoCx":
          aVal = a.projetadoCx ?? a.projetadoUn ?? 0;
          bVal = b.projetadoCx ?? b.projetadoUn ?? 0;
          break;
      }
      return sortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

    return result;
  }, [items, search, segmentoFilter, grupoFilter, subgrupoFilter, crmSegmentoFilter, sort, sortDir]);

  const SortHeader = ({ field, children, className: extraClass }: { field: SortField; children: React.ReactNode; className?: string }) => (
    <th
      className={`px-2 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-teal-600 select-none ${extraClass || ""}`}
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className={`w-3 h-3 ${sort === field ? "text-teal-600" : "text-slate-300"}`} />
      </div>
    </th>
  );

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
      <div className="overflow-x-auto">
        <table className={`w-full ${showFinancial ? 'min-w-[1100px]' : ''}`} style={!showFinancial ? { tableLayout: 'fixed' } : undefined}>
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {showFinancial ? (
                <>
                  <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider cursor-pointer" style={{ minWidth: 280 }} onClick={() => onSort('descricaoItem')}>
                    <div className="flex items-center gap-1">Produto <ArrowUpDown className={`w-2.5 h-2.5 ${sort === 'descricaoItem' ? 'text-teal-600' : 'text-slate-300'}`} /></div>
                  </th>

                  <th className="px-1 py-2 text-right text-[10px] font-semibold uppercase tracking-wider cursor-pointer bg-emerald-50/60 border-x border-emerald-100 whitespace-nowrap" onClick={() => onSort('disponivelCx')}>
                    <div className="flex items-center justify-end gap-0.5 text-emerald-700">Disp. <ArrowUpDown className={`w-2.5 h-2.5 ${sort === 'disponivelCx' ? 'text-emerald-700' : 'text-emerald-300'}`} /></div>
                    <span className="text-[7px] font-bold text-emerald-500 tracking-widest block text-right">P/ VENDA</span>
                  </th>
                  <th className="px-1 py-2 text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wider cursor-pointer whitespace-nowrap" onClick={() => onSort('poCx')}>
                    <div className="flex items-center justify-end gap-0.5"><Ship className="w-2.5 h-2.5" /> PO <ArrowUpDown className={`w-2.5 h-2.5 ${sort === 'poCx' ? 'text-teal-600' : 'text-slate-300'}`} /></div>
                  </th>
                  <th className="px-1 py-2 text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wider cursor-pointer whitespace-nowrap" onClick={() => onSort('projetadoCx')}>
                    <div className="flex items-center justify-end gap-0.5"><TrendingUp className="w-2.5 h-2.5" /> Proj. <ArrowUpDown className={`w-2.5 h-2.5 ${sort === 'projetadoCx' ? 'text-teal-600' : 'text-slate-300'}`} /></div>
                  </th>
                  <th className="px-1 py-2 text-right text-[10px] font-semibold text-emerald-600 uppercase tracking-wider bg-emerald-50/50 border-l border-emerald-100 whitespace-nowrap">R$/Cx</th>
                  <th className="px-1 py-2 text-right text-[10px] font-semibold text-emerald-600 uppercase tracking-wider bg-emerald-50/50 whitespace-nowrap">Vlr Est.</th>
                  <th className="px-1 py-2 text-right text-[10px] font-semibold text-blue-600 uppercase tracking-wider bg-blue-50/50 whitespace-nowrap">Vlr PO</th>
                  <th className="px-1 py-2 text-right text-[10px] font-semibold text-indigo-600 uppercase tracking-wider bg-indigo-50/50 whitespace-nowrap">Vlr Proj.</th>
                </>
              ) : (
                <>
                  <th
                    className="py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-teal-600 select-none relative"
                    style={{ width: prodColWidth, minWidth: 200, maxWidth: 800, paddingLeft: 8, paddingRight: 12 }}
                    onClick={() => onSort('descricaoItem')}
                  >
                    <div className="flex items-center gap-1">
                      Produto (Maxiprod)
                      <ArrowUpDown className={`w-3 h-3 ${sort === 'descricaoItem' ? 'text-teal-600' : 'text-slate-300'}`} />
                    </div>
                    {/* Resize handle */}
                    <div
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-teal-200/50 active:bg-teal-300/50 z-10"
                      onMouseDown={handleResizeStart}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap" style={{ width: 70 }}>Un/Cx</th>
                  <th className="px-2 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: 160, width: 170 }}>Grupo</th>
                  <SortHeader field="estoqueCx">Estoque</SortHeader>
                  <SortHeader field="pedidosCx">Pedidos</SortHeader>
                  <th
                    className="px-2 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:text-emerald-700 select-none bg-emerald-50/60 border-x border-emerald-100 relative"
                    onClick={() => onSort("disponivelCx")}
                  >
                    <div className="flex items-center gap-1 text-emerald-700">
                      <ShoppingCart className="w-3 h-3" />
                      Disponivel
                      <ArrowUpDown className={`w-3 h-3 ${sort === "disponivelCx" ? "text-emerald-700" : "text-emerald-300"}`} />
                    </div>
                    <span className="text-[8px] font-bold text-emerald-500 tracking-widest block">P/ VENDA</span>
                  </th>
                  <SortHeader field="poCx">
                    <Ship className="w-3 h-3" /> PO
                  </SortHeader>
                  <SortHeader field="projetadoCx">
                    <TrendingUp className="w-3 h-3" /> Projetado
                  </SortHeader>
                  <th className="px-2 py-3 text-right text-xs font-semibold text-purple-600 uppercase tracking-wider whitespace-nowrap" title="Estoque Regulador (definido em Config > Produtos)">Est. Reg.</th>
                  <th className="px-2 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((item) => {
              const isNegative = (item.disponivelCx ?? item.disponivelUn) < 0;
              const isZero = (item.disponivelCx ?? item.disponivelUn) === 0;
              const projetado = item.projetadoCx ?? item.projetadoUn ?? 0;
              const isExpanded = expandedParents.has(item.codigoItem);
              const hasVariants = item.isParent && item.variants && item.variants.length > 0;
              
              const toggleExpand = () => {
                setExpandedParents(prev => {
                  const next = new Set(prev);
                  if (next.has(item.codigoItem)) next.delete(item.codigoItem);
                  else next.add(item.codigoItem);
                  return next;
                });
              };
              
              // Número de colunas para as sub-linhas
              const colCount = showFinancial ? 8 : 10;
              
              return (
                <React.Fragment key={item.codigoItem}>
                <tr className={`hover:bg-slate-50 transition-colors ${isNegative ? "bg-red-50/50" : isZero ? "bg-amber-50/30" : ""}`}>
                  {/* Produto - descrição EXATA do Maxiprod */}
                  <td
                    className={showFinancial ? 'px-2 py-1.5' : 'px-2 py-2.5'}
                    style={showFinancial ? { minWidth: 280 } : { width: prodColWidth, minWidth: 200, maxWidth: 800 }}
                  >
                    <div className={`flex items-start gap-1 ${showFinancial ? 'whitespace-normal break-words leading-tight' : ''}`}>
                      {hasVariants && (
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleExpand(); }}
                          className="mt-0.5 flex-shrink-0 w-4 h-4 rounded flex items-center justify-center text-teal-600 hover:bg-teal-100 transition-colors"
                          title={isExpanded ? 'Ocultar variações' : 'Expandir variações'}
                        >
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      )}
                      <span className={`font-medium text-slate-800 ${showFinancial ? 'text-[10px]' : 'text-sm'}`}>{item.descricaoItem}</span>
                    </div>
                    <div className={`text-slate-400 mt-0.5 ${showFinancial ? 'text-[9px]' : 'text-xs'} ${hasVariants ? 'ml-5' : ''}`}>
                      {showFinancial ? item.codigoItem : `Cod: ${item.codigoItem}`}
                      {!showFinancial && item.descricaoGrupo && <span className="ml-2 text-slate-300">| {item.descricaoGrupo}</span>}
                      {hasVariants && <span className="ml-2 text-teal-500 font-medium">· {item.variants!.length} variaç{item.variants!.length > 1 ? 'ões' : 'ão'}</span>}
                    </div>
                  </td>
                  {!showFinancial && (
                    <>
                      {/* Un/Cx */}
                      <td className="px-2 py-2.5 text-sm text-slate-600 whitespace-nowrap" style={{ width: 70 }}>
                        {item.isKgProduct ? "kg" : (item.unidadesPorCaixa ? formatNumber(item.unidadesPorCaixa) : "\u2014")}
                      </td>
                      {/* Grupo/Subgrupo */}
                      <td className="px-2 py-2.5 overflow-hidden" style={{ minWidth: 160, width: 170, maxWidth: 180 }}>
                        <GrupoBadge grupo={item.grupo} subgrupo={item.subgrupo} />
                      </td>
                    </>
                  )}
                  {/* Estoque - esconder quando showFinancial */}
                  {!showFinancial && (
                  <td className='px-2 py-2.5 whitespace-nowrap'>
                    <span className='font-semibold text-slate-800 text-sm'>
                      {item.estoqueCx !== null ? `${formatNumber(item.estoqueCx)}` : `${formatNumber(item.estoqueUn)}`}
                      {<> {getUnit(item, item.estoqueCx !== null)}</>}
                    </span>
                  </td>
                  )}
                  {/* Pedidos - esconder quando showFinancial */}
                  {!showFinancial && (
                  <td className='px-2 py-2.5'>
                    {(() => {
                      const allPedidos = item.pedidosPorCliente || [];
                      const reservados = allPedidos.filter(pc => pc.status !== 'Digitação');
                      // digitacao removido - não exibir pedidos em digitação
                      const hasAny = allPedidos.length > 0;
                      const hasPedidos = (item.pedidosCx ?? item.pedidosUn) > 0;
                      const unit = getUnit(item, false);
                      const isParentWithVariants = item.isParent && item.variants && item.variants.length > 0;
                      
                      // Para produto pai: separar pedidos próprios vs variações
                      const pedidosProprioCx = item.pedidosCxProprio ?? 0;
                      const pedidosProprioPorCliente = item.pedidosPorClienteProprio || [];
                      const proprioReservados = pedidosProprioPorCliente.filter(pc => pc.status !== 'Digitação');
                      
                      if (hasPedidos && hasAny) {
                        return (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className={`font-semibold text-sm cursor-help border-b border-dashed ${hasPedidos ? 'text-orange-600 border-orange-300' : 'text-slate-400 border-slate-300'}`}>
                                {item.pedidosCx !== null ? `${formatNumber(item.pedidosCx)} ${getUnit(item, true)}` : `${formatNumber(item.pedidosUn)} ${unit}`}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="max-w-4xl w-[750px] p-0" sideOffset={8}>
                              <div className="bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden">

                                {/* Detalhamento por cliente (pedidos próprios do pai se for pai, ou todos se não for) */}
                                {(() => {
                                  const clienteReservados = isParentWithVariants ? proprioReservados : reservados;
                                  const sectionTitle = isParentWithVariants ? item.descricaoItem : 'Pedidos Reservados';
                                  if (clienteReservados.length === 0 && !isParentWithVariants && reservados.length === 0) return null;
                                  return (
                                    <>
                                      {clienteReservados.length > 0 && (
                                        <>
                                          <div className="bg-orange-50 px-5 py-4 border-b border-orange-100">
                                            <p className="text-base font-bold text-orange-800">{sectionTitle}</p>
                                            <p className="text-sm text-orange-600">Reservam estoque (Aprovado / A aprovar)</p>
                                          </div>
                                          <div className="max-h-[420px] overflow-y-auto">
                                            <table className="w-full text-base">
                                              <thead>
                                                <tr className="bg-slate-50 text-slate-500">
                                                  <th className="text-left px-4 py-2.5 font-semibold text-sm">Cliente</th>
                                                  <th className="text-right px-4 py-2.5 font-semibold text-sm">Qtd</th>
                                                  <th className="text-center px-4 py-2.5 font-semibold text-sm">Status</th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-slate-100">
                                                {clienteReservados.map((pc, idx) => (
                                                  <tr key={idx} className="hover:bg-slate-50">
                                                    <td className="px-4 py-3 text-slate-700 max-w-[450px] truncate text-sm" title={pc.cliente}>
                                                      {pc.cliente}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-bold text-orange-600 whitespace-nowrap text-sm">
                                                      {formatNumber(Math.ceil(pc.quantidadeCx))} {unit}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                      <span className={`inline-block px-3 py-1 rounded text-xs font-semibold ${
                                                        pc.status === 'Aprovado' ? 'bg-emerald-100 text-emerald-700' :
                                                        'bg-amber-100 text-amber-700'
                                                      }`}>
                                                        {pc.status}
                                                      </span>
                                                    </td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                        </>
                                      )}
                                      {/* Clientes de cada variação */}
                                      {isParentWithVariants && item.variants!.map((v, vi) => {
                                        const vReservados = (v.pedidosPorCliente || []).filter(pc => pc.status !== 'Digitação');
                                        if (vReservados.length === 0) return null;
                                        return (
                                          <div key={`var-${vi}`}>
                                            <div className="bg-violet-50 px-5 py-3.5 border-y border-violet-100">
                                              <p className="text-base font-bold text-violet-800">{v.descricaoItem}</p>
                                            </div>
                                            <div className="max-h-72 overflow-y-auto">
                                              <table className="w-full text-base">
                                                <tbody className="divide-y divide-slate-100">
                                                  {vReservados.map((pc, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50">
                                                      <td className="px-4 py-3 text-slate-700 max-w-[450px] truncate text-sm" title={pc.cliente}>
                                                        {pc.cliente}
                                                      </td>
                                                      <td className="px-4 py-3 text-right font-bold text-violet-600 whitespace-nowrap text-sm">
                                                        {formatNumber(Math.ceil(pc.quantidadeCx))} cx
                                                      </td>
                                                      <td className="px-4 py-3 text-center">
                                                        <span className={`inline-block px-3 py-1 rounded text-xs font-semibold ${
                                                          pc.status === 'Aprovado' ? 'bg-emerald-100 text-emerald-700' :
                                                          'bg-amber-100 text-amber-700'
                                                        }`}>
                                                          {pc.status}
                                                        </span>
                                                      </td>
                                                    </tr>
                                                  ))}
                                                </tbody>
                                              </table>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </>
                                  );
                                })()}

                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      }
                      return (
                        <span className={`font-semibold text-sm ${hasPedidos ? "text-orange-600" : "text-slate-400"}`}>
                          {item.pedidosCx !== null ? `${formatNumber(item.pedidosCx)} ${getUnit(item, true)}` : `${formatNumber(item.pedidosUn)} ${unit}`}
                        </span>
                      );
                    })()}
                  </td>
                  )}
                  {/* Disponivel - destaque para time comercial */}
                  <td className={`bg-emerald-50/40 border-x border-emerald-100 ${showFinancial ? 'px-1 py-1.5 text-right' : 'px-2 py-2.5'}`}>
                    <span className={`font-bold ${showFinancial ? 'text-[10px]' : 'text-sm'} ${isNegative ? "text-red-600" : isZero ? "text-amber-600" : "text-emerald-700"}`}>
                      {item.disponivelCx !== null ? `${formatNumber(item.disponivelCx)}` : `${formatNumber(item.disponivelUn)}`}
                      {!showFinancial && <> {getUnit(item, item.disponivelCx !== null)}</>}
                    </span>
                  </td>
                  {/* PO */}
                  <td className={showFinancial ? 'px-1 py-1.5 text-right' : 'px-2 py-2.5'}>
                    <POCell item={item} />
                  </td>
                  {/* Projetado */}
                  <td className={showFinancial ? 'px-1 py-1.5 text-right' : 'px-2 py-2.5'}>
                    {(item.poCx ?? 0) > 0 || (item.disponivelCx ?? item.disponivelUn) !== 0 ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={`font-bold cursor-help ${showFinancial ? 'text-[10px]' : 'text-sm'} ${
                            projetado < 0 ? "text-red-500" : projetado === 0 ? "text-amber-500" : "text-indigo-600"
                          }`}>
                            {item.projetadoCx !== null ? `${formatNumber(item.projetadoCx)} ${getUnit(item, true)}` : `${formatNumber(item.projetadoUn)} ${getUnit(item, false)}`}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">
                            Disponivel ({formatNumber(item.disponivelCx ?? item.disponivelUn)} {getUnit(item, item.disponivelCx !== null)}) + PO ({formatNumber(item.isKgProduct ? item.poUn : (item.poCx ?? 0))} {getPOUnit(item)}) = <strong>{formatNumber(projetado)} {getUnit(item, item.projetadoCx !== null)}</strong>
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-slate-300 text-sm">{"\u2014"}</span>
                    )}
                  </td>
                  {/* Estoque Regulador - oculto quando showFinancial */}
                  {!showFinancial && (
                    <td className="px-2 py-2.5 text-right">
                      {(() => {
                        const pricingItem = pricingOverrides?.find(p => p.codigoItem === item.codigoItem);
                        const vendaMensal = pricingItem?.vendaMensal;
                        if (vendaMensal == null) return <span className="text-xs text-slate-300">—</span>;
                        const fator = pricingItem?.fatorMultiplicacao ? parseFloat(pricingItem.fatorMultiplicacao) : 2.3;
                        const estReg = Math.round(vendaMensal * fator);
                        const unit = item.isKgProduct ? "kg" : "cx";
                        const projetado = item.projetadoCx ?? item.projetadoUn ?? 0;
                        // Determine color based on proximity to estoque regulador
                        let estRegColor = 'text-emerald-600';
                        if (enableCompraRule && estReg > 0) {
                          if (projetado <= estReg) {
                            estRegColor = 'text-red-600 bg-red-50 px-1.5 py-0.5 rounded';
                          } else if (projetado <= estReg * 1.2) {
                            estRegColor = 'text-pink-600 bg-pink-50 px-1.5 py-0.5 rounded';
                          } else if (projetado <= estReg * 1.4) {
                            estRegColor = 'text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded';
                          }
                        }
                        return (
                          <span className={`text-xs font-semibold ${estRegColor}`}
                            title={`Vd.Mensal: ${vendaMensal} × Fator: ${fator.toLocaleString("pt-BR")} = ${estReg} ${unit} | Projetado: ${formatNumber(projetado)} ${unit}`}
                          >
                            {formatNumber(estReg)} {unit}
                          </span>
                        );
                      })()}
                    </td>
                  )}
                  {/* Status */}
                  {!showFinancial && (
                    <td className="px-2 py-2.5">
                      {(() => {
                        const pItem = pricingOverrides?.find(p => p.codigoItem === item.codigoItem);
                        const vm = pItem?.vendaMensal;
                        let calcEstReg: number | null = null;
                        if (vm != null) {
                          const f = pItem?.fatorMultiplicacao ? parseFloat(pItem.fatorMultiplicacao) : 2.3;
                          calcEstReg = Math.round(vm * f);
                        }
                        const projetado = item.projetadoCx ?? item.projetadoUn ?? 0;
                        return <StatusBadge projetado={projetado} estReg={enableCompraRule ? calcEstReg : null} />;
                      })()}
                    </td>
                  )}
                  {showFinancial && (() => {
                    const price = priceMap?.[item.descricaoItem];
                    const estCx = item.estoqueCx ?? 0;
                    const poCx = item.poCx ?? 0;
                    const totalCx = (item.projetadoCx ?? 0);
                    if (!price) {
                      return (
                        <>
                          <td className="px-1 py-1.5 text-right border-l border-emerald-100 bg-emerald-50/20">
                            <span className="text-[9px] text-slate-300 italic">s/ preço</span>
                          </td>
                          <td className="px-1 py-1.5 text-right bg-emerald-50/20"><span className="text-slate-300 text-[9px]">—</span></td>
                          <td className="px-1 py-1.5 text-right bg-blue-50/20"><span className="text-slate-300 text-[9px]">—</span></td>
                          <td className="px-1 py-1.5 text-right bg-indigo-50/20"><span className="text-slate-300 text-[9px]">—</span></td>
                        </>
                      );
                    }
                    const vlrEstoque = estCx * price.avgPrice;
                    const vlrPO = poCx * price.avgPrice;
                    const vlrTotal = totalCx * price.avgPrice;
                    return (
                      <>
                        <td className="px-1 py-1.5 text-right border-l border-emerald-100 bg-emerald-50/20">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-[10px] font-semibold text-emerald-700 cursor-help border-b border-dashed border-emerald-300 whitespace-nowrap">
                                {formatCurrency(price.avgPrice)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="bg-white border border-slate-200 shadow-lg text-slate-700">
                              <p className="text-xs">Média das últimas {price.salesCount} venda(s)</p>
                            </TooltipContent>
                          </Tooltip>
                        </td>
                        <td className="px-1 py-1.5 text-right bg-emerald-50/20">
                          <span className={`text-[10px] font-bold whitespace-nowrap ${vlrEstoque > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                            {vlrEstoque > 0 ? formatCurrency(vlrEstoque) : '—'}
                          </span>
                        </td>
                        <td className="px-1 py-1.5 text-right bg-blue-50/20">
                          <span className={`text-[10px] font-bold whitespace-nowrap ${vlrPO > 0 ? 'text-blue-700' : 'text-slate-400'}`}>
                            {vlrPO > 0 ? formatCurrency(vlrPO) : '—'}
                          </span>
                        </td>
                        <td className="px-1 py-1.5 text-right bg-indigo-50/20">
                          <span className={`text-[10px] font-bold whitespace-nowrap ${vlrTotal > 0 ? 'text-indigo-700' : vlrTotal < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                            {vlrTotal !== 0 ? formatCurrency(vlrTotal) : '—'}
                          </span>
                        </td>
                      </>
                    );
                  })()}
                </tr>
                {/* Sub-linhas de variações (expandidas) */}
                {hasVariants && isExpanded && item.variants!.map((variant) => (
                  <tr key={`${item.codigoItem}-${variant.codigoItem}`} className="bg-teal-50/30 border-l-4 border-teal-300">
                    <td
                      className={showFinancial ? 'px-2 py-1 pl-8' : 'px-2 py-1.5 pl-8'}
                      style={showFinancial ? { minWidth: 280 } : { width: prodColWidth, minWidth: 200, maxWidth: 800 }}
                      colSpan={showFinancial ? 1 : undefined}
                    >
                      <div className={showFinancial ? 'whitespace-normal break-words leading-tight' : ''}>
                        <span className={`text-slate-600 ${showFinancial ? 'text-[9px]' : 'text-xs'}`}>
                          └ {variant.descricaoItem}
                        </span>
                      </div>
                      <div className={`text-slate-400 ml-3 ${showFinancial ? 'text-[8px]' : 'text-[10px]'}`}>
                        {variant.codigoItem} · Fator: {variant.conversionFactor}x
                      </div>
                    </td>
                    {!showFinancial && (
                      <>
                        <td className="px-2 py-1.5 text-xs text-slate-500 whitespace-nowrap" style={{ width: 70 }}>
                          {variant.unidadesPorCaixa ? formatNumber(variant.unidadesPorCaixa) : '—'}
                        </td>
                        <td className="px-2 py-1.5" style={{ minWidth: 130, width: 140 }}>
                          <span className="text-[9px] text-teal-500 font-medium">Variação</span>
                        </td>
                        <td className="px-2 py-1.5">
                          <span className="text-xs text-slate-400">—</span>
                        </td>
                        <td className="px-2 py-1.5">
                          <span className={`text-xs font-semibold ${(variant.pedidosCx ?? variant.pedidosUn) > 0 ? 'text-orange-500' : 'text-slate-400'}`}>
                            {variant.pedidosCx !== null ? `${formatNumber(variant.pedidosCx)} ${getUnit(variant as any, true)}` : `${formatNumber(variant.pedidosUn)} un`}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 bg-emerald-50/40 border-x border-emerald-100">
                          <span className="text-xs text-slate-400">—</span>
                        </td>
                        <td className="px-2 py-1.5">
                          <span className="text-xs text-slate-400">—</span>
                        </td>
                        <td className="px-2 py-1.5">
                          <span className="text-xs text-slate-400">—</span>
                        </td>
                        <td className="px-2 py-1.5"></td>
                        <td className="px-2 py-1.5"></td>
                      </>
                    )}
                    {showFinancial && (
                      <>
                        <td className="px-1 py-1 text-right bg-emerald-50/20 border-x border-emerald-100">
                          <span className="text-[9px] text-slate-400">—</span>
                        </td>
                        <td className="px-1 py-1 text-right">
                          <span className="text-[9px] text-slate-400">—</span>
                        </td>
                        <td className="px-1 py-1 text-right">
                          <span className="text-[9px] text-slate-400">—</span>
                        </td>
                        <td className="px-1 py-1 text-right border-l border-emerald-100 bg-emerald-50/20">
                          <span className="text-[9px] text-slate-400">—</span>
                        </td>
                        <td className="px-1 py-1 text-right bg-emerald-50/20">
                          <span className="text-[9px] text-slate-400">—</span>
                        </td>
                        <td className="px-1 py-1 text-right bg-blue-50/20">
                          <span className="text-[9px] text-slate-400">—</span>
                        </td>
                        <td className="px-1 py-1 text-right bg-indigo-50/20">
                          <span className="text-[9px] text-slate-400">—</span>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                </React.Fragment>
              );
            })}
          </tbody>
          {showFinancial && priceMap && filtered.length > 0 && (
            <tfoot className="border-t-2 border-slate-200 bg-slate-50">
              <tr>
                <td colSpan={4} className="px-1 py-1.5 text-right text-[10px] font-bold text-slate-600 uppercase">Totais</td>
                {(() => {
                  let totalVlrEstoque = 0;
                  let totalVlrPO = 0;
                  let totalVlrTotal = 0;
                  for (const item of filtered) {
                    const price = priceMap[item.descricaoItem];
                    if (price) {
                      totalVlrEstoque += (item.estoqueCx ?? 0) * price.avgPrice;
                      totalVlrPO += (item.poCx ?? 0) * price.avgPrice;
                      totalVlrTotal += (item.projetadoCx ?? 0) * price.avgPrice;
                    }
                  }
                  return (
                    <>
                      <td className="px-1 py-1.5 text-right border-l border-emerald-100 bg-emerald-50/30"></td>
                      <td className="px-1 py-1.5 text-right bg-emerald-50/30">
                        <span className="text-[10px] font-extrabold text-emerald-700">{formatCurrency(totalVlrEstoque)}</span>
                      </td>
                      <td className="px-1 py-1.5 text-right bg-blue-50/30">
                        <span className="text-[10px] font-extrabold text-blue-700">{formatCurrency(totalVlrPO)}</span>
                      </td>
                      <td className="px-1 py-1.5 text-right bg-indigo-50/30">
                        <span className="text-[10px] font-extrabold text-indigo-700">{formatCurrency(totalVlrTotal)}</span>
                      </td>
                    </>
                  );
                })()}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {filtered.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Nenhum item encontrado</p>
        </div>
      )}
    </div>
  );
}

/* --- PO Overview Card --- */
interface POSummary {
  referenciaPO: string;
  fornecedor: string;
  dataEntrega: string;
  totalCx: number;
  totalUn: number;
  produtos: { descricaoItem: string; codigoItem: string; quantidade: number; quantidadeUn: number }[];
}

function POOverviewCard({ items }: { items: StockItem[] }) {
  const [isListOpen, setIsListOpen] = useState(false);
  const [expandedPO, setExpandedPO] = useState<string | null>(null);

  // Aggregate all PO lotes across all items, grouped by referenciaPO
  const poSummaries = useMemo(() => {
    const poMap = new Map<string, POSummary>();

    for (const item of items) {
      if (!item.poLotes || item.poLotes.length === 0) continue;
      for (const lote of item.poLotes) {
        const key = lote.referenciaPO || lote.numeroPedido || "?";
        const existing = poMap.get(key) || {
          referenciaPO: key,
          fornecedor: lote.fornecedor || "",
          dataEntrega: lote.dataEntrega || "",
          totalCx: 0,
          totalUn: 0,
          produtos: [],
        };
        existing.totalCx += lote.quantidade;
        existing.totalUn += lote.quantidadeUn;
        existing.produtos.push({
          descricaoItem: item.descricaoItem,
          codigoItem: item.codigoItem,
          quantidade: lote.quantidade,
          quantidadeUn: lote.quantidadeUn,
        });
        // Use earliest delivery date for the PO
        if (!existing.dataEntrega && lote.dataEntrega) {
          existing.dataEntrega = lote.dataEntrega;
        }
        poMap.set(key, existing);
      }
    }

    // Sort by delivery date (DD/MM/YY format)
    return Array.from(poMap.values()).sort((a, b) => {
      const parseDate = (d: string) => {
        if (!d) return Infinity;
        const parts = d.split("/");
        if (parts.length === 3) {
          return new Date(2000 + parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
        }
        return Infinity;
      };
      return parseDate(a.dataEntrega) - parseDate(b.dataEntrega);
    });
  }, [items]);

  if (poSummaries.length === 0) return null;

  const totalPOCx = poSummaries.reduce((sum, po) => sum + po.totalCx, 0);

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Header - Clickable to expand/collapse */}
      <button
        onClick={() => { setIsListOpen(!isListOpen); if (isListOpen) setExpandedPO(null); }}
        className="w-full bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-4 border-b border-slate-100 text-left hover:from-blue-100/60 hover:to-indigo-100/60 transition-colors cursor-pointer"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Ship className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Pedidos de Compra (POs)</h3>
              <p className="text-xs text-slate-500">
                {poSummaries.length} POs pendentes de chegada &middot; Total: <strong>{formatNumber(totalPOCx)} caixas</strong>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-2xl font-extrabold text-blue-600">{formatNumber(totalPOCx)} cx</p>
              <p className="text-xs text-slate-400">{poSummaries.length} embarques</p>
            </div>
            {isListOpen ? (
              <ChevronUp className="w-5 h-5 text-blue-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-blue-400" />
            )}
          </div>
        </div>
      </button>

      {/* PO List - Collapsible */}
      {isListOpen && <div className="divide-y divide-slate-100">
        {poSummaries.map((po) => {
          const isExpanded = expandedPO === po.referenciaPO;
          // Parse date for proximity indicator
          const isUrgent = (() => {
            if (!po.dataEntrega) return false;
            const parts = po.dataEntrega.split("/");
            if (parts.length !== 3) return false;
            const entrega = new Date(2000 + parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            const today = new Date();
            const diffDays = Math.ceil((entrega.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            return diffDays <= 7;
          })();
          const isPast = (() => {
            if (!po.dataEntrega) return false;
            const parts = po.dataEntrega.split("/");
            if (parts.length !== 3) return false;
            const entrega = new Date(2000 + parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return entrega < today;
          })();

          return (
            <div key={po.referenciaPO}>
              {/* PO Row - Clickable */}
              <button
                onClick={() => setExpandedPO(isExpanded ? null : po.referenciaPO)}
                className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors text-left"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-lg flex flex-col items-center justify-center text-white font-bold text-xs leading-tight ${
                    isPast ? "bg-red-500" : isUrgent ? "bg-amber-500" : "bg-blue-500"
                  }`}>
                    <Anchor className="w-4 h-4 mb-0.5" />
                    <span className="text-[10px]">{po.referenciaPO}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 text-sm">{po.referenciaPO}</span>
                      {isPast && <Badge className="bg-red-100 text-red-700 text-[10px] border-0 px-1.5 py-0">Atrasada</Badge>}
                      {isUrgent && !isPast && <Badge className="bg-amber-100 text-amber-700 text-[10px] border-0 px-1.5 py-0">Esta semana</Badge>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {po.fornecedor || "Fornecedor"}
                      </span>
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" />
                        {po.dataEntrega || "Sem data"}
                      </span>
                      <span className="text-xs text-slate-400">
                        {po.produtos.length} {po.produtos.length === 1 ? "produto" : "produtos"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-bold text-blue-600 text-sm">{formatNumber(po.totalCx)} cx</p>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              </button>

              {/* Expanded: Product Details */}
              {isExpanded && (
                <div className="bg-blue-50/50 border-t border-slate-100 px-5 py-3">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-slate-500 uppercase tracking-wider">
                        <th className="text-left py-1.5 font-semibold">Produto</th>
                        <th className="text-left py-1.5 font-semibold">Codigo</th>
                        <th className="text-right py-1.5 font-semibold">Quantidade (cx)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-blue-100">
                      {po.produtos
                        .sort((a, b) => b.quantidade - a.quantidade)
                        .map((prod, idx) => (
                        <tr key={idx} className="hover:bg-blue-100/50">
                          <td className="py-2 text-slate-700 font-medium text-xs pr-4">
                            {prod.descricaoItem}
                          </td>
                          <td className="py-2 text-slate-400 text-xs">
                            {prod.codigoItem}
                          </td>
                          <td className="py-2 text-right font-bold text-blue-700">
                            {formatNumber(prod.quantidade)} cx
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-blue-200">
                        <td colSpan={2} className="py-2 text-xs font-semibold text-slate-600 uppercase">Total</td>
                        <td className="py-2 text-right font-extrabold text-blue-700">
                          {formatNumber(po.totalCx)} cx
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>}
    </div>
  );
}

/* --- Classification Group Card --- */
type PriceMap = Record<string, { avgPrice: number; salesCount: number }>;

function ClassificationCard({ 
  title, 
  subtitle,
  icon: Icon, 
  iconBg, 
  iconColor, 
  borderColor,
  items, 
  isOpen, 
  onToggle,
  priceMap,
  showFinancial,
  pricingOverrides,
  enableCompraRule,
  hideAlerts,
}: { 
  title: string; 
  subtitle: string;
  icon: React.ElementType; 
  iconBg: string;
  iconColor: string;
  borderColor: string;
  items: StockItem[]; 
  isOpen: boolean; 
  onToggle: () => void;
  priceMap: PriceMap;
  showFinancial: boolean;
  pricingOverrides?: Array<{ codigoItem: string; vendaMensal: number | null; fatorMultiplicacao: string | null; prazoCompraDias: number | null }>;
  enableCompraRule?: boolean;
  hideAlerts?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [grupoFilter, setGrupoFilter] = useState("all");
  const [subgrupoFilter, setSubgrupoFilter] = useState("all");
  const [crmSegmentoFilter, setCrmSegmentoFilter] = useState("all");
  const [sort, setSort] = useState<SortField>("comprimento");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Labels para os grupos e subgrupos de negócio
  const GRUPO_NEGOCIO_LABELS: Record<string, string> = {
    importacao_revenda: "Import. Produtos Prontos (Revenda)",
    industrializacao: "Industrialização",
    importacao_mp: "Import. Matéria-Prima",
    outros: "Outros",
  };
  const SUBGRUPO_NEGOCIO_LABELS: Record<string, string> = {
    bambu: "Bambu", fibra: "Fibra", madeira: "Madeira",
    madeira_importada: "Madeira Importada",
    varetas: "Varetas", espetos: "Espetos", palitos: "Palitos",
    maquina_espetinho: "Máq. Espetinho",
    outros: "Outros",
  };

  // Extrair grupos e subgrupos disponíveis nos itens deste card
  // Sempre incluir os 3 grupos principais + grupos que existem nos dados
  const availableGrupos = useMemo(() => {
    const set = new Set<string>(["importacao_revenda", "industrializacao", "importacao_mp"]);
    items.forEach(i => { if (i.grupo) set.add(i.grupo); });
    return Array.from(set).sort();
  }, [items]);

  // Subgrupos fixos por grupo (sempre visíveis mesmo sem itens)
  const FIXED_SUBGRUPOS: Record<string, string[]> = {
    industrializacao: ["madeira"],
    importacao_revenda: ["bambu", "fibra", "maquina_espetinho"],
    importacao_mp: ["madeira_importada"],
  };

  const availableSubgrupos = useMemo(() => {
    const set = new Set<string>();
    // Adicionar subgrupos fixos do grupo selecionado
    if (grupoFilter !== "all" && FIXED_SUBGRUPOS[grupoFilter]) {
      FIXED_SUBGRUPOS[grupoFilter].forEach(s => set.add(s));
    }
    // Adicionar subgrupos que existem nos dados
    const base = grupoFilter !== "all" ? items.filter(i => i.grupo === grupoFilter) : items;
    base.forEach(i => { if (i.subgrupo && i.subgrupo !== "outros") set.add(i.subgrupo); });
    return Array.from(set).sort();
  }, [items, grupoFilter]);

  // Extrair segmentos CRM disponíveis nos itens filtrados
  const availableCrmSegmentos = useMemo(() => {
    const set = new Set<string>();
    let base = items;
    if (grupoFilter !== "all") base = base.filter(i => i.grupo === grupoFilter);
    if (subgrupoFilter !== "all") base = base.filter(i => i.subgrupo === subgrupoFilter);
    base.forEach(i => {
      if (i.segmentosCRM) {
        i.segmentosCRM.forEach(s => { if (s) set.add(s); });
      }
    });
    return Array.from(set).sort();
  }, [items, grupoFilter, subgrupoFilter]);

  // Reset subgrupo when grupo changes
  const handleGrupoChange = (val: string) => {
    setGrupoFilter(val);
    setSubgrupoFilter("all");
    setCrmSegmentoFilter("all");
  };

  // Reset segmento CRM when subgrupo changes
  const handleSubgrupoChange = (val: string) => {
    setSubgrupoFilter(val);
    setCrmSegmentoFilter("all");
  };

  const handleSort = (field: SortField) => {
    if (sort === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSort(field);
      setSortDir("desc");
    }
  };
  const totalEstoque = items.reduce((sum, i) => sum + (i.estoqueCx ?? 0), 0);
  const totalPedidos = items.reduce((sum, i) => sum + (i.pedidosCx ?? 0), 0);
  const totalDisponivel = items.reduce((sum, i) => sum + (i.disponivelCx ?? 0), 0);
  const totalPO = items.reduce((sum, i) => sum + (i.poCx ?? 0), 0);
  const totalProjetado = items.reduce((sum, i) => sum + (i.projetadoCx ?? 0), 0);
  const negativos = items.filter(i => (i.disponivelCx ?? i.disponivelUn) < 0).length;
  const parentCount = useMemo(() => items.filter(i => !i.isChild).length, [items]);

  // Alertas baseados no estoque regulador (projetado <= estReg)
  const alertCount = useMemo(() => {
    if (!enableCompraRule) return negativos;
    if (!pricingOverrides) return 0; // Aguardando dados carregar
    return items.filter(item => {
      if (item.isChild) return false;
      const pItem = pricingOverrides.find(p => p.codigoItem === item.codigoItem);
      const vm = pItem?.vendaMensal;
      if (vm == null) return false;
      const f = pItem?.fatorMultiplicacao ? parseFloat(pItem.fatorMultiplicacao) : 2.3;
      const estReg = Math.round(vm * f);
      const projetado = item.projetadoCx ?? item.projetadoUn ?? 0;
      return projetado <= estReg;
    }).length;
  }, [items, enableCompraRule, pricingOverrides, negativos]);

  // Financial valuation
  const valuation = useMemo(() => {
    let valorEstoque = 0;
    let valorPO = 0;
    let valorProjetado = 0;
    let comPreco = 0;
    let semPreco = 0;

    for (const item of items) {
      const price = priceMap[item.descricaoItem];
      if (price) {
        comPreco++;
        const estCx = item.estoqueCx ?? 0;
        const poCx = item.poCx ?? 0;
        const projCx = item.projetadoCx ?? 0;
        valorEstoque += estCx * price.avgPrice;
        valorPO += poCx * price.avgPrice;
        valorProjetado += projCx * price.avgPrice;
      } else {
        semPreco++;
      }
    }
    return { valorEstoque, valorPO, valorProjetado, comPreco, semPreco };
  }, [items, priceMap]);


  return (
    <div className={`bg-white rounded-xl border-l-4 ${borderColor} border border-slate-100 shadow-sm transition-all duration-300`}>
      {/* Header - Clickable */}
      <button
        onClick={onToggle}
        className="w-full px-5 py-4 text-left hover:bg-slate-50/50 transition-colors cursor-pointer"
      >
        {/* Top row: title + chevron */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center`}>
              <Icon className={`w-6 h-6 ${iconColor}`} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold text-slate-800">{title}</h3>
                <span className="text-sm font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{parentCount} itens</span>
                {!hideAlerts && alertCount > 0 && (
                  <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />{alertCount} alerta{alertCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
            </div>
          </div>
          {isOpen ? (
            <ChevronUp className="w-5 h-5 text-slate-400 flex-shrink-0" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />
          )}
        </div>

        {/* Metrics row - Desktop: Quantidades */}
        <div className="hidden sm:grid grid-cols-6 gap-3 mt-4 ml-16">
          <div className="bg-teal-50/80 rounded-lg px-3 py-2">
            <p className="text-[10px] text-teal-600 font-semibold uppercase tracking-wider">Estoque</p>
            <p className="text-base font-extrabold text-teal-700">{formatNumber(totalEstoque)} <span className="text-xs font-semibold">cx</span></p>
          </div>
          <div className="bg-orange-50/80 rounded-lg px-3 py-2">
            <p className="text-[10px] text-orange-600 font-semibold uppercase tracking-wider">Pedidos</p>
            <p className={`text-base font-extrabold ${totalPedidos > 0 ? 'text-orange-700' : 'text-slate-400'}`}>{formatNumber(totalPedidos)} <span className="text-xs font-semibold">cx</span></p>
          </div>
          <div className={`rounded-lg px-3 py-2 ${totalDisponivel < 0 ? 'bg-red-50/80' : 'bg-emerald-50/80'}`}>
            <p className={`text-[10px] font-semibold uppercase tracking-wider ${totalDisponivel < 0 ? 'text-red-600' : 'text-emerald-600'}`}>Disponível</p>
            <p className={`text-base font-extrabold ${totalDisponivel < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{formatNumber(totalDisponivel)} <span className="text-xs font-semibold">cx</span></p>
          </div>
          <div className="bg-blue-50/80 rounded-lg px-3 py-2">
            <p className="text-[10px] text-blue-600 font-semibold uppercase tracking-wider">PO (Compra)</p>
            <p className={`text-base font-extrabold ${totalPO > 0 ? 'text-blue-700' : 'text-slate-400'}`}>{formatNumber(totalPO)} <span className="text-xs font-semibold">cx</span></p>
          </div>
          <div className="bg-indigo-50/80 rounded-lg px-3 py-2">
            <p className="text-[10px] text-indigo-600 font-semibold uppercase tracking-wider">Projetado</p>
            <p className={`text-base font-extrabold ${totalProjetado < 0 ? 'text-red-700' : 'text-indigo-700'}`}>{formatNumber(totalProjetado)} <span className="text-xs font-semibold">cx</span></p>
          </div>
          <div className="bg-slate-50/80 rounded-lg px-3 py-2">
            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Produtos</p>
            <p className="text-base font-extrabold text-slate-700">{parentCount}</p>
          </div>
        </div>

        {/* Financial valuation row - appears when showFinancial is active AND card is closed */}
        {showFinancial && !isOpen && (
          <div className="mt-3 ml-16 space-y-3">
            <div className="hidden sm:grid grid-cols-3 gap-3">
              <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <p className="text-[10px] text-green-700 font-semibold uppercase tracking-wider flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />Vlr Estoque
                </p>
                <p className="text-base font-extrabold text-green-800">{formatCurrency(valuation.valorEstoque)}</p>
                <p className="text-[9px] text-green-600">{valuation.comPreco}/{parentCount} com preço</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <p className="text-[10px] text-blue-700 font-semibold uppercase tracking-wider flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />Vlr PO
                </p>
                <p className="text-base font-extrabold text-blue-800">{formatCurrency(valuation.valorPO)}</p>
              </div>
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
                <p className="text-[10px] text-indigo-700 font-semibold uppercase tracking-wider flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />Vlr Projetado
                </p>
                <p className="text-base font-extrabold text-indigo-800">{formatCurrency(valuation.valorProjetado)}</p>
              </div>
            </div>

          </div>
        )}

        {/* Mobile summary */}
        <div className="grid sm:hidden grid-cols-3 gap-2 mt-3 ml-16">
          <div className="text-center bg-teal-50/60 rounded px-2 py-1">
            <p className="text-[9px] text-teal-600 font-semibold">Estoque</p>
            <p className="text-sm font-bold text-teal-700">{formatNumber(totalEstoque)}</p>
          </div>
          <div className="text-center bg-emerald-50/60 rounded px-2 py-1">
            <p className="text-[9px] text-emerald-600 font-semibold">Dispon.</p>
            <p className={`text-sm font-bold ${totalDisponivel < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{formatNumber(totalDisponivel)}</p>
          </div>
          <div className="text-center bg-indigo-50/60 rounded px-2 py-1">
            <p className="text-[9px] text-indigo-600 font-semibold">Projetado</p>
            <p className="text-sm font-bold text-indigo-700">{formatNumber(totalProjetado)}</p>
          </div>
        </div>

        {/* Mobile financial summary */}
        {showFinancial && !isOpen && (
          <div className="grid sm:hidden grid-cols-3 gap-2 mt-2 ml-16">
            <div className="text-center bg-green-50 border border-green-200 rounded px-2 py-1">
              <p className="text-[9px] text-green-700 font-semibold">Vlr Estoque</p>
              <p className="text-xs font-bold text-green-800">{formatCurrencyCompact(valuation.valorEstoque)}</p>
            </div>
            <div className="text-center bg-blue-50 border border-blue-200 rounded px-2 py-1">
              <p className="text-[9px] text-blue-700 font-semibold">Vlr PO</p>
              <p className="text-xs font-bold text-blue-800">{formatCurrencyCompact(valuation.valorPO)}</p>
            </div>
            <div className="text-center bg-indigo-50 border border-indigo-200 rounded px-2 py-1">
              <p className="text-[9px] text-indigo-700 font-semibold">Vlr Projetado</p>
              <p className="text-xs font-bold text-indigo-800">{formatCurrencyCompact(valuation.valorProjetado)}</p>
            </div>
          </div>
        )}
      </button>

      {/* Expandable Content */}
      {isOpen && (
        <div className="border-t border-slate-100">
          {/* Search & Filter inside card */}
          <div className="px-5 py-3 bg-slate-50/50 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Buscar produto, código, grupo..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 bg-white h-9 text-sm"
                />
              </div>
              {availableGrupos.length > 1 && (
                <Select value={grupoFilter} onValueChange={handleGrupoChange}>
                  <SelectTrigger className="w-full sm:w-64 bg-white h-9 text-sm">
                    <SelectValue placeholder="Grupo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Grupos</SelectItem>
                    {availableGrupos.map(g => (
                      <SelectItem key={g} value={g}>{GRUPO_NEGOCIO_LABELS[g] || g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {grupoFilter !== "all" && availableSubgrupos.length > 0 && (
                <Select value={subgrupoFilter} onValueChange={handleSubgrupoChange}>
                  <SelectTrigger className="w-full sm:w-44 bg-white h-9 text-sm">
                    <SelectValue placeholder="Subgrupo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Subgrupos</SelectItem>
                    {availableSubgrupos.map(sg => (
                      <SelectItem key={sg} value={sg}>{SUBGRUPO_NEGOCIO_LABELS[sg] || sg}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {availableCrmSegmentos.length > 0 && (
                <Select value={crmSegmentoFilter} onValueChange={setCrmSegmentoFilter}>
                  <SelectTrigger className="w-full sm:w-48 bg-white h-9 text-sm">
                    <SelectValue placeholder="Segmento CRM" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Segmentos</SelectItem>
                    {availableCrmSegmentos.map(seg => (
                      <SelectItem key={seg} value={seg}>{seg}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <StockTable
            items={items}
            search={search}
            segmentoFilter={"all"}
            grupoFilter={grupoFilter}
            subgrupoFilter={subgrupoFilter}
            crmSegmentoFilter={crmSegmentoFilter}
            sort={sort}
            sortDir={sortDir}
            onSort={handleSort}
            priceMap={priceMap}
            showFinancial={showFinancial}
            pricingOverrides={pricingOverrides}
            enableCompraRule={enableCompraRule}
          />
        </div>
      )}
    </div>
  );
}

/* --- Semi Pronto Card (informativo, estoque editável manualmente) --- */
function SemiProntoCard({ items, isOpen, onToggle, operatorName }: {
  items: StockItem[];
  isOpen: boolean;
  onToggle: () => void;
  operatorName?: string;
}) {
  const [search, setSearch] = useState("");
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch semi pronto stock data
  const { data: semiProntoData } = trpc.dashboard.getSemiProntoStock.useQuery(undefined, {
    refetchInterval: 30000,
  });
  const updateMutation = trpc.dashboard.updateSemiProntoStock.useMutation({
    onSuccess: () => {
      toast.success("Estoque atualizado!");
      setEditingItem(null);
    },
    onError: () => toast.error("Erro ao salvar"),
  });
  const utils = trpc.useUtils();

  // Map of codigoItem -> quantidade from DB
  const semiProntoMap = useMemo(() => {
    const map = new Map<string, number>();
    if (semiProntoData?.items) {
      for (const sp of semiProntoData.items) {
        map.set(sp.codigoItem, parseFloat(String(sp.quantidade)) || 0);
      }
    }
    return map;
  }, [semiProntoData]);

  // Only parent items (no children)
  const parentItems = useMemo(() => items.filter(i => !i.isChild), [items]);

  // Filter by search
  const filtered = useMemo(() => {
    if (!search.trim()) return parentItems;
    const s = search.toLowerCase();
    return parentItems.filter(i =>
      i.descricaoItem.toLowerCase().includes(s) ||
      i.codigoItem.toLowerCase().includes(s)
    );
  }, [parentItems, search]);

  // Total estoque from manual entries
  const totalEstoque = useMemo(() => {
    let total = 0;
    for (const item of parentItems) {
      total += semiProntoMap.get(item.codigoItem) || 0;
    }
    return total;
  }, [parentItems, semiProntoMap]);

  const handleStartEdit = useCallback((codigoItem: string) => {
    const current = semiProntoMap.get(codigoItem) || 0;
    setEditingItem(codigoItem);
    setEditValue(String(current));
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [semiProntoMap]);

  const handleSave = useCallback(() => {
    if (!editingItem) return;
    const val = parseFloat(editValue) || 0;
    updateMutation.mutate(
      { codigoItem: editingItem, quantidade: val, operatorName: operatorName || undefined },
      { onSuccess: () => utils.dashboard.getSemiProntoStock.invalidate() }
    );
  }, [editingItem, editValue, updateMutation, operatorName, utils]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") setEditingItem(null);
  }, [handleSave]);

  return (
    <div className="bg-white rounded-xl border-l-4 border-l-amber-600 border border-slate-100 shadow-sm transition-all duration-300">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full px-5 py-4 text-left hover:bg-slate-50/50 transition-colors cursor-pointer"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
              <Hammer className="w-6 h-6 text-amber-700" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold text-slate-800">Madeira Semi Pronto</h3>
                <span className="text-sm font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{parentItems.length} itens</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{parentItems.length} produtos industrializados de madeira - estoque manual</p>
            </div>
          </div>
          {isOpen ? (
            <ChevronUp className="w-5 h-5 text-slate-400 flex-shrink-0" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />
          )}
        </div>

        {/* Metrics row */}
        <div className="hidden sm:grid grid-cols-6 gap-3 mt-4 ml-16">
          <div className="bg-teal-50/80 rounded-lg px-3 py-2">
            <p className="text-[10px] text-teal-600 font-semibold uppercase tracking-wider">Estoque</p>
            <p className="text-base font-extrabold text-teal-700">{formatNumber(totalEstoque)} <span className="text-xs font-semibold">cx</span></p>
          </div>
          <div className="bg-orange-50/80 rounded-lg px-3 py-2">
            <p className="text-[10px] text-orange-600 font-semibold uppercase tracking-wider">Pedidos</p>
            <p className="text-base font-extrabold text-slate-400">0 <span className="text-xs font-semibold">cx</span></p>
          </div>
          <div className="bg-emerald-50/80 rounded-lg px-3 py-2">
            <p className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wider">Disponível</p>
            <p className="text-base font-extrabold text-slate-400">0 <span className="text-xs font-semibold">cx</span></p>
          </div>
          <div className="bg-blue-50/80 rounded-lg px-3 py-2">
            <p className="text-[10px] text-blue-600 font-semibold uppercase tracking-wider">PO (Compra)</p>
            <p className="text-base font-extrabold text-slate-400">0 <span className="text-xs font-semibold">cx</span></p>
          </div>
          <div className="bg-indigo-50/80 rounded-lg px-3 py-2">
            <p className="text-[10px] text-indigo-600 font-semibold uppercase tracking-wider">Projetado</p>
            <p className="text-base font-extrabold text-slate-400">0 <span className="text-xs font-semibold">cx</span></p>
          </div>
          <div className="bg-slate-50/80 rounded-lg px-3 py-2">
            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Produtos</p>
            <p className="text-base font-extrabold text-slate-700">{parentItems.length}</p>
          </div>
        </div>
      </button>

      {/* Expanded content */}
      {isOpen && (
        <div className="px-5 pb-5 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Buscar produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-9 text-sm"
            />
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500 uppercase">Código</th>
                  <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500 uppercase">Produto</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-amber-600 uppercase">Estoque (cx)</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-slate-400 uppercase">Pedidos</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-slate-400 uppercase">Disponível</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-slate-400 uppercase">PO</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-slate-400 uppercase">Projetado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const qty = semiProntoMap.get(item.codigoItem) || 0;
                  const isEditing = editingItem === item.codigoItem;
                  return (
                    <tr key={item.codigoItem} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="py-2 px-2 text-xs text-slate-500 font-mono">{item.codigoItem}</td>
                      <td className="py-2 px-2 text-sm text-slate-700 max-w-[300px] truncate" title={item.descricaoItem}>{item.descricaoItem}</td>
                      <td className="py-2 px-2 text-right">
                        {isEditing ? (
                          <input
                            ref={inputRef}
                            type="number"
                            min="0"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onBlur={handleSave}
                            className="w-20 text-right text-sm border border-amber-400 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-300 bg-amber-50"
                          />
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleStartEdit(item.codigoItem); }}
                            className="text-sm font-bold text-amber-700 hover:bg-amber-50 px-2 py-1 rounded cursor-pointer transition-colors min-w-[60px] text-right"
                            title="Clique para editar"
                          >
                            {formatNumber(qty)}
                          </button>
                        )}
                      </td>
                      <td className="py-2 px-2 text-right text-sm text-slate-300">0</td>
                      <td className="py-2 px-2 text-right text-sm text-slate-300">0</td>
                      <td className="py-2 px-2 text-right text-sm text-slate-300">0</td>
                      <td className="py-2 px-2 text-right text-sm text-slate-300">0</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function AguardandoEscolhaCard({ items, isOpen, onToggle, operatorName }: {
  items: StockItem[];
  isOpen: boolean;
  onToggle: () => void;
  operatorName?: string;
}) {
  const [search, setSearch] = useState("");
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: aguardandoData } = trpc.dashboard.getAguardandoEscolhaStock.useQuery(undefined, {
    refetchInterval: 30000,
  });
  const updateMutation = trpc.dashboard.updateAguardandoEscolhaStock.useMutation({
    onSuccess: () => {
      toast.success("Estoque atualizado!");
      setEditingItem(null);
    },
    onError: () => toast.error("Erro ao salvar"),
  });
  const utils = trpc.useUtils();

  const aguardandoMap = useMemo(() => {
    const map = new Map<string, number>();
    if (aguardandoData?.items) {
      for (const sp of aguardandoData.items) {
        map.set(sp.codigoItem, parseFloat(String(sp.quantidade)) || 0);
      }
    }
    return map;
  }, [aguardandoData]);

  const parentItems = useMemo(() => items.filter(i => !i.isChild), [items]);

  const filtered = useMemo(() => {
    if (!search.trim()) return parentItems;
    const s = search.toLowerCase();
    return parentItems.filter(i =>
      i.descricaoItem.toLowerCase().includes(s) ||
      i.codigoItem.toLowerCase().includes(s)
    );
  }, [parentItems, search]);

  const totalEstoque = useMemo(() => {
    let total = 0;
    for (const item of parentItems) {
      total += aguardandoMap.get(item.codigoItem) || 0;
    }
    return total;
  }, [parentItems, aguardandoMap]);

  const handleStartEdit = useCallback((codigoItem: string) => {
    const current = aguardandoMap.get(codigoItem) || 0;
    setEditingItem(codigoItem);
    setEditValue(String(current));
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [aguardandoMap]);

  const handleSave = useCallback(() => {
    if (!editingItem) return;
    const val = parseFloat(editValue) || 0;
    updateMutation.mutate(
      { codigoItem: editingItem, quantidade: val, operatorName: operatorName || undefined },
      { onSuccess: () => utils.dashboard.getAguardandoEscolhaStock.invalidate() }
    );
  }, [editingItem, editValue, updateMutation, operatorName, utils]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") setEditingItem(null);
  }, [handleSave]);

  return (
    <div className="bg-white rounded-xl border-l-4 border-l-purple-600 border border-slate-100 shadow-sm transition-all duration-300">
      <button
        onClick={onToggle}
        className="w-full px-5 py-4 text-left hover:bg-slate-50/50 transition-colors cursor-pointer"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
              <Clock className="w-6 h-6 text-purple-700" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold text-slate-800">Madeira Aguardando Escolha</h3>
                <span className="text-sm font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{parentItems.length} itens</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{parentItems.length} produtos industrializados de madeira - aguardando escolha</p>
            </div>
          </div>
          {isOpen ? (
            <ChevronUp className="w-5 h-5 text-slate-400 flex-shrink-0" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />
          )}
        </div>

        <div className="hidden sm:grid grid-cols-6 gap-3 mt-4 ml-16">
          <div className="bg-teal-50/80 rounded-lg px-3 py-2">
            <p className="text-[10px] text-teal-600 font-semibold uppercase tracking-wider">Estoque</p>
            <p className="text-base font-extrabold text-teal-700">{formatNumber(totalEstoque)} <span className="text-xs font-semibold">cx</span></p>
          </div>
          <div className="bg-orange-50/80 rounded-lg px-3 py-2">
            <p className="text-[10px] text-orange-600 font-semibold uppercase tracking-wider">Pedidos</p>
            <p className="text-base font-extrabold text-slate-400">0 <span className="text-xs font-semibold">cx</span></p>
          </div>
          <div className="bg-emerald-50/80 rounded-lg px-3 py-2">
            <p className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wider">Disponível</p>
            <p className="text-base font-extrabold text-slate-400">0 <span className="text-xs font-semibold">cx</span></p>
          </div>
          <div className="bg-blue-50/80 rounded-lg px-3 py-2">
            <p className="text-[10px] text-blue-600 font-semibold uppercase tracking-wider">PO (Compra)</p>
            <p className="text-base font-extrabold text-slate-400">0 <span className="text-xs font-semibold">cx</span></p>
          </div>
          <div className="bg-indigo-50/80 rounded-lg px-3 py-2">
            <p className="text-[10px] text-indigo-600 font-semibold uppercase tracking-wider">Projetado</p>
            <p className="text-base font-extrabold text-slate-400">0 <span className="text-xs font-semibold">cx</span></p>
          </div>
          <div className="bg-slate-50/80 rounded-lg px-3 py-2">
            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Produtos</p>
            <p className="text-base font-extrabold text-slate-700">{parentItems.length}</p>
          </div>
        </div>
      </button>

      {isOpen && (
        <div className="px-5 pb-5 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Buscar produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-9 text-sm"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500 uppercase">Código</th>
                  <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500 uppercase">Produto</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-purple-600 uppercase">Estoque (cx)</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-slate-400 uppercase">Pedidos</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-slate-400 uppercase">Disponível</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-slate-400 uppercase">PO</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-slate-400 uppercase">Projetado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const qty = aguardandoMap.get(item.codigoItem) || 0;
                  const isEditing = editingItem === item.codigoItem;
                  return (
                    <tr key={item.codigoItem} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="py-2 px-2 text-xs text-slate-500 font-mono">{item.codigoItem}</td>
                      <td className="py-2 px-2 text-sm text-slate-700 max-w-[300px] truncate" title={item.descricaoItem}>{item.descricaoItem}</td>
                      <td className="py-2 px-2 text-right">
                        {isEditing ? (
                          <input
                            ref={inputRef}
                            type="number"
                            min="0"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onBlur={handleSave}
                            className="w-20 text-right text-sm border border-purple-400 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-purple-300 bg-purple-50"
                          />
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleStartEdit(item.codigoItem); }}
                            className="text-sm font-bold text-purple-700 hover:bg-purple-50 px-2 py-1 rounded cursor-pointer transition-colors min-w-[60px] text-right"
                            title="Clique para editar"
                          >
                            {formatNumber(qty)}
                          </button>
                        )}
                      </td>
                      <td className="py-2 px-2 text-right text-sm text-slate-300">0</td>
                      <td className="py-2 px-2 text-right text-sm text-slate-300">0</td>
                      <td className="py-2 px-2 text-right text-sm text-slate-300">0</td>
                      <td className="py-2 px-2 text-right text-sm text-slate-300">0</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* --- Main Dashboard Content --- */
function DashboardContent({ items }: { items: StockItem[] }) {
  const operatorCtx = useOperator();
  const [search, setSearch] = useState("");
  const [segmentoFilter, setSegmentoFilter] = useState("all");
  const [sort, setSort] = useState<SortField>("comprimento");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [openCards, setOpenCards] = useState<Record<string, boolean>>({ estoque: false, encomenda: false, madeira: false, semiPronto: false, aguardandoEscolha: false });
  const [showFinancial, setShowFinancial] = useState(false);

  // Fetch classifications
  const { data: classifications } = trpc.settings.getProductClassifications.useQuery();

  // Fetch semi pronto and aguardando escolha stock for madeira KPIs
  const { data: semiProntoKPI } = trpc.dashboard.getSemiProntoStock.useQuery(undefined, { refetchInterval: 30000 });
  const { data: aguardandoKPI } = trpc.dashboard.getAguardandoEscolhaStock.useQuery(undefined, { refetchInterval: 30000 });

  // Fetch avg sales prices for valuation
  const { data: pricesData } = trpc.dashboard.getAvgSalesPrices.useQuery(undefined, {
    refetchInterval: 60000,
  });
  // Fetch manual pricing overrides
  const { data: pricingOverrides } = trpc.settings.getProductPricing.useQuery();

  const priceMap: PriceMap = useMemo(() => {
    const base = { ...(pricesData?.prices || {}) };
    // Override with manual prices where set
    if (pricingOverrides) {
      for (const p of pricingOverrides) {
        if (p.mode === "manual" && p.manualPrice) {
          const manualVal = parseFloat(p.manualPrice);
          if (!isNaN(manualVal) && manualVal > 0) {
            // Find which descricaoItem this codigoItem maps to
            const stockItem = items.find((s) => s.codigoItem === p.codigoItem);
            if (stockItem) {
              base[stockItem.descricaoItem] = { avgPrice: manualVal, salesCount: -1 };
            }
          }
        }
      }
    }
    return base;
  }, [pricesData, pricingOverrides, items]);

  const classificationMap = useMemo(() => {
    const map = new Map<string, string>();
    if (classifications) {
      for (const c of classifications) {
        map.set(c.codigoItem, c.classification);
      }
    }
    return map;
  }, [classifications]);

  // Split items into 3 groups
  const estoqueItems = useMemo(() => items.filter(i => {
    const c = classificationMap.get(i.codigoItem);
    // Excluir itens de industrialização (madeira) - eles vão no card Madeira
    if (i.grupo === "industrializacao") return false;
    return c === "estoque" || !c || c === "outros";
  }), [items, classificationMap]);
  const encomendaItems = useMemo(() => items.filter(i => classificationMap.get(i.codigoItem) === "encomenda"), [items, classificationMap]);

  // Itens de madeira: todos os produtos de industrialização (varetas, espetos, palitos, madeira serrada)
  // Esses são os produtos industrializados de madeira que não têm estoque no Maxiprod
  const madeiraItems = useMemo(() => items.filter(i => i.grupo === "industrializacao"), [items]);

  const revendaItems = useMemo(() => items.filter((i) => i.grupo === "importacao_revenda"), [items]);
  const industItems = useMemo(() => items.filter((i) => i.grupo === "industrializacao"), [items]);
  const mpItems = useMemo(() => items.filter((i) => i.grupo === "importacao_mp"), [items]);

  // Contagem apenas de pais (excluindo variações filhas)
  const parentOnlyItems = useMemo(() => items.filter(i => !i.isChild), [items]);
  const parentOnlyEstoque = useMemo(() => estoqueItems.filter(i => !i.isChild), [estoqueItems]);
  const parentOnlyEncomenda = useMemo(() => encomendaItems.filter(i => !i.isChild), [encomendaItems]);
  const parentOnlyMadeira = useMemo(() => madeiraItems.filter(i => !i.isChild), [madeiraItems]);
  const parentOnlyRevenda = useMemo(() => revendaItems.filter(i => !i.isChild), [revendaItems]);
  const parentOnlyIndust = useMemo(() => industItems.filter(i => !i.isChild), [industItems]);
  const parentOnlyMP = useMemo(() => mpItems.filter(i => !i.isChild), [mpItems]);

  const totalEstoqueCx = items.reduce((sum, i) => sum + (i.estoqueCx ?? 0), 0);
  const totalPedidosCx = items.reduce((sum, i) => sum + (i.pedidosCx ?? 0), 0);
  const totalDisponivelCx = items.reduce((sum, i) => sum + (i.disponivelCx ?? 0), 0);
  const totalPOCx = items.reduce((sum, i) => sum + (i.poCx ?? 0), 0);
  const totalProjetadoCx = items.reduce((sum, i) => sum + (i.projetadoCx ?? 0), 0);

  // Madeira KPI totals (Madeira card + Semi Pronto + Aguardando Escolha)
  const semiProntoTotal = useMemo(() => {
    if (!semiProntoKPI?.items) return 0;
    return semiProntoKPI.items.reduce((sum, sp) => sum + (parseFloat(String(sp.quantidade)) || 0), 0);
  }, [semiProntoKPI]);

  const aguardandoTotal = useMemo(() => {
    if (!aguardandoKPI?.items) return 0;
    return aguardandoKPI.items.reduce((sum, sp) => sum + (parseFloat(String(sp.quantidade)) || 0), 0);
  }, [aguardandoKPI]);

  const madeiraEstoqueCx = useMemo(() => {
    const madeiraCardEstoque = madeiraItems.reduce((sum, i) => sum + (i.estoqueCx ?? 0), 0);
    return madeiraCardEstoque + semiProntoTotal + aguardandoTotal;
  }, [madeiraItems, semiProntoTotal, aguardandoTotal]);

  const madeiraPedidosCx = useMemo(() => madeiraItems.reduce((sum, i) => sum + (i.pedidosCx ?? 0), 0), [madeiraItems]);
  const madeiraDisponivelCx = madeiraEstoqueCx - madeiraPedidosCx;
  const madeiraPOCx = useMemo(() => madeiraItems.reduce((sum, i) => sum + (i.poCx ?? 0), 0), [madeiraItems]);
  const madeiraProjetadoCx = madeiraDisponivelCx + madeiraPOCx;
  const madeiraProdutos = parentOnlyMadeira.length;
  const negativos = items.filter((i) => (i.disponivelCx ?? i.disponivelUn) < 0).length;

  // Custo do Estoque Regulador global (apenas itens do card Estoque)
  const custoEstRegGlobal = useMemo(() => {
    if (!pricingOverrides) return null;
    let total = 0;
    let itensComCalculo = 0;
    for (const item of estoqueItems) {
      const pItem = pricingOverrides.find(p => p.codigoItem === item.codigoItem);
      const vm = pItem?.vendaMensal;
      if (vm == null) continue;
      const f = pItem?.fatorMultiplicacao ? parseFloat(pItem.fatorMultiplicacao) : 2.3;
      const estReg = Math.round(vm * f);
      const price = priceMap[item.descricaoItem];
      if (price) {
        total += estReg * price.avgPrice;
        itensComCalculo++;
      }
    }
    return { total, itensComCalculo };
  }, [estoqueItems, priceMap, pricingOverrides]);

  // Calcular alertas por categoria (apenas do card Estoque)
  const alertDetails = useMemo(() => {
    const compra: { item: StockItem; estReg: number; projetado: number }[] = [];
    const cuidado: { item: StockItem; estReg: number; projetado: number }[] = [];
    const atencao: { item: StockItem; estReg: number; projetado: number }[] = [];
    if (!pricingOverrides) return { compra, cuidado, atencao, total: 0 };
    for (const item of estoqueItems) {
      if (item.isChild) continue;
      const pItem = pricingOverrides.find(p => p.codigoItem === item.codigoItem);
      const vm = pItem?.vendaMensal;
      if (vm == null) continue;
      const f = pItem?.fatorMultiplicacao ? parseFloat(pItem.fatorMultiplicacao) : 2.3;
      const estReg = Math.round(vm * f);
      const projetado = item.projetadoCx ?? item.projetadoUn ?? 0;
      if (projetado <= estReg) {
        compra.push({ item, estReg, projetado });
      } else if (projetado <= estReg * 1.2) {
        cuidado.push({ item, estReg, projetado });
      } else if (projetado <= estReg * 1.4) {
        atencao.push({ item, estReg, projetado });
      }
    }
    return { compra, cuidado, atencao, total: compra.length + cuidado.length + atencao.length };
  }, [estoqueItems, pricingOverrides]);

  const itensCompra = alertDetails.compra.length;
  const [alertsDialogOpen, setAlertsDialogOpen] = useState(false);
  const [alertTab, setAlertTab] = useState<"compra" | "cuidado" | "atencao">("compra");

  const handleSort = (field: SortField) => {
    if (sort === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSort(field);
      setSortDir("desc");
    }
  };

  const toggleCard = (key: string) => {
    setOpenCards(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-20 text-slate-400">
        <Package className="w-16 h-16 mx-auto mb-4 opacity-30" />
        <p className="text-lg font-medium">Aguardando dados do Maxiprod...</p>
        <p className="text-sm mt-1">Clique em Sincronizar para buscar os dados</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard
          label="Estoque Total"
          value={`${formatNumber(totalEstoqueCx)} cx`}
          sub={`${parentOnlyItems.length} produtos`}
          icon={Package}
          theme="teal"
        />
        <KPICard
          label="Pedidos (Venda)"
          value={`${formatNumber(totalPedidosCx)} cx`}
          sub="Aprovados + A aprovar"
          icon={ShoppingCart}
          theme="orange"
        />
        <KPICard
          label="Disponivel"
          value={`${formatNumber(totalDisponivelCx)} cx`}
          sub="Estoque - Pedidos"
          icon={CheckCircle2}
          theme="emerald"
        />
        <KPICard
          label="PO (A Receber)"
          value={`${formatNumber(totalPOCx)} cx`}
          sub="Pedidos de compra"
          icon={Ship}
          theme="blue"
        />
        <KPICard
          label="Projetado"
          value={`${formatNumber(totalProjetadoCx)} cx`}
          sub="Disponivel + PO"
          icon={TrendingUp}
          theme="indigo"
        />
        <KPICard
          label="Alertas"
          value={alertDetails.compra.length > 0 ? `${alertDetails.compra.length} itens` : alertDetails.total > 0 ? `${alertDetails.total} itens` : "Nenhum"}
          sub={alertDetails.total > 0 ? `${alertDetails.compra.length} compra (abaixo do est. regulador) · ${alertDetails.cuidado.length} cuidado · ${alertDetails.atencao.length} atenção` : "Tudo em ordem"}
          icon={alertDetails.total > 0 ? AlertTriangle : CheckCircle2}
          theme={alertDetails.compra.length > 0 ? "red" : alertDetails.cuidado.length > 0 ? "pink" : alertDetails.atencao.length > 0 ? "amber" : "slate"}
          onClick={alertDetails.total > 0 ? () => setAlertsDialogOpen(true) : undefined}
        />
      </div>

      {/* Alerts Detail Dialog */}
      {alertsDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setAlertsDialogOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Detalhes dos Alertas</h3>
                <p className="text-sm text-slate-400 mt-0.5">{alertDetails.total} produtos com alerta</p>
              </div>
              <button onClick={() => setAlertsDialogOpen(false)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Tab selector */}
            <div className="px-6 pt-4 flex gap-2">
              <button
                onClick={() => setAlertTab("compra")}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  alertTab === "compra"
                    ? "bg-red-100 text-red-700 ring-1 ring-red-200"
                    : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  Compra ({alertDetails.compra.length}) <span className="text-[10px] font-normal text-red-500 ml-0.5">(Abaixo do Est. Regulador)</span>
                </span>
              </button>
              <button
                onClick={() => setAlertTab("cuidado")}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  alertTab === "cuidado"
                    ? "bg-pink-100 text-pink-700 ring-1 ring-pink-200"
                    : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-pink-500" />
                  Cuidado ({alertDetails.cuidado.length}) <span className="text-[10px] font-normal text-pink-500 ml-0.5">(20% acima do Est. Regulador)</span>
                </span>
              </button>
              <button
                onClick={() => setAlertTab("atencao")}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  alertTab === "atencao"
                    ? "bg-orange-100 text-orange-700 ring-1 ring-orange-200"
                    : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-orange-500" />
                  Atenção ({alertDetails.atencao.length}) <span className="text-[10px] font-normal text-orange-500 ml-0.5">(40% acima do Est. Regulador)</span>
                </span>
              </button>
            </div>

            {/* Product list */}
            <div className="px-6 py-4 overflow-y-auto max-h-[55vh]">
              {(() => {
                const list = alertTab === "compra" ? alertDetails.compra : alertTab === "cuidado" ? alertDetails.cuidado : alertDetails.atencao;
                const colorMap = {
                  compra: { bg: "bg-red-50", text: "text-red-700", badge: "bg-red-100 text-red-700", border: "border-red-100" },
                  cuidado: { bg: "bg-pink-50", text: "text-pink-700", badge: "bg-pink-100 text-pink-700", border: "border-pink-100" },
                  atencao: { bg: "bg-orange-50", text: "text-orange-700", badge: "bg-orange-100 text-orange-700", border: "border-orange-100" },
                };
                const colors = colorMap[alertTab];
                if (list.length === 0) {
                  return (
                    <div className="text-center py-12 text-slate-400">
                      <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
                      <p className="text-sm">Nenhum produto nesta categoria</p>
                    </div>
                  );
                }
                return (
                  <div className="space-y-2">
                    {list.map(({ item, estReg, projetado }) => (
                      <div key={item.codigoItem} className={`${colors.bg} rounded-lg border ${colors.border} p-3 flex items-center justify-between gap-4`}>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-800 truncate">{item.descricaoItem}</p>
                          <p className="text-xs text-slate-500 mt-0.5">Cód: {item.codigoItem}</p>
                        </div>
                        <div className="flex items-center gap-4 flex-shrink-0">
                          <div className="text-center">
                            <p className="text-[10px] text-slate-400 uppercase font-medium">Projetado</p>
                            <p className={`text-sm font-bold ${colors.text}`}>{formatNumber(projetado)} cx</p>
                          </div>
                          <div className="text-center">
                            <p className="text-[10px] text-slate-400 uppercase font-medium">Est. Reg.</p>
                            <p className="text-sm font-bold text-slate-600">{formatNumber(estReg)} cx</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* PO Overview Card */}
      <POOverviewCard items={items} />



      {/* Valuation summary card + Financial toggle */}
      {(() => {
        // Calculate global valuation across ALL items
        const globalValuation = (() => {
          let valorEstoque = 0;
          let valorPO = 0;
          let valorProjetado = 0;
          let comPreco = 0;
          let semPreco = 0;
          for (const item of items) {
            const price = priceMap[item.descricaoItem];
            if (price) {
              comPreco++;
              valorEstoque += (item.estoqueCx ?? 0) * price.avgPrice;
              valorPO += (item.poCx ?? 0) * price.avgPrice;
              valorProjetado += (item.projetadoCx ?? 0) * price.avgPrice;
            } else {
              semPreco++;
            }
          }
          return { valorEstoque, valorPO, valorProjetado, comPreco, semPreco };
        })();

        return (
          <div className="flex items-stretch gap-4">
            {/* Global Valuation Card */}
            {showFinancial && (
              <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-3 transition-all">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Valorização Total do Estoque</p>
                  <span className="text-[10px] text-slate-400 ml-auto">{globalValuation.comPreco}/{parentOnlyItems.length} com preço</span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2.5">
                    <p className="text-[10px] text-green-700 font-semibold uppercase tracking-wider">Vlr Estoque</p>
                    <p className="text-lg font-extrabold text-green-800">{formatCurrency(globalValuation.valorEstoque)}</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
                    <p className="text-[10px] text-blue-700 font-semibold uppercase tracking-wider">Vlr PO</p>
                    <p className="text-lg font-extrabold text-blue-800">{formatCurrency(globalValuation.valorPO)}</p>
                  </div>
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2.5">
                    <p className="text-[10px] text-indigo-700 font-semibold uppercase tracking-wider">Vlr Projetado</p>
                    <p className="text-lg font-extrabold text-indigo-800">{formatCurrency(globalValuation.valorProjetado)}</p>
                  </div>
                </div>
                {custoEstRegGlobal && custoEstRegGlobal.total > 0 && (
                  <div className="mt-3 bg-purple-50 border border-purple-200 rounded-lg px-4 py-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-purple-700 font-semibold uppercase tracking-wider flex items-center gap-1">
                          <Package className="w-3 h-3" />Custo do Estoque Regulador
                        </p>
                        <p className="text-[9px] text-purple-500 mt-0.5">Valor para manter estoque regulador ({custoEstRegGlobal.itensComCalculo} itens)</p>
                      </div>
                      <p className="text-lg font-extrabold text-purple-800">{formatCurrency(custoEstRegGlobal.total)}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Financial toggle button - restricted by est.valorizacao granular permission */}
            {operatorCtx?.hasGranularAccess("est.valorizacao") && (
              <div className={`flex items-center ${!showFinancial ? 'ml-auto' : ''}`}>
                <button
                  onClick={() => setShowFinancial(!showFinancial)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                    showFinancial
                      ? 'bg-emerald-600 text-white shadow-md hover:bg-emerald-700'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 shadow-sm'
                  }`}
                >
                  <DollarSign className="w-4 h-4" />
                  {showFinancial ? 'Ocultar Valorização' : 'Valorização do Estoque'}
                  {showFinancial ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            )}
          </div>
        );
      })()}

      {/* 3 Classification Cards */}
      <ClassificationCard
        title="Estoque"
        subtitle={`${parentOnlyEstoque.length} produtos classificados para manter em estoque`}
        icon={Boxes}
        iconBg="bg-teal-100"
        iconColor="text-teal-600"
        borderColor="border-l-teal-500"
        items={estoqueItems}
        isOpen={openCards.estoque}
        onToggle={() => toggleCard("estoque")}
        priceMap={priceMap}
        showFinancial={showFinancial}
        pricingOverrides={pricingOverrides ?? undefined}
        enableCompraRule={true}
      />

      <ClassificationCard
        title="Sob Encomenda"
        subtitle={`${parentOnlyEncomenda.length} produtos vendidos sob encomenda`}
        icon={ClipboardList}
        iconBg="bg-amber-100"
        iconColor="text-amber-600"
        borderColor="border-l-amber-500"
        items={encomendaItems}
        isOpen={openCards.encomenda}
        onToggle={() => toggleCard("encomenda")}
        priceMap={priceMap}
        showFinancial={showFinancial}
        pricingOverrides={pricingOverrides ?? undefined}
        hideAlerts={true}
      />

      {/* KPIs Madeira - Análise dos 3 grupos de madeira */}
      <div className="mt-2 mb-1">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Resumo Madeira (Madeira + Semi Pronto + Aguardando Escolha)</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard
          label="Estoque Total"
          value={`${formatNumber(madeiraEstoqueCx)} cx`}
          sub={`${madeiraProdutos} produtos`}
          icon={TreePine}
          theme="teal"
        />
        <KPICard
          label="Pedidos (Venda)"
          value={`${formatNumber(madeiraPedidosCx)} cx`}
          sub="Pedidos de madeira"
          icon={ShoppingCart}
          theme="orange"
        />
        <KPICard
          label="Disponivel"
          value={`${formatNumber(madeiraDisponivelCx)} cx`}
          sub="Estoque - Pedidos"
          icon={CheckCircle2}
          theme="emerald"
        />
        <KPICard
          label="PO (A Receber)"
          value={`${formatNumber(madeiraPOCx)} cx`}
          sub="Pedidos de compra"
          icon={Ship}
          theme="blue"
        />
        <KPICard
          label="Projetado"
          value={`${formatNumber(madeiraProjetadoCx)} cx`}
          sub="Disponivel + PO"
          icon={TrendingUp}
          theme="indigo"
        />
        <KPICard
          label="Alertas"
          value="Nenhum"
          sub="Tudo em ordem"
          icon={CheckCircle2}
          theme="slate"
        />
      </div>

      <ClassificationCard
        title="Madeira"
        subtitle={`${parentOnlyMadeira.length} produtos industrializados de madeira`}
        icon={TreePine}
        iconBg="bg-green-100"
        iconColor="text-green-700"
        borderColor="border-l-green-600"
        items={madeiraItems}
        isOpen={openCards.madeira}
        onToggle={() => toggleCard("madeira")}
        priceMap={priceMap}
        showFinancial={showFinancial}
        pricingOverrides={pricingOverrides ?? undefined}
        hideAlerts={true}
      />

      <SemiProntoCard
        items={madeiraItems}
        isOpen={openCards.semiPronto}
        onToggle={() => toggleCard("semiPronto")}
        operatorName={operatorCtx.operator?.name}
      />

      <AguardandoEscolhaCard
        items={madeiraItems}
        isOpen={openCards.aguardandoEscolha}
        onToggle={() => toggleCard("aguardandoEscolha")}
        operatorName={operatorCtx.operator?.name}
      />

    </div>
  );
}

/* --- Main Page --- */
export default function Home() {
  const operatorCtx = useOperator();
  const { data, isLoading } = trpc.dashboard.getData.useQuery(undefined, {
    refetchInterval: 30000,
  });
  const { data: hiddenProducts } = trpc.settings.getHiddenProducts.useQuery();

  const items: StockItem[] = useMemo(() => {
    const allItems = (data?.items as StockItem[]) || [];
    if (!hiddenProducts || hiddenProducts.length === 0) return allItems;
    const hiddenCodeSet = new Set(hiddenProducts.filter(h => h.codigoItem).map(h => h.codigoItem));
    return allItems.filter(item => {
      if (item.codigoItem && hiddenCodeSet.has(item.codigoItem)) return false;
      return true;
    });
  }, [data?.items, hiddenProducts]);

  return (
    <div className="min-h-screen bg-slate-50">
      <TopNav rightContent={
        <div className="text-right text-xs text-slate-400">
          {data?.lastSync ? (
            <span>Dados de {new Date(data.lastSync).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
          ) : (
            <span>Carregando...</span>
          )}
        </div>
      } />

      {/* Main */}
      <main className="container py-6 space-y-5">
        <div className="text-center py-2">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            <span className="text-slate-700">Dashboard de Estoque</span>
            <span className="text-teal-600 ml-2">Grupo Fox</span>
          </h2>
          <p className="text-sm text-slate-400 mt-1.5 tracking-widest uppercase">Controle de Produtos e Pedidos de Compra</p>
        </div>

        <ConnectionStatusCard />

        {isLoading ? (
          <div className="text-center py-20">
            <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-teal-500" />
            <p className="text-slate-500">Carregando dados do Maxiprod...</p>
          </div>
        ) : (
          <DashboardContent items={items} />
        )}
      </main>
    </div>
  );
}
