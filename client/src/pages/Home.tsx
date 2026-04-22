/**
 * Dashboard Grupo Fox - ESPELHO FIEL DO MAXIPROD
 * 
 * REGRA FUNDAMENTAL: O dashboard exibe os dados EXATAMENTE como vêm do Maxiprod.
 * Mesmas descrições, mesmos códigos, mesmas quantidades.
 * Sem processamento de nomes, sem filtros manuais de grupo.
 */

import React, { useState, useMemo, useRef, Fragment, useCallback, useEffect } from "react";
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
  History,
  X,
  KeyRound,
  Pencil,
  ShieldAlert,
  Scale,
  FileText,
  ClipboardCheck,
  Store,
  Info,
  ArrowRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
    estoqueUn?: number;
    estoqueCx?: number | null;
  }[];
  variantConversionFactor?: number | null;
  // Pedidos próprios do pai (antes de somar variações)
  pedidosCxProprio?: number | null;
  pedidosUnProprio?: number;
  pedidosPorClienteProprio?: PedidoCliente[];
  // E-commerce breakdown (para produtos de importação com variações PC)
  ecommerceBreakdown?: {
    totalCaixasOriginal: number;
    estoqueFisicoCx: number;
    variacoes: {
      codigoItem: string;
      descricaoItem: string;
      unidadesPorPacote: number;
      quantidadePC: number;
      caixasEquivalentes: number;
    }[];
    pedidosEcommerceCx: number;
    pedidosEcommerceUn: number;
  } | null;
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

function formatNumber(n: number | null, forceFloor = false): string {
  if (n === null || n === undefined) return "—";
  if (forceFloor) {
    // Arredondar para baixo (sem números quebrados em caixas)
    const floored = n < 0 ? Math.ceil(n) : Math.floor(n);
    return floored.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  }
  // Show decimal places when number is not integer (e.g., 11.6 for product 00808)
  const fractionDigits = Number.isInteger(n) ? 0 : 1;
  return n.toLocaleString("pt-BR", { maximumFractionDigits: fractionDigits });
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
  if (item.codigoItem === "00223") return "kg"; // Vareta de Apito: unidade = kg
  if (item.codigoItem === "00129") return "dz"; // Rojão: unidade = dúzia
  return hasCx ? "cx" : "un";
}

/**
 * For kg products, PO "caixas" are actually sacos (bags).
 * Returns the label for PO quantities.
 */
function getPOUnit(item: StockItem): string {
  if (item.isKgProduct) return "kg";
  if (item.codigoItem === "00223") return "kg"; // Vareta de Apito: unidade = kg
  if (item.codigoItem === "00129") return "dz"; // Rojão: unidade = dúzia
  return "cx";
}

/**
 * For kg products, poCx is already in kg (set by backend).
 * For other products, poCx is in boxes.
 */
function getPODisplayQty(item: StockItem): number {
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
    <Badge className={`${style.bg} ${style.text} text-[11px] border-0 max-w-full whitespace-normal text-center leading-tight py-1 px-2`} title={`${style.label}${subLabel ? ` / ${subLabel}` : ""}`}>
      <Icon className="w-3 h-3 mr-1 flex-shrink-0" /><span className="break-words">{style.label}{subLabel ? `/${subLabel}` : ""}</span>
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
  green:   { iconBg: "bg-green-50",   iconColor: "text-green-600",   bar: "bg-gradient-to-r from-green-400 to-green-600" },
  slate:   { iconBg: "bg-slate-50",   iconColor: "text-slate-500",   bar: "bg-gradient-to-r from-slate-300 to-slate-400" },
};

