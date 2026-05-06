/**
 * Card de Aceite da Produção
 * Visual padronizado com BillingCard: mesma tipografia, setas, espaçamentos.
 * Tabs individuais por grupo + tipo especial.
 */

import { useState, useMemo } from "react";
import { ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Leaf,
  Factory,
  Package,
  Search,
  Check,
  Loader2,
  Gift,
  FlaskConical,
  MessageSquareWarning,
  AlertTriangle,
} from "lucide-react";

type OrderItem = {
  descricao: string;
  quantidade: number;
  quantidadeOriginal?: number;
  quantidadeFaturada?: number;
  valorUnitario: number;
  valorTotal: number;
  valorFaturar: number;
  estadoItem: string;
  codigoGrupo: string;
  dataEntregaItem?: string;
  codigoItem?: string | null;
  descricaoItem?: string | null;
};

type BillingOrder = {
  pedido: string;
  cliente: string;
  clienteApelido: string;
  uf: string;
  dataEmissao: string;
  dataEntrega: string;
  empresa: string;
  representante: string;
  segmento: string;
  estadoItem: string;
  valorTotal: number;
  tipoEspecial?: "AMOSTRA" | "BONIFICACAO" | null;
  condicaoPagamento?: string;
  transportadora?: string;
  razaoSocial?: string;
  grupo?: string;
  grupoKey?: string;
  observacoes?: string;
  itens: OrderItem[];
};

type GrupoKey = "importacao_revenda" | "industrializacao" | "importacao_mp";
type TipoEspecial = "AMOSTRA" | "BONIFICACAO" | null;
type TabKey = string;

const GRUPO_CONFIG: Record<GrupoKey, { label: string; shortLabel: string; icon: React.ElementType; color: string; bgColor: string; borderColor: string; textColor: string }> = {
  importacao_revenda: {
    label: "Prod. Importados (Revenda)",
    shortLabel: "Import. Revenda",
    icon: Leaf,
    color: "bg-teal-500",
    bgColor: "bg-teal-50",
    borderColor: "border-teal-200",
    textColor: "text-teal-700",
  },
  industrializacao: {
    label: "Industrializados",
    shortLabel: "Industrializados",
    icon: Factory,
    color: "bg-violet-500",
    bgColor: "bg-violet-50",
    borderColor: "border-violet-200",
    textColor: "text-violet-700",
  },
  importacao_mp: {
    label: "Matéria-Prima (Importação)",
    shortLabel: "Matéria-Prima",
    icon: Package,
    color: "bg-blue-500",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    textColor: "text-blue-700",
  },
};

const VALID_GRUPO_KEYS: GrupoKey[] = ["importacao_revenda", "industrializacao", "importacao_mp"];