function KPICard({ label, value, sub, icon: Icon, theme, onClick }: { 
  label: string; value: string; sub?: string; icon: React.ElementType; 
  theme: keyof typeof kpiStyles;
  onClick?: () => void;
}) {
  const s = kpiStyles[theme];
  return (
    <div className={`group relative bg-white rounded-xl border border-slate-100 overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 h-full ${onClick ? 'cursor-pointer' : ''}`} onClick={onClick}>
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
    return <span className="text-slate-300 text-sm">{"—"}</span>;
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
            {isKg && <span className="ml-1">({formatNumber(poCx, true)} sacos)</span>}
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
function StockTable({ items, search, segmentoFilter, grupoFilter, subgrupoFilter, crmSegmentoFilter, sort, sortDir, onSort, priceMap, showFinancial, pricingOverrides, enableCompraRule, monthlySalesData }: {
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
  monthlySalesData?: MonthlySalesData;
}) {
  const [prodColWidth, setProdColWidth] = useState(380);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  const [showSalesColumns, setShowSalesColumns] = useState(false);
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
      <div className="max-h-[60vh] overflow-auto relative">
        <table className={`${showFinancial ? 'w-full min-w-[1100px]' : 'w-full'}`} style={!showFinancial ? { tableLayout: 'fixed', ...(showSalesColumns ? { width: 1500 } : {}) } : undefined}>
          <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-20 shadow-sm">
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
                    className={`py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-teal-600 select-none relative ${showSalesColumns ? 'sticky left-0 z-30 bg-slate-50' : ''}`}
                    style={{ width: showSalesColumns ? 340 : prodColWidth, minWidth: 200, maxWidth: 800, paddingLeft: 8, paddingRight: 12 }}
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
                  <th className="px-2 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap" style={{ width: showSalesColumns ? 55 : 70 }}>Un/Cx</th>
                  {!showSalesColumns && <th className="px-2 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: 160, width: 170 }}>Grupo</th>}
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
                  <th
                    className="px-2 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:text-teal-600 select-none whitespace-nowrap"
                    onClick={() => onSort('projetadoCx')}
                  >
                    <div className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" /> Projetado
                      <ArrowUpDown className={`w-3 h-3 ${sort === 'projetadoCx' ? 'text-teal-600' : 'text-slate-300'}`} />
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowSalesColumns(!showSalesColumns); }}
                        className={`ml-1 p-1 rounded transition-all ${showSalesColumns ? 'bg-blue-500 text-white shadow-sm' : 'bg-amber-100 text-amber-600 hover:bg-amber-200 ring-1 ring-amber-300 animate-pulse'}`}
                        title={showSalesColumns ? 'Ocultar colunas de vendas' : 'Mostrar vendas mensais'}
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </th>
                  {showSalesColumns && monthlySalesData?.months && (
                    <>
                      {monthlySalesData.months.slice(0, 3).map((m) => (
                        <th key={m.key} className="px-1 py-2.5 text-right text-[10px] font-bold text-blue-700 uppercase tracking-wider bg-blue-50/60 border-x border-blue-200 whitespace-nowrap" title={`Vendas faturadas em ${m.label}`}>
                          <div className="text-[8px] text-blue-500 font-medium leading-tight">VENDAS</div>
                          <div>{m.label}</div>
                        </th>
                      ))}
                      <th className="px-1 py-2.5 text-right text-[10px] font-bold text-indigo-800 uppercase tracking-wider bg-indigo-100/60 border-x border-indigo-200 whitespace-nowrap" title="Média de vendas dos últimos 3 meses">
                        <div className="text-[8px] text-indigo-500 font-medium leading-tight">MÉDIA</div>
                        <div>3 Meses</div>
                      </th>
                      <th className="px-1 py-2.5 text-right text-[10px] font-bold text-purple-800 uppercase tracking-wider bg-purple-100/60 border-x border-purple-200 whitespace-nowrap" title="Estoque Regulador Calculado = Média × 2,33 (cobertura 60 dias)">
                        <div className="text-[8px] text-purple-500 font-medium leading-tight">EST.REG.</div>
                        <div>Calc.</div>
                      </th>
                      <th className="px-1 py-2.5 text-right text-[10px] font-bold text-emerald-800 uppercase tracking-wider bg-emerald-100/60 border-x border-emerald-200 whitespace-nowrap" title={`Vendas do mês atual (${monthlySalesData.months[3]?.label})`}>
                        <div className="text-[8px] text-emerald-500 font-medium leading-tight">VENDAS</div>
                        <div>{monthlySalesData.months[3]?.label || 'Atual'}</div>
                      </th>
                    </>
                  )}
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
                    className={`${showFinancial ? 'px-2 py-1.5' : 'px-2 py-2.5'} ${showSalesColumns && !showFinancial ? 'sticky left-0 z-20 bg-white' : ''}`}
                    style={showFinancial ? { minWidth: 280 } : { width: showSalesColumns ? 340 : prodColWidth, minWidth: 200, maxWidth: 800 }}
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
                        {item.isKgProduct ? "kg" : (item.unidadesPorCaixa ? formatNumber(item.unidadesPorCaixa, true) : "—")}
                      </td>
                      {/* Grupo/Subgrupo */}
                      {!showSalesColumns && <td className="px-2 py-2.5 overflow-hidden" style={{ minWidth: 160, width: 170, maxWidth: 180 }}>
                        <GrupoBadge grupo={item.grupo} subgrupo={item.subgrupo} />
                      </td>}
                    </>
                  )}
                  {/* Estoque - esconder quando showFinancial */}
                  {!showFinancial && (
                  <td className='px-2 py-2.5 whitespace-nowrap'>
                    {item.ecommerceBreakdown ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className='font-semibold text-slate-800 text-sm cursor-help border-b border-dashed border-purple-300'>
                            {formatNumber(item.ecommerceBreakdown.totalCaixasOriginal, true)} {getUnit(item, true)}
                            <Store className="w-3 h-3 inline ml-1 text-purple-500" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-md w-[400px] p-0" sideOffset={8}>
                          <div className="bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden">
                            {/* Header */}
                            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 px-5 py-4 border-b border-purple-100">
                              <div className="flex items-center gap-2">
                                <Store className="w-5 h-5 text-purple-600" />
                                <p className="text-sm font-bold text-purple-800">Composição do Estoque</p>
                              </div>
                              <p className="text-xs text-purple-500 mt-1">Inclui pacotes E-commerce convertidos em caixas</p>
                            </div>
                            {/* Breakdown */}
                            <div className="px-5 py-4 space-y-3">
                              {/* Estoque físico (caixas originais) */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full bg-teal-500" />
                                  <span className="text-sm text-slate-700">Estoque Físico (CX)</span>
                                </div>
                                <span className="text-sm font-bold text-teal-700">{formatNumber(item.ecommerceBreakdown.estoqueFisicoCx, true)} cx</span>
                              </div>
                              {/* Variações PC convertidas */}
                              {item.ecommerceBreakdown.variacoes.map((v, vi) => (
                                <div key={vi} className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-purple-400" />
                                    <div>
                                      <span className="text-xs text-slate-600">{formatNumber(v.quantidadePC, true)} PC × {formatNumber(v.unidadesPorPacote, true)} un</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <ArrowRight className="w-3 h-3 text-slate-400" />
                                    <span className="text-sm font-bold text-purple-700">{formatNumber(v.caixasEquivalentes, true)} cx</span>
                                  </div>
                                </div>
                              ))}
                              {/* Separador */}
                              <div className="border-t border-slate-200 pt-3 flex items-center justify-between">
                                <span className="text-sm font-semibold text-slate-800">Total Real</span>
                                <span className="text-base font-extrabold text-slate-900">{formatNumber(item.ecommerceBreakdown.totalCaixasOriginal, true)} cx</span>
                              </div>
                              {/* Info E-commerce */}
                              {item.ecommerceBreakdown.variacoes.length > 0 && (
                                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 mt-2">
                                  <div className="flex items-center gap-2">
                                    <Info className="w-4 h-4 text-amber-600 flex-shrink-0" />
                                    <div>
                                      <p className="text-xs font-semibold text-amber-800">Transferência E-commerce</p>
                                      <p className="text-xs text-amber-600">{formatNumber(item.ecommerceBreakdown.variacoes.reduce((sum: number, v: any) => sum + v.caixasEquivalentes, 0), true)} cx em pedidos para filial (não gera receita)</p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className='font-semibold text-slate-800 text-sm'>
                        {item.estoqueCx !== null ? `${formatNumber(item.estoqueCx, true)}` : `${formatNumber(item.estoqueUn, true)}`}
                        {<> {getUnit(item, item.estoqueCx !== null)}</>}
                      </span>
                    )}
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
                                                      {formatNumber(Math.ceil(pc.quantidadeCx), true)} {unit}
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
                                                        {formatNumber(Math.ceil(pc.quantidadeCx), true)} cx
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
                      {item.disponivelCx !== null ? `${formatNumber(item.disponivelCx, true)}` : `${formatNumber(item.disponivelUn, true)}`}
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
                            Disponivel ({formatNumber(item.disponivelCx ?? item.disponivelUn, true)} {getUnit(item, item.disponivelCx !== null)}) + PO ({formatNumber(item.poCx ?? 0, true)} {getPOUnit(item)}) = <strong>{formatNumber(projetado, true)} {getUnit(item, item.projetadoCx !== null)}</strong>
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-slate-300 text-sm">{"—"}</span>
                    )}
                  </td>
                  {/* Toggle icon cell (spacer) */}

                  {/* 6 colunas ocultas de vendas mensais */}
                  {!showFinancial && showSalesColumns && monthlySalesData?.months && (() => {
                    const salesByMonth = monthlySalesData.data[item.codigoItem] || {};
                    const m1 = salesByMonth[monthlySalesData.months[0]?.key] || 0;
                    const m2 = salesByMonth[monthlySalesData.months[1]?.key] || 0;
                    const m3 = salesByMonth[monthlySalesData.months[2]?.key] || 0;
                    const avg3m = (m1 + m2 + m3) / 3;
                    const estRegCalc = Math.round(avg3m * 2.33);
                    const mAtual = salesByMonth[monthlySalesData.months[3]?.key] || 0;
                    const unit = item.isKgProduct ? "kg" : "cx";
                    return (
                      <>
                        <td className="px-1 py-2 text-right bg-blue-50/30 border-x border-blue-200 whitespace-nowrap">
                          <span className={`text-[11px] font-medium ${m1 > 0 ? 'text-blue-700' : 'text-slate-300'}`}>{m1 > 0 ? `${formatNumber(m1)} ${unit}` : '—'}</span>
                        </td>
                        <td className="px-1 py-2 text-right bg-blue-50/30 border-x border-blue-200 whitespace-nowrap">
                          <span className={`text-[11px] font-medium ${m2 > 0 ? 'text-blue-700' : 'text-slate-300'}`}>{m2 > 0 ? `${formatNumber(m2)} ${unit}` : '—'}</span>
                        </td>
                        <td className="px-1 py-2 text-right bg-blue-50/30 border-x border-blue-200 whitespace-nowrap">
                          <span className={`text-[11px] font-medium ${m3 > 0 ? 'text-blue-700' : 'text-slate-300'}`}>{m3 > 0 ? `${formatNumber(m3)} ${unit}` : '—'}</span>
                        </td>
                        <td className="px-1 py-2 text-right bg-indigo-100/40 border-x border-indigo-200 whitespace-nowrap">
                          <span className={`text-[11px] font-bold ${avg3m > 0 ? 'text-indigo-800' : 'text-slate-300'}`}>{avg3m > 0 ? `${formatNumber(Math.round(avg3m))} ${unit}` : '—'}</span>
                        </td>
                        <td className="px-1 py-2 text-right bg-purple-100/40 border-x border-purple-200 whitespace-nowrap">
                          <span className={`text-[11px] font-bold ${estRegCalc > 0 ? 'text-purple-800' : 'text-slate-300'}`} title={`${formatNumber(Math.round(avg3m))} × 2,33 = ${formatNumber(estRegCalc)}`}>{estRegCalc > 0 ? `${formatNumber(estRegCalc)} ${unit}` : '—'}</span>
                        </td>
                        <td className="px-1 py-2 text-right bg-emerald-100/40 border-x border-emerald-200 whitespace-nowrap">
                          {(() => {
                            const aboveAvg = avg3m > 0 && mAtual > avg3m;
                            const belowAvg = avg3m > 0 && mAtual < avg3m;
                            const color = aboveAvg ? 'text-emerald-700' : belowAvg ? 'text-orange-600' : mAtual > 0 ? 'text-emerald-600' : 'text-slate-300';
                            return <span className={`text-[11px] font-bold ${color}`}>{mAtual > 0 ? `${formatNumber(mAtual)} ${unit}` : '—'}{aboveAvg ? ' ↑' : belowAvg ? ' ↓' : ''}</span>;
                          })()}
                        </td>
                      </>
                    );
                  })()}
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
                      className={`${showFinancial ? 'px-2 py-1 pl-8' : 'px-2 py-1.5 pl-8'} ${showSalesColumns && !showFinancial ? 'sticky left-0 z-20 bg-teal-50' : ''}`}
                      style={showFinancial ? { minWidth: 280 } : { width: showSalesColumns ? 340 : prodColWidth, minWidth: 200, maxWidth: 800 }}
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
                          {variant.unidadesPorCaixa ? formatNumber(variant.unidadesPorCaixa, true) : '—'}
                        </td>
                        <td className="px-2 py-1.5" style={{ minWidth: 130, width: 140 }}>
                          <span className="text-[9px] text-teal-500 font-medium">Variação</span>
                        </td>
                        <td className="px-2 py-1.5">
                          {variant.estoqueCx != null && variant.estoqueCx > 0 ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-xs font-semibold text-teal-600 cursor-help">
                                  {formatNumber(variant.estoqueCx)} {getUnit(variant as any, true)}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent><p className="text-xs">Estoque reservado da variação (abatido do produto mãe)</p></TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          <span className={`text-xs font-semibold ${(variant.pedidosCx ?? variant.pedidosUn) > 0 ? 'text-orange-500' : 'text-slate-400'}`}>
                            {variant.pedidosCx !== null ? `${formatNumber(variant.pedidosCx)} ${getUnit(variant as any, true)}` : `${formatNumber(variant.pedidosUn)} un`}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 bg-emerald-50/40 border-x border-emerald-100">
                          {variant.estoqueCx != null && variant.estoqueCx > 0 && (variant.pedidosCx ?? 0) > 0 ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className={`text-xs font-semibold ${(variant.estoqueCx - (variant.pedidosCx ?? 0)) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                  {formatNumber(variant.estoqueCx - (variant.pedidosCx ?? 0))} {getUnit(variant as any, true)}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent><p className="text-xs">Disponível da variação = Estoque reservado - Pedidos</p></TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
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
                {poSummaries.length} POs pendentes de chegada &middot; Total: <strong>{formatNumber(totalPOCx, true)} caixas</strong>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-2xl font-extrabold text-blue-600">{formatNumber(totalPOCx, true)} cx</p>
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
                    <p className="font-bold text-blue-600 text-sm">{formatNumber(po.totalCx, true)} cx</p>
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
                            {formatNumber(prod.quantidade, true)} cx
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-blue-200">
                        <td colSpan={2} className="py-2 text-xs font-semibold text-slate-600 uppercase">Total</td>
                        <td className="py-2 text-right font-extrabold text-blue-700">
                          {formatNumber(po.totalCx, true)} cx
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

/* --- Password Modal for Stock Editing --- */
function PasswordModal({ open, onClose, onConfirm, title }: {
  open: boolean;
  onClose: () => void;
  onConfirm: (name: string) => void;
  title?: string;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPassword("");
      setError("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSubmit = () => {
    const trimmed = password.trim();
    if (!trimmed) {
      setError("Digite seu nome");
      return;
    }
    onConfirm(trimmed);
    setPassword("");
    setError("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-amber-600" />
            {title || "Identificação"}
          </DialogTitle>
          <DialogDescription>Digite seu nome para registrar a alteração</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <Input
            ref={inputRef}
            placeholder=""
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            className={error ? "border-red-400" : ""}
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" onClick={handleSubmit}>Confirmar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* --- Stock Edit History Modal --- */
function StockHistoryModal({ open, onClose, card, codigoItem, descricaoItem }: {
  open: boolean;
  onClose: () => void;
  card: "madeira" | "semiPronto" | "aguardandoEscolha";
  codigoItem?: string;
  descricaoItem?: string;
}) {
  const { data, isLoading } = trpc.dashboard.getStockEditHistory.useQuery(
    { card, codigoItem },
    { enabled: open }
  );

  const cardLabel = card === "madeira" ? "Madeira - Produto Acabado" : card === "semiPronto" ? "Semi Pronto" : "Aguardando Escolha";
  const cardColor = card === "madeira" ? "text-green-700" : card === "semiPronto" ? "text-amber-700" : "text-purple-700";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-slate-600" />
            Histórico de Alterações
          </DialogTitle>
          <DialogDescription>
            <span className={`font-semibold ${cardColor}`}>{cardLabel}</span>
            {descricaoItem && <> — {descricaoItem}</>}
            {" "}(últimos 15 dias)
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 -mx-6 px-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : !data?.history?.length ? (
            <div className="text-center py-8 text-slate-400">
              <History className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nenhuma alteração registrada</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Data/Hora</th>
                  <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Operador</th>
                  {!codigoItem && <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Produto</th>}
                  <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500">Anterior</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500">Novo</th>
                  <th className="text-center py-2 px-2 text-xs font-semibold text-slate-500">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {data.history.map((h: any, i: number) => {
                  const isReduction = h.tipo === "tentativa_reducao";
                  return (
                    <tr key={i} className={`border-b border-slate-100 ${isReduction ? "bg-red-50" : "hover:bg-slate-50/50"}`}>
                      <td className="py-2 px-2 text-xs text-slate-600 whitespace-nowrap">
                        {new Date(h.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="py-2 px-2 text-xs font-semibold text-slate-700">{h.operador}</td>
                      {!codigoItem && (
                        <td className="py-2 px-2 text-xs text-slate-600 max-w-[150px] truncate" title={h.descricaoItem || h.codigoItem}>
                          {h.codigoItem}
                        </td>
                      )}
                      <td className="py-2 px-2 text-right text-xs text-slate-500">{parseFloat(h.valorAnterior || "0").toFixed(0)}</td>
                      <td className={`py-2 px-2 text-right text-xs font-bold ${isReduction ? "text-red-600" : "text-green-600"}`}>
                        {parseFloat(h.valorNovo || "0").toFixed(0)}
                      </td>
                      <td className="py-2 px-2 text-center">
                        {isReduction ? (
                          <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">BLOQUEADO</span>
                        ) : (
                          <span className="text-[10px] font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">OK</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* --- Classification Group Card --- */
type PriceMap = Record<string, { avgPrice: number; salesCount: number }>;

type MonthlySalesData = {
  months: { key: string; label: string }[];
  data: Record<string, Record<string, number>>;
} | undefined;

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
  monthlySalesData,
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
  monthlySalesData?: MonthlySalesData;
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
  // Excluir filhos (isChild) dos totais para não duplicar estoque de variações PC já somadas no mãe
  const parentItems_ = useMemo(() => items.filter(i => !i.isChild), [items]);
  const totalEstoque = parentItems_.reduce((sum, i) => sum + (i.estoqueCx ?? 0), 0);
  const totalPedidos = parentItems_.reduce((sum, i) => sum + (i.pedidosCx ?? 0), 0);
  const totalDisponivel = parentItems_.reduce((sum, i) => sum + (i.disponivelCx ?? 0), 0);
  const totalPO = parentItems_.reduce((sum, i) => sum + (i.poCx ?? 0), 0);
  const totalProjetado = parentItems_.reduce((sum, i) => sum + (i.projetadoCx ?? 0), 0);
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
          <div className="bg-teal-50/80 rounded-lg px-3 py-3.5">
            <p className="text-[10px] text-teal-600 font-semibold uppercase tracking-wider">Estoque</p>
            <p className="text-lg font-extrabold text-teal-700 mt-1">{formatNumber(totalEstoque, true)} <span className="text-xs font-semibold">cx</span></p>
          </div>
          <div className="bg-orange-50/80 rounded-lg px-3 py-3.5">
            <p className="text-[10px] text-orange-600 font-semibold uppercase tracking-wider">Pedidos</p>
            <p className={`text-lg font-extrabold mt-1 ${totalPedidos > 0 ? 'text-orange-700' : 'text-slate-400'}`}>{formatNumber(totalPedidos, true)} <span className="text-xs font-semibold">cx</span></p>
          </div>
          <div className={`rounded-lg px-3 py-3.5 ${totalDisponivel < 0 ? 'bg-red-50/80' : 'bg-emerald-50/80'}`}>
            <p className={`text-[10px] font-semibold uppercase tracking-wider ${totalDisponivel < 0 ? 'text-red-600' : 'text-emerald-600'}`}>Disponível</p>
            <p className={`text-lg font-extrabold mt-1 ${totalDisponivel < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{formatNumber(totalDisponivel, true)} <span className="text-xs font-semibold">cx</span></p>
          </div>
          <div className="bg-blue-50/80 rounded-lg px-3 py-3.5">
            <p className="text-[10px] text-blue-600 font-semibold uppercase tracking-wider">PO (Compra)</p>
            <p className={`text-lg font-extrabold mt-1 ${totalPO > 0 ? 'text-blue-700' : 'text-slate-400'}`}>{formatNumber(totalPO, true)} <span className="text-xs font-semibold">cx</span></p>
          </div>
          <div className="bg-indigo-50/80 rounded-lg px-3 py-3.5">
            <p className="text-[10px] text-indigo-600 font-semibold uppercase tracking-wider">Projetado</p>
            <p className={`text-lg font-extrabold mt-1 ${totalProjetado < 0 ? 'text-red-700' : 'text-indigo-700'}`}>{formatNumber(totalProjetado, true)} <span className="text-xs font-semibold">cx</span></p>
          </div>
          <div className="bg-slate-50/80 rounded-lg px-3 py-3.5">
            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Produtos</p>
            <p className="text-lg font-extrabold text-slate-700 mt-1">{parentCount}</p>
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 cursor-help">
                    <p className="text-[10px] text-indigo-700 font-semibold uppercase tracking-wider flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />Vlr Projetado
                    </p>
                    <p className="text-base font-extrabold text-indigo-800">{formatCurrency(valuation.valorProjetado)}</p>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs bg-white border border-indigo-200 shadow-lg text-slate-700 p-3">
                  <p className="text-xs leading-relaxed"><strong>Projetado = Estoque - Pedidos em Aberto + PO</strong></p>
                  <p className="text-[10px] text-slate-500 mt-1">O valor projetado desconta os pedidos em aberto (já comprometidos) e soma os pedidos de compra (PO) a caminho. Por isso pode ser menor que o Vlr Estoque.</p>
                </TooltipContent>
              </Tooltip>
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
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-center bg-indigo-50 border border-indigo-200 rounded px-2 py-1 cursor-help">
                  <p className="text-[9px] text-indigo-700 font-semibold">Vlr Projetado</p>
                  <p className="text-xs font-bold text-indigo-800">{formatCurrencyCompact(valuation.valorProjetado)}</p>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs bg-white border border-indigo-200 shadow-lg text-slate-700 p-3">
                <p className="text-xs leading-relaxed"><strong>Projetado = Estoque - Pedidos em Aberto + PO</strong></p>
                <p className="text-[10px] text-slate-500 mt-1">Desconta pedidos já comprometidos e soma PO a caminho.</p>
              </TooltipContent>
            </Tooltip>
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
            monthlySalesData={monthlySalesData}
          />
        </div>
      )}
    </div>
  );
}

/* --- Valorização de Estoque Madeira (igual ao bambu: VLR ESTOQUE, VLR PO, VLR PROJETADO, CUSTO EST. REGULADOR) --- */
function MadeiraValorizacaoCard({
  madeiraItems,
  madeiraItemsSemiPronto,
  madeiraItemsAguardando,
  madeiraVisData,
  madeiraStockMap,
  semiProntoMap,
  aguardandoMap,
  pricingOverrides,
  showMadeiraFinancial,
  setShowMadeiraFinancial,
  operatorCtx,
}: {
  madeiraItems: StockItem[];
  madeiraItemsSemiPronto: StockItem[];
  madeiraItemsAguardando: StockItem[];
  madeiraVisData: { items: Array<{ codigoItem: string; card: string; precoCaixa: string | null }> } | undefined;
  madeiraStockMap: Map<string, number>;
  semiProntoMap: Map<string, number>;
  aguardandoMap: Map<string, number>;
  pricingOverrides?: Array<{ codigoItem: string; vendaMensal: number | null; fatorMultiplicacao: string | null; prazoCompraDias: number | null }>;
  showMadeiraFinancial: boolean;
  setShowMadeiraFinancial: (v: boolean) => void;
  operatorCtx: ReturnType<typeof useOperator>;
}) {
  // Build price map from madeira_visibility for ALL cards
  const precosMap = useMemo(() => {
    const map = new Map<string, number>();
    if (madeiraVisData?.items) {
      for (const row of madeiraVisData.items) {
        if (row.precoCaixa) {
          const val = parseFloat(row.precoCaixa);
          if (!isNaN(val) && val > 0) {
            // Use the highest price if same product appears in multiple cards
            const existing = map.get(row.codigoItem);
            if (!existing || val > existing) map.set(row.codigoItem, val);
          }
        }
      }
    }
    return map;
  }, [madeiraVisData]);

  // Calculate valuation across all 3 cards
  const valuation = useMemo(() => {
    let valorEstoque = 0;
    let valorPO = 0;
    let valorProjetado = 0;
    let comPreco = 0;
    let semPreco = 0;
    const allItems = new Map<string, boolean>(); // track unique items

    // Madeira PA items
    for (const item of madeiraItems) {
      if (item.isChild) continue;
      if (allItems.has(item.codigoItem)) continue;
      allItems.set(item.codigoItem, true);
      const preco = precosMap.get(item.codigoItem);
      if (preco && preco > 0) {
        comPreco++;
        const estoque = madeiraStockMap.get(item.codigoItem) || 0;
        const pedidos = item.pedidosCx ?? 0;
        const disponivel = estoque - pedidos;
        const po = item.poCx ?? 0;
        const projetado = disponivel + po;
        valorEstoque += estoque * preco;
        valorPO += po * preco;
        valorProjetado += projetado * preco;
      } else {
        semPreco++;
      }
    }

    // Semi Pronto items (only estoque, no PO/pedidos)
    for (const item of madeiraItemsSemiPronto) {
      if (item.isChild) continue;
      if (allItems.has(item.codigoItem + '_sp')) continue;
      allItems.set(item.codigoItem + '_sp', true);
      const preco = precosMap.get(item.codigoItem);
      if (preco && preco > 0) {
        // Don't double-count comPreco if already counted in madeira
        if (!allItems.has(item.codigoItem)) comPreco++;
        const estoque = semiProntoMap.get(item.codigoItem) || 0;
        valorEstoque += estoque * preco;
        valorProjetado += estoque * preco; // semi pronto has no PO/pedidos, projetado = estoque
      } else {
        if (!allItems.has(item.codigoItem)) semPreco++;
      }
    }

    // Aguardando Escolha items (only estoque, no PO/pedidos)
    for (const item of madeiraItemsAguardando) {
      if (item.isChild) continue;
      if (allItems.has(item.codigoItem + '_ag')) continue;
      allItems.set(item.codigoItem + '_ag', true);
      const preco = precosMap.get(item.codigoItem);
      if (preco && preco > 0) {
        if (!allItems.has(item.codigoItem) && !allItems.has(item.codigoItem + '_sp')) comPreco++;
        const estoque = aguardandoMap.get(item.codigoItem) || 0;
        valorEstoque += estoque * preco;
        valorProjetado += estoque * preco;
      } else {
        if (!allItems.has(item.codigoItem) && !allItems.has(item.codigoItem + '_sp')) semPreco++;
      }
    }

    const totalItens = comPreco + semPreco;
    return { valorEstoque, valorPO, valorProjetado, comPreco, semPreco, totalItens };
  }, [madeiraItems, madeiraItemsSemiPronto, madeiraItemsAguardando, precosMap, madeiraStockMap, semiProntoMap, aguardandoMap]);

  // Custo do Estoque Regulador (madeira PA only, same logic as bambu)
  const custoEstRegMadeira = useMemo(() => {
    if (!pricingOverrides) return null;
    let total = 0;
    let itensComCalculo = 0;
    for (const item of madeiraItems) {
      if (item.isChild) continue;
      const pItem = pricingOverrides.find(p => p.codigoItem === item.codigoItem);
      const vm = pItem?.vendaMensal;
      if (vm == null) continue;
      const f = pItem?.fatorMultiplicacao ? parseFloat(pItem.fatorMultiplicacao) : 2.3;
      const estReg = Math.round(vm * f);
      const preco = precosMap.get(item.codigoItem);
      if (preco && preco > 0) {
        total += estReg * preco;
        itensComCalculo++;
      }
    }
    return { total, itensComCalculo };
  }, [madeiraItems, pricingOverrides, precosMap]);

  return (
    <div className="flex items-stretch gap-4">
      {/* Valuation Card - same layout as bambu */}
      {showMadeiraFinancial && (
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-3 transition-all">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="w-4 h-4 text-emerald-600" />
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Valorização Total do Estoque</p>
            <span className="text-[10px] text-slate-400 ml-auto">{valuation.comPreco}/{valuation.totalItens} com preço</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2.5">
              <p className="text-[10px] text-green-700 font-semibold uppercase tracking-wider">Vlr Estoque</p>
              <p className="text-lg font-extrabold text-green-800">{formatCurrency(valuation.valorEstoque)}</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
              <p className="text-[10px] text-blue-700 font-semibold uppercase tracking-wider">Vlr PO</p>
              <p className="text-lg font-extrabold text-blue-800">{formatCurrency(valuation.valorPO)}</p>
            </div>
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2.5">
              <p className="text-[10px] text-indigo-700 font-semibold uppercase tracking-wider">Vlr Projetado</p>
              <p className="text-lg font-extrabold text-indigo-800">{formatCurrency(valuation.valorProjetado)}</p>
            </div>
          </div>
          {custoEstRegMadeira && custoEstRegMadeira.total > 0 && (
            <div className="mt-3 bg-purple-50 border border-purple-200 rounded-lg px-4 py-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-purple-700 font-semibold uppercase tracking-wider flex items-center gap-1">
                    <Package className="w-3 h-3" />Custo do Estoque Regulador
                  </p>
                  <p className="text-[9px] text-purple-500 mt-0.5">Valor para manter estoque regulador ({custoEstRegMadeira.itensComCalculo} itens)</p>
                </div>
                <p className="text-lg font-extrabold text-purple-800">{formatCurrency(custoEstRegMadeira.total)}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Toggle button - restricted by est.valorizacao granular permission */}
      {operatorCtx?.hasGranularAccess("est.valorizacao") && (
        <div className={`flex items-center ${!showMadeiraFinancial ? 'ml-auto' : ''}`}>
          <button
            onClick={() => setShowMadeiraFinancial(!showMadeiraFinancial)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              showMadeiraFinancial
                ? 'bg-emerald-600 text-white shadow-md hover:bg-emerald-700'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 shadow-sm'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            {showMadeiraFinancial ? 'Ocultar Valorização' : 'Valorização do Estoque'}
            {showMadeiraFinancial ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      )}
    </div>
  );
}

/* --- Auto-Feed Report Modal --- */
function AutoFeedReportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, isLoading } = trpc.production.getStockAutoFeedReport.useQuery(undefined, { enabled: open });
  const [filterDivergent, setFilterDivergent] = useState(false);

  const report = data?.report || [];
  const dataLabel = data?.data || new Date().toISOString().slice(0, 10);
  const filtered = filterDivergent ? report.filter(r => !r.bateu || r.embaladoHoje > 0 || r.alteracoes.length > 0) : report.filter(r => r.embaladoHoje > 0 || r.alteracoes.length > 0);
  const totalEmbalado = report.reduce((s, r) => s + r.embaladoHoje, 0);
  const totalDivergentes = report.filter(r => !r.bateu && (r.embaladoHoje > 0 || r.alteracoes.length > 0)).length;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-emerald-600" />
            Conferência Auto-feed Embalagem → Estoque
          </DialogTitle>
          <DialogDescription>
            Relatório de {new Date(dataLabel + "T12:00:00").toLocaleDateString("pt-BR")} — Verifica se o estoque bate com o preenchimento da Embalagem
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            <span className="ml-3 text-slate-500">Carregando relatório...</span>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5 text-center">
                <p className="text-[10px] text-emerald-600 font-semibold uppercase">Produtos Embalados</p>
                <p className="text-xl font-extrabold text-emerald-700">{filtered.length}</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-center">
                <p className="text-[10px] text-blue-600 font-semibold uppercase">Total Embalado</p>
                <p className="text-xl font-extrabold text-blue-700">{formatNumber(totalEmbalado, true)} cx</p>
              </div>
              <div className={`${totalDivergentes > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'} border rounded-lg px-4 py-2.5 text-center`}>
                <p className={`text-[10px] font-semibold uppercase ${totalDivergentes > 0 ? 'text-red-600' : 'text-green-600'}`}>Divergências</p>
                <p className={`text-xl font-extrabold ${totalDivergentes > 0 ? 'text-red-700' : 'text-green-700'}`}>{totalDivergentes}</p>
              </div>
            </div>

            {/* Filter toggle */}
            <div className="flex items-center gap-3 mb-3">
              <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
                <input type="checkbox" checked={filterDivergent} onChange={(e) => setFilterDivergent(e.target.checked)} className="rounded border-slate-300" />
                Mostrar apenas divergências
              </label>
              <span className="text-[10px] text-slate-400">{filtered.length} de {report.length} produtos</span>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="text-left py-2.5 px-3 text-xs text-slate-500 font-semibold">Produto</th>
                    <th className="text-right py-2.5 px-3 text-xs text-slate-500 font-semibold">Ontem</th>
                    <th className="text-right py-2.5 px-3 text-xs text-emerald-600 font-semibold">+ Embalado</th>
                    <th className="text-right py-2.5 px-3 text-xs text-blue-600 font-semibold">= Esperado</th>
                    <th className="text-right py-2.5 px-3 text-xs text-slate-700 font-semibold">Atual</th>
                    <th className="text-center py-2.5 px-3 text-xs text-slate-500 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-12 text-slate-400"><CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-40" /><p className="text-sm">Nenhum produto embalado hoje</p></td></tr>
                  ) : filtered.map(r => (
                    <tr key={r.codigoItem} className={`border-b border-slate-100 hover:bg-slate-50/50 ${!r.bateu ? 'bg-red-50/30' : ''}`}>
                      <td className="py-2 px-3">
                        <p className="text-xs font-medium text-slate-700 truncate max-w-[200px]">{r.descricaoItem}</p>
                        <p className="text-[10px] text-slate-400">{r.codigoItem}</p>
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-600 text-xs">{formatNumber(r.estoqueOntem)}</td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-600 text-xs">{r.embaladoHoje > 0 ? `+${formatNumber(r.embaladoHoje)}` : '—'}</td>
                      <td className="py-2 px-3 text-right font-semibold text-blue-600 text-xs">{formatNumber(r.esperado)}</td>
                      <td className="py-2 px-3 text-right font-bold text-slate-800 text-xs">{formatNumber(r.estoqueAtual)}</td>
                      <td className="py-2 px-3 text-center">
                        {r.bateu ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" /> OK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                            <AlertTriangle className="w-3 h-3" /> {formatNumber(r.estoqueAtual - r.esperado)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-[10px] text-slate-400 mt-3 text-center">Fórmula: Estoque Ontem + Embalado Hoje = Estoque Esperado. Se Atual ≠ Esperado, há divergência (edição manual ou outro ajuste).</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* --- Madeira PA Card (estoque editável com senha e histórico - SOMENTE AUMENTO) --- */
function MadeiraPACard({ items, isOpen, onToggle, pricingOverrides, monthlySalesData }: {
  items: StockItem[];
  isOpen: boolean;
  onToggle: () => void;
  pricingOverrides?: Array<{ codigoItem: string; vendaMensal: number | null; fatorMultiplicacao: string | null; prazoCompraDias: number | null }>;
  monthlySalesData?: MonthlySalesData;
}) {
  const [search, setSearch] = useState("");
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [pendingEditItem, setPendingEditItem] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentOperator, setCurrentOperator] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyItem, setHistoryItem] = useState<{ codigo: string; descricao: string } | undefined>(undefined);
  const [showSalesColumns, setShowSalesColumns] = useState(false);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: madeiraStockData } = trpc.dashboard.getMadeiraStock.useQuery(undefined, {
    refetchInterval: 30000,
  });
  const updateMutation = trpc.dashboard.updateMadeiraStock.useMutation({
    onSuccess: (result) => {
      if (result.success === false && result.error === "reduction_blocked") {
        toast.error(`Redução bloqueada! Operador: ${result.operador}. Madeira PA só pode AUMENTAR.`);
      } else {
        toast.success("Estoque atualizado!");
      }
      setEditingItem(null);
    },
    onError: () => toast.error("Erro ao salvar"),
  });
  const utils = trpc.useUtils();

  const madeiraStockMap = useMemo(() => {
    const map = new Map<string, number>();
    if (madeiraStockData?.items) {
      for (const ms of madeiraStockData.items) {
        map.set(ms.codigoItem, parseFloat(String(ms.quantidade)) || 0);
      }
    }
    return map;
  }, [madeiraStockData]);

  const parentItems = useMemo(() => items.filter(i => !i.isChild), [items]);
  const [madeiraSort, setMadeiraSort] = useState<SortField>("comprimento");
  const [madeiraSortDir, setMadeiraSortDir] = useState<SortDir>("asc");
  const handleMadeiraSort = (field: SortField) => {
    if (madeiraSort === field) setMadeiraSortDir(madeiraSortDir === "asc" ? "desc" : "asc");
    else { setMadeiraSort(field); setMadeiraSortDir("desc"); }
  };

  const filtered = useMemo(() => {
    let result = parentItems;
    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter(i => i.descricaoItem.toLowerCase().includes(s) || i.codigoItem.toLowerCase().includes(s) || (i.descricaoGrupo || "").toLowerCase().includes(s));
    }
    return [...result].sort((a, b) => {
      let aV: number | string = 0; let bV: number | string = 0;
      switch (madeiraSort) {
        case "comprimento": { const d = (madeiraSortDir==="asc"?1:-1)*(extractComprimento(a.descricaoItem||"")-extractComprimento(b.descricaoItem||"")); return d!==0?d:(a.descricaoItem||"").localeCompare(b.descricaoItem||""); }
        case "descricaoItem": return madeiraSortDir==="asc"?(a.descricaoItem||"").localeCompare(b.descricaoItem||""):(b.descricaoItem||"").localeCompare(a.descricaoItem||"");
        case "estoqueCx": aV=a.estoqueCx??0; bV=b.estoqueCx??0; break;
        case "pedidosCx": aV=a.pedidosCx??0; bV=b.pedidosCx??0; break;
        case "disponivelCx": aV=a.disponivelCx??0; bV=b.disponivelCx??0; break;
        case "poCx": aV=a.poCx??0; bV=b.poCx??0; break;
        case "projetadoCx": aV=a.projetadoCx??0; bV=b.projetadoCx??0; break;
      }
      return madeiraSortDir==="asc"?(aV as number)-(bV as number):(bV as number)-(aV as number);
    });
  }, [parentItems, search, madeiraSort, madeiraSortDir]);

  const totalEstoqueManual = useMemo(() => {
    let total = 0;
    for (const item of parentItems) {
      total += madeiraStockMap.get(item.codigoItem) || 0;
    }
    return total;
  }, [parentItems, madeiraStockMap]);

  const ROJAO_CODE_PA = "00129";
  const VARETA_APITO_CODE_PA = "00223";

  const totalEstoqueMaxiprod = useMemo(() => parentItems.reduce((sum, i) => sum + (i.estoqueCx ?? 0), 0), [parentItems]);
  const totalPedidos = useMemo(() => parentItems.reduce((sum, i) => sum + (i.pedidosCx ?? 0), 0), [parentItems]);
  const totalDisponivel = totalEstoqueManual - totalPedidos;
  const totalPO = useMemo(() => parentItems.reduce((sum, i) => sum + (i.poCx ?? 0), 0), [parentItems]);
  const totalProjetado = totalDisponivel + totalPO;

  // Separação Caixas / Dúzias / Kg dentro do card Madeira PA
  const paEstoqueCx = useMemo(() => {
    return parentItems
      .filter(i => i.codigoItem !== ROJAO_CODE_PA && i.codigoItem !== VARETA_APITO_CODE_PA && !i.isKgProduct)
      .reduce((sum, i) => sum + (madeiraStockMap.get(i.codigoItem) || 0), 0);
  }, [parentItems, madeiraStockMap]);
  const paPedidosCx = useMemo(() => {
    return parentItems
      .filter(i => i.codigoItem !== ROJAO_CODE_PA && i.codigoItem !== VARETA_APITO_CODE_PA && !i.isKgProduct)
      .reduce((sum, i) => sum + (i.pedidosCx ?? 0), 0);
  }, [parentItems]);
  const paDisponivelCx = paEstoqueCx - paPedidosCx;

  const paEstoqueDz = useMemo(() => madeiraStockMap.get(ROJAO_CODE_PA) || 0, [madeiraStockMap]);
  const paPedidosDz = useMemo(() => {
    const rojao = parentItems.find(i => i.codigoItem === ROJAO_CODE_PA);
    return rojao?.pedidosCx ?? 0;
  }, [parentItems]);
  const paDisponivelDz = paEstoqueDz - paPedidosDz;

  const paEstoqueKg = useMemo(() => madeiraStockMap.get(VARETA_APITO_CODE_PA) || 0, [madeiraStockMap]);
  const paPedidosKg = useMemo(() => {
    const vareta = parentItems.find(i => i.codigoItem === VARETA_APITO_CODE_PA);
    return vareta?.pedidosCx ?? 0;
  }, [parentItems]);
  const paDisponivelKg = paEstoqueKg - paPedidosKg;

  const handleStartEdit = useCallback((codigoItem: string) => {
    if (!currentOperator) {
      setPendingEditItem(codigoItem);
      setShowPasswordModal(true);
      return;
    }
    const current = madeiraStockMap.get(codigoItem) || 0;
    setEditingItem(codigoItem);
    setEditValue(String(current));
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [madeiraStockMap, currentOperator]);

  const handlePasswordConfirm = useCallback((name: string) => {
    setCurrentOperator(name);
    setShowPasswordModal(false);
    if (pendingEditItem) {
      const current = madeiraStockMap.get(pendingEditItem) || 0;
      setEditingItem(pendingEditItem);
      setEditValue(String(current));
      setPendingEditItem(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [pendingEditItem, madeiraStockMap]);

  const handleSave = useCallback(() => {
    if (!editingItem || !currentOperator) return;
    const val = parseFloat(editValue) || 0;
    const currentVal = madeiraStockMap.get(editingItem) || 0;
    // Client-side warning for decrease attempt (backend also blocks)
    if (val < currentVal) {
      toast.error(`Redução não permitida! Madeira PA só pode AUMENTAR. (${currentOperator})`);
    }
    const item = parentItems.find(i => i.codigoItem === editingItem);
    updateMutation.mutate(
      { codigoItem: editingItem, quantidade: val, operatorName: currentOperator, descricaoItem: item?.descricaoItem },
      { onSuccess: () => utils.dashboard.getMadeiraStock.invalidate() }
    );
  }, [editingItem, editValue, updateMutation, currentOperator, utils, parentItems, madeiraStockMap]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") setEditingItem(null);
  }, [handleSave]);

  return (
    <div className="bg-white rounded-xl border-l-4 border-l-green-600 border border-slate-100 shadow-sm transition-all duration-300">
      <PasswordModal open={showPasswordModal} onClose={() => { setShowPasswordModal(false); setPendingEditItem(null); }} onConfirm={handlePasswordConfirm} title="Quem está editando?" />
      <StockHistoryModal open={showHistory} onClose={() => { setShowHistory(false); setHistoryItem(undefined); }} card="madeira" codigoItem={historyItem?.codigo} descricaoItem={historyItem?.descricao} />

      <div onClick={onToggle} className="w-full px-5 py-4 text-left hover:bg-slate-50/50 transition-colors cursor-pointer" role="button" tabIndex={0}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
              <TreePine className="w-6 h-6 text-green-700" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold text-slate-800">Madeira - Produto Acabado</h3>
                <span className="text-sm font-extrabold text-green-700 bg-green-100 border border-green-300 px-3 py-1 rounded-full">{parentItems.length} itens</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{parentItems.length} produtos industrializados de madeira - estoque (somente aumento)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); setHistoryItem(undefined); setShowHistory(true); }}
              className="p-1.5 rounded-lg hover:bg-green-100 transition-colors" title="Histórico de alterações"
            >
              <History className="w-4 h-4 text-green-600" />
            </button>
            {isOpen ? <ChevronUp className="w-5 h-5 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />}
          </div>
        </div>
        <div className="hidden sm:grid gap-3 mt-4 ml-16" style={{ gridTemplateColumns: '2fr 2fr 2fr 1.5fr 1.5fr 1fr' }}>
          <div className="bg-teal-50/80 rounded-lg px-3 py-3.5">
            <p className="text-[10px] text-teal-600 font-semibold uppercase tracking-wider">Estoque</p>
            <p className="text-lg font-extrabold text-teal-700 mt-1">{formatNumber(paEstoqueCx, true)} <span className="text-xs font-semibold">cx</span></p>
          </div>
          <div className="bg-orange-50/80 rounded-lg px-3 py-3.5">
            <p className="text-[10px] text-orange-600 font-semibold uppercase tracking-wider">Pedidos</p>
            <p className={`text-lg font-extrabold mt-1 ${paPedidosCx > 0 ? 'text-orange-700' : 'text-slate-400'}`}>{formatNumber(paPedidosCx, true)} <span className="text-xs font-semibold">cx</span></p>
          </div>
          <div className={`rounded-lg px-3 py-3.5 ${paDisponivelCx < 0 ? 'bg-red-50/80' : 'bg-emerald-50/80'}`}>
            <p className={`text-[10px] font-semibold uppercase tracking-wider ${paDisponivelCx < 0 ? 'text-red-600' : 'text-emerald-600'}`}>Disponível</p>
            <p className={`text-lg font-extrabold mt-1 ${paDisponivelCx < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{formatNumber(paDisponivelCx, true)} <span className="text-xs font-semibold">cx</span></p>
          </div>
          {/* ROJÃO mini-card - AZUL */}
          <div className="bg-blue-50/80 rounded-lg px-2.5 py-3 border border-blue-200">
            <p className="text-[9px] text-blue-600 font-bold uppercase tracking-wider mb-0.5">Rojão (dz)</p>
            <div className="space-y-0">
              <div className="flex justify-between items-baseline">
                <span className="text-[9px] text-blue-600 font-semibold">Estoque</span>
                <span className="text-xs font-extrabold text-blue-700">{formatNumber(paEstoqueDz)}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-[9px] text-blue-600 font-semibold">Pedidos</span>
                <span className={`text-xs font-extrabold ${paPedidosDz > 0 ? 'text-blue-700' : 'text-slate-400'}`}>{formatNumber(paPedidosDz)}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className={`text-[9px] font-bold ${paDisponivelDz < 0 ? 'text-red-600' : 'text-blue-600'}`}>Disponível</span>
                <span className={`text-xs font-black ${paDisponivelDz < 0 ? 'text-red-700' : 'text-blue-700'}`}>{formatNumber(paDisponivelDz)}</span>
              </div>
            </div>
          </div>
          {/* APITO mini-card - ROXO */}
          <div className="bg-indigo-50/80 rounded-lg px-2.5 py-3 border border-indigo-200">
            <p className="text-[9px] text-indigo-600 font-bold uppercase tracking-wider mb-0.5">Apito (kg)</p>
            <div className="space-y-0">
              <div className="flex justify-between items-baseline">
                <span className="text-[9px] text-indigo-600 font-semibold">Estoque</span>
                <span className="text-xs font-extrabold text-indigo-700">{formatNumber(paEstoqueKg)}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-[9px] text-indigo-600 font-semibold">Pedidos</span>
                <span className="text-xs font-extrabold text-indigo-700">{formatNumber(paPedidosKg)}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className={`text-[9px] font-bold ${paDisponivelKg < 0 ? 'text-red-600' : 'text-indigo-600'}`}>Disponível</span>
                <span className={`text-xs font-black ${paDisponivelKg < 0 ? 'text-red-700' : 'text-indigo-700'}`}>{formatNumber(paDisponivelKg)}</span>
              </div>
            </div>
          </div>
          {/* PRODUTOS card */}
          <div className="bg-slate-50/80 rounded-lg px-3 py-3.5 flex flex-col items-end justify-center">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Produtos</p>
            <p className="text-lg font-extrabold text-slate-900 mt-1">{parentItems.length}</p>
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="border-t border-slate-100">
          {/* Search & Filter */}
          <div className="px-5 py-3 bg-slate-50/50 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input placeholder="Buscar produto, código, grupo..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-white h-9 text-sm" />
              </div>
              {currentOperator && (
                <span className="text-xs text-green-600 font-semibold bg-green-50 px-2 py-1 rounded-full whitespace-nowrap self-center">
                  Editando: {currentOperator}
                </span>
              )}
            </div>
          </div>
          <div className="px-3 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="text-xs text-amber-700"><strong>Regra:</strong> Estoque de Madeira PA só pode ser <strong>aumentado</strong> manualmente. Reduções são bloqueadas e registradas.</p>
          </div>
          <div className="bg-white rounded-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-[48px] z-20 shadow-sm">
                  <tr>
                    <th className="px-2 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-teal-600 select-none whitespace-nowrap" style={{ minWidth: '180px', width: '25%' }} onClick={() => handleMadeiraSort('descricaoItem')}>
                      <div className="flex items-center gap-1">Produto <ArrowUpDown className={`w-3 h-3 ${madeiraSort === 'descricaoItem' ? 'text-teal-600' : 'text-slate-300'}`} /></div>
                    </th>
                    <th className="px-1.5 py-2.5 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap" style={{ width: '50px' }}>Un/Cx</th>
                    <th className="px-1.5 py-2.5 text-center text-[11px] font-semibold text-purple-600 uppercase tracking-wider" style={{ minWidth: '110px', width: '12%' }}>Grupo</th>
                    <th className="px-1.5 py-2.5 text-center text-[11px] font-semibold text-green-700 uppercase tracking-wider bg-green-50/60 border-x border-green-200 whitespace-nowrap">Estoque</th>
                    <th className="w-7 py-2.5 px-0.5"></th>
                    <th className="px-1.5 py-2.5 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-teal-600 select-none whitespace-nowrap" onClick={() => handleMadeiraSort('pedidosCx')}>
                      <div className="flex items-center justify-center gap-1">Pedidos <ArrowUpDown className={`w-3 h-3 ${madeiraSort === 'pedidosCx' ? 'text-teal-600' : 'text-slate-300'}`} /></div>
                    </th>
                    <th className="px-1.5 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider cursor-pointer hover:text-emerald-700 select-none bg-emerald-50/60 border-x border-emerald-100 whitespace-nowrap" onClick={() => handleMadeiraSort('disponivelCx')}>
                      <div className="flex items-center justify-center gap-1 text-emerald-700">
                        Disponivel <ArrowUpDown className={`w-3 h-3 ${madeiraSort === 'disponivelCx' ? 'text-emerald-700' : 'text-emerald-300'}`} />
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowSalesColumns(!showSalesColumns); }}
                          className={`ml-1 p-1 rounded transition-all ${showSalesColumns ? 'bg-blue-500 text-white shadow-sm' : 'bg-amber-100 text-amber-600 hover:bg-amber-200 ring-1 ring-amber-300 animate-pulse'}`}
                          title={showSalesColumns ? 'Ocultar colunas de vendas' : 'Mostrar vendas mensais'}
                        >
                          <BarChart3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="text-[8px] font-bold text-emerald-500 tracking-widest block text-center">P/ VENDA</span>
                    </th>

                    {showSalesColumns && monthlySalesData?.months && (
                      <>
                        {monthlySalesData.months.slice(0, 3).map((m) => (
                          <th key={m.key} className="px-1 py-2.5 text-right text-[10px] font-bold text-blue-700 uppercase tracking-wider bg-blue-50/60 border-x border-blue-200 whitespace-nowrap" title={`Vendas faturadas em ${m.label}`}>
                            <div className="text-[8px] text-blue-500 font-medium leading-tight">VENDAS</div>
                            <div>{m.label}</div>
                          </th>
                        ))}
                        <th className="px-1 py-2.5 text-right text-[10px] font-bold text-indigo-800 uppercase tracking-wider bg-indigo-100/60 border-x border-indigo-200 whitespace-nowrap" title="Média de vendas dos últimos 3 meses">
                          <div className="text-[8px] text-indigo-500 font-medium leading-tight">MÉDIA</div>
                          <div>3 Meses</div>
                        </th>
                        <th className="px-1 py-2.5 text-right text-[10px] font-bold text-purple-800 uppercase tracking-wider bg-purple-100/60 border-x border-purple-200 whitespace-nowrap" title="Estoque Regulador Calculado = Média × 2,33 (cobertura 60 dias)">
                          <div className="text-[8px] text-purple-500 font-medium leading-tight">EST.REG.</div>
                          <div>Calc.</div>
                        </th>
                        <th className="px-1 py-2.5 text-right text-[10px] font-bold text-emerald-800 uppercase tracking-wider bg-emerald-100/60 border-x border-emerald-200 whitespace-nowrap" title={`Vendas do mês atual (${monthlySalesData.months[3]?.label})`}>
                          <div className="text-[8px] text-emerald-500 font-medium leading-tight">VENDAS</div>
                          <div>{monthlySalesData.months[3]?.label || 'Atual'}</div>
                        </th>
                      </>
                    )}
                    <th className="px-1.5 py-2.5 text-center text-[11px] font-semibold text-purple-600 uppercase tracking-wider whitespace-nowrap" title="Estoque Regulador">Est. Reg.</th>
                    <th className="px-1.5 py-2.5 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((item) => {
                    const manualQty = madeiraStockMap.get(item.codigoItem) || 0;
                    const isEditing = editingItem === item.codigoItem;
                    // Disponível p/ Venda = Estoque - Pedidos de Venda
                    const pedidosVal = item.pedidosCx ?? item.pedidosUn;
                    const disponivelManual = manualQty - pedidosVal;
                    const isNegative = disponivelManual < 0;
                    const isZero = disponivelManual === 0;
                    const projetadoManual = disponivelManual + (item.poCx ?? 0);
                    const hasVariants = item.isParent && item.variants && item.variants.length > 0;
                    const isExpanded = expandedParents.has(item.codigoItem);
                    const toggleExpand = () => {
                      setExpandedParents(prev => {
                        const next = new Set(prev);
                        if (next.has(item.codigoItem)) next.delete(item.codigoItem);
                        else next.add(item.codigoItem);
                        return next;
                      });
                    };
                    return (
                      <React.Fragment key={item.codigoItem}>
                      <tr className={`hover:bg-slate-50 transition-colors ${isNegative ? 'bg-red-50/50' : isZero ? 'bg-amber-50/30' : ''}`}>
                        {/* Produto */}
                        <td className="px-2 py-2">
                          <div className="flex items-start gap-1">
                            {hasVariants && (
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleExpand(); }}
                                className="mt-0.5 flex-shrink-0 w-4 h-4 rounded flex items-center justify-center text-green-600 hover:bg-green-100 transition-colors"
                                title={isExpanded ? 'Ocultar variações' : 'Expandir variações'}
                              >
                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>
                            )}
                            <div>
                              <div className="font-medium text-slate-800 text-[13px] break-words leading-snug" title={item.descricaoItem}>{item.descricaoItem}</div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                Cod: {item.codigoItem}
                                {hasVariants && <span className="ml-2 text-green-500 font-medium">· {item.variants!.length} variaç{item.variants!.length > 1 ? 'ões' : 'ão'}</span>}
                              </div>
                            </div>
                          </div>
                        </td>
                        {/* Un/Cx */}
                        <td className="px-1.5 py-2 text-[13px] text-slate-600 text-center whitespace-nowrap">
                          {item.isKgProduct ? "kg" : (item.unidadesPorCaixa ? formatNumber(item.unidadesPorCaixa, true) : "—")}
                        </td>
                        {/* Grupo */}
                        <td className="px-1.5 py-2 text-center">
                          <GrupoBadge grupo={item.grupo} subgrupo={item.subgrupo} />
                        </td>
                        {/* Estoque */}
                        <td className="px-1.5 py-2 text-center bg-green-50/40 border-x border-green-200">
                          {isEditing ? (
                            <input ref={inputRef} type="number" min="0" value={editValue}
                              onChange={(e) => setEditValue(e.target.value)} onKeyDown={handleKeyDown} onBlur={handleSave}
                              className="w-16 text-right text-[13px] border border-green-400 rounded px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-green-300 bg-green-50" />
                          ) : (
                            <button onClick={(e) => { e.stopPropagation(); handleStartEdit(item.codigoItem); }}
                              className="text-[13px] font-bold text-green-700 hover:bg-green-100 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                              title="Clique para editar (somente aumento)">{formatNumber(manualQty, true)} {item.isKgProduct || item.codigoItem === "00223" ? "kg" : item.codigoItem === "00129" ? "dz" : "cx"}</button>
                          )}
                        </td>
                        {/* Histórico */}
                        <td className="py-2 px-0.5 text-center">
                          <button onClick={(e) => { e.stopPropagation(); setHistoryItem({ codigo: item.codigoItem, descricao: item.descricaoItem }); setShowHistory(true); }}
                            className="p-0.5 rounded hover:bg-green-50 transition-colors" title="Histórico deste item">
                            <History className="w-3.5 h-3.5 text-slate-400 hover:text-green-600" />
                          </button>
                        </td>
                        {/* Pedidos */}
                        <td className="px-1.5 py-2 text-center whitespace-nowrap">
                          <span className={`font-semibold text-[13px] ${(item.pedidosCx ?? item.pedidosUn) > 0 ? 'text-orange-600' : 'text-slate-400'}`}>
                            {item.pedidosCx !== null ? `${formatNumber(item.pedidosCx)} ${getUnit(item, true)}` : `${formatNumber(item.pedidosUn)} ${getUnit(item, false)}`}
                          </span>
                        </td>
                        {/* Disponível = Estoque - Pedidos */}
                        <td className="px-1.5 py-2 text-center bg-emerald-50/40 border-x border-emerald-100 whitespace-nowrap">
                          <span className={`font-bold text-[13px] ${isNegative ? 'text-red-600' : isZero ? 'text-amber-600' : 'text-emerald-700'}`}>
                            {formatNumber(disponivelManual, true)} {item.isKgProduct || item.codigoItem === "00223" ? "kg" : item.codigoItem === "00129" ? "dz" : "cx"}
                          </span>
                        </td>

                        {/* 6 colunas ocultas de vendas mensais */}
                        {showSalesColumns && monthlySalesData?.months && (() => {
                          const salesByMonth = monthlySalesData.data[item.codigoItem] || {};
                          const m1 = salesByMonth[monthlySalesData.months[0]?.key] || 0;
                          const m2 = salesByMonth[monthlySalesData.months[1]?.key] || 0;
                          const m3 = salesByMonth[monthlySalesData.months[2]?.key] || 0;
                          const avg3m = (m1 + m2 + m3) / 3;
                          const estRegCalc = Math.round(avg3m * 2.33);
                          const mAtual = salesByMonth[monthlySalesData.months[3]?.key] || 0;
                          const unit = item.isKgProduct || item.codigoItem === "00223" ? "kg" : (item.codigoItem === "00129" ? "dz" : "cx");
                          return (
                            <>
                              <td className="px-1 py-2 text-right bg-blue-50/30 border-x border-blue-200 whitespace-nowrap">
                                <span className={`text-[11px] font-medium ${m1 > 0 ? 'text-blue-700' : 'text-slate-300'}`}>{m1 > 0 ? `${formatNumber(m1)} ${unit}` : '—'}</span>
                              </td>
                              <td className="px-1 py-2 text-right bg-blue-50/30 border-x border-blue-200 whitespace-nowrap">
                                <span className={`text-[11px] font-medium ${m2 > 0 ? 'text-blue-700' : 'text-slate-300'}`}>{m2 > 0 ? `${formatNumber(m2)} ${unit}` : '—'}</span>
                              </td>
                              <td className="px-1 py-2 text-right bg-blue-50/30 border-x border-blue-200 whitespace-nowrap">
                                <span className={`text-[11px] font-medium ${m3 > 0 ? 'text-blue-700' : 'text-slate-300'}`}>{m3 > 0 ? `${formatNumber(m3)} ${unit}` : '—'}</span>
                              </td>
                              <td className="px-1 py-2 text-right bg-indigo-100/40 border-x border-indigo-200 whitespace-nowrap">
                                <span className={`text-[11px] font-bold ${avg3m > 0 ? 'text-indigo-800' : 'text-slate-300'}`}>{avg3m > 0 ? `${formatNumber(Math.round(avg3m))} ${unit}` : '—'}</span>
                              </td>
                              <td className="px-1 py-2 text-right bg-purple-100/40 border-x border-purple-200 whitespace-nowrap">
                                <span className={`text-[11px] font-bold ${estRegCalc > 0 ? 'text-purple-800' : 'text-slate-300'}`} title={`${formatNumber(Math.round(avg3m))} × 2,33 = ${formatNumber(estRegCalc)}`}>{estRegCalc > 0 ? `${formatNumber(estRegCalc)} ${unit}` : '—'}</span>
                              </td>
                              <td className="px-1 py-2 text-right bg-emerald-100/40 border-x border-emerald-200 whitespace-nowrap">
                                {(() => {
                                  const aboveAvg = avg3m > 0 && mAtual > avg3m;
                                  const belowAvg = avg3m > 0 && mAtual < avg3m;
                                  const color = aboveAvg ? 'text-emerald-700' : belowAvg ? 'text-orange-600' : mAtual > 0 ? 'text-emerald-600' : 'text-slate-300';
                                  return <span className={`text-[11px] font-bold ${color}`}>{mAtual > 0 ? `${formatNumber(mAtual)} ${unit}` : '—'}{aboveAvg ? ' ↑' : belowAvg ? ' ↓' : ''}</span>;
                                })()}
                              </td>
                            </>
                          );
                        })()}
                        {/* Est. Reg. */}
                        <td className="px-1.5 py-2 text-center whitespace-nowrap">
                          {(() => {
                            const pricingItem = pricingOverrides?.find(p => p.codigoItem === item.codigoItem);
                            const vendaMensal = pricingItem?.vendaMensal;
                            if (vendaMensal == null) return <span className="text-[11px] text-slate-300">—</span>;
                            const fator = pricingItem?.fatorMultiplicacao ? parseFloat(pricingItem.fatorMultiplicacao) : 2.3;
                            const estReg = Math.round(vendaMensal * fator);
                            const unit = item.isKgProduct || item.codigoItem === "00223" ? "kg" : (item.codigoItem === "00129" ? "dz" : "cx");
                            let estRegColor = 'text-emerald-600';
                            if (estReg > 0) {
                              if (disponivelManual <= estReg) estRegColor = 'text-red-600 bg-red-50 px-1 py-0.5 rounded';
                              else if (disponivelManual <= estReg * 1.2) estRegColor = 'text-pink-600 bg-pink-50 px-1 py-0.5 rounded';
                              else if (disponivelManual <= estReg * 1.4) estRegColor = 'text-orange-600 bg-orange-50 px-1 py-0.5 rounded';
                            }
                            return <span className={`text-[11px] font-semibold ${estRegColor}`} title={`Vd.Mensal: ${vendaMensal} × Fator: ${fator.toLocaleString("pt-BR")} = ${estReg} ${unit}`}>{formatNumber(estReg)} {unit}</span>;
                          })()}
                        </td>
                        {/* Status */}
                        <td className="px-1.5 py-2 text-center whitespace-nowrap">
                          {(() => {
                            const estoque = manualQty || (item.estoqueCx ?? 0);
                            const pedidos = item.pedidosCx ?? 0;
                            if (pedidos > 0 && estoque < pedidos) {
                              return <Badge className="bg-red-100 text-red-700 text-[11px] border-0 whitespace-nowrap">Alerta de Produção</Badge>;
                            }
                            return <Badge className="bg-emerald-100 text-emerald-700 text-[11px] border-0">OK</Badge>;
                          })()}
                        </td>
                      </tr>
                      {/* Sub-linhas de variações (expandidas) */}
                      {hasVariants && isExpanded && item.variants!.map((variant) => (
                        <tr key={`${item.codigoItem}-${variant.codigoItem}`} className="bg-green-50/30 border-l-4 border-green-300">
                          <td className="px-2 py-1 pl-8">
                            <span className="text-slate-600 text-xs">
                              └ {variant.descricaoItem}
                            </span>
                            <div className="text-[10px] text-slate-400 ml-3">
                              {variant.codigoItem} · Fator: {variant.conversionFactor}x
                            </div>
                          </td>
                          <td className="px-1.5 py-1 text-xs text-slate-500 text-center whitespace-nowrap">
                            {variant.unidadesPorCaixa ? formatNumber(variant.unidadesPorCaixa, true) : '—'}
                          </td>
                          <td className="px-1.5 py-1 text-center">
                            <span className="text-[9px] text-green-500 font-medium">Variação</span>
                          </td>
                          <td className="px-1.5 py-1 text-center bg-green-50/40 border-x border-green-200">
                            {variant.estoqueCx != null && variant.estoqueCx > 0 ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-xs font-semibold text-teal-600 cursor-help">
                                    {formatNumber(variant.estoqueCx)} {getUnit(variant as any, true)}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent><p className="text-xs">Estoque reservado da variação (abatido do produto mãe)</p></TooltipContent>
                              </Tooltip>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-1 px-0.5"></td>
                          <td className="px-1.5 py-1 text-center whitespace-nowrap">
                            <span className={`text-xs font-semibold ${(variant.pedidosCx ?? variant.pedidosUn) > 0 ? 'text-orange-500' : 'text-slate-400'}`}>
                              {variant.pedidosCx !== null ? `${formatNumber(variant.pedidosCx)} ${getUnit(variant as any, true)}` : `${formatNumber(variant.pedidosUn)} un`}
                            </span>
                          </td>
                          <td className="px-1.5 py-1 text-center bg-emerald-50/40 border-x border-emerald-100">
                            {variant.estoqueCx != null && variant.estoqueCx > 0 && (variant.pedidosCx ?? 0) > 0 ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className={`text-xs font-semibold ${(variant.estoqueCx - (variant.pedidosCx ?? 0)) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                    {formatNumber(variant.estoqueCx - (variant.pedidosCx ?? 0))} {getUnit(variant as any, true)}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent><p className="text-xs">Disponível da variação = Estoque reservado - Pedidos</p></TooltipContent>
                              </Tooltip>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                          {showSalesColumns && monthlySalesData?.months && (
                            <>
                              <td className="px-1 py-1 bg-blue-50/30 border-x border-blue-200"></td>
                              <td className="px-1 py-1 bg-blue-50/30 border-x border-blue-200"></td>
                              <td className="px-1 py-1 bg-blue-50/30 border-x border-blue-200"></td>
                              <td className="px-1 py-1 bg-indigo-100/40 border-x border-indigo-200"></td>
                              <td className="px-1 py-1 bg-purple-100/40 border-x border-purple-200"></td>
                              <td className="px-1 py-1 bg-emerald-100/40 border-x border-emerald-200"></td>
                            </>
                          )}
                          <td className="px-1.5 py-1"></td>
                          <td className="px-1.5 py-1"></td>
                        </tr>
                      ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Nenhum item encontrado</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* --- Semi Pronto Card (estoque editável com senha e histórico) --- */
function SemiProntoCard({ items, isOpen, onToggle }: {
  items: StockItem[];
  isOpen: boolean;
  onToggle: () => void;
}) {
  const [search, setSearch] = useState("");
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [pendingEditItem, setPendingEditItem] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentOperator, setCurrentOperator] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyItem, setHistoryItem] = useState<{ codigo: string; descricao: string } | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const semiProntoMap = useMemo(() => {
    const map = new Map<string, number>();
    if (semiProntoData?.items) {
      for (const sp of semiProntoData.items) {
        map.set(sp.codigoItem, parseFloat(String(sp.quantidade)) || 0);
      }
    }
    return map;
  }, [semiProntoData]);

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
      total += semiProntoMap.get(item.codigoItem) || 0;
    }
    return total;
  }, [parentItems, semiProntoMap]);

  const totalPedidos = useMemo(() => {
    let total = 0;
    for (const item of parentItems) {
      total += item.pedidosCx ?? item.pedidosUn;
    }
    return total;
  }, [parentItems]);

  const totalDisponivel = totalEstoque - totalPedidos;

  const handleStartEdit = useCallback((codigoItem: string) => {
    if (!currentOperator) {
      setPendingEditItem(codigoItem);
      setShowPasswordModal(true);
      return;
    }
    const current = semiProntoMap.get(codigoItem) || 0;
    setEditingItem(codigoItem);
    setEditValue(String(current));
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [semiProntoMap, currentOperator]);

  const handlePasswordConfirm = useCallback((name: string) => {
    setCurrentOperator(name);
    setShowPasswordModal(false);
    if (pendingEditItem) {
      const current = semiProntoMap.get(pendingEditItem) || 0;
      setEditingItem(pendingEditItem);
      setEditValue(String(current));
      setPendingEditItem(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [pendingEditItem, semiProntoMap]);

  const handleSave = useCallback(() => {
    if (!editingItem || !currentOperator) return;
    const val = parseFloat(editValue) || 0;
    const item = parentItems.find(i => i.codigoItem === editingItem);
    updateMutation.mutate(
      { codigoItem: editingItem, quantidade: val, operatorName: currentOperator, descricaoItem: item?.descricaoItem },
      { onSuccess: () => utils.dashboard.getSemiProntoStock.invalidate() }
    );
  }, [editingItem, editValue, updateMutation, currentOperator, utils, parentItems]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") setEditingItem(null);
  }, [handleSave]);

  return (
    <div className="bg-white rounded-xl border-l-4 border-l-amber-600 border border-slate-100 shadow-sm transition-all duration-300">
      <PasswordModal open={showPasswordModal} onClose={() => { setShowPasswordModal(false); setPendingEditItem(null); }} onConfirm={handlePasswordConfirm} title="Quem está editando?" />
      <StockHistoryModal open={showHistory} onClose={() => { setShowHistory(false); setHistoryItem(undefined); }} card="semiPronto" codigoItem={historyItem?.codigo} descricaoItem={historyItem?.descricao} />

      <div onClick={onToggle} className="w-full px-5 py-4 text-left hover:bg-slate-50/50 transition-colors cursor-pointer" role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onToggle(); }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
              <Hammer className="w-6 h-6 text-amber-700" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold text-slate-800">Madeira Semi Pronto</h3>
                <span className="text-sm font-extrabold text-blue-700 bg-blue-100 border border-blue-300 px-3 py-1 rounded-full">{parentItems.length} itens</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{parentItems.length} produtos industrializados de madeira - estoque</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); setHistoryItem(undefined); setShowHistory(true); }}
              className="p-1.5 rounded-lg hover:bg-amber-100 transition-colors" title="Histórico de alterações"
            >
              <History className="w-4 h-4 text-amber-600" />
            </button>
            {isOpen ? <ChevronUp className="w-5 h-5 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />}
          </div>
        </div>
<div className="hidden sm:grid gap-3 mt-4 ml-16" style={{ gridTemplateColumns: '2fr 2fr 2fr 1.5fr 1.5fr 1fr' }}>
          <div className="bg-teal-50/80 rounded-lg px-3 py-3.5">
            <p className="text-[10px] text-teal-600 font-semibold uppercase tracking-wider">Estoque</p>
            <p className="text-lg font-extrabold text-teal-700 mt-1">{formatNumber(totalEstoque, true)} <span className="text-xs font-semibold">cx</span></p>
          </div>
          <div className="bg-orange-50/80 rounded-lg px-3 py-3.5">
            <p className="text-[10px] text-orange-600 font-semibold uppercase tracking-wider">Pedidos</p>
            <p className={`text-lg font-extrabold mt-1 ${totalPedidos > 0 ? 'text-orange-600' : 'text-slate-400'}`}>{formatNumber(totalPedidos, true)} <span className="text-xs font-semibold">cx</span></p>
          </div>
          <div className="bg-emerald-50/80 rounded-lg px-3 py-3.5">
            <p className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wider">Disponível</p>
            <p className={`text-lg font-extrabold mt-1 ${totalDisponivel < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{formatNumber(totalDisponivel, true)} <span className="text-xs font-semibold">cx</span></p>
          </div>
          <div className="bg-slate-50/80 rounded-lg px-3 py-3.5 flex flex-col items-end justify-center" style={{ gridColumn: '4 / 7' }}>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Produtos</p>
            <p className="text-lg font-extrabold text-slate-900 mt-1">{parentItems.length}</p>
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="px-5 pb-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input placeholder="Buscar produto..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 h-9 text-sm" />
            </div>
            {currentOperator && (
              <span className="text-xs text-amber-600 font-semibold bg-amber-50 px-2 py-1 rounded-full whitespace-nowrap">
                Editando: {currentOperator}
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500 uppercase">Código</th>
                  <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500 uppercase">Produto</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-amber-600 uppercase">Estoque (cx)</th>
                  <th className="w-8 py-2 px-1"></th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-orange-600 uppercase">Pedidos</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-emerald-600 uppercase">Disponível</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const qty = semiProntoMap.get(item.codigoItem) || 0;
                  const isEditing = editingItem === item.codigoItem;
                  const pedidosVal = item.pedidosCx ?? item.pedidosUn;
                  const disponivel = qty - pedidosVal;
                  return (
                    <tr key={item.codigoItem} className={`border-b border-slate-100 hover:bg-slate-50/50 ${disponivel < 0 ? 'bg-red-50/50' : ''}`}>
                      <td className="py-2 px-2 text-xs text-slate-500 font-mono">{item.codigoItem}</td>
<td className="py-2 px-2 text-sm text-slate-700 break-words leading-snug" title={item.descricaoItem}>{item.descricaoItem}</td>
                       <td className="py-2 px-2 text-right">
                        {isEditing ? (
                          <input ref={inputRef} type="number" min="0" value={editValue}
                            onChange={(e) => setEditValue(e.target.value)} onKeyDown={handleKeyDown} onBlur={handleSave}
                            className="w-20 text-right text-sm border border-amber-400 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-300 bg-amber-50" />
                        ) : (
                          <button onClick={(e) => { e.stopPropagation(); handleStartEdit(item.codigoItem); }}
                            className="text-sm font-bold text-amber-700 hover:bg-amber-50 px-2 py-1 rounded cursor-pointer transition-colors min-w-[60px] text-right"
                            title="Clique para editar">{formatNumber(qty)}</button>
                        )}
                      </td>
                      <td className="py-2 px-1">
                        <button onClick={(e) => { e.stopPropagation(); setHistoryItem({ codigo: item.codigoItem, descricao: item.descricaoItem }); setShowHistory(true); }}
                          className="p-1 rounded hover:bg-amber-50 transition-colors" title="Histórico deste item">
                          <History className="w-3.5 h-3.5 text-slate-400 hover:text-amber-600" />
                        </button>
                      </td>
                      <td className="py-2 px-2 text-right">
                        <span className={`text-sm font-semibold ${pedidosVal > 0 ? 'text-orange-600' : 'text-slate-400'}`}>
                          {formatNumber(pedidosVal)}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right">
                        <span className={`text-sm font-bold ${disponivel < 0 ? 'text-red-600' : disponivel === 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {formatNumber(disponivel)}
                        </span>
                      </td>
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

function AguardandoEscolhaCard({ items, isOpen, onToggle }: {
  items: StockItem[];
  isOpen: boolean;
  onToggle: () => void;
}) {
  const [search, setSearch] = useState("");
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [pendingEditItem, setPendingEditItem] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentOperator, setCurrentOperator] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyItem, setHistoryItem] = useState<{ codigo: string; descricao: string } | undefined>(undefined);
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

  const totalPedidos = useMemo(() => {
    let total = 0;
    for (const item of parentItems) {
      total += item.pedidosCx ?? item.pedidosUn;
    }
    return total;
  }, [parentItems]);

  const totalDisponivel = totalEstoque - totalPedidos;

  const handleStartEdit = useCallback((codigoItem: string) => {
    if (!currentOperator) {
      setPendingEditItem(codigoItem);
      setShowPasswordModal(true);
      return;
    }
    const current = aguardandoMap.get(codigoItem) || 0;
    setEditingItem(codigoItem);
    setEditValue(String(current));
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [aguardandoMap, currentOperator]);

  const handlePasswordConfirm = useCallback((name: string) => {
    setCurrentOperator(name);
    setShowPasswordModal(false);
    if (pendingEditItem) {
      const current = aguardandoMap.get(pendingEditItem) || 0;
      setEditingItem(pendingEditItem);
      setEditValue(String(current));
      setPendingEditItem(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [pendingEditItem, aguardandoMap]);

  const handleSave = useCallback(() => {
    if (!editingItem || !currentOperator) return;
    const val = parseFloat(editValue) || 0;
    const item = parentItems.find(i => i.codigoItem === editingItem);
    updateMutation.mutate(
      { codigoItem: editingItem, quantidade: val, operatorName: currentOperator, descricaoItem: item?.descricaoItem },
      { onSuccess: () => utils.dashboard.getAguardandoEscolhaStock.invalidate() }
    );
  }, [editingItem, editValue, updateMutation, currentOperator, utils, parentItems]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") setEditingItem(null);
  }, [handleSave]);

  return (
    <div className="bg-white rounded-xl border-l-4 border-l-purple-600 border border-slate-100 shadow-sm transition-all duration-300">
      <PasswordModal open={showPasswordModal} onClose={() => { setShowPasswordModal(false); setPendingEditItem(null); }} onConfirm={handlePasswordConfirm} title="Quem está editando?" />
      <StockHistoryModal open={showHistory} onClose={() => { setShowHistory(false); setHistoryItem(undefined); }} card="aguardandoEscolha" codigoItem={historyItem?.codigo} descricaoItem={historyItem?.descricao} />

      <div onClick={onToggle} className="w-full px-5 py-4 text-left hover:bg-slate-50/50 transition-colors cursor-pointer" role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onToggle(); }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
              <Clock className="w-6 h-6 text-purple-700" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold text-slate-800">Madeira Aguardando Escolha</h3>
                <span className="text-sm font-extrabold text-amber-700 bg-amber-100 border border-amber-300 px-3 py-1 rounded-full">{parentItems.length} itens</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{parentItems.length} produtos industrializados de madeira - aguardando escolha</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); setHistoryItem(undefined); setShowHistory(true); }}
              className="p-1.5 rounded-lg hover:bg-purple-100 transition-colors" title="Histórico de alterações"
            >
              <History className="w-4 h-4 text-purple-600" />
            </button>
            {isOpen ? <ChevronUp className="w-5 h-5 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />}
          </div>
        </div>
        <div className="hidden sm:grid gap-3 mt-4 ml-16" style={{ gridTemplateColumns: '2fr 2fr 2fr 1.5fr 1.5fr 1fr' }}>
          <div className="bg-teal-50/80 rounded-lg px-3 py-3.5">
            <p className="text-[10px] text-teal-600 font-semibold uppercase tracking-wider">Estoque</p>
            <p className="text-lg font-extrabold text-teal-700 mt-1">{formatNumber(totalEstoque, true)} <span className="text-xs font-semibold">cx</span></p>
          </div>
          <div className="bg-orange-50/80 rounded-lg px-3 py-3.5">
            <p className="text-[10px] text-orange-600 font-semibold uppercase tracking-wider">Pedidos</p>
            <p className={`text-lg font-extrabold mt-1 ${totalPedidos > 0 ? 'text-orange-600' : 'text-slate-400'}`}>{formatNumber(totalPedidos, true)} <span className="text-xs font-semibold">cx</span></p>
          </div>
          <div className="bg-emerald-50/80 rounded-lg px-3 py-3.5">
            <p className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wider">Disponível</p>
            <p className={`text-lg font-extrabold mt-1 ${totalDisponivel < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{formatNumber(totalDisponivel, true)} <span className="text-xs font-semibold">cx</span></p>
          </div>
          <div className="bg-slate-50/80 rounded-lg px-3 py-3.5 flex flex-col items-end justify-center" style={{ gridColumn: '4 / 7' }}>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Produtos</p>
            <p className="text-lg font-extrabold text-slate-900 mt-1">{parentItems.length}</p>
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="px-5 pb-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input placeholder="Buscar produto..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 h-9 text-sm" />
            </div>
            {currentOperator && (
              <span className="text-xs text-purple-600 font-semibold bg-purple-50 px-2 py-1 rounded-full whitespace-nowrap">
                Editando: {currentOperator}
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500 uppercase">Código</th>
                  <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500 uppercase">Produto</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-purple-600 uppercase">Estoque (cx)</th>
                  <th className="w-8 py-2 px-1"></th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-slate-400 uppercase">Pedidos</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-slate-400 uppercase">Disponível</th>

                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const qty = aguardandoMap.get(item.codigoItem) || 0;
                  const isEditing = editingItem === item.codigoItem;
                  const pedidosVal = item.pedidosCx ?? item.pedidosUn;
                  const disponivel = qty - pedidosVal;
                  return (
                    <tr key={item.codigoItem} className={`border-b border-slate-100 hover:bg-slate-50/50 ${disponivel < 0 ? 'bg-red-50/50' : ''}`}>
                      <td className="py-2 px-2 text-xs text-slate-500 font-mono">{item.codigoItem}</td>
                      <td className="py-2 px-2 text-sm text-slate-700 break-words leading-snug" title={item.descricaoItem}>{item.descricaoItem}</td>
                      <td className="py-2 px-2 text-right">
                        {isEditing ? (
                          <input ref={inputRef} type="number" min="0" value={editValue}
                            onChange={(e) => setEditValue(e.target.value)} onKeyDown={handleKeyDown} onBlur={handleSave}
                            className="w-20 text-right text-sm border border-purple-400 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-purple-300 bg-purple-50" />
                        ) : (
                          <button onClick={(e) => { e.stopPropagation(); handleStartEdit(item.codigoItem); }}
                            className="text-sm font-bold text-purple-700 hover:bg-purple-50 px-2 py-1 rounded cursor-pointer transition-colors min-w-[60px] text-right"
                            title="Clique para editar">{formatNumber(qty)}</button>
                        )}
                      </td>
                      <td className="py-2 px-1">
                        <button onClick={(e) => { e.stopPropagation(); setHistoryItem({ codigo: item.codigoItem, descricao: item.descricaoItem }); setShowHistory(true); }}
                          className="p-1 rounded hover:bg-purple-50 transition-colors" title="Histórico deste item">
                          <History className="w-3.5 h-3.5 text-slate-400 hover:text-purple-600" />
                        </button>
                      </td>
                      <td className="py-2 px-2 text-right">
                        <span className={`text-sm font-semibold ${pedidosVal > 0 ? 'text-orange-600' : 'text-slate-400'}`}>
                          {formatNumber(pedidosVal)}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right">
                        <span className={`text-sm font-bold ${disponivel < 0 ? 'text-red-600' : disponivel === 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {formatNumber(disponivel)}
                        </span>
                      </td>
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
  const [showMadeiraFinancial, setShowMadeiraFinancial] = useState(false);
  const [showEcommerceHistory, setShowEcommerceHistory] = useState(false);
  const [showIndustrializedBaixa, setShowIndustrializedBaixa] = useState(false);

  // Fetch classifications
  const { data: classifications } = trpc.settings.getProductClassifications.useQuery();

  // Fetch semi pronto and aguardando escolha stock for madeira KPIs
  const { data: semiProntoKPI } = trpc.dashboard.getSemiProntoStock.useQuery(undefined, { refetchInterval: 30000 });
  const { data: aguardandoKPI } = trpc.dashboard.getAguardandoEscolhaStock.useQuery(undefined, { refetchInterval: 30000 });

  // Fetch madeira PA manual stock for KPIs (same data as MadeiraPACard)
  const { data: madeiraStockKPI } = trpc.dashboard.getMadeiraStock.useQuery(undefined, { refetchInterval: 30000 });

  // Fetch madeira visibility settings
  const { data: madeiraVisData } = trpc.settings.getMadeiraVisibility.useQuery();

  // Fetch avg sales prices for valuation
  const { data: pricesData } = trpc.dashboard.getAvgSalesPrices.useQuery(undefined, {
    refetchInterval: 60000,
  });
  // Fetch manual pricing overrides
  const { data: pricingOverrides } = trpc.settings.getProductPricing.useQuery();

  // Fetch monthly sales by product for hidden informational columns
  const { data: monthlySalesData } = trpc.sales.getMonthlySalesByProduct.useQuery(undefined, {
    refetchInterval: 60000,
  });

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

  // Build madeira visibility map
  const madeiraVisMap = useMemo(() => {
    const map: Record<string, { madeira: boolean; semiPronto: boolean; aguardandoEscolha: boolean }> = {};
    if (madeiraVisData?.items) {
      for (const row of madeiraVisData.items) {
        if (!map[row.codigoItem]) map[row.codigoItem] = { madeira: true, semiPronto: true, aguardandoEscolha: true };
        if (row.card === "madeira") map[row.codigoItem].madeira = row.visible;
        if (row.card === "semiPronto") map[row.codigoItem].semiPronto = row.visible;
        if (row.card === "aguardandoEscolha") map[row.codigoItem].aguardandoEscolha = row.visible;
      }
    }
    return map;
  }, [madeiraVisData]);

  // Itens de madeira: todos os produtos de industrialização (varetas, espetos, palitos, madeira serrada)
  const allMadeiraItems = useMemo(() => items.filter(i => i.grupo === "industrializacao"), [items]);
  // Filtered by visibility for each card
  const madeiraItems = useMemo(() => allMadeiraItems.filter(i => {
    const vis = madeiraVisMap[i.codigoItem];
    return !vis || vis.madeira;
  }), [allMadeiraItems, madeiraVisMap]);
  const madeiraItemsSemiPronto = useMemo(() => allMadeiraItems.filter(i => {
    const vis = madeiraVisMap[i.codigoItem];
    return !vis || vis.semiPronto;
  }), [allMadeiraItems, madeiraVisMap]);
  const madeiraItemsAguardando = useMemo(() => allMadeiraItems.filter(i => {
    const vis = madeiraVisMap[i.codigoItem];
    return !vis || vis.aguardandoEscolha;
  }), [allMadeiraItems, madeiraVisMap]);

  const revendaItems = useMemo(() => items.filter((i) => i.grupo === "importacao_revenda"), [items]);
  const industItems = useMemo(() => items.filter((i) => i.grupo === "industrializacao"), [items]);
  const mpItems = useMemo(() => items.filter((i) => i.grupo === "importacao_mp"), [items]);

  // Contagem apenas de pais (excluindo variações filhas)
  // KPI geral conta apenas importação (revenda + MP), exclui industrialização (madeira)
  const parentOnlyItems = useMemo(() => items.filter(i => !i.isChild && i.grupo !== "industrializacao"), [items]);
  const parentOnlyEstoque = useMemo(() => estoqueItems.filter(i => !i.isChild), [estoqueItems]);
  const parentOnlyEncomenda = useMemo(() => encomendaItems.filter(i => !i.isChild), [encomendaItems]);
  const parentOnlyMadeira = useMemo(() => madeiraItems.filter(i => !i.isChild), [madeiraItems]);
  const parentOnlyRevenda = useMemo(() => revendaItems.filter(i => !i.isChild), [revendaItems]);
  const parentOnlyIndust = useMemo(() => industItems.filter(i => !i.isChild), [industItems]);
  const parentOnlyMP = useMemo(() => mpItems.filter(i => !i.isChild), [mpItems]);

  // Totais gerais: apenas importação (revenda + MP), exclui industrialização (madeira)
  // IMPORTANTE: excluir filhos (isChild) para não duplicar estoque de variações PC já somadas no mãe
  const importItems = useMemo(() => items.filter(i => i.grupo !== "industrializacao" && !i.isChild), [items]);
  const totalEstoqueCx = importItems.reduce((sum, i) => sum + (i.estoqueCx ?? 0), 0);
  // Pedidos de venda: soma TODOS os produtos (importação + industrialização), excluindo filhos
  const totalPedidosCx = items.filter(i => !i.isChild).reduce((sum, i) => sum + (i.pedidosCx ?? 0), 0);
  // Disponível = Estoque Total - Pedidos (Venda) = 19.501 - 2.505 = 16.996
  const totalDisponivelCx = totalEstoqueCx - totalPedidosCx;
  // KPI PO: somar em caixas usando poLotes (quantidade original da PO)
  // Para produtos kg (ex: 00058), poCx está em kg para a tabela, mas o KPI deve mostrar caixas
  const totalPOCx = importItems.reduce((sum, i) => {
    if (i.poLotes && i.poLotes.length > 0) {
      return sum + i.poLotes.reduce((ls: number, l: any) => ls + (l.quantidade ?? 0), 0);
    }
    return sum + (i.poCx ?? 0);
  }, 0);
  // Projetado = Disponível + PO = 16.996 + 9.639 = 26.635
  const totalProjetadoCx = totalDisponivelCx + totalPOCx;

  // Madeira KPI totals (Madeira card + Semi Pronto + Aguardando Escolha)
  const semiProntoTotal = useMemo(() => {
    if (!semiProntoKPI?.items) return 0;
    return semiProntoKPI.items.reduce((sum, sp) => sum + (parseFloat(String(sp.quantidade)) || 0), 0);
  }, [semiProntoKPI]);

  const aguardandoTotal = useMemo(() => {
    if (!aguardandoKPI?.items) return 0;
    return aguardandoKPI.items.reduce((sum, sp) => sum + (parseFloat(String(sp.quantidade)) || 0), 0);
  }, [aguardandoKPI]);

  // Mapas de estoque para Semi Pronto e Aguardando (para valorização)
  const semiProntoMapKPI = useMemo(() => {
    const map = new Map<string, number>();
    if (semiProntoKPI?.items) {
      for (const sp of semiProntoKPI.items) {
        map.set(sp.codigoItem, parseFloat(String(sp.quantidade)) || 0);
      }
    }
    return map;
  }, [semiProntoKPI]);

  const aguardandoMapKPI = useMemo(() => {
    const map = new Map<string, number>();
    if (aguardandoKPI?.items) {
      for (const sp of aguardandoKPI.items) {
        map.set(sp.codigoItem, parseFloat(String(sp.quantidade)) || 0);
      }
    }
    return map;
  }, [aguardandoKPI]);

  // KPIs: Estoque Total e Pedidos APENAS de Madeira PA (não inclui Semi Pronto nem Aguardando)
  const ROJAO_CODE = "00129";
  const VARETA_APITO_CODE = "00223";

  // Mapa de estoque para KPIs (sincronizado com MadeiraPACard)
  const madeiraStockMapKPI = useMemo(() => {
    const map = new Map<string, number>();
    if (madeiraStockKPI?.items) {
      for (const ms of madeiraStockKPI.items) {
        map.set(ms.codigoItem, parseFloat(String(ms.quantidade)) || 0);
      }
    }
    return map;
  }, [madeiraStockKPI]);

  // Estoque Total = soma do estoque do Maxiprod (estoqueCx) de todos os itens Madeira PA
  const madeiraEstoqueCx = useMemo(() => {
    return parentOnlyMadeira.reduce((sum, i) => sum + (i.estoqueCx ?? 0), 0);
  }, [parentOnlyMadeira]);

  const madeiraPedidosCx = useMemo(() => madeiraItems.reduce((sum, i) => sum + (i.pedidosCx ?? 0), 0), [madeiraItems]);
  const madeiraDisponivelCx = madeiraEstoqueCx - madeiraPedidosCx;
  const madeiraPOCx = useMemo(() => madeiraItems.reduce((sum, i) => sum + (i.poCx ?? 0), 0), [madeiraItems]);
  const madeiraProjetadoCx = madeiraDisponivelCx + madeiraPOCx;
  const madeiraProdutos = parentOnlyMadeira.length;
  const negativos = items.filter((i) => (i.disponivelCx ?? i.disponivelUn) < 0).length;

  // Disponível separado: Caixas (tudo exceto Rojão e Vareta Apito) e Dúzias (apenas Rojão 00129)
  // Usa estoque em vez de estoqueCx do Maxiprod
  const disponivelCaixas = useMemo(() => {
    return parentOnlyMadeira
      .filter(i => i.codigoItem !== ROJAO_CODE && i.codigoItem !== VARETA_APITO_CODE && !i.isKgProduct)
      .reduce((sum, i) => sum + ((madeiraStockMapKPI.get(i.codigoItem) || 0) - (i.pedidosCx ?? 0)), 0);
  }, [parentOnlyMadeira, madeiraStockMapKPI]);
  // Dúzias: Rojão (00129) - Estoque, Pedidos, Disponível
  const estoqueDuzias = useMemo(() => madeiraStockMapKPI.get(ROJAO_CODE) || 0, [madeiraStockMapKPI]);
  const pedidosDuzias = useMemo(() => {
    const rojao = madeiraItems.find(i => i.codigoItem === ROJAO_CODE);
    return rojao?.pedidosCx ?? 0;
  }, [madeiraItems]);
  const disponivelDuzias = estoqueDuzias - pedidosDuzias;

  // Kg: Vareta de Apito (00223) - Estoque, Pedidos, Disponível
  const estoqueKg = useMemo(() => madeiraStockMapKPI.get(VARETA_APITO_CODE) || 0, [madeiraStockMapKPI]);
  const pedidosKg = useMemo(() => {
    const vareta = madeiraItems.find(i => i.codigoItem === VARETA_APITO_CODE);
    return vareta?.pedidosCx ?? 0;
  }, [madeiraItems]);
  const disponivelKg = estoqueKg - pedidosKg;

  // Caixas separado: Estoque e Pedidos (excluindo Rojão e Vareta Apito)
  const estoqueCaixas = useMemo(() => {
    return parentOnlyMadeira
      .filter(i => i.codigoItem !== ROJAO_CODE && i.codigoItem !== VARETA_APITO_CODE && !i.isKgProduct)
      .reduce((sum, i) => sum + (madeiraStockMapKPI.get(i.codigoItem) || 0), 0);
  }, [parentOnlyMadeira, madeiraStockMapKPI]);
  const pedidosCaixas = useMemo(() => {
    return madeiraItems
      .filter(i => i.codigoItem !== ROJAO_CODE && i.codigoItem !== VARETA_APITO_CODE && !i.isKgProduct)
      .reduce((sum, i) => sum + (i.pedidosCx ?? 0), 0);
  }, [madeiraItems]);

  // Alertas: produtos com estoque < pedidos dos últimos 30 dias
  const [showAlertasPanel, setShowAlertasPanel] = useState(false);
  const [showAutoFeedReport, setShowAutoFeedReport] = useState(false);

  const madeiraAlertas = useMemo(() => {
    return parentOnlyMadeira.filter(i => {
      const estoque = i.estoqueCx ?? 0;
      const pedidos = i.pedidosCx ?? 0;
      return pedidos > 0 && estoque < pedidos;
    }).map(i => ({ codigo: i.codigoItem, descricao: i.descricaoItem, estoque: i.estoqueCx ?? 0, pedidos: i.pedidosCx ?? 0, deficit: (i.pedidosCx ?? 0) - (i.estoqueCx ?? 0) }));
  }, [parentOnlyMadeira]);

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
      {/* ═══ TÍTULO IMPORTAÇÃO ═══ */}
      <div className="mb-1">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-blue-300 to-transparent" />
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-full px-5 py-2">
            <Ship className="w-5 h-5 text-blue-700" />
            <span className="text-sm font-bold text-blue-800 uppercase tracking-wider">Importação</span>
          </div>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-blue-300 to-transparent" />
        </div>
      </div>
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard
          label="Estoque Total"
          value={`${formatNumber(totalEstoqueCx, true)} cx`}
          sub={`${parentOnlyItems.length} produtos`}
          icon={Package}
          theme="teal"
        />
        <KPICard
          label="Pedidos (Venda)"
          value={`${formatNumber(totalPedidosCx, true)} cx`}
          sub="Aprovados + A aprovar"
          icon={ShoppingCart}
          theme="orange"
        />
        <KPICard
          label="Disponivel"
          value={`${formatNumber(totalDisponivelCx, true)} cx`}
          sub="Estoque - Pedidos"
          icon={CheckCircle2}
          theme="emerald"
        />
        <KPICard
          label="PO (A Receber)"
          value={`${formatNumber(totalPOCx, true)} cx`}
          sub="Pedidos de compra"
          icon={Ship}
          theme="blue"
        />
        <KPICard
          label="Projetado"
          value={`${formatNumber(totalProjetadoCx, true)} cx`}
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
                          <p className="text-sm font-semibold text-slate-800 break-words leading-snug">{item.descricaoItem}</p>
                          <p className="text-xs text-slate-500 mt-0.5">Cód: {item.codigoItem}</p>
                        </div>
                        <div className="flex items-center gap-4 flex-shrink-0">
                          <div className="text-center">
                            <p className="text-[10px] text-slate-400 uppercase font-medium">Projetado</p>
                            <p className={`text-sm font-bold ${colors.text}`}>{formatNumber(projetado, true)} cx</p>
                          </div>
                          <div className="text-center">
                            <p className="text-[10px] text-slate-400 uppercase font-medium">Est. Reg.</p>
                            <p className="text-sm font-bold text-slate-600">{formatNumber(estReg, true)} cx</p>
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
          // Excluir filhos (isChild) para não duplicar variações PC já somadas no pai
          const parentOnlyAll = items.filter(i => !i.isChild);
          for (const item of parentOnlyAll) {
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

            {/* E-commerce History button */}
            <div className="flex items-center">
              <button
                onClick={() => setShowEcommerceHistory(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap bg-white text-purple-600 border border-purple-200 hover:bg-purple-50 shadow-sm"
              >
                <Store className="w-4 h-4" />
                Histórico E-commerce
              </button>
            </div>


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

      {/* E-commerce History Dialog */}
      {showEcommerceHistory && <EcommerceHistoryDialog open={showEcommerceHistory} onClose={() => setShowEcommerceHistory(false)} />}

      {/* Industrialized Baixa History Dialog */}
      {showIndustrializedBaixa && <IndustrializedBaixaDialog open={showIndustrializedBaixa} onClose={() => setShowIndustrializedBaixa(false)} />}

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
        monthlySalesData={monthlySalesData}
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
        monthlySalesData={monthlySalesData}
      />

      {/* ═══ SEÇÃO MADEIRA ═══ */}
      <div className="mt-10 mb-5">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-green-300 to-transparent" />
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-full px-5 py-2">
            <TreePine className="w-5 h-5 text-green-700" />
            <span className="text-sm font-bold text-green-800 uppercase tracking-wider">Industrialização Madeira</span>
          </div>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-green-300 to-transparent" />
        </div>
        <p className="text-center text-xs text-slate-400 mt-2">Madeira + Semi Pronto + Aguardando Escolha</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <KPICard
          label="Estoque Total"
          value={`${formatNumber(estoqueCaixas, true)} cx`}
          sub={`${madeiraProdutos} produtos (Madeira PA)`}
          icon={TreePine}
          theme="teal"
        />
        <KPICard
          label="Pedidos (Venda)"
          value={`${formatNumber(pedidosCaixas, true)} cx`}
          sub="Apenas Madeira PA"
          icon={ShoppingCart}
          theme="orange"
        />
        <KPICard
          label="Disponível"
          value={`${formatNumber(estoqueCaixas - pedidosCaixas, true)} cx`}
          sub="Estoque - Pedidos (cx)"
          icon={Boxes}
          theme="emerald"
        />
        <KPICard
          label="Semi Pronto"
          value={`${formatNumber(semiProntoTotal, true)} cx`}
          sub="Estoque semi pronto"
          icon={Hammer}
          theme="blue"
        />
        <KPICard
          label="Aguardando Escolha"
          value={`${formatNumber(aguardandoTotal, true)} cx`}
          sub="Estoque aguardando"
          icon={Clock}
          theme="indigo"
        />
        {/* Card Rojão expandido: Estoque, Pedidos, Disponível */}
        <div className="rounded-xl border bg-white p-3 shadow-sm" style={{ borderTop: '3px solid #22c55e' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rojão 7x1000 (dz)</span>
            <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center">
              <Package className="w-4 h-4 text-green-600" />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between items-baseline">
              <span className="text-[10px] text-slate-900 font-semibold">Estoque</span>
              <span className="text-sm font-extrabold text-slate-900">{formatNumber(estoqueDuzias)} dz</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-[10px] text-slate-900 font-semibold">Pedidos</span>
              <span className="text-sm font-extrabold text-slate-900">{formatNumber(pedidosDuzias)} dz</span>
            </div>
            <div className="h-px bg-slate-100" />
            <div className="flex justify-between items-baseline">
              <span className="text-[10px] font-bold text-slate-900">Disponível</span>
              <span className={`text-base font-extrabold ${disponivelDuzias < 0 ? 'text-red-700' : 'text-slate-900'}`}>{formatNumber(disponivelDuzias)} dz</span>
            </div>
          </div>
        </div>
        <div onClick={() => madeiraAlertas.length > 0 && setShowAlertasPanel(p => !p)} className={`h-full ${madeiraAlertas.length > 0 ? "cursor-pointer" : ""}`}>
          <KPICard
            label="Alertas"
            value={madeiraAlertas.length > 0 ? `${madeiraAlertas.length}` : "Nenhum"}
            sub={madeiraAlertas.length > 0 ? (showAlertasPanel ? "Clique p/ fechar" : "Clique p/ ver") : "Tudo em ordem"}
            icon={madeiraAlertas.length > 0 ? AlertTriangle : CheckCircle2}
            theme={madeiraAlertas.length > 0 ? "red" : "slate"}
          />
        </div>
      </div>

      {/* Botão discreto de conferência auto-feed */}
      <div className="flex justify-end mt-1">
        <button
          onClick={() => setShowAutoFeedReport(true)}
          className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-emerald-600 transition-colors font-medium px-2 py-1 rounded-md hover:bg-emerald-50"
        >
          <ClipboardCheck className="w-3.5 h-3.5" />
          Conferência Auto-feed
        </button>
      </div>

      {/* Modal de Conferência Auto-feed */}
      {showAutoFeedReport && <AutoFeedReportModal open={showAutoFeedReport} onClose={() => setShowAutoFeedReport(false)} />}

      {/* Painel de Alertas de Produção */}
      {madeiraAlertas.length > 0 && showAlertasPanel && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span className="text-sm font-bold text-red-700">Alertas de Produção - Estoque abaixo dos pedidos (últimos 30 dias)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-red-200">
                  <th className="text-left py-1.5 px-2 text-red-700 font-semibold text-xs">Produto</th>
                  <th className="text-right py-1.5 px-2 text-red-700 font-semibold text-xs">Estoque</th>
                  <th className="text-right py-1.5 px-2 text-red-700 font-semibold text-xs">Pedidos</th>
                  <th className="text-right py-1.5 px-2 text-red-700 font-semibold text-xs">Déficit</th>
                </tr>
              </thead>
              <tbody>
                {madeiraAlertas.map(a => (
                  <tr key={a.codigo} className="border-b border-red-100 hover:bg-red-100/50">
                    <td className="py-1.5 px-2 text-slate-700 text-xs">
                      <span className="text-slate-400 mr-1">{a.codigo}</span> {a.descricao}
                    </td>
                    <td className="py-1.5 px-2 text-right font-semibold text-teal-600 text-xs">{formatNumber(a.estoque, true)} cx</td>
                    <td className="py-1.5 px-2 text-right font-semibold text-orange-600 text-xs">{formatNumber(a.pedidos, true)} cx</td>
                    <td className="py-1.5 px-2 text-right font-bold text-red-600 text-xs">-{formatNumber(a.deficit, true)} cx</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Valorização de Estoque Madeira (igual ao bambu) */}
      <MadeiraValorizacaoCard
        madeiraItems={madeiraItems}
        madeiraItemsSemiPronto={madeiraItemsSemiPronto}
        madeiraItemsAguardando={madeiraItemsAguardando}
        madeiraVisData={madeiraVisData}
        madeiraStockMap={madeiraStockMapKPI}
        semiProntoMap={semiProntoMapKPI}
        aguardandoMap={aguardandoMapKPI}
        pricingOverrides={pricingOverrides ?? undefined}
        showMadeiraFinancial={showMadeiraFinancial}
        setShowMadeiraFinancial={setShowMadeiraFinancial}
        operatorCtx={operatorCtx}
      />

      <MadeiraPACard
        items={madeiraItems}
        isOpen={openCards.madeira}
        onToggle={() => toggleCard("madeira")}
        pricingOverrides={pricingOverrides ?? undefined}
        monthlySalesData={monthlySalesData}
      />

      <SemiProntoCard
        items={madeiraItemsSemiPronto}
        isOpen={openCards.semiPronto}
        onToggle={() => toggleCard("semiPronto")}
      />

      <AguardandoEscolhaCard
        items={madeiraItemsAguardando}
        isOpen={openCards.aguardandoEscolha}
        onToggle={() => toggleCard("aguardandoEscolha")}
      />

    </div>
  );
}

/* --- Industrialized Baixa History Dialog --- */
function IndustrializedBaixaDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [dateFilter, setDateFilter] = useState<string>("");
  const [dateFilterEnd, setDateFilterEnd] = useState<string>("");
  const [productFilter, setProductFilter] = useState<string>("");

  const { data, isLoading } = trpc.dashboard.getIndustrializedBaixaHistory.useQuery(
    {
      startDate: dateFilter || undefined,
      endDate: dateFilterEnd || undefined,
      codigoItem: productFilter || undefined,
    },
    { enabled: open }
  );

  const items = data?.items || [];
  const totalBaixas = data?.totalBaixas || 0;
  const totalQuantidade = data?.totalQuantidade || 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Factory className="w-5 h-5 text-violet-600" />
            Baixas por Faturamento (Industrializados)
          </DialogTitle>
          <DialogDescription>
            Registro automático de abatimentos no estoque de madeira quando pedidos industrializados são faturados
          </DialogDescription>
        </DialogHeader>

        {/* Summary */}
        {items.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-violet-50 border border-violet-200 rounded-lg px-4 py-2.5 text-center">
              <p className="text-[10px] text-violet-600 font-semibold uppercase">Baixas Realizadas</p>
              <p className="text-lg font-extrabold text-violet-800">{totalBaixas}</p>
            </div>
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2.5 text-center">
              <p className="text-[10px] text-indigo-600 font-semibold uppercase">Total Abatido</p>
              <p className="text-lg font-extrabold text-indigo-800">{formatNumber(totalQuantidade)}</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 font-medium">De:</label>
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="h-8 text-xs w-36"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 font-medium">Até:</label>
            <Input
              type="date"
              value={dateFilterEnd}
              onChange={(e) => setDateFilterEnd(e.target.value)}
              className="h-8 text-xs w-36"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 font-medium">Produto:</label>
            <Input
              type="text"
              placeholder="Código do produto"
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="h-8 text-xs w-40"
            />
          </div>
          {(dateFilter || dateFilterEnd || productFilter) && (
            <button
              onClick={() => { setDateFilter(""); setDateFilterEnd(""); setProductFilter(""); }}
              className="text-xs text-slate-400 hover:text-slate-600 underline"
            >
              Limpar filtros
            </button>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-violet-400" />
              <p className="text-sm text-slate-400 mt-2">Carregando histórico...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12">
              <Factory className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-sm text-slate-500 font-medium">Nenhuma baixa registrada</p>
              <p className="text-xs text-slate-400 mt-1">As baixas serão registradas automaticamente quando itens industrializados forem faturados</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Data Baixa</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Pedido</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Produto</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Descrição</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Cliente</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Qtd</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Anterior</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Novo</th>
                </tr>
              </thead>
              <tbody>
                {items.map((h: any, i: number) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="px-3 py-2 text-xs text-slate-600 whitespace-nowrap">
                      {h.dataBaixa ? new Date(h.dataBaixa + 'T12:00:00').toLocaleDateString("pt-BR") : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs font-semibold text-slate-700">#{h.pedido}</td>
                    <td className="px-3 py-2 text-xs font-mono text-slate-500">{h.codigoItem}</td>
                    <td className="px-3 py-2 text-sm text-slate-700 break-words leading-snug max-w-[200px]">{(h.descricaoItem || '').substring(0, 50)}</td>
                    <td className="px-3 py-2 text-xs text-slate-500 max-w-[150px] truncate">{h.cliente || '—'}</td>
                    <td className="px-3 py-2 text-right text-sm font-semibold text-red-600">-{formatNumber(parseFloat(h.quantidade))} {h.unidadeMedida || ''}</td>
                    <td className="px-3 py-2 text-right text-xs text-slate-400">{formatNumber(parseFloat(h.estoqueAnterior))}</td>
                    <td className="px-3 py-2 text-right text-xs font-semibold text-violet-700">{formatNumber(parseFloat(h.estoqueNovo))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                <tr>
                  <td colSpan={5} className="px-3 py-2 text-xs font-bold text-slate-600 uppercase">Total ({totalBaixas} baixas)</td>
                  <td className="px-3 py-2 text-right text-sm font-extrabold text-red-700">-{formatNumber(totalQuantidade)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* --- E-commerce History Dialog --- */
function EcommerceHistoryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [dateFilter, setDateFilter] = useState<string>("");
  const [dateFilterEnd, setDateFilterEnd] = useState<string>("");
  const [productFilter, setProductFilter] = useState<string>("");

  const { data, isLoading } = trpc.dashboard.getEcommerceHistory.useQuery(
    {
      fromDate: dateFilter || undefined,
      toDate: dateFilterEnd || undefined,
      codigoItem: productFilter || undefined,
    },
    { enabled: open }
  );

  const history = data?.history || [];

  // Calculate totals
  const totalCx = history.reduce((sum, h: any) => sum + (h.quantidadeCx || 0), 0);
  const totalUn = history.reduce((sum, h: any) => sum + (h.quantidadeUn || 0), 0);

  // Get unique products for filter
  const uniqueProducts = useMemo(() => {
    const map = new Map<string, string>();
    for (const h of history as any[]) {
      if (h.codigoItem && h.descricaoItem) map.set(h.codigoItem, h.descricaoItem);
    }
    return Array.from(map.entries());
  }, [history]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="w-5 h-5 text-purple-600" />
            Histórico de Transferências E-commerce
          </DialogTitle>
          <DialogDescription>
            Registro automático de todas as saídas de estoque para a filial E-commerce
          </DialogDescription>
        </DialogHeader>

        {/* Summary */}
        {history.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-2.5 text-center">
              <p className="text-[10px] text-purple-600 font-semibold uppercase">Transferências</p>
              <p className="text-lg font-extrabold text-purple-800">{history.length}</p>
            </div>
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2.5 text-center">
              <p className="text-[10px] text-indigo-600 font-semibold uppercase">Total Caixas</p>
              <p className="text-lg font-extrabold text-indigo-800">{formatNumber(totalCx)} cx</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-center">
              <p className="text-[10px] text-blue-600 font-semibold uppercase">Total Unidades</p>
              <p className="text-lg font-extrabold text-blue-800">{formatNumber(totalUn)} un</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 font-medium">De:</label>
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="h-8 text-xs w-36"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 font-medium">Até:</label>
            <Input
              type="date"
              value={dateFilterEnd}
              onChange={(e) => setDateFilterEnd(e.target.value)}
              className="h-8 text-xs w-36"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 font-medium">Produto:</label>
            <Input
              type="text"
              placeholder="Código do produto"
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="h-8 text-xs w-40"
            />
          </div>
          {(dateFilter || dateFilterEnd || productFilter) && (
            <button
              onClick={() => { setDateFilter(""); setDateFilterEnd(""); setProductFilter(""); }}
              className="text-xs text-slate-400 hover:text-slate-600 underline"
            >
              Limpar filtros
            </button>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-purple-400" />
              <p className="text-sm text-slate-400 mt-2">Carregando histórico...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12">
              <Store className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-sm text-slate-500 font-medium">Nenhuma transferência registrada</p>
              <p className="text-xs text-slate-400 mt-1">As transferências serão registradas automaticamente quando o estoque E-commerce baixar na sync</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Data</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Produto</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Descrição</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Qtd (CX)</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Qtd (UN)</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Tipo</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Pedido</th>
                </tr>
              </thead>
              <tbody>
                {(history as any[]).map((h, i) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="px-3 py-2 text-xs text-slate-600 whitespace-nowrap">
                      {new Date(h.detectedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-3 py-2 text-xs font-mono text-slate-500">{h.codigoItem}</td>
                    <td className="px-3 py-2 text-sm text-slate-700 break-words leading-snug max-w-[250px]">{h.descricaoItem}</td>
                    <td className="px-3 py-2 text-right text-sm font-semibold text-purple-700">{formatNumber(h.quantidadeCx)} cx</td>
                    <td className="px-3 py-2 text-right text-sm font-semibold text-indigo-700">{formatNumber(h.quantidadeUn)} un</td>
                    <td className="px-3 py-2">
                      <Badge className={`text-[10px] border-0 ${
                        h.tipoMovimento === 'saida_total' ? 'bg-red-100 text-red-700' :
                        h.tipoMovimento === 'saida_parcial' ? 'bg-orange-100 text-orange-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {h.tipoMovimento === 'saida_total' ? 'Saída Total' :
                         h.tipoMovimento === 'saida_parcial' ? 'Saída Parcial' :
                         h.tipoMovimento}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">{h.pedidoRelacionado || '—'}</td>
                  </tr>
                ))}
              </tbody>
              {/* Footer totals */}
              <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                <tr>
                  <td colSpan={3} className="px-3 py-2 text-xs font-bold text-slate-600 uppercase">Total</td>
                  <td className="px-3 py-2 text-right text-sm font-extrabold text-purple-800">{formatNumber(totalCx)} cx</td>
                  <td className="px-3 py-2 text-right text-sm font-extrabold text-indigo-800">{formatNumber(totalUn)} un</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
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