function formatCurrencyFull(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

function formatNumber(n: number): string {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

interface ProductionAcceptanceCardProps {
  orders: BillingOrder[];
  acceptedPedidos: Set<string>;
  modifiedPedidos?: Set<string>;
  newPedidos?: Set<string>;
  onAccept: (pedido: string) => void;
  onReject: (pedido: string) => void;
  showValues: boolean;
  isAccepting?: boolean;
}

/* ---- Order Row — mesma estrutura visual do BillingOrderRow ---- */
function OrderRow({
  order,
  isExpanded,
  onToggle,
  onAccept,
  showValues,
  isAccepting,
  isModified,
  isNew,
}: {
  order: BillingOrder;
  isExpanded: boolean;
  onToggle: () => void;
  onAccept: (pedido: string) => void;
  showValues: boolean;
  isAccepting?: boolean;
  isModified?: boolean;
  isNew?: boolean;
}) {
  const displayName = order.cliente;

  return (
    <div className={`transition-all duration-300 ${
      isModified
        ? isExpanded
          ? "border-2 border-red-500 bg-red-50/40 rounded-xl my-3 mx-2 shadow-xl shadow-red-200/60 relative z-10 ring-4 ring-red-200/40"
          : "border-2 border-red-400 bg-red-50/30 rounded-lg my-1.5 mx-2"
        : isNew
          ? isExpanded
            ? "border-2 border-green-500 bg-green-50/40 rounded-xl my-3 mx-2 shadow-xl shadow-green-200/60 relative z-10 ring-4 ring-green-200/40"
            : "border-2 border-green-400 bg-green-50/30 rounded-lg my-1.5 mx-2"
          : isExpanded
            ? "border-2 border-teal-400 bg-teal-50/40 rounded-xl my-3 mx-2 shadow-xl shadow-teal-200/60 relative z-10 ring-4 ring-teal-200/40"
            : "border-b border-slate-100"
    }`}>
      {/* Collapsed row — same layout as BillingOrderRow */}
      <div
        onClick={onToggle}
        className={`w-full flex items-center gap-2 px-3 py-2.5 transition-colors text-left cursor-pointer ${
          isExpanded
            ? "bg-gradient-to-r from-teal-100/80 via-teal-50 to-white border-b-2 border-teal-400 py-3.5 rounded-t-xl"
            : "hover:bg-slate-50"
        }`}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
      >
        {/* ACTION ZONE - Aceitar button — same style as BillingOrderRow authorize */}
        <div className="flex-shrink-0 mr-1">
          <button
            onClick={(e) => { e.stopPropagation(); onAccept(order.pedido); }}
            disabled={isAccepting}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 border-dashed border-cyan-400 bg-cyan-50 hover:bg-cyan-100 hover:border-cyan-500 hover:border-solid text-cyan-700 transition-all shadow-sm hover:shadow-md group disabled:opacity-50"
            title="Aceitar pedido"
          >
            {isAccepting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-5 h-5 group-hover:scale-110 transition-transform" />
            )}
            <span className="text-xs font-bold uppercase tracking-wide hidden sm:inline">Aceitar</span>
          </button>
        </div>

        {/* Expand arrow — same as BillingOrderRow */}
        <div className="flex-shrink-0 text-slate-400">
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>

        {/* Pedido + Grupo badge — fixed width */}
        <div className="flex-shrink-0">
          <div className="flex items-center gap-1.5">
            {isModified && (
              <span className="relative flex-shrink-0">
                <span className="w-3 h-3 rounded-full bg-red-500 inline-block animate-pulse" />
                <span className="absolute inset-0 w-3 h-3 rounded-full bg-red-400 animate-ping opacity-75" />
              </span>
            )}
            {isNew && !isModified && (
              <span className="relative flex-shrink-0">
                <span className="w-3 h-3 rounded-full bg-green-500 inline-block animate-pulse" />
                <span className="absolute inset-0 w-3 h-3 rounded-full bg-green-400 animate-ping opacity-75" />
              </span>
            )}
            <span className={`font-bold ${isModified ? 'text-red-600' : isNew ? 'text-green-600' : 'text-teal-600'} ${showValues ? 'text-sm' : 'text-base'}`}>#{order.pedido}</span>
            {order.grupo && order.grupoKey !== 'outros' && (
              <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold whitespace-nowrap ${
                order.tipoEspecial === 'AMOSTRA' ? 'bg-yellow-100 text-yellow-800 border border-yellow-300' :
                order.tipoEspecial === 'BONIFICACAO' ? 'bg-pink-100 text-pink-800 border border-pink-300' :
                order.grupoKey === 'importacao_revenda' ? 'bg-teal-100 text-teal-700' :
                order.grupoKey === 'industrializacao' ? 'bg-violet-100 text-violet-700' :
                order.grupoKey === 'importacao_mp' ? 'bg-blue-100 text-blue-700' :
                'bg-slate-100 text-slate-600'
              }`}>
                {order.grupo}
              </span>
            )}
            {isModified && (
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-red-100 text-red-800 border border-red-400 shadow-sm animate-pulse whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                Modificado
              </span>
            )}
            {order.itens.some(i => i.quantidadeFaturada && i.quantidadeFaturada > 0) && (
              <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold whitespace-nowrap bg-blue-100 text-blue-700 border border-blue-300 animate-pulse">
                Fat. Parcial
              </span>
            )}
          </div>
        </div>

        {/* Client name — takes remaining space, truncates if needed */}
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          <span className={`text-slate-700 truncate font-medium ${showValues ? 'text-sm' : 'text-base'}`} title={order.cliente}>
            {displayName}
          </span>
          {order.observacoes && order.observacoes.trim() !== "" && (
            <span className="inline-flex items-center flex-shrink-0 px-1.5 py-1 rounded-md bg-amber-400 text-white shadow-sm animate-pulse" title={order.observacoes}>
              <MessageSquareWarning className="w-3.5 h-3.5" />
            </span>
          )}
        </div>

        {/* UF — same as BillingOrderRow */}
        <div className="w-10 flex-shrink-0 text-center">
          {order.uf && <span className={`text-slate-500 font-medium ${showValues ? 'text-xs' : 'text-sm'}`}>{order.uf}</span>}
        </div>

        {/* Data emissão — same as BillingOrderRow */}
        <div className={`${showValues ? 'w-20' : 'w-24'} flex-shrink-0 text-center`}>
          <span className={`text-slate-500 ${showValues ? 'text-sm' : 'text-base'}`}>{order.dataEmissao}</span>
        </div>

        {/* Data entrega — same as BillingOrderRow */}
        <div className={`${showValues ? 'w-24' : 'w-28'} flex-shrink-0 text-center`}>
          {order.dataEntrega ? (
            <span className={`text-slate-600 font-medium ${showValues ? 'text-sm' : 'text-base'}`}>{order.dataEntrega}</span>
          ) : (
            <span className={`text-slate-300 ${showValues ? 'text-sm' : 'text-base'}`}>—</span>
          )}
        </div>

        {/* Items count + obs indicator — same as BillingOrderRow */}
        <div className={`${showValues ? 'w-16' : 'w-20'} flex-shrink-0 text-center`}>
          <span className={`text-slate-500 ${showValues ? 'text-xs' : 'text-sm font-medium'}`}>{order.itens.length} {order.itens.length === 1 ? "item" : "itens"}</span>

        </div>

        {/* Valor — same as BillingOrderRow */}
        {showValues && (
          <div className="w-24 flex-shrink-0 text-right">
            <span className="text-xs text-slate-500">
              R$ {order.valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
          </div>
        )}

      </div>



      {/* Expanded details */}
      {isExpanded && (
        <div className="bg-white border-t-0 rounded-b-xl overflow-hidden">
          {/* Observações banner — same style as BillingOrderRow */}
          {order.observacoes && order.observacoes.trim() !== "" && (
            <div className="px-4 pl-12 py-3 bg-amber-50 border-b-2 border-amber-300">
              <div className="flex items-start gap-2.5">
                <div className="flex-shrink-0 mt-0.5">
                  <div className="w-7 h-7 rounded-full bg-amber-400 flex items-center justify-center">
                    <MessageSquareWarning className="w-3.5 h-3.5 text-white" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Observações do Comercial</span>
                    <div className="h-px flex-1 bg-amber-200" />
                  </div>
                  <p className="text-sm font-semibold text-amber-900 whitespace-pre-line leading-relaxed">
                    {order.observacoes}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Order info grid — same style as BillingOrderRow detail cards */}
          <div className="px-4 pl-12 py-3 bg-slate-50/40 border-b border-slate-100">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white rounded-lg border border-slate-100 px-3 py-2">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Representante</p>
                <p className="text-sm font-medium text-slate-700 mt-0.5">{order.representante || "—"}</p>
              </div>
              <div className="bg-white rounded-lg border border-slate-100 px-3 py-2">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Segmento</p>
                <p className="text-sm font-medium text-slate-700 mt-0.5">{order.segmento || "—"}</p>
              </div>
              <div className="bg-white rounded-lg border border-slate-100 px-3 py-2">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Cond. Pagamento</p>
                <p className="text-sm font-medium text-slate-700 mt-0.5">{order.condicaoPagamento || "—"}</p>
              </div>
              <div className="bg-white rounded-lg border border-slate-100 px-3 py-2">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Transportadora</p>
                <p className="text-sm font-medium text-slate-700 mt-0.5">{order.transportadora || "—"}</p>
              </div>
            </div>
          </div>

          {/* Items table — same header style as BillingOrderRow */}
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
            <span className="text-sm font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-teal-600" />
              Itens do Pedido ({order.itens.length})
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {order.itens.map((item, idx) => (
              <div key={idx} className="px-4 pl-12 py-3 hover:bg-slate-50/80 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-bold text-slate-800 leading-tight">{item.descricao}</p>
                    {item.codigoItem && (
                      <span className="text-[10px] text-slate-400 font-mono">Cód: {item.codigoItem}</span>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <span className="text-base font-bold text-slate-800">
                      {formatNumber(item.quantidade)} un
                    </span>
                    {item.quantidadeFaturada && item.quantidadeFaturada > 0 && (
                      <span className="text-[10px] text-blue-500 block">
                        (orig: {formatNumber(item.quantidadeOriginal || 0)}, fat: {formatNumber(item.quantidadeFaturada)})
                      </span>
                    )}
                    {showValues && (
                      <span className="text-sm text-slate-500 block">
                        {formatCurrencyFull(item.valorTotal)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {/* Somatório de unidades ao final da coluna */}
            <div className="px-4 pl-12 py-2 border-t border-slate-300">
              <div className="flex items-center justify-end">
                <div className="text-right">
                  <span className="text-sm font-bold text-slate-800">
                    Total: {formatNumber(order.itens.reduce((sum, i) => sum + i.quantidade, 0))} un
                  </span>
                  {showValues && (
                    <span className="text-xs text-slate-500 block">
                      R$ {order.itens.reduce((sum, i) => sum + i.valorTotal, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function makeTabKey(grupo: GrupoKey, tipo: TipoEspecial): TabKey {
  return `${grupo}|${tipo || "normal"}`;
}

function getTabConfig(grupo: GrupoKey, tipo: TipoEspecial) {
  const gc = GRUPO_CONFIG[grupo];
  if (tipo === "AMOSTRA") {
    return {
      label: `Amostra ${gc.shortLabel}`,
      icon: FlaskConical,
      activeBg: "bg-yellow-500",
      inactiveBg: "bg-yellow-50",
      inactiveBorder: "border-yellow-300",
      inactiveText: "text-yellow-700",
    };
  }
  if (tipo === "BONIFICACAO") {
    return {
      label: `Bonif. ${gc.shortLabel}`,
      icon: Gift,
      activeBg: "bg-pink-500",
      inactiveBg: "bg-pink-50",
      inactiveBorder: "border-pink-300",
      inactiveText: "text-pink-700",
    };
  }
  return {
    label: gc.label,
    icon: gc.icon,
    activeBg: gc.color,
    inactiveBg: "bg-white",
    inactiveBorder: gc.borderColor,
    inactiveText: gc.textColor,
  };
}

export default function ProductionAcceptanceCard({
  orders,
  acceptedPedidos,
  modifiedPedidos = new Set(),
  newPedidos = new Set(),
  onAccept,
  onReject,
  showValues,
  isAccepting,
}: ProductionAcceptanceCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [search, setSearch] = useState("");
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<"data" | "entrega">("entrega");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = (field: "data" | "entrega") => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const pendingOrders = useMemo(() => {
    // Pedidos pendentes: não aceitos OU aceitos mas modificados no Maxiprod
    return orders.filter(o => !acceptedPedidos.has(o.pedido) || modifiedPedidos.has(o.pedido));
  }, [orders, acceptedPedidos, modifiedPedidos]);

  const getOrderGrupoKey = (order: BillingOrder): GrupoKey => {
    const key = order.grupoKey as GrupoKey;
    if (key && VALID_GRUPO_KEYS.includes(key)) return key;
    return "importacao_revenda";
  };

  const tabEntries = useMemo(() => {
    const counts: Record<TabKey, { grupo: GrupoKey; tipo: TipoEspecial; orders: BillingOrder[] }> = {};
    for (const order of pendingOrders) {
      const grupo = getOrderGrupoKey(order);
      const tipo = order.tipoEspecial || null;
      const key = makeTabKey(grupo, tipo);
      if (!counts[key]) counts[key] = { grupo, tipo, orders: [] };
      counts[key].orders.push(order);
    }

    const sortedEntries: { key: TabKey; grupo: GrupoKey; tipo: TipoEspecial; orders: BillingOrder[] }[] = [];
    for (const grupoKey of VALID_GRUPO_KEYS) {
      const normalKey = makeTabKey(grupoKey, null);
      if (counts[normalKey]) sortedEntries.push({ key: normalKey, ...counts[normalKey] });
    }
    for (const grupoKey of VALID_GRUPO_KEYS) {
      const amostraKey = makeTabKey(grupoKey, "AMOSTRA");
      if (counts[amostraKey]) sortedEntries.push({ key: amostraKey, ...counts[amostraKey] });
    }
    for (const grupoKey of VALID_GRUPO_KEYS) {
      const bonifKey = makeTabKey(grupoKey, "BONIFICACAO");
      if (counts[bonifKey]) sortedEntries.push({ key: bonifKey, ...counts[bonifKey] });
    }
    return sortedEntries;
  }, [pendingOrders]);

  const filteredOrders = useMemo(() => {
    let base: BillingOrder[] = [];
    if (activeTab === "all") {
      base = pendingOrders;
    } else {
      const entry = tabEntries.find(e => e.key === activeTab);
      base = entry ? entry.orders : [];
    }
    if (search) {
      const s = search.toLowerCase();
      base = base.filter(o =>
        o.pedido.includes(s) ||
        o.cliente.toLowerCase().includes(s) ||
        o.clienteApelido.toLowerCase().includes(s) ||
        o.uf.toLowerCase().includes(s) ||
        o.itens.some(i => i.descricao.toLowerCase().includes(s))
      );
    }

    // Sort by Emissão or Entrega
    const sorted = [...base].sort((a, b) => {
      let cmp = 0;
      if (sortField === "data") {
        cmp = (a.dataEmissao || "").split("/").reverse().join("-").localeCompare(
          (b.dataEmissao || "").split("/").reverse().join("-")
        );
      } else {
        const aDate = a.itens.map(i => i.dataEntregaItem).filter(Boolean).sort()[0] || "";
        const bDate = b.itens.map(i => i.dataEntregaItem).filter(Boolean).sort()[0] || "";
        cmp = aDate.localeCompare(bDate);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return sorted;
  }, [activeTab, tabEntries, pendingOrders, search, sortField, sortDir]);

  const totalPending = pendingOrders.length;

  const toggleOrderExpand = (pedido: string) => {
    setExpandedOrders(prev => {
      const next = new Set(prev);
      if (next.has(pedido)) next.delete(pedido);
      else next.add(pedido);
      return next;
    });
  };

  const totalNormais = pendingOrders.filter(o => !o.tipoEspecial).length;
  const totalAmostras = pendingOrders.filter(o => o.tipoEspecial === "AMOSTRA").length;
  const totalBonificacoes = pendingOrders.filter(o => o.tipoEspecial === "BONIFICACAO").length;
  const totalModificados = pendingOrders.filter(o => modifiedPedidos.has(o.pedido)).length;
  const totalNovos = orders.filter(o => newPedidos.has(o.pedido)).length;
  const totalValue = pendingOrders.reduce((sum, o) => sum + o.valorTotal, 0);
  const filteredTotal = filteredOrders.reduce((sum, o) => sum + o.valorTotal, 0);

  // Empty state: show card with 0 pedidos instead of hiding
  if (totalPending === 0) {
    return (
      <div className="bg-white rounded-lg border border-cyan-300 shadow-sm overflow-hidden">
        <div className="w-full flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <ClipboardCheck className={`${showValues ? 'w-5 h-5' : 'w-6 h-6'} text-cyan-600`} />
            <h3 className={`font-semibold text-slate-700 uppercase tracking-wide ${showValues ? 'text-sm' : 'text-base'}`}>Aceite da Produção</h3>
            <Badge variant="outline" className={`${showValues ? 'text-xs' : 'text-sm'} text-slate-400`}>0 pedidos</Badge>
          </div>
          <span className="text-xs text-slate-400">Nenhum pedido pendente de aceite</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-cyan-300 shadow-sm overflow-hidden">
      {/* Header — same pattern as BillingCard */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex flex-col md:flex-row md:items-center md:justify-between px-4 md:px-5 py-3 md:py-4 hover:bg-cyan-50/30 transition-colors"
      >
        <div className="flex items-center gap-2 md:gap-3 flex-wrap">
          <ClipboardCheck className={`${showValues ? 'w-5 h-5' : 'w-6 h-6'} text-cyan-600 flex-shrink-0`} />
          <h3 className={`font-semibold text-slate-700 uppercase tracking-wide ${showValues ? 'text-xs md:text-sm' : 'text-sm md:text-base'}`}>Aceite da Produção</h3>
          <Badge variant="outline" className={`${showValues ? 'text-[10px] md:text-xs' : 'text-xs md:text-sm'} flex-shrink-0`}>{totalNormais} pedidos</Badge>
          <div className="flex items-center gap-1.5 flex-wrap">
            {totalAmostras > 0 && (
              <Badge className="bg-yellow-100 text-yellow-700 text-[10px] md:text-xs border-0 whitespace-nowrap">
                <FlaskConical className="w-3 h-3 mr-0.5" />
                {totalAmostras} {totalAmostras === 1 ? "amostra" : "amostras"}
              </Badge>
            )}
            {totalBonificacoes > 0 && (
              <Badge className="bg-pink-100 text-pink-700 text-[10px] md:text-xs border-0 whitespace-nowrap">
                <Gift className="w-3 h-3 mr-0.5" />
                {totalBonificacoes} bonif.
              </Badge>
            )}
            {totalModificados > 0 && (
              <Badge className="bg-red-100 text-red-700 text-[10px] md:text-xs border-0 animate-pulse whitespace-nowrap">
                <AlertTriangle className="w-3 h-3 mr-0.5" />
                {totalModificados} modificado{totalModificados > 1 ? 's' : ''}
              </Badge>
            )}
            {totalNovos > 0 && (
              <Badge className="bg-green-100 text-green-700 text-[10px] md:text-xs border-2 border-green-400 animate-pulse whitespace-nowrap">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block mr-0.5" />
                {totalNovos} novo{totalNovos > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-4 mt-1 md:mt-0 pl-7 md:pl-0">
          {showValues && (
            <span className="text-sm font-bold text-slate-800">
              R$ {totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
          )}
          {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-cyan-200">
          {/* Tabs */}
          <div className="flex flex-wrap gap-2 px-4 py-3 bg-cyan-50/30 border-b border-cyan-100">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeTab === "all"
                  ? "bg-cyan-500 text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              Todos ({totalPending})
            </button>
            {tabEntries.map(entry => {
              const config = getTabConfig(entry.grupo, entry.tipo);
              const Icon = config.icon;
              const isActive = activeTab === entry.key;
              return (
                <button
                  key={entry.key}
                  onClick={() => setActiveTab(entry.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    isActive
                      ? `${config.activeBg} text-white shadow-sm`
                      : `${config.inactiveBg} ${config.inactiveText} hover:opacity-80 border ${config.inactiveBorder}`
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {config.label} ({entry.orders.length})
                </button>
              );
            })}
          </div>

          {/* Search + count — same pattern as BillingCard */}
          <div className={`px-4 py-3 bg-cyan-50/20 border-b border-cyan-100 flex flex-col sm:flex-row gap-2`}>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar por pedido, cliente, produto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-white h-8 text-sm"
              />
            </div>
            <div className="flex-shrink-0 flex items-center gap-2">
              <span className={`text-slate-500 ${showValues ? 'text-xs' : 'text-sm font-medium'}`}>{filteredOrders.length} pedidos</span>
              {showValues && (
                <span className="text-sm font-bold text-slate-800">
                  R$ {filteredTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              )}
            </div>
          </div>

          {/* Column headers — same pattern as BillingCard */}
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase font-semibold">
            <div className="flex-shrink-0 mr-1" style={{ width: '110px' }}>
              <span className="text-[10px]">Ação</span>
            </div>
            <div className="w-4 flex-shrink-0" />
            <div className={`${showValues ? 'w-52' : 'w-56'} flex-shrink-0`}>
              <span className="text-[10px]">Pedido</span>
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px]">Cliente</span>
            </div>
            <div className="w-10 flex-shrink-0 text-center">
              <span className="text-[10px]">UF</span>
            </div>
            <div className={`${showValues ? 'w-20' : 'w-24'} flex-shrink-0 text-center`}>
              <button
                onClick={(e) => { e.stopPropagation(); handleSort("data"); }}
                className={`flex items-center gap-1 hover:text-teal-600 transition-colors select-none justify-center text-[10px] uppercase`}
              >
                Emissão
                <ArrowUpDown className={`w-3 h-3 ${sortField === "data" ? "text-teal-600" : "text-slate-300"}`} />
              </button>
            </div>
            <div className={`${showValues ? 'w-24' : 'w-28'} flex-shrink-0 text-center`}>
              <button
                onClick={(e) => { e.stopPropagation(); handleSort("entrega"); }}
                className={`flex items-center gap-1 hover:text-teal-600 transition-colors select-none justify-center text-[10px] uppercase`}
              >
                Entrega
                <ArrowUpDown className={`w-3 h-3 ${sortField === "entrega" ? "text-teal-600" : "text-slate-300"}`} />
              </button>
            </div>
            <div className={`${showValues ? 'w-16' : 'w-20'} flex-shrink-0 text-center`}>
              <span className="text-[10px]">Itens</span>
            </div>
            {showValues && (
              <div className="w-24 flex-shrink-0 text-right">
                <span className="text-[10px]">Valor</span>
              </div>
            )}
          </div>

          {/* Order list */}
          {filteredOrders.length > 0 ? (
            <div>
              {filteredOrders.map(order => (
                <OrderRow
                  key={order.pedido}
                  order={order}
                  isExpanded={expandedOrders.has(order.pedido)}
                  onToggle={() => toggleOrderExpand(order.pedido)}
                  onAccept={onAccept}
                  showValues={showValues}
                  isAccepting={isAccepting}
                  isModified={modifiedPedidos.has(order.pedido)}
                  isNew={newPedidos.has(order.pedido)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhum pedido encontrado</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
