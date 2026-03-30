/**
 * Dashboard Grupo Fox - Aba de Faturamento
 * Fluxo: Pedidos em Aberto → Autorizado a Faturar → Faturados
 * Com vinculação de Notas Fiscais aos pedidos faturados
 */

import { useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import ConnectionStatusCard from "@/components/ConnectionStatusCard";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  FileCheck,
  Clock,
  Loader2,
  BarChart3,
  Search,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  Package,
  ClipboardList,
  DollarSign,
  AlertCircle,
  FileText,
  Copy,
  CheckCircle,
  ShieldCheck,
  Lock,
  Check,
  X,
  Undo2,
  Truck,
  MapPin,
  Building2,
  CreditCard,
  Eye,
  EyeOff,
  Phone,
  Mail,
  User,
  Tag,
  Hash,
  Ruler,
  Globe,
  MessageSquare,
  ClipboardCheck,
  Leaf,
  Factory,
  Gift,
  FlaskConical,
  Printer,
  Pencil,
  Save,
  StickyNote,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import TopNav from "@/components/TopNav";
import ProductionAcceptanceCard from "@/components/ProductionAcceptanceCard";
import { useOperator } from "@/contexts/OperatorContext";
import { generateOrderPdf } from "@/lib/generateOrderPdf";

/* ---- Helpers ---- */
function formatCurrencyFull(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

// When values are hidden, return empty string - no trace of value existence

function formatNumber(n: number): string {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function formatDateBR(d: string): string {
  if (!d) return "";
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    return date.toLocaleDateString("pt-BR");
  } catch { return d; }
}

/* ---- Production Status Options ---- */
const PRODUCTION_STATUS_OPTIONS = [
  { value: "aguardando_producao", label: "Aguardando Produção (Na Fila)", color: "bg-slate-100 text-slate-700 border-slate-200", dot: "bg-slate-500" },
  { value: "em_producao", label: "Em Produção", color: "bg-blue-100 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  { value: "falta_mercadoria", label: "Falta de Mercadoria", color: "bg-red-100 text-red-700 border-red-200", dot: "bg-red-500" },
  { value: "falta_materia_prima", label: "Falta de Matéria Prima", color: "bg-orange-100 text-orange-700 border-orange-200", dot: "bg-orange-500" },
  { value: "pronto_aguardando_data", label: "Pronto Aguardando Data", color: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  { value: "25_pronto", label: "25% Pronto", color: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  { value: "50_pronto", label: "50% Pronto", color: "bg-yellow-100 text-yellow-700 border-yellow-200", dot: "bg-yellow-500" },
  { value: "75_pronto", label: "75% Pronto", color: "bg-lime-100 text-lime-700 border-lime-200", dot: "bg-lime-500" },
  { value: "em_separacao", label: "Em Separação", color: "bg-violet-100 text-violet-700 border-violet-200", dot: "bg-violet-500" },
] as const;

function getStatusOption(value: string) {
  return PRODUCTION_STATUS_OPTIONS.find(o => o.value === value);
}

/* ---- Transport Options ---- */
const TRANSPORT_LABELS: Record<string, string> = {
  cliente_retira: "Cliente Retira",
  braspress: "Braspress",
  flor_de_minas: "Flor de Minas",
  rodo_naves: "RodoNaves/Paulineres",
  delcio: "Delcio",
  camilo: "Camilo",
  alfa: "Alfa",
  trans_transportes: "Trans Transportes",
  correio: "Correio",
  zaz_trans: "Zaz Tras",
  fob: "FOB",
  regional_gestao: "Regional Gestão",
  transexport: "Transexport",
};

/* ---- KPI Card ---- */
const kpiStyles: Record<string, { iconBg: string; iconColor: string; bar: string }> = {
  teal: { iconBg: "bg-teal-100", iconColor: "text-teal-600", bar: "bg-teal-500" },
  emerald: { iconBg: "bg-emerald-100", iconColor: "text-emerald-600", bar: "bg-emerald-500" },
  orange: { iconBg: "bg-orange-100", iconColor: "text-orange-600", bar: "bg-orange-500" },
  red: { iconBg: "bg-red-100", iconColor: "text-red-600", bar: "bg-red-500" },
  blue: { iconBg: "bg-blue-100", iconColor: "text-blue-600", bar: "bg-blue-500" },
  amber: { iconBg: "bg-amber-100", iconColor: "text-amber-600", bar: "bg-amber-500" },
  cyan: { iconBg: "bg-cyan-100", iconColor: "text-cyan-600", bar: "bg-cyan-500" },
};

function KPICard({ label, value, sub, icon: Icon, theme, showValues = true }: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  theme: keyof typeof kpiStyles;
  showValues?: boolean;
}) {
  const s = kpiStyles[theme];
  return (
    <div className="group relative bg-white rounded-xl border border-slate-100 overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5">
      <div className={`h-1.5 ${s.bar}`} />
      <div className={`px-5 ${showValues ? 'py-4' : 'py-5'}`}>
        <div className="flex items-start justify-between mb-2">
          <p className={`font-semibold uppercase tracking-wider leading-tight ${showValues ? 'text-[11px] text-slate-400' : 'text-sm text-slate-600'}`}>{label}</p>
          <div className={`${showValues ? 'w-8 h-8' : 'w-10 h-10'} rounded-lg flex-shrink-0 flex items-center justify-center ${s.iconBg} transition-transform group-hover:scale-110`}>
            <Icon className={`${showValues ? 'w-4 h-4' : 'w-5 h-5'} ${s.iconColor}`} />
          </div>
        </div>
        {showValues && <p className="text-lg font-extrabold text-slate-900 tracking-tight leading-none truncate" title={value}>{value}</p>}
        {sub && <p className={`mt-1.5 font-medium ${showValues ? 'text-[11px] text-slate-400' : 'text-sm text-slate-500'}`}>{sub}</p>}
      </div>
    </div>
  );
}

/* ---- Types ---- */
type NfInfo = {
  numero: string;
  serie: string;
  chaveDeAcesso: string | null;
  emissaoData: string;
  valorTotal: number;
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
  // Novos campos
  condicaoPagamento?: string;
  transportadora?: string;
  razaoSocial?: string;
  inscricaoEstadual?: string;
  endereco?: {
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    cep: string;
    cidade: string;
    uf: string;
  } | null;
  valorTotalPedido?: number | null;
  // Campos adicionais para detalhes completos (produção)
  clienteTelefone?: string;
  clienteEmail?: string;
  transportadoraRazaoSocial?: string;
  crmSegmento?: string;
  regiao?: string;
  observacoes?: string;
  orderHash?: string; // Hash dos dados do pedido para detectar alterações
  dataFaturamento?: string | null; // Data da NF mais recente (quando disponível)
  grupo?: string;
  grupoKey?: string;
  itens: Array<{
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
    // Campos adicionais para detalhes completos (produção)
    unidadeMedida?: string;
    unidadeMedidaDescricao?: string;
    quantidadeUnidadeItem?: number | null;
    ncm?: string;
    fatorConversao?: number | null;
    grupoDescricao?: string;
  }>;
};

/* ---- Status Badge ---- */
function StatusBadge({ status }: { status: string }) {
  if (status === "Faturado") return <Badge className="bg-emerald-100 text-emerald-700 text-xs border-0">Faturado</Badge>;
  if (status === "A faturar") return <Badge className="bg-orange-100 text-orange-700 text-xs border-0">A Faturar</Badge>;
  if (status === "Faturado parcial") return <Badge className="bg-blue-100 text-blue-700 text-xs border-0">Parcial</Badge>;
  if (status === "Autorizado") return <Badge className="bg-amber-100 text-amber-700 text-xs border-0">Autorizado</Badge>;
  return <Badge variant="outline" className="text-xs">{status}</Badge>;
}

/* ---- Copy to clipboard helper ---- */
function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-teal-600 transition-colors"
      title={`Copiar ${label || "chave"}`}
    >
      {copied ? (
        <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

/* ---- NF Badge ---- */
function NfBadge({ nfs }: { nfs: NfInfo[] }) {
  if (!nfs || nfs.length === 0) return null;
  
  if (nfs.length === 1) {
    return (
      <span className="inline-flex items-center gap-1 text-xs">
        <FileText className="w-3 h-3 text-teal-500" />
        <span className="text-teal-700 font-medium">NF {nfs[0].numero}</span>
      </span>
    );
  }
  
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <FileText className="w-3 h-3 text-teal-500" />
      <span className="text-teal-700 font-medium">{nfs.length} NFs</span>
    </span>
  );
}

/* ---- Sort types ---- */
type SortField = "pedido" | "cliente" | "uf" | "data" | "entrega" | "status" | "itens" | "valor" | "nf";
type SortDir = "asc" | "desc";

function SortableHeader({ field, label, currentSort, currentDir, onSort, className }: {
  field: SortField;
  label: string;
  currentSort: SortField;
  currentDir: SortDir;
  onSort: (field: SortField) => void;
  className?: string;
}) {
  const isActive = currentSort === field;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onSort(field); }}
      className={`flex items-center gap-1 hover:text-teal-600 transition-colors select-none ${className || ""}`}
    >
      {label}
      <ArrowUpDown className={`w-3 h-3 ${isActive ? "text-teal-600" : "text-slate-300"}`} />
    </button>
  );
}

/* ---- Password Dialog ---- */
function PasswordDialog({ open, onOpenChange, title, description, onConfirm, loading }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: (password: string) => void;
  loading?: boolean;
}) {
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim()) {
      onConfirm(password);
      setPassword("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setPassword(""); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-amber-600" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="py-4">
            <Input
              type="password"
              placeholder="Digite a senha..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              className="text-center text-lg tracking-widest"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setPassword(""); onOpenChange(false); }}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!password.trim() || loading} className="bg-amber-600 hover:bg-amber-700">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
              Confirmar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---- Production Note Dialog ---- */
function ProductionNoteDialog({ open, onOpenChange, pedido, currentNote, onSave, isSaving }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pedido: string;
  currentNote: string;
  onSave: (pedido: string, note: string, password: string) => void;
  isSaving: boolean;
}) {
  const [note, setNote] = useState(currentNote);
  const [password, setPassword] = useState("");
  const [isEditing, setIsEditing] = useState(!currentNote);

  // Reset state when dialog opens
  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setPassword("");
      setIsEditing(!currentNote);
      setNote(currentNote);
    }
    onOpenChange(v);
  };

  // Sync note with currentNote when it changes
  if (open && note !== currentNote && !isEditing) {
    setNote(currentNote);
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim()) {
      onSave(pedido, note.trim(), password);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StickyNote className="w-5 h-5 text-blue-600" />
            Observação da Produção — Pedido #{pedido}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Digite a observação da produção sobre este pedido. A senha é necessária para salvar."
              : "Observação registrada pela produção. Clique em Editar para modificar (requer senha)."}
          </DialogDescription>
        </DialogHeader>

        {!isEditing && currentNote ? (
          <div className="py-4 space-y-3">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <StickyNote className="w-4 h-4 text-blue-600" />
                <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">Observação da Produção</span>
              </div>
              <p className="text-sm text-blue-900 whitespace-pre-line leading-relaxed font-medium">{currentNote}</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Fechar
              </Button>
              <Button type="button" onClick={() => setIsEditing(true)} className="gap-1.5">
                <Pencil className="w-4 h-4" />
                Editar
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="py-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Observação</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ex: Produção em andamento, previsão de conclusão sexta-feira..."
                  className="w-full min-h-[100px] rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
                  maxLength={1000}
                  autoFocus
                />
                <p className="text-[10px] text-slate-400 mt-1 text-right">{note.length}/1000</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Senha da Produção</label>
                <Input
                  type="password"
                  placeholder="Digite a senha..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="text-center text-lg tracking-widest"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                if (currentNote && isEditing) {
                  setIsEditing(false);
                  setNote(currentNote);
                  setPassword("");
                } else {
                  handleOpenChange(false);
                }
              }}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!password.trim() || isSaving} className="gap-1.5">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ---- Billing Observation Section (Autorizado a Faturar) ---- */
function BillingObservationSection({ pedido, observation, onSetObservation }: {
  pedido: string;
  observation?: { observation: string; updatedBy: string | null; updatedAt: Date };
  onSetObservation: (pedido: string, observation: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(observation?.observation || "");
  const hasObservation = observation && observation.observation.trim() !== "";

  const handleSave = () => {
    onSetObservation(pedido, text);
    setEditing(false);
  };

  if (!editing && !hasObservation) {
    return (
      <div className="px-4 pl-12 py-2 bg-orange-50/50 border-b border-orange-200">
        <button
          onClick={(e) => { e.stopPropagation(); setEditing(true); }}
          className="flex items-center gap-2 text-xs text-orange-500 hover:text-orange-700 font-medium transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
          CAMPO DE OBSERVAÇÃO
        </button>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="px-4 pl-12 py-3 bg-orange-50 border-b-2 border-orange-300" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-full bg-orange-400 flex items-center justify-center">
            <Pencil className="w-3 h-3 text-white" />
          </div>
          <span className="text-[10px] font-bold text-orange-800 uppercase tracking-wider">Campo de Observação</span>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ex: Produto em falta, aguardando liberação do financeiro..."
          className="w-full h-20 text-sm border border-orange-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
          maxLength={1000}
          autoFocus
        />
        <div className="flex items-center gap-2 mt-2">
          <Button
            size="sm"
            onClick={handleSave}
            className="bg-orange-500 hover:bg-orange-600 text-white text-xs h-7 px-3"
          >
            <Save className="w-3 h-3 mr-1" /> Salvar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setEditing(false); setText(observation?.observation || ""); }}
            className="text-xs h-7 px-3"
          >
            Cancelar
          </Button>
          {hasObservation && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => { onSetObservation(pedido, ""); setEditing(false); setText(""); }}
              className="text-xs h-7 px-3 text-red-500 hover:text-red-700 border-red-200 hover:border-red-300"
            >
              <X className="w-3 h-3 mr-1" /> Remover
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pl-12 py-3 bg-orange-50 border-b-2 border-orange-300">
      <div className="flex items-start gap-2.5">
        <div className="flex-shrink-0 mt-0.5">
          <div className="w-7 h-7 rounded-full bg-orange-400 flex items-center justify-center">
            <Pencil className="w-3.5 h-3.5 text-white" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold text-orange-800 uppercase tracking-wider">Campo de Observação</span>
            <div className="h-px flex-1 bg-orange-200" />
            <button
              onClick={(e) => { e.stopPropagation(); setEditing(true); setText(observation?.observation || ""); }}
              className="text-[10px] text-orange-600 hover:text-orange-800 font-semibold flex items-center gap-1 transition-colors"
            >
              <Pencil className="w-3 h-3" />
              Editar
            </button>
          </div>
          <p className="text-sm font-semibold text-orange-900 whitespace-pre-line leading-relaxed">
            {observation?.observation}
          </p>
          {observation?.updatedBy && (
            <p className="text-[10px] text-orange-500 mt-1">
              Por {observation.updatedBy} em {new Date(observation.updatedAt).toLocaleDateString('pt-BR')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---- Order Row ---- */
function BillingOrderRow({ order, nfs, showNf, showAuthorize, showDeauthorize, onAuthorize, onDeauthorize, isAuthorized, showValues = true, showPrint = false, productionNote, onOpenProductionNote, productionStatusValue, onChangeProductionStatus, collectionStatus, onToggleCollection, transportadora, onChangeTransportadora, pickupSchedule, onChangePickupSchedule, onClearPickupSchedule, billingObservation, onSetBillingObservation, trackingLink, onSetTrackingLink, authorizedTime }: {
  order: BillingOrder;
  nfs?: NfInfo[];
  showNf?: boolean;
  showAuthorize?: boolean;
  showDeauthorize?: boolean;
  onAuthorize?: (pedido: string) => void;
  onDeauthorize?: (pedido: string) => void;
  isAuthorized?: boolean;
  showValues?: boolean;
  showPrint?: boolean;
  productionNote?: string;
  onOpenProductionNote?: (pedido: string) => void;
  productionStatusValue?: string;
  onChangeProductionStatus?: (pedido: string, status: string) => void;
  collectionStatus?: { pedidoColeta: boolean; coletado: boolean };
  onToggleCollection?: (pedido: string, field: "pedidoColeta" | "coletado", value: boolean) => void;
  transportadora?: string;
  onChangeTransportadora?: (pedido: string, transportadora: string) => void;
  pickupSchedule?: { pickupDate: string; pickupHour: number };
  onChangePickupSchedule?: (pedido: string, pickupDate: string, pickupHour: number) => void;
  onClearPickupSchedule?: (pedido: string) => void;
  billingObservation?: { observation: string; updatedBy: string | null; updatedAt: Date };
  onSetBillingObservation?: (pedido: string, observation: string) => void;
  trackingLink?: { trackingUrl: string; updatedBy: string | null };
  onSetTrackingLink?: (pedido: string, trackingUrl: string) => void;
  authorizedTime?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editingTracking, setEditingTracking] = useState(false);
  const [trackingInput, setTrackingInput] = useState("");
  const displayName = order.cliente;

  // Determine earliest delivery date for the order
  const earliestDelivery = useMemo(() => {
    const dates = order.itens
      .map(i => i.dataEntregaItem)
      .filter(Boolean)
      .map(d => new Date(d!))
      .filter(d => !isNaN(d.getTime()));
    if (dates.length === 0) return null;
    return new Date(Math.min(...dates.map(d => d.getTime())));
  }, [order.itens]);

  // Only show overdue indicator for non-faturado orders
  const isFaturado = order.estadoItem === "Faturado";
  const isOverdue = !isFaturado && earliestDelivery && earliestDelivery < new Date();

  // Collection status coloring: green for collected, amber for pending
  const isColetado = collectionStatus?.coletado === true;
  const isPendingColeta = onToggleCollection && !isColetado; // only applies to Faturados card (has onToggleCollection)

  return (
    <div className={`transition-all duration-300 ${
      expanded 
        ? "border-2 border-teal-400 bg-teal-50/40 rounded-xl my-3 mx-2 shadow-xl shadow-teal-200/60 relative z-10 ring-4 ring-teal-200/40" 
        : "border-b border-slate-100"
    }`}>
      <div
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center gap-0 px-3 py-2.5 transition-colors text-left cursor-pointer group/row ${
          expanded 
            ? "bg-gradient-to-r from-teal-100/80 via-teal-50 to-white border-b-2 border-teal-400 py-4 rounded-t-xl" 
            : isColetado
              ? "bg-emerald-50/70 hover:bg-emerald-100/70 border-l-4 border-l-emerald-400"
              : isPendingColeta
                ? "bg-amber-50/60 hover:bg-amber-100/60 border-l-4 border-l-amber-400"
                : "hover:bg-slate-50"
        }`}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(!expanded); } }}
      >
        {/* ACTION ZONE - Authorize/Deauthorize button with prominent box */}
        {showAuthorize && (
          <div className="flex-shrink-0" style={{ width: '120px' }}>
            <button
              onClick={(e) => { e.stopPropagation(); onAuthorize?.(order.pedido); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 border-dashed border-amber-400 bg-amber-50 hover:bg-amber-100 hover:border-amber-500 hover:border-solid text-amber-700 transition-all shadow-sm hover:shadow-md group"
              title="Autorizar faturamento"
            >
              <Check className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold uppercase tracking-wide hidden sm:inline">Autorizar</span>
            </button>
          </div>
        )}
        {showDeauthorize && (
          <div className="flex-shrink-0" style={{ width: '120px' }}>
            <button
              onClick={(e) => { e.stopPropagation(); onDeauthorize?.(order.pedido); }}
              className="flex items-center gap-1 px-1.5 py-1 rounded border border-red-200 bg-red-50/50 hover:bg-red-100 hover:border-red-300 text-red-400 hover:text-red-500 transition-all group"
              title="Remover autorização"
            >
              <Undo2 className="w-3 h-3" />
            </button>
          </div>
        )}



        {/* Expand arrow */}
        <div className="flex-shrink-0 text-slate-400">
          {expanded ? <ChevronDown className={`${showValues ? 'w-4 h-4' : 'w-5 h-5'}`} /> : <ChevronRight className={`${showValues ? 'w-4 h-4' : 'w-5 h-5'}`} />}
        </div>

        {/* Pedido number + Grupo badge + Tipo Especial badge */}
        <div className="flex-shrink-0" style={{ width: showValues ? '170px' : '200px' }}>
          <div className="flex items-center gap-1.5 flex-nowrap">
            <span className={`font-bold text-teal-600 ${showValues ? 'text-sm' : 'text-base'}`}>#{order.pedido}</span>
            {order.grupo && (
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
            {order.itens.some(i => i.quantidadeFaturada && i.quantidadeFaturada > 0 && i.quantidade !== i.quantidadeFaturada) && (
              <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold whitespace-nowrap bg-blue-100 text-blue-700 border border-blue-300 animate-pulse">
                Fat. Parcial
              </span>
            )}
          </div>
        </div>

        {/* Client name - clean, no icons here */}
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          <span className={`text-slate-700 font-medium ${showValues ? 'text-sm' : 'text-base'} truncate`} title={order.cliente}>{displayName}</span>
        </div>

        {/* Production note icon + alert icons - fixed width column */}
        {onOpenProductionNote && (
          <div style={{ width: '80px' }} className="flex-shrink-0 flex items-center justify-center gap-1">
            {productionNote && productionNote.trim() !== "" ? (
              <button
                onClick={(e) => { e.stopPropagation(); onOpenProductionNote(order.pedido); }}
                className="p-0.5 rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                title={`Obs. Produção: ${productionNote}`}
              >
                <StickyNote className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); onOpenProductionNote(order.pedido); }}
                className="p-0.5 rounded border border-dashed border-slate-300 text-slate-300 hover:bg-blue-50 hover:text-blue-500 hover:border-blue-400 transition-colors"
                title="Adicionar observação da produção"
              >
                <StickyNote className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* NF badge + alert icons stacked vertically below */}
        {showNf ? (
          <div style={{ width: '80px' }} className="flex-shrink-0 flex flex-col items-center gap-1">
            <NfBadge nfs={nfs || []} />
            {(() => {
              const hasObs = order.observacoes && order.observacoes.trim() !== "";
              const hasBillingObs = billingObservation && billingObservation.observation.trim() !== "";
              const missing: string[] = [];
              if (!order.representante || order.representante.trim() === "") missing.push("Representante");
              if (!order.segmento && !order.crmSegmento) missing.push("Segmento");
              if (!order.condicaoPagamento || order.condicaoPagamento.trim() === "") missing.push("Cond. Pagamento");
              if (!order.transportadora || order.transportadora.trim() === "") missing.push("Transportadora");
              const hasAlerts = hasObs || hasBillingObs || missing.length > 0;
              if (!hasAlerts) return null;
              return (
                <div className="flex items-center gap-1 justify-center flex-wrap">
                  {hasObs && (
                    <span className="inline-flex items-center p-0.5 rounded bg-amber-400 text-white" title={`Obs. Comercial: ${order.observacoes}`}>
                      <MessageSquare className="w-3 h-3" />
                    </span>
                  )}
                  {hasBillingObs && (
                    <span className="inline-flex items-center px-1 py-0.5 rounded bg-orange-500 text-white animate-pulse" title={`Obs. Faturamento: ${billingObservation.observation}`}>
                      <AlertTriangle className="w-3 h-3" />
                    </span>
                  )}
                  {missing.length > 0 && (
                    <span
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[8px] font-bold uppercase tracking-wider animate-pulse"
                      title={`CAMPOS OBRIGATÓRIOS NÃO PREENCHIDOS: ${missing.join(", ")}${order.representante ? ` (Vendedor: ${order.representante})` : " (Vendedor não identificado)"}`}
                    >
                      <AlertTriangle className="w-2.5 h-2.5" />
                      {missing.length}
                    </span>
                  )}
                </div>
              );
            })()}
          </div>
        ) : (
          /* Alert icons for cards without NF (Aceite, Pedidos em Aberto, Autorizado) */
          (() => {
            const hasObs = order.observacoes && order.observacoes.trim() !== "";
            const hasBillingObs = billingObservation && billingObservation.observation.trim() !== "";
            const missing: string[] = [];
            if (!order.representante || order.representante.trim() === "") missing.push("Representante");
            if (!order.segmento && !order.crmSegmento) missing.push("Segmento");
            if (!order.condicaoPagamento || order.condicaoPagamento.trim() === "") missing.push("Cond. Pagamento");
            if (!order.transportadora || order.transportadora.trim() === "") missing.push("Transportadora");
            const hasAlerts = hasObs || hasBillingObs || missing.length > 0;
            if (!hasAlerts) return <div style={{ width: '80px' }} className="flex-shrink-0" />;
            return (
              <div style={{ width: '80px' }} className="flex-shrink-0 flex items-center justify-center gap-1">
                {hasObs && (
                  <span className="inline-flex items-center p-0.5 rounded bg-amber-400 text-white" title={`Obs. Comercial: ${order.observacoes}`}>
                    <MessageSquare className="w-3 h-3" />
                  </span>
                )}
                {hasBillingObs && (
                  <span className="inline-flex items-center px-1 py-0.5 rounded bg-orange-500 text-white animate-pulse" title={`Obs. Faturamento: ${billingObservation.observation}`}>
                    <AlertTriangle className="w-3 h-3" />
                  </span>
                )}
                {missing.length > 0 && (
                  <span
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[8px] font-bold uppercase tracking-wider animate-pulse"
                    title={`CAMPOS OBRIGATÓRIOS NÃO PREENCHIDOS: ${missing.join(", ")}${order.representante ? ` (Vendedor: ${order.representante})` : " (Vendedor não identificado)"}`}
                  >
                    <AlertTriangle className="w-2.5 h-2.5" />
                    {missing.length}
                  </span>
                )}
              </div>
            );
          })()
        )}

        {/* Data emissão / Data faturamento */}
        <div style={{ width: showValues ? '80px' : '90px' }} className="flex-shrink-0 text-center">
          {order.dataFaturamento ? (
            <div className="flex flex-col">
              <span className={`text-emerald-600 font-semibold ${showValues ? 'text-xs' : 'text-sm'}`} title="Data de faturamento (NF)">{order.dataFaturamento}</span>
              {order.dataFaturamento !== order.dataEmissao && (
                <span className="text-[10px] text-slate-400 line-through" title="Data de emissão do pedido">{order.dataEmissao}</span>
              )}
            </div>
          ) : (
            <span className={`text-slate-600 font-medium ${showValues ? 'text-xs' : 'text-sm'}`}>{order.dataEmissao}</span>
          )}
        </div>

        {/* Horário de autorização */}
        {authorizedTime && (
          <div style={{ width: '60px' }} className="flex-shrink-0 text-center">
            <span className="text-xs text-slate-500 font-medium">
              {new Date(authorizedTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}

        {/* Data entrega */}
        <div style={{ width: showValues ? '90px' : '100px' }} className="flex-shrink-0 text-center">
          {earliestDelivery ? (
            <span className={`font-medium ${showValues ? 'text-xs' : 'text-sm'} ${isOverdue ? 'text-red-600 font-bold' : 'text-slate-600'}`}>
              {earliestDelivery.toLocaleDateString('pt-BR')}
            </span>
          ) : (
            <span className={`text-slate-300 ${showValues ? 'text-xs' : 'text-sm'}`}>—</span>
          )}
        </div>

        {/* Collection checkboxes - only in Faturados */}
        {onToggleCollection && (() => {
          const hasPedColeta = collectionStatus?.pedidoColeta === true;
          const hasTransp = !!transportadora;
          const canColetado = hasPedColeta && hasTransp;
          const isColetado = collectionStatus?.coletado === true;
          const canAgendamento = isColetado;
          return (
          <div className="flex-shrink-0 flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <Checkbox
                checked={collectionStatus?.pedidoColeta || false}
                onCheckedChange={(checked) => onToggleCollection(order.pedido, "pedidoColeta", !!checked)}
                className="h-7 w-7 border-2 border-slate-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 rounded-md"
              />
              <span className="text-[11px] font-medium text-slate-600">Ped. Coleta</span>
            </label>

            {/* Transportadora selector - between Ped. Coleta and Coletado */}
            {onChangeTransportadora && (
              <div className="w-36 flex-shrink-0 flex justify-center">
                <Select value={transportadora || ""} onValueChange={(val) => onChangeTransportadora(order.pedido, val)}>
                  <SelectTrigger className="h-9 text-xs px-2.5 border-slate-300 bg-white font-medium">
                    <SelectValue placeholder="Transp." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TRANSPORT_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <label className={`flex items-center gap-1.5 ${canColetado ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'}`}
              title={!canColetado ? 'Preencha Ped. Coleta e Transportadora primeiro' : ''}>
              <Checkbox
                checked={collectionStatus?.coletado || false}
                onCheckedChange={(checked) => canColetado && onToggleCollection(order.pedido, "coletado", !!checked)}
                disabled={!canColetado}
                className="h-7 w-7 border-2 border-slate-300 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600 rounded-md disabled:opacity-40"
              />
              <span className="text-[11px] font-medium text-slate-600">Coletado</span>
            </label>
          </div>
          );
        })()}

        {/* Pickup schedule - date and hour selector (only enabled after Coletado is checked) */}
        {onChangePickupSchedule && (() => {
          const isColetado = collectionStatus?.coletado === true;
          return (
          <div className={`flex-shrink-0 flex items-center gap-1 ${!isColetado ? 'opacity-40 pointer-events-none' : ''}`}
            style={{ width: '160px' }}
            onClick={(e) => e.stopPropagation()}
            title={!isColetado ? 'Marque Coletado primeiro' : ''}>
            <input
              type="date"
              value={pickupSchedule?.pickupDate ? pickupSchedule.pickupDate.split('/').reverse().join('-') : ''}
              onChange={(e) => {
                const val = e.target.value;
                if (val) {
                  const [y, m, d] = val.split('-');
                  const formatted = `${d}/${m}/${y}`;
                  onChangePickupSchedule(order.pedido, formatted, pickupSchedule?.pickupHour ?? 8);
                } else if (onClearPickupSchedule) {
                  onClearPickupSchedule(order.pedido);
                }
              }}
              className="h-8 w-[95px] text-[10px] border border-slate-300 rounded px-1 bg-white"
            />
            <select
              value={pickupSchedule?.pickupHour ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'clear' && onClearPickupSchedule) {
                  onClearPickupSchedule(order.pedido);
                  return;
                }
                const hour = Number(val);
                if (pickupSchedule?.pickupDate) {
                  onChangePickupSchedule(order.pedido, pickupSchedule.pickupDate, hour);
                } else {
                  const today = new Date();
                  const d = String(today.getDate()).padStart(2, '0');
                  const m = String(today.getMonth() + 1).padStart(2, '0');
                  const y = today.getFullYear();
                  onChangePickupSchedule(order.pedido, `${d}/${m}/${y}`, hour);
                }
              }}
              className="h-8 w-[50px] text-[10px] border border-slate-300 rounded px-0.5 bg-white"
            >
              <option value="" disabled>Hr</option>
              {pickupSchedule && (
                <option value="clear" className="text-red-500">✕ Limpar</option>
              )}
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
              ))}
            </select>
          </div>
          );
        })()}

        {/* Tracking link inline input - visible for all in Faturados */}
        {(trackingLink !== undefined || onSetTrackingLink) && (
          <div className="flex-shrink-0" style={{ width: '180px' }} onClick={(e) => e.stopPropagation()}>
            {onSetTrackingLink ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={editingTracking ? trackingInput : (trackingLink?.trackingUrl || "")}
                  placeholder="Inserir link de rastreio"
                  className="w-full text-[10px] px-2 py-1.5 rounded border border-slate-200 bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none transition-all placeholder:text-slate-300"
                  onFocus={() => {
                    if (!editingTracking) {
                      setEditingTracking(true);
                      setTrackingInput(trackingLink?.trackingUrl || "");
                    }
                  }}
                  onChange={(e) => {
                    setEditingTracking(true);
                    setTrackingInput(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && editingTracking) {
                      onSetTrackingLink(order.pedido, trackingInput);
                      setEditingTracking(false);
                    }
                    if (e.key === 'Escape') {
                      setEditingTracking(false);
                      setTrackingInput("");
                    }
                  }}
                  onBlur={() => {
                    if (editingTracking && trackingInput !== (trackingLink?.trackingUrl || "")) {
                      onSetTrackingLink(order.pedido, trackingInput);
                    }
                    setEditingTracking(false);
                  }}
                />
                {trackingLink?.trackingUrl && !editingTracking && (
                  <a
                    href={trackingLink.trackingUrl.startsWith('http') ? trackingLink.trackingUrl : `https://${trackingLink.trackingUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 rounded hover:bg-indigo-50 text-indigo-500 flex-shrink-0"
                    title="Abrir link"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            ) : trackingLink?.trackingUrl ? (
              <a
                href={trackingLink.trackingUrl.startsWith('http') ? trackingLink.trackingUrl : `https://${trackingLink.trackingUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-indigo-600 hover:text-indigo-800 underline truncate block px-2"
                title={trackingLink.trackingUrl}
              >
                {trackingLink.trackingUrl}
              </a>
            ) : (
              <span className="text-[10px] text-slate-300 px-2">—</span>
            )}
          </div>
        )}

        {/* Items count + total volumes */}
        <div style={{ width: showValues ? '70px' : '80px' }} className="flex-shrink-0 text-center">
          <span className="text-xs text-slate-400">{order.itens.length} {order.itens.length === 1 ? "item" : "itens"}</span>
          <div className={`font-bold ${showValues ? 'text-sm' : 'text-base'} text-slate-700`}>
            {Math.round(order.itens.reduce((sum, i) => sum + i.quantidade, 0))} vol.
          </div>
        </div>

        {/* Value - smaller, secondary */}
        {showValues && (
          <div style={{ width: '90px' }} className="flex-shrink-0 text-right">
            <span className="text-sm text-slate-500">{formatCurrencyFull(order.valorTotal)}</span>
          </div>
        )}

        {/* PDF button - only in Pedidos em Aberto */}
        {showPrint && (
          <div style={{ width: '36px' }} className="flex-shrink-0 flex justify-center">
            <button
              onClick={(e) => {
                e.stopPropagation();
                generateOrderPdf({
                  ...order,
                  nfs: nfs || undefined,
                  etapa: "Em Aberto",
                }, showValues ?? true).catch(console.error);
              }}
              className="p-1.5 rounded-lg hover:bg-teal-100 text-slate-400 hover:text-teal-600 transition-all group"
              title="Gerar PDF do pedido"
            >
              <Printer className={`${showValues ? 'w-4 h-4' : 'w-5 h-5'} group-hover:scale-110 transition-transform`} />
            </button>
          </div>
        )}

        {/* Production Status Badge/Selector - only in Pedidos em Aberto */}
        {onChangeProductionStatus && (
          <div className="flex-shrink-0" style={{ width: '140px' }} onClick={(e) => e.stopPropagation()}>
            <Select
              value={productionStatusValue || "sem_status"}
              onValueChange={(val) => {
                onChangeProductionStatus(order.pedido, val === "sem_status" ? "" : val);
              }}
            >
              <SelectTrigger className={`h-7 text-[10px] font-semibold border rounded-full px-2 gap-1 w-full ${
                productionStatusValue && getStatusOption(productionStatusValue)
                  ? getStatusOption(productionStatusValue)!.color
                  : "bg-slate-50 text-slate-400 border-slate-200"
              }`}>
                <div className="flex items-center truncate">
                  <SelectValue placeholder="Status" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sem_status">
                  <span className="text-slate-400">Sem status</span>
                </SelectItem>
                {PRODUCTION_STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span>{opt.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>



      {/* Expanded items */}
      {expanded && (
        <div className="bg-white border-t-0 rounded-b-xl overflow-hidden">
          {/* Observações banner — same style as ProductionAcceptanceCard */}
          {order.observacoes && order.observacoes.trim() !== "" && (
            <div className="px-4 pl-12 py-3 bg-amber-50 border-b-2 border-amber-300">
              <div className="flex items-start gap-2.5">
                <div className="flex-shrink-0 mt-0.5">
                  <div className="w-7 h-7 rounded-full bg-amber-400 flex items-center justify-center">
                    <MessageSquare className="w-3.5 h-3.5 text-white" />
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

          {/* Production note banner — blue theme */}
          {productionNote && productionNote.trim() !== "" && (
            <div className="px-4 pl-12 py-3 bg-blue-50 border-b-2 border-blue-300">
              <div className="flex items-start gap-2.5">
                <div className="flex-shrink-0 mt-0.5">
                  <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center">
                    <StickyNote className="w-3.5 h-3.5 text-white" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">Observação da Produção</span>
                    <div className="h-px flex-1 bg-blue-200" />
                    {onOpenProductionNote && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onOpenProductionNote(order.pedido); }}
                        className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 transition-colors"
                      >
                        <Pencil className="w-3 h-3" />
                        Editar
                      </button>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-blue-900 whitespace-pre-line leading-relaxed">
                    {productionNote}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Billing observation — for Autorizado a Faturar */}
          {onSetBillingObservation && (
            <BillingObservationSection
              pedido={order.pedido}
              observation={billingObservation}
              onSetObservation={onSetBillingObservation}
            />
          )}

          {/* Info grid — same 4-col layout as ProductionAcceptanceCard */}
          <div className="px-4 pl-12 py-3 bg-slate-50/40 border-b border-slate-100">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white rounded-lg border border-slate-100 px-3 py-2">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Representante</p>
                <p className="text-sm font-medium text-slate-700 mt-0.5">{order.representante || "—"}</p>
              </div>
              <div className="bg-white rounded-lg border border-slate-100 px-3 py-2">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Segmento</p>
                <p className="text-sm font-medium text-slate-700 mt-0.5">{order.segmento || order.crmSegmento || "—"}</p>
              </div>
              <div className="bg-white rounded-lg border border-slate-100 px-3 py-2">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Cond. Pagamento</p>
                <p className="text-sm font-medium text-slate-700 mt-0.5">{order.condicaoPagamento ? `${order.condicaoPagamento} dias` : "—"}</p>
              </div>
              <div className="bg-white rounded-lg border border-slate-100 px-3 py-2">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Transportadora</p>
                <p className="text-sm font-medium text-slate-700 mt-0.5">{order.transportadora || "—"}</p>
              </div>
            </div>
          </div>

          {/* NF details section — only for Faturados */}
          {showNf && nfs && nfs.length > 0 && (
            <div className="px-4 py-3 pl-12 bg-teal-50/50 border-b border-teal-100">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-teal-600" />
                <span className="text-xs font-semibold text-teal-700 uppercase tracking-wide">
                  {nfs.length === 1 ? "Nota Fiscal Vinculada" : `${nfs.length} Notas Fiscais Vinculadas`}
                </span>
              </div>
              <div className="space-y-2">
                {nfs.map((nf, idx) => (
                  <div key={idx} className="bg-white rounded-lg border border-teal-200 px-4 py-2.5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div>
                          <span className="text-sm font-bold text-teal-700">NF {nf.numero}</span>
                          <span className="text-xs text-slate-400 ml-1">Série {nf.serie}</span>
                        </div>
                        <div className="text-xs text-slate-500">
                          {formatDateBR(nf.emissaoData)}
                        </div>
                      </div>

                    </div>
                    {nf.chaveDeAcesso && (
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 font-mono tracking-wider">
                          {nf.chaveDeAcesso}
                        </span>
                        <CopyButton text={nf.chaveDeAcesso} label="chave de acesso" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tracking link section — visible for all in Faturados, editable with fat.rastreio permission */}
          {(trackingLink !== undefined || onSetTrackingLink) && (
            <div className="px-4 pl-12 py-3 bg-indigo-50/50 border-b border-indigo-200" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2 mb-2">
                <ExternalLink className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Link de Rastreio</span>
                <div className="h-px flex-1 bg-indigo-200" />
                {onSetTrackingLink && trackingLink?.trackingUrl && !editingTracking && (
                  <button
                    onClick={() => { setEditingTracking(true); setTrackingInput(trackingLink.trackingUrl); }}
                    className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 transition-colors"
                  >
                    <Pencil className="w-3 h-3" />
                    Editar
                  </button>
                )}
              </div>
              {onSetTrackingLink && editingTracking ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={trackingInput}
                    onChange={(e) => setTrackingInput(e.target.value)}
                    placeholder="Cole o link de rastreio aqui..."
                    className="h-8 text-sm flex-1 bg-white border-indigo-300 focus:ring-indigo-400"
                    autoFocus
                  />
                  <Button
                    size="sm"
                    onClick={() => { onSetTrackingLink(order.pedido, trackingInput); setEditingTracking(false); }}
                    className="bg-indigo-500 hover:bg-indigo-600 text-white text-xs h-8 px-3"
                  >
                    <Save className="w-3 h-3 mr-1" /> Salvar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setEditingTracking(false); setTrackingInput(''); }}
                    className="text-xs h-8 px-3"
                  >
                    Cancelar
                  </Button>
                  {trackingLink?.trackingUrl && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { onSetTrackingLink(order.pedido, ''); setEditingTracking(false); setTrackingInput(''); }}
                      className="text-xs h-8 px-3 text-red-500 hover:text-red-700 border-red-200 hover:border-red-300"
                    >
                      <X className="w-3 h-3 mr-1" /> Remover
                    </Button>
                  )}
                </div>
              ) : trackingLink?.trackingUrl ? (
                <div className="flex items-center gap-2">
                  <a
                    href={trackingLink.trackingUrl.startsWith('http') ? trackingLink.trackingUrl : `https://${trackingLink.trackingUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-indigo-700 font-medium hover:text-indigo-900 underline underline-offset-2 break-all"
                  >
                    {trackingLink.trackingUrl}
                  </a>
                  <CopyButton text={trackingLink.trackingUrl} label="link de rastreio" />
                  {onSetTrackingLink && (
                    <button
                      onClick={() => { setEditingTracking(true); setTrackingInput(trackingLink.trackingUrl); }}
                      className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 transition-colors ml-2"
                    >
                      <Pencil className="w-3 h-3" />
                      Editar
                    </button>
                  )}
                </div>
              ) : onSetTrackingLink ? (
                <button
                  onClick={() => { setTrackingInput(''); setEditingTracking(true); }}
                  className="flex items-center gap-2 text-xs text-indigo-500 hover:text-indigo-700 font-medium transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Adicionar link de rastreio
                </button>
              ) : (
                <span className="text-xs text-slate-400 italic">Nenhum link de rastreio cadastrado</span>
              )}
            </div>
          )}

          {/* Items table — same header style as ProductionAcceptanceCard */}
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
            <span className="text-sm font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <Package className="w-4 h-4 text-teal-600" />
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
            {/* Somatório de unidades ao final da lista */}
            <div className="px-4 pl-12 py-3 bg-slate-50/80">
              <div className="flex items-center justify-end gap-4">
                <div className="text-right">
                  <div className="border-t-2 border-slate-400 pt-1.5 mt-0.5 pl-8">
                    <span className="text-sm font-bold text-slate-800">
                      Total: {formatNumber(order.itens.reduce((sum, i) => sum + i.quantidade, 0))} un
                    </span>
                    {showValues && (
                      <span className="text-xs text-slate-500 block">
                        {formatCurrencyFull(order.itens.reduce((sum, i) => sum + i.valorTotal, 0))}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- Collapsible Orders Card ---- */
function BillingCard({ title, icon: Icon, orders, borderColor, iconColor, hoverColor, filterBgColor, filterBorderColor, activeFilterColor, invoicesByPedido, showNf, showAuthorize, showDeauthorize, onAuthorize, onDeauthorize, authorizedPedidos, badgeExtra, showValues = true, showPrint = false, productionNotes, onOpenProductionNote, productionStatuses, onChangeProductionStatus, collectionStatuses, onToggleCollection, transportSelections, onChangeTransportadora, pickupSchedules, onChangePickupSchedule, onClearPickupSchedule, billingObservations, onSetBillingObservation, trackingLinks, onSetTrackingLink, authorizedTimes }: {
  title: string;
  icon: React.ElementType;
  orders: BillingOrder[];
  borderColor: string;
  iconColor: string;
  hoverColor: string;
  filterBgColor: string;
  filterBorderColor: string;
  activeFilterColor: string;
  invoicesByPedido?: Record<string, NfInfo[]>;
  showNf?: boolean;
  showAuthorize?: boolean;
  showDeauthorize?: boolean;
  onAuthorize?: (pedido: string) => void;
  onDeauthorize?: (pedido: string) => void;
  authorizedPedidos?: Set<string>;
  badgeExtra?: React.ReactNode;
  showValues?: boolean;
  showPrint?: boolean;
  productionNotes?: Record<string, string>;
  onOpenProductionNote?: (pedido: string) => void;
  productionStatuses?: Record<string, string>;
  onChangeProductionStatus?: (pedido: string, status: string) => void;
  collectionStatuses?: Record<string, { pedidoColeta: boolean; coletado: boolean }>;
  onToggleCollection?: (pedido: string, field: "pedidoColeta" | "coletado", value: boolean) => void;
  transportSelections?: Record<string, string>;
  onChangeTransportadora?: (pedido: string, transportadora: string) => void;
  pickupSchedules?: Record<string, { pickupDate: string; pickupHour: number }>;
  onChangePickupSchedule?: (pedido: string, pickupDate: string, pickupHour: number) => void;
  onClearPickupSchedule?: (pedido: string) => void;
  billingObservations?: Record<string, { observation: string; updatedBy: string | null; updatedAt: Date }>;
  onSetBillingObservation?: (pedido: string, observation: string) => void;
  trackingLinks?: Record<string, { trackingUrl: string; updatedBy: string | null }>;
  onSetTrackingLink?: (pedido: string, trackingUrl: string) => void;
  authorizedTimes?: Record<string, string>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [empresaFilter, setEmpresaFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("entrega");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [activeTab, setActiveTab] = useState<string>("all");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const totalValue = useMemo(() => orders.reduce((sum, o) => sum + o.valorTotal, 0), [orders]);

  // Count how many orders have NFs
  const nfCount = useMemo(() => {
    if (!invoicesByPedido) return 0;
    return orders.filter(o => invoicesByPedido[o.pedido]?.length > 0).length;
  }, [orders, invoicesByPedido]);

  const empresas = useMemo(() => {
    const set = new Set(orders.map(o => o.empresa).filter(Boolean));
    return Array.from(set).sort();
  }, [orders]);

  // Tab entries — same logic as Aceite da Produção
  type GrupoKey = "importacao_revenda" | "industrializacao" | "importacao_mp";
  type TipoEspecial = "AMOSTRA" | "BONIFICACAO" | null;
  const VALID_GRUPO_KEYS: GrupoKey[] = ["importacao_revenda", "industrializacao", "importacao_mp"];
  const makeTabKey = (grupo: GrupoKey, tipo: TipoEspecial) => `${grupo}|${tipo || "normal"}`;
  const getOrderGrupoKey = (order: BillingOrder): GrupoKey => {
    const key = order.grupoKey as GrupoKey;
    if (key && VALID_GRUPO_KEYS.includes(key)) return key;
    return "importacao_revenda";
  };

  const GRUPO_TAB_CONFIG: Record<GrupoKey, { label: string; shortLabel: string; icon: React.ElementType; color: string; bgColor: string; borderColor: string; textColor: string }> = {
    importacao_revenda: { label: "Prod. Importados (Revenda)", shortLabel: "Import. Revenda", icon: Leaf, color: "bg-teal-500", bgColor: "bg-teal-50", borderColor: "border-teal-200", textColor: "text-teal-700" },
    industrializacao: { label: "Industrializados", shortLabel: "Industrializados", icon: Factory, color: "bg-violet-500", bgColor: "bg-violet-50", borderColor: "border-violet-200", textColor: "text-violet-700" },
    importacao_mp: { label: "Matéria-Prima (Importação)", shortLabel: "Matéria-Prima", icon: Package, color: "bg-blue-500", bgColor: "bg-blue-50", borderColor: "border-blue-200", textColor: "text-blue-700" },
  };

  const getTabConfig = (grupo: GrupoKey, tipo: TipoEspecial) => {
    const gc = GRUPO_TAB_CONFIG[grupo];
    if (tipo === "AMOSTRA") return { label: `Amostra ${gc.shortLabel}`, icon: FlaskConical, activeBg: "bg-yellow-500", inactiveBg: "bg-yellow-50", inactiveBorder: "border-yellow-300", inactiveText: "text-yellow-700" };
    if (tipo === "BONIFICACAO") return { label: `Bonif. ${gc.shortLabel}`, icon: Gift, activeBg: "bg-pink-500", inactiveBg: "bg-pink-50", inactiveBorder: "border-pink-300", inactiveText: "text-pink-700" };
    return { label: gc.label, icon: gc.icon, activeBg: gc.color, inactiveBg: "bg-white", inactiveBorder: gc.borderColor, inactiveText: gc.textColor };
  };

  const tabEntries = useMemo(() => {
    const counts: Record<string, { grupo: GrupoKey; tipo: TipoEspecial; orders: BillingOrder[] }> = {};
    for (const order of orders) {
      const grupo = getOrderGrupoKey(order);
      const tipo = order.tipoEspecial || null;
      const key = makeTabKey(grupo, tipo);
      if (!counts[key]) counts[key] = { grupo, tipo, orders: [] };
      counts[key].orders.push(order);
    }
    const sortedEntries: { key: string; grupo: GrupoKey; tipo: TipoEspecial; orders: BillingOrder[] }[] = [];
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
  }, [orders]);

  const filtered = useMemo(() => {
    // Tab filter
    let result: BillingOrder[] = [];
    if (activeTab === "all") {
      result = orders;
    } else {
      const entry = tabEntries.find(e => e.key === activeTab);
      result = entry ? entry.orders : [];
    }

    if (empresaFilter !== "all") {
      result = result.filter(o => o.empresa === empresaFilter);
    }

    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      result = result.filter(o =>
        o.pedido.toLowerCase().includes(s) ||
        o.cliente.toLowerCase().includes(s) ||
        (o.clienteApelido && o.clienteApelido.toLowerCase().includes(s)) ||
        o.uf.toLowerCase().includes(s) ||
        o.representante?.toLowerCase().includes(s) ||
        (invoicesByPedido?.[o.pedido]?.some(nf => nf.numero.includes(s)) ?? false)
      );
    }

    const sorted = [...result].sort((a, b) => {
      // REGRA: Pedidos não coletados sempre no topo (apenas no card Faturados)
      if (collectionStatuses) {
        const aColetado = collectionStatuses[a.pedido]?.coletado === true;
        const bColetado = collectionStatuses[b.pedido]?.coletado === true;
        if (aColetado !== bColetado) {
          return aColetado ? 1 : -1; // não coletados primeiro
        }
      }

      let cmp = 0;
      switch (sortField) {
        case "pedido":
          cmp = Number(a.pedido) - Number(b.pedido);
          break;
        case "cliente": {
          const nameA = a.cliente.toLowerCase();
          const nameB = b.cliente.toLowerCase();
          cmp = nameA.localeCompare(nameB);
          break;
        }
        case "uf":
          cmp = (a.uf || "").localeCompare(b.uf || "");
          break;
        case "data": {
          // Usar data de faturamento (NF) quando disponível, senão data de emissão
          const dateAStr = a.dataFaturamento || a.dataEmissao || "";
          const dateBStr = b.dataFaturamento || b.dataEmissao || "";
          cmp = dateAStr.split("/").reverse().join("-").localeCompare(
            dateBStr.split("/").reverse().join("-")
          );
          break;
        }
        case "entrega": {
          const aDate = a.itens.map(i => i.dataEntregaItem).filter(Boolean).sort()[0] || "";
          const bDate = b.itens.map(i => i.dataEntregaItem).filter(Boolean).sort()[0] || "";
          cmp = aDate.localeCompare(bDate);
          break;
        }
        case "nf": {
          const nfA = invoicesByPedido?.[a.pedido]?.[0]?.numero || "";
          const nfB = invoicesByPedido?.[b.pedido]?.[0]?.numero || "";
          cmp = Number(nfA || 0) - Number(nfB || 0);
          break;
        }
        case "status":
          cmp = (a.estadoItem || "").localeCompare(b.estadoItem || "");
          break;
        case "itens":
          cmp = a.itens.length - b.itens.length;
          break;
        case "valor":
          cmp = a.valorTotal - b.valorTotal;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return sorted;
  }, [orders, searchTerm, empresaFilter, sortField, sortDir, invoicesByPedido, activeTab, tabEntries, collectionStatuses]);

  const filteredTotal = useMemo(() => filtered.reduce((sum, o) => sum + o.valorTotal, 0), [filtered]);

  return (
    <div className={`bg-white rounded-lg border ${borderColor} shadow-sm overflow-hidden`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center justify-between px-5 py-4 ${hoverColor} transition-colors`}
      >
        <div className="flex items-center gap-3">
          <Icon className={`${showValues ? 'w-5 h-5' : 'w-6 h-6'} ${iconColor}`} />
          <h3 className={`font-semibold text-slate-700 uppercase tracking-wide ${showValues ? 'text-sm' : 'text-base'}`}>{title}</h3>
          <Badge variant="outline" className={`${showValues ? 'text-xs' : 'text-sm'}`}>{orders.length} pedidos</Badge>
          {showNf && nfCount > 0 && (
            <Badge className="bg-teal-100 text-teal-700 text-xs border-0">
              <FileText className="w-3 h-3 mr-1" />
              {nfCount} com NF
            </Badge>
          )}
          {orders.filter(o => o.tipoEspecial === "AMOSTRA").length > 0 && (
            <Badge className="bg-yellow-100 text-yellow-700 text-xs border-0">
              <FlaskConical className="w-3 h-3 mr-1" />
              {orders.filter(o => o.tipoEspecial === "AMOSTRA").length} {orders.filter(o => o.tipoEspecial === "AMOSTRA").length === 1 ? "amostra" : "amostras"}
            </Badge>
          )}
          {orders.filter(o => o.tipoEspecial === "BONIFICACAO").length > 0 && (
            <Badge className="bg-pink-100 text-pink-700 text-xs border-0">
              <Gift className="w-3 h-3 mr-1" />
              {orders.filter(o => o.tipoEspecial === "BONIFICACAO").length} bonif.
            </Badge>
          )}
          {badgeExtra}
        </div>
        <div className="flex items-center gap-4">
          {showValues && <span className="text-sm font-bold text-slate-800">{formatCurrencyFull(totalValue)}</span>}
          {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className={`border-t ${filterBorderColor}`}>
          {/* Tabs — identical to Aceite da Produção */}
          <div className={`flex flex-wrap gap-2 px-4 py-3 ${filterBgColor} border-b ${filterBorderColor}`}>
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeTab === "all"
                  ? `${activeFilterColor} text-white shadow-sm`
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              Todos ({orders.length})
            </button>
            {tabEntries.map(entry => {
              const config = getTabConfig(entry.grupo, entry.tipo);
              const TabIcon = config.icon;
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
                  <TabIcon className="w-3.5 h-3.5" />
                  {config.label} ({entry.orders.length})
                </button>
              );
            })}
          </div>

          {/* Search + Filters */}
          <div className={`px-4 py-3 ${filterBgColor} border-b ${filterBorderColor} flex flex-col sm:flex-row gap-2`}>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder={showNf ? "Buscar por pedido, cliente, UF, NF..." : "Buscar por pedido, cliente, UF, representante..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-white h-8 text-sm"
              />
            </div>
            {empresas.length > 1 && (
              <Select value={empresaFilter} onValueChange={setEmpresaFilter}>
                <SelectTrigger className="w-full sm:w-48 bg-white h-8 text-sm">
                  <SelectValue placeholder="Empresa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Empresas</SelectItem>
                  {empresas.map(e => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="flex-shrink-0 flex items-center gap-2">
              <span className={`text-slate-500 ${showValues ? 'text-xs' : 'text-sm font-medium'}`}>{filtered.length} pedidos</span>
              {showValues && <span className="text-sm font-bold text-slate-800">{formatCurrencyFull(filteredTotal)}</span>}
            </div>
          </div>

          {/* Table header + orders with horizontal scroll */}
          <div className="overflow-x-auto">
          <div style={{ minWidth: '1200px' }}>
          <div className="flex items-center gap-0 px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase font-semibold">
            {(showAuthorize || showDeauthorize) && (
              <div className="flex-shrink-0" style={{ width: '120px' }}>
                <span className="text-[10px]">Ação</span>
              </div>
            )}
            <div style={{ width: '20px' }} className="flex-shrink-0" />
            <div style={{ width: showValues ? '170px' : '200px' }} className="flex-shrink-0">
              <span className="text-[10px]">Pedido</span>
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px]">Cliente</span>
            </div>
            {(showAuthorize || !showNf) && (
              <div style={{ width: '80px' }} className="flex-shrink-0 text-center">
                <span className="text-[10px]"></span>
              </div>
            )}
            {showNf && (
              <div style={{ width: '80px' }} className="flex-shrink-0 text-center">
                <span className="text-[10px]">NF</span>
              </div>
            )}
            <div style={{ width: showValues ? '80px' : '90px' }} className="flex-shrink-0 text-center">
              <SortableHeader field="data" label="Emissão" currentSort={sortField} currentDir={sortDir} onSort={handleSort} className="justify-center" />
            </div>
            {authorizedTimes && (
              <div style={{ width: '60px' }} className="flex-shrink-0 text-center">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Horário</span>
              </div>
            )}
            <div style={{ width: showValues ? '90px' : '100px' }} className="flex-shrink-0 text-center">
              <SortableHeader field="entrega" label="Entrega" currentSort={sortField} currentDir={sortDir} onSort={handleSort} className="justify-center" />
            </div>
            {onToggleCollection && (
              <div className="flex-shrink-0 flex items-center gap-3">
                <span className="text-[11px]" style={{ width: '84px' }}>Ped. Coleta</span>
                {onChangeTransportadora && (
                  <span className="text-[11px]" style={{ width: '144px', textAlign: 'center' }}>Transp.</span>
                )}
                <span className="text-[11px]" style={{ width: '74px' }}>Coletado</span>
              </div>
            )}
            {onChangePickupSchedule && (
              <div className="flex-shrink-0 text-center" style={{ width: '160px' }}>
                <span className="text-[11px]">Agendamento</span>
              </div>
            )}
            {trackingLinks && (
              <div className="flex-shrink-0 text-center" style={{ width: '180px' }}>
                <span className="text-[11px]">Rastreio</span>
              </div>
            )}
            <div style={{ width: showValues ? '70px' : '80px' }} className="flex-shrink-0 text-center">
              <span className="text-[10px]">Itens</span>
            </div>
            {showValues && (
              <div style={{ width: '90px' }} className="flex-shrink-0 text-right">
                <span className="text-[10px]">Valor</span>
              </div>
            )}
            {showPrint && (
              <div style={{ width: '36px' }} className="flex-shrink-0" />
            )}
            {showAuthorize && (
              <div className="flex-shrink-0" style={{ width: '140px' }}>
                <span className="text-[10px]">Status</span>
              </div>
            )}
          </div>

          {/* Orders list */}
          <div>
            {filtered.map((order) => (
              <BillingOrderRow
                key={order.pedido}
                order={order}
                nfs={invoicesByPedido?.[order.pedido]}
                showNf={showNf}
                showAuthorize={showAuthorize}
                showDeauthorize={showDeauthorize}
                onAuthorize={onAuthorize}
                onDeauthorize={onDeauthorize}
                isAuthorized={authorizedPedidos?.has(order.pedido)}
                showValues={showValues}
                showPrint={showPrint}
                productionNote={productionNotes?.[order.pedido]}
                onOpenProductionNote={onOpenProductionNote}
                productionStatusValue={productionStatuses?.[order.pedido]}
                onChangeProductionStatus={onChangeProductionStatus}
                collectionStatus={collectionStatuses?.[order.pedido]}
                onToggleCollection={onToggleCollection}
                transportadora={transportSelections?.[order.pedido]}
                onChangeTransportadora={onChangeTransportadora}
                pickupSchedule={pickupSchedules?.[order.pedido]}
                onChangePickupSchedule={onChangePickupSchedule}
                onClearPickupSchedule={onClearPickupSchedule}
                billingObservation={billingObservations?.[order.pedido]}
                onSetBillingObservation={onSetBillingObservation}
                trackingLink={trackingLinks?.[order.pedido]}
                onSetTrackingLink={onSetTrackingLink}
                authorizedTime={authorizedTimes?.[order.pedido]}
              />
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-8 text-slate-400">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhum pedido encontrado</p>
              </div>
            )}
          </div>{/* close orders list */}
          </div>{/* close minWidth inner div */}
          </div>{/* close overflow-x-auto wrapper */}
        </div>
      )}
    </div>
  );
}

/* ---- Main Billing Page ---- */
export default function Billing() {
  const { hasGranularAccess } = useOperator();
  const [empresa, setEmpresa] = useState("all");
  const [showValues, setShowValues] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: "authorize" | "deauthorize" | "accept" | "reject_accept"; pedidos: string[] } | null>(null);

  // Production notes state
  const [prodNoteDialogOpen, setProdNoteDialogOpen] = useState(false);
  const [prodNotePedido, setProdNotePedido] = useState("");

  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.billing.getOverview.useQuery(
    empresa !== "all" ? { empresa } : undefined,
    { refetchInterval: 60000 }
  );

  const openOrders = data?.openOrders || [];
  const billedOrders = data?.billedOrders || [];
  const summary = data?.summary;

  // Get authorized pedidos
  const { data: authData } = trpc.billing.getAuthorizedOrders.useQuery(undefined, { refetchInterval: 60000 });
  const authorizedPedidosSet = useMemo(() => new Set(authData?.authorizedPedidos || []), [authData]);
  const authorizedTimesMap = useMemo(() => authData?.authorizedTimes || {} as Record<string, string>, [authData]);

  // Get accepted pedidos (production acceptance)
  const { data: acceptData } = trpc.billing.getAcceptedOrders.useQuery(undefined, { refetchInterval: 60000 });
  const acceptedPedidosSet = useMemo(() => new Set(acceptData?.acceptedPedidos || []), [acceptData]);
  const modifiedPedidosSet = useMemo(() => new Set(acceptData?.modifiedPedidos || []), [acceptData]);

  // New pedidos - fetch recent "novo_pedido" notifications to highlight new orders
  const { data: newPedidosData } = trpc.notifications.getRecentByType.useQuery(
    { type: "novo_pedido", hours: 24 },
  );
  const newPedidosSet = useMemo(() => {
    const pedidos = new Set<string>();
    if (newPedidosData?.notifications) {
      for (const n of newPedidosData.notifications) {
        const meta = n.metadata as any;
        if (meta?.pedido) pedidos.add(String(meta.pedido));
      }
    }
    return pedidos;
  }, [newPedidosData]);

  // Cleanup billed authorizations on load
  trpc.billing.cleanupBilledAuthorizations.useMutation();

  // Production notes - fetch for all open orders
  const allOpenPedidos = useMemo(() => openOrders.map(o => o.pedido).filter(Boolean), [openOrders]);
  const { data: prodNotesData } = trpc.billing.getProductionNotes.useQuery(
    { pedidos: allOpenPedidos },
    { enabled: allOpenPedidos.length > 0, refetchInterval: 60000 }
  );
  const productionNotesMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (prodNotesData?.notes) {
      for (const [pedido, info] of Object.entries(prodNotesData.notes)) {
        if (info.note) map[pedido] = info.note;
      }
    }
    return map;
  }, [prodNotesData]);

  // Save production note mutation
  const saveProductionNoteMutation = trpc.billing.saveProductionNote.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Observação da produção salva");
        utils.billing.getProductionNotes.invalidate();
        setProdNoteDialogOpen(false);
        setProdNotePedido("");
      } else {
        toast.error(data.error || "Erro ao salvar observação");
      }
    },
    onError: (err) => {
      toast.error("Erro: " + err.message);
    },
  });

  // Production status - fetch for all open orders
  const { data: prodStatusData } = trpc.billing.getProductionStatuses.useQuery(
    { pedidos: allOpenPedidos },
    { enabled: allOpenPedidos.length > 0, refetchInterval: 60000 }
  );
  const productionStatusesMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (prodStatusData?.statuses) {
      for (const [pedido, info] of Object.entries(prodStatusData.statuses)) {
        if (info.status) map[pedido] = info.status;
      }
    }
    return map;
  }, [prodStatusData]);

  // Save production status mutation
  const [statusPasswordDialogOpen, setStatusPasswordDialogOpen] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<{ pedido: string; status: string } | null>(null);

  const saveProductionStatusMutation = trpc.billing.saveProductionStatus.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Status da produção atualizado");
        utils.billing.getProductionStatuses.invalidate();
        setStatusPasswordDialogOpen(false);
        setPendingStatusChange(null);
      } else {
        toast.error(data.error || "Erro ao atualizar status");
      }
    },
    onError: (err) => {
      toast.error("Erro: " + err.message);
    },
  });

  const handleChangeProductionStatus = useCallback((pedido: string, status: string) => {
    setPendingStatusChange({ pedido, status });
    setStatusPasswordDialogOpen(true);
  }, []);

  // ---- Collection Status (Faturados) ----
  const allBilledPedidos = useMemo(() => billedOrders.map(o => o.pedido), [billedOrders]);
  const { data: collectionData } = trpc.billing.getCollectionStatuses.useQuery(
    { pedidos: allBilledPedidos },
    { enabled: allBilledPedidos.length > 0, refetchInterval: 60000 }
  );
  const collectionStatusesMap = useMemo(() => {
    return collectionData?.statuses || {};
  }, [collectionData]);

  const [collectionPasswordDialogOpen, setCollectionPasswordDialogOpen] = useState(false);
  const [pendingCollectionToggle, setPendingCollectionToggle] = useState<{ pedido: string; field: "pedidoColeta" | "coletado"; value: boolean } | null>(null);

  const setCollectionStatusMutation = trpc.billing.setCollectionStatus.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Status de coleta atualizado");
        utils.billing.getCollectionStatuses.invalidate();
        setCollectionPasswordDialogOpen(false);
        setPendingCollectionToggle(null);
      } else {
        toast.error("Erro ao atualizar coleta");
      }
    },
    onError: (err) => {
      toast.error("Erro: " + err.message);
    },
  });

  const handleToggleCollection = useCallback((pedido: string, field: "pedidoColeta" | "coletado", value: boolean) => {
    setPendingCollectionToggle({ pedido, field, value });
    setCollectionPasswordDialogOpen(true);
  }, []);

  // ---- Transport Selection (Faturados) ----
  const { data: transportData } = trpc.billing.getTransportSelections.useQuery(
    { pedidos: allBilledPedidos },
    { enabled: allBilledPedidos.length > 0, refetchInterval: 60000 }
  );
  const transportSelectionsMap = useMemo(() => {
    return (transportData as Record<string, string>) || {};
  }, [transportData]);

  const [transportPasswordDialogOpen, setTransportPasswordDialogOpen] = useState(false);
  const [pendingTransportChange, setPendingTransportChange] = useState<{ pedido: string; transportadora: string } | null>(null);

  const setTransportMutation = trpc.billing.setTransportSelection.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Transportadora atualizada");
        utils.billing.getTransportSelections.invalidate();
        setTransportPasswordDialogOpen(false);
        setPendingTransportChange(null);
      } else {
        toast.error("Erro ao atualizar transportadora");
      }
    },
    onError: (err) => {
      toast.error("Erro: " + err.message);
    },
  });

  const handleChangeTransportadora = useCallback((pedido: string, transportadora: string) => {
    setPendingTransportChange({ pedido, transportadora });
    setTransportPasswordDialogOpen(true);
  }, []);

  // ---- Pickup Schedule (Faturados) ----
  const { data: pickupData } = trpc.billing.getPickupSchedules.useQuery(
    { pedidos: allBilledPedidos },
    { enabled: allBilledPedidos.length > 0, refetchInterval: 60000 }
  );
  const pickupSchedulesMap = useMemo(() => {
    return (pickupData as Record<string, { pickupDate: string; pickupHour: number }>) || {};
  }, [pickupData]);

  const [pickupPasswordDialogOpen, setPickupPasswordDialogOpen] = useState(false);
  const [pendingPickupChange, setPendingPickupChange] = useState<{ pedido: string; pickupDate: string; pickupHour: number; clear?: boolean } | null>(null);

  const setPickupMutation = trpc.billing.setPickupSchedule.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Agendamento atualizado");
        utils.billing.getPickupSchedules.invalidate();
        setPickupPasswordDialogOpen(false);
        setPendingPickupChange(null);
      } else {
        toast.error("Erro ao atualizar agendamento");
      }
    },
    onError: (err) => {
      toast.error("Erro: " + err.message);
    },
  });

  const clearPickupMutation = trpc.billing.clearPickupSchedule.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Agendamento limpo");
        utils.billing.getPickupSchedules.invalidate();
        setPickupPasswordDialogOpen(false);
        setPendingPickupChange(null);
      } else {
        toast.error("Erro ao limpar agendamento");
      }
    },
    onError: (err) => {
      toast.error("Erro: " + err.message);
    },
  });

  const handleChangePickupSchedule = useCallback((pedido: string, pickupDate: string, pickupHour: number) => {
    setPendingPickupChange({ pedido, pickupDate, pickupHour });
    setPickupPasswordDialogOpen(true);
  }, []);

  const handleClearPickupSchedule = useCallback((pedido: string) => {
    setPendingPickupChange({ pedido, pickupDate: '', pickupHour: 0, clear: true });
    setPickupPasswordDialogOpen(true);
  }, []);

  // ---- Billing Observations (Autorizado a Faturar) ----
  const { data: billingObsData } = trpc.billing.getBillingObservations.useQuery(undefined, { refetchInterval: 60000 });
  const billingObservationsMap = useMemo(() => {
    return billingObsData?.observations || {};
  }, [billingObsData]);

  const [obsPasswordDialogOpen, setObsPasswordDialogOpen] = useState(false);
  const [pendingObsChange, setPendingObsChange] = useState<{ pedido: string; observation: string } | null>(null);

  const setBillingObsMutation = trpc.billing.setBillingObservation.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Observação salva");
        utils.billing.getBillingObservations.invalidate();
        setObsPasswordDialogOpen(false);
        setPendingObsChange(null);
      } else {
        toast.error(data.error || "Erro ao salvar observação");
      }
    },
    onError: (err) => {
      toast.error("Erro: " + err.message);
    },
  });

  const handleSetBillingObservation = useCallback((pedido: string, observation: string) => {
    setPendingObsChange({ pedido, observation });
    setObsPasswordDialogOpen(true);
  }, []);

  // ---- Tracking Links (Faturados) ----
  const { data: trackingData } = trpc.billing.getTrackingLinks.useQuery(
    { pedidos: allBilledPedidos },
    { enabled: allBilledPedidos.length > 0, refetchInterval: 60000 }
  );
  const trackingLinksMap = useMemo(() => {
    return (trackingData as Record<string, { trackingUrl: string; updatedBy: string | null }>) || {};
  }, [trackingData]);

  const [trackingPasswordDialogOpen, setTrackingPasswordDialogOpen] = useState(false);
  const [pendingTrackingChange, setPendingTrackingChange] = useState<{ pedido: string; trackingUrl: string } | null>(null);

  const setTrackingMutation = trpc.billing.setTrackingLink.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Link de rastreio atualizado");
        utils.billing.getTrackingLinks.invalidate();
        setTrackingPasswordDialogOpen(false);
        setPendingTrackingChange(null);
      } else {
        toast.error("Erro ao atualizar link de rastreio");
      }
    },
    onError: (err) => {
      toast.error("Erro: " + err.message);
    },
  });

  const handleSetTrackingLink = useCallback((pedido: string, trackingUrl: string) => {
    setPendingTrackingChange({ pedido, trackingUrl });
    setTrackingPasswordDialogOpen(true);
  }, []);

  // Production acceptance mutations
  const acceptMutation = trpc.billing.acceptOrders.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Pedido aceito pela produção");
        utils.billing.getAcceptedOrders.invalidate();
      } else {
        toast.error(data.error || "Erro ao aceitar pedido");
      }
      setPasswordDialogOpen(false);
      setPendingAction(null);
    },
    onError: (err) => {
      toast.error("Erro: " + err.message);
      setPasswordDialogOpen(false);
      setPendingAction(null);
    },
  });

  const rejectAcceptanceMutation = trpc.billing.rejectAcceptance.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Aceite removido");
        utils.billing.getAcceptedOrders.invalidate();
      } else {
        toast.error(data.error || "Erro ao remover aceite");
      }
      setPasswordDialogOpen(false);
      setPendingAction(null);
    },
    onError: (err) => {
      toast.error("Erro: " + err.message);
      setPasswordDialogOpen(false);
      setPendingAction(null);
    },
  });

  // Get pedido numbers from billed orders to fetch their NFs
  const billedPedidos = useMemo(() => billedOrders.map(o => o.pedido).filter(Boolean), [billedOrders]);

  // Fetch NFs for billed orders
  const { data: invoiceData, isLoading: isLoadingNfs } = trpc.billing.getInvoicesForOrders.useQuery(
    { pedidos: billedPedidos },
    { enabled: billedPedidos.length > 0 }
  );

  const invoicesByPedido = invoiceData?.invoicesByPedido || {};

  // Mutations
  const authorizeMutation = trpc.billing.authorizeOrders.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Pedido autorizado para faturamento");
        utils.billing.getAuthorizedOrders.invalidate();
      } else {
        toast.error(data.error || "Erro ao autorizar");
      }
      setPasswordDialogOpen(false);
      setPendingAction(null);
    },
    onError: (err) => {
      toast.error("Erro: " + err.message);
      setPasswordDialogOpen(false);
      setPendingAction(null);
    },
  });

  const deauthorizeMutation = trpc.billing.deauthorizeOrders.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Autorização removida");
        utils.billing.getAuthorizedOrders.invalidate();
      } else {
        toast.error(data.error || "Erro ao remover autorização");
      }
      setPasswordDialogOpen(false);
      setPendingAction(null);
    },
    onError: (err) => {
      toast.error("Erro: " + err.message);
      setPasswordDialogOpen(false);
      setPendingAction(null);
    },
  });

  // Handlers
  const handleAccept = useCallback((pedido: string) => {
    setPendingAction({ type: "accept", pedidos: [pedido] });
    setPasswordDialogOpen(true);
  }, []);

  const handleRejectAcceptance = useCallback((pedido: string) => {
    setPendingAction({ type: "reject_accept", pedidos: [pedido] });
    setPasswordDialogOpen(true);
  }, []);

  const handleAuthorize = useCallback((pedido: string) => {
    setPendingAction({ type: "authorize", pedidos: [pedido] });
    setPasswordDialogOpen(true);
  }, []);

  const handleDeauthorize = useCallback((pedido: string) => {
    setPendingAction({ type: "deauthorize", pedidos: [pedido] });
    setPasswordDialogOpen(true);
  }, []);

  const handleOpenProductionNote = useCallback((pedido: string) => {
    setProdNotePedido(pedido);
    setProdNoteDialogOpen(true);
  }, []);

  const handleSaveProductionNote = useCallback((pedido: string, note: string, password: string) => {
    saveProductionNoteMutation.mutate({ pedido, note, password });
  }, [saveProductionNoteMutation]);

  const handlePasswordConfirm = useCallback((password: string) => {
    if (!pendingAction) return;
    if (pendingAction.type === "authorize") {
      authorizeMutation.mutate({ password, pedidos: pendingAction.pedidos });
    } else if (pendingAction.type === "deauthorize") {
      deauthorizeMutation.mutate({ password, pedidos: pendingAction.pedidos });
    } else if (pendingAction.type === "accept") {
      // Build orderHashes map from current order data
      const orderHashes: Record<string, string> = {};
      for (const pedidoNum of pendingAction.pedidos) {
        const order = openOrders.find(o => o.pedido === pedidoNum);
        if (order?.orderHash) {
          orderHashes[pedidoNum] = order.orderHash;
        }
      }
      acceptMutation.mutate({ password, pedidos: pendingAction.pedidos, orderHashes });
    } else if (pendingAction.type === "reject_accept") {
      rejectAcceptanceMutation.mutate({ password, pedidos: pendingAction.pedidos });
    }
  }, [pendingAction, authorizeMutation, deauthorizeMutation]);

  // Fluxo EXCLUSIVO: Aceite → Em Aberto → Autorizado → Faturado
  // Cada pedido só pode estar em UMA etapa por vez
  const { pendingAcceptanceOrders, pureOpenOrders, authorizedOrders } = useMemo(() => {
    const pendingAcceptance: BillingOrder[] = [];
    const pureOpen: BillingOrder[] = [];
    const authorized: BillingOrder[] = [];
    for (const order of openOrders) {
      // Pedidos modificados no Maxiprod voltam para Aceite da Produção
      if (modifiedPedidosSet.has(order.pedido)) {
        pendingAcceptance.push(order);
      } else if (authorizedPedidosSet.has(order.pedido)) {
        // Etapa 3: Autorizado a faturar
        authorized.push(order);
      } else if (acceptedPedidosSet.has(order.pedido)) {
        // Etapa 2: Aceito pela produção, aguardando autorização (Em Aberto)
        pureOpen.push(order);
      } else {
        // Etapa 1: Pendente de aceite da produção
        pendingAcceptance.push(order);
      }
    }
    return { pendingAcceptanceOrders: pendingAcceptance, pureOpenOrders: pureOpen, authorizedOrders: authorized };
  }, [openOrders, authorizedPedidosSet, acceptedPedidosSet, modifiedPedidosSet]);

  // KPI values
  const authorizedValue = useMemo(() => authorizedOrders.reduce((sum, o) => sum + o.valorTotal, 0), [authorizedOrders]);
  const pureOpenValue = useMemo(() => pureOpenOrders.reduce((sum, o) => sum + o.valorTotal, 0), [pureOpenOrders]);

  // Extract unique empresas from all orders
  const empresas = useMemo(() => {
    const all = [...openOrders, ...billedOrders];
    const set = new Set(all.map(o => o.empresa).filter(Boolean));
    return Array.from(set).sort();
  }, [openOrders, billedOrders]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <TopNav
        rightContent={
          <div className="flex items-center gap-2">
            {empresas.length > 1 && (
              <Select value={empresa} onValueChange={setEmpresa}>
                <SelectTrigger className="w-48 bg-white h-8 text-sm">
                  <SelectValue placeholder="Empresa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Empresas</SelectItem>
                  {empresas.map(e => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        }
      />
      <main className="container py-6 space-y-6">
        {/* Titulo */}
        <div className="text-center py-2">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            <span className="text-slate-700">Dashboard de Faturamento</span>
            <span className="text-teal-600 ml-2">Grupo Fox</span>
          </h2>
          <p className="text-sm text-slate-400 mt-1.5 tracking-widest uppercase">Pedidos em Aberto e Faturados</p>
        </div>

        <ConnectionStatusCard />

        {isLoading ? (
          <div className="text-center py-20">
            <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-teal-500" />
            <p className="text-slate-500">Carregando dados de faturamento...</p>
          </div>
        ) : !summary ? (
          <div className="text-center py-20">
            <BarChart3 className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <p className="text-lg font-medium text-slate-500">Nenhum dado de faturamento disponivel</p>
            <p className="text-sm text-slate-400 mt-1">Sincronize os dados do Maxiprod para ver o faturamento</p>
          </div>
        ) : (
          <>
            {/* Toggle valores + KPIs */}
            <div className="flex justify-end">
              {hasGranularAccess("fat.toggleValores") && <Button
                variant="outline"
                onClick={() => setShowValues(!showValues)}
                className={`h-10 px-5 gap-2 text-sm font-semibold transition-all ${
                  showValues
                    ? "bg-teal-50 border-teal-300 text-teal-700 hover:bg-teal-100"
                    : "bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200"
                }`}
                title={showValues ? "Ocultar valores monetários" : "Mostrar valores monetários"}
              >
                {showValues ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                {showValues ? "Valores Visíveis" : "Valores Ocultos"}
              </Button>}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KPICard
                label="Aceite da Produção"
                value={formatCurrencyFull(pendingAcceptanceOrders.reduce((sum, o) => sum + o.valorTotal, 0))}
                sub={`${pendingAcceptanceOrders.length} pedidos`}
                icon={ClipboardCheck}
                theme="cyan"
                showValues={showValues}
              />
              <KPICard
                label="Em Aberto (A Faturar)"
                value={formatCurrencyFull(pureOpenValue)}
                sub={`${pureOpenOrders.length} pedidos`}
                icon={Clock}
                theme="orange"
                showValues={showValues}
              />
              <KPICard
                label="Autorizado a Faturar"
                value={formatCurrencyFull(authorizedValue)}
                sub={`${authorizedOrders.length} pedidos`}
                icon={ShieldCheck}
                theme="amber"
                showValues={showValues}
              />
              <KPICard
                label="Faturado (Últ. 30 dias)"
                value={formatCurrencyFull(summary.billedValue)}
                sub={`${summary.billedCount} pedidos`}
                icon={FileCheck}
                theme="emerald"
                showValues={showValues}
              />
            </div>

            {/* Card 0: Aceite da Produção */}
            <ProductionAcceptanceCard
              orders={pendingAcceptanceOrders}
              acceptedPedidos={acceptedPedidosSet}
              modifiedPedidos={modifiedPedidosSet}
              newPedidos={newPedidosSet}
              onAccept={hasGranularAccess("fat.aceiteProducao") ? handleAccept : () => {}}
              onReject={hasGranularAccess("fat.aceiteProducao") ? handleRejectAcceptance : () => {}}
              showValues={showValues}
              isAccepting={acceptMutation.isPending}
            />

            {/* Card 1: Pedidos em Aberto (todos os abertos não autorizados) */}
            <BillingCard
              title="Pedidos em Aberto"
              icon={ClipboardList}
              orders={pureOpenOrders}
              borderColor="border-orange-200"
              iconColor="text-orange-600"
              hoverColor="hover:bg-orange-50/50"
              filterBgColor="bg-orange-50/30"
              filterBorderColor="border-orange-100"
              activeFilterColor="bg-orange-500"
              showAuthorize={hasGranularAccess("fat.autorizarFaturamento")}
              onAuthorize={hasGranularAccess("fat.autorizarFaturamento") ? handleAuthorize : undefined}
              authorizedPedidos={authorizedPedidosSet}
              showValues={showValues}
              showPrint={hasGranularAccess("fat.imprimirPedido")}
              productionNotes={productionNotesMap}
              onOpenProductionNote={hasGranularAccess("fat.notaProducao") ? handleOpenProductionNote : undefined}
              productionStatuses={productionStatusesMap}
              onChangeProductionStatus={hasGranularAccess("fat.statusProducao") ? handleChangeProductionStatus : undefined}
              billingObservations={hasGranularAccess("fat.observacaoFaturar") ? billingObservationsMap : undefined}
              onSetBillingObservation={hasGranularAccess("fat.observacaoFaturar") ? handleSetBillingObservation : undefined}
            />

            {/* Card 2: Autorizado a Faturar (entre Em Aberto e Faturados) */}
            <BillingCard
              title="Autorizado a Faturar"
              icon={ShieldCheck}
              orders={authorizedOrders}
              borderColor="border-amber-200"
              iconColor="text-amber-600"
              hoverColor="hover:bg-amber-50/50"
              filterBgColor="bg-amber-50/30"
              filterBorderColor="border-amber-100"
              activeFilterColor="bg-amber-500"
                showDeauthorize={hasGranularAccess("fat.desautorizarFaturamento")}
                onDeauthorize={hasGranularAccess("fat.desautorizarFaturamento") ? handleDeauthorize : undefined}
                authorizedPedidos={authorizedPedidosSet}
                showValues={showValues}
                billingObservations={hasGranularAccess("fat.observacaoFaturar") ? billingObservationsMap : undefined}
                onSetBillingObservation={hasGranularAccess("fat.observacaoFaturar") ? handleSetBillingObservation : undefined}
                authorizedTimes={authorizedTimesMap}
                badgeExtra={
                authorizedOrders.length === 0 ? (
                  <span className="text-xs text-slate-400 italic">Nenhum pedido autorizado</span>
                ) : null
              }
            />

            {/* Card 3: Faturados (Últ. 30 dias) - com NFs */}
            {billedOrders.length > 0 && (
              <BillingCard
                title="Faturados (Últ. 30 dias)"
                icon={FileCheck}
                orders={billedOrders}
                borderColor="border-emerald-200"
                iconColor="text-emerald-600"
                hoverColor="hover:bg-emerald-50/50"
                filterBgColor="bg-emerald-50/30"
                filterBorderColor="border-emerald-100"
                activeFilterColor="bg-emerald-500"
                invoicesByPedido={invoicesByPedido}
                showNf={true}
                showValues={showValues}
                collectionStatuses={collectionStatusesMap}
                onToggleCollection={hasGranularAccess("fat.pedidoColeta") || hasGranularAccess("fat.coletado") ? handleToggleCollection : undefined}
                transportSelections={transportSelectionsMap}
                onChangeTransportadora={hasGranularAccess("fat.transportadora") ? handleChangeTransportadora : undefined}
                pickupSchedules={pickupSchedulesMap}
                onChangePickupSchedule={hasGranularAccess("fat.agendamentoColeta") ? handleChangePickupSchedule : undefined}
                onClearPickupSchedule={hasGranularAccess("fat.agendamentoColeta") ? handleClearPickupSchedule : undefined}
                trackingLinks={(hasGranularAccess("fat.verRastreio") || hasGranularAccess("fat.rastreio")) ? trackingLinksMap : undefined}
                onSetTrackingLink={hasGranularAccess("fat.rastreio") ? handleSetTrackingLink : undefined}
                billingObservations={hasGranularAccess("fat.observacaoFaturar") ? billingObservationsMap : undefined}
                onSetBillingObservation={hasGranularAccess("fat.observacaoFaturar") ? handleSetBillingObservation : undefined}
              />
            )}

            {/* Loading NFs indicator */}
            {isLoadingNfs && billedOrders.length > 0 && (
              <div className="text-center py-2">
                <span className="text-xs text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Carregando notas fiscais vinculadas...
                </span>
              </div>
            )}
          </>
        )}
      </main>

      {/* Password Dialog */}
      <PasswordDialog
        open={passwordDialogOpen}
        onOpenChange={setPasswordDialogOpen}
        title={
          pendingAction?.type === "authorize" ? "Autorizar Faturamento" :
          pendingAction?.type === "accept" ? "Aceite da Produção" :
          pendingAction?.type === "reject_accept" ? "Remover Aceite" :
          "Remover Autorização"
        }
        description={
          pendingAction?.type === "authorize"
            ? `Digite a senha para autorizar o pedido #${pendingAction?.pedidos?.[0]} para faturamento.`
            : pendingAction?.type === "accept"
            ? `Digite a senha para aceitar o pedido #${pendingAction?.pedidos?.[0]} na produção.`
            : pendingAction?.type === "reject_accept"
            ? `Digite a senha para remover o aceite do pedido #${pendingAction?.pedidos?.[0]}.`
            : `Digite a senha para remover a autorização do pedido #${pendingAction?.pedidos?.[0]}.`
        }
        onConfirm={handlePasswordConfirm}
        loading={authorizeMutation.isPending || deauthorizeMutation.isPending || acceptMutation.isPending || rejectAcceptanceMutation.isPending}
      />

      {/* Production Note Dialog */}
      <ProductionNoteDialog
        open={prodNoteDialogOpen}
        onOpenChange={setProdNoteDialogOpen}
        pedido={prodNotePedido}
        currentNote={productionNotesMap[prodNotePedido] || ""}
        onSave={handleSaveProductionNote}
        isSaving={saveProductionNoteMutation.isPending}
      />

      {/* Production Status Password Dialog */}
      <PasswordDialog
        open={statusPasswordDialogOpen}
        onOpenChange={(open) => {
          setStatusPasswordDialogOpen(open);
          if (!open) setPendingStatusChange(null);
        }}
        title={`Alterar Status — Pedido #${pendingStatusChange?.pedido || ""}`}
        description={pendingStatusChange?.status
          ? `Definir status como: ${getStatusOption(pendingStatusChange.status)?.label || "Sem status"}`
          : "Remover status do pedido"
        }
        onConfirm={(password) => {
          if (pendingStatusChange) {
            saveProductionStatusMutation.mutate({
              password,
              pedido: pendingStatusChange.pedido,
              status: pendingStatusChange.status,
            });
          }
        }}
        loading={saveProductionStatusMutation.isPending}
      />

      {/* Collection Status Password Dialog */}
      <PasswordDialog
        open={collectionPasswordDialogOpen}
        onOpenChange={(open) => {
          setCollectionPasswordDialogOpen(open);
          if (!open) setPendingCollectionToggle(null);
        }}
        title={`Coleta — Pedido #${pendingCollectionToggle?.pedido || ""}`}
        description={
          pendingCollectionToggle?.field === "pedidoColeta"
            ? (pendingCollectionToggle.value ? "Marcar como pedido de coleta solicitado" : "Desmarcar pedido de coleta")
            : (pendingCollectionToggle?.value ? "Marcar como coletado" : "Desmarcar coletado")
        }
        onConfirm={(password) => {
          if (pendingCollectionToggle) {
            setCollectionStatusMutation.mutate({
              password,
              pedido: pendingCollectionToggle.pedido,
              field: pendingCollectionToggle.field,
              value: pendingCollectionToggle.value,
            });
          }
        }}
        loading={setCollectionStatusMutation.isPending}
      />

      {/* Transport Selection Password Dialog */}
      <PasswordDialog
        open={transportPasswordDialogOpen}
        onOpenChange={(open) => {
          setTransportPasswordDialogOpen(open);
          if (!open) setPendingTransportChange(null);
        }}
        title={`Transportadora — Pedido #${pendingTransportChange?.pedido || ""}`}
        description={`Definir transportadora como: ${TRANSPORT_LABELS[pendingTransportChange?.transportadora || ""] || pendingTransportChange?.transportadora || ""}`}
        onConfirm={(password) => {
          if (pendingTransportChange) {
            setTransportMutation.mutate({
              password,
              pedido: pendingTransportChange.pedido,
              transportadora: pendingTransportChange.transportadora,
            });
          }
        }}
        loading={setTransportMutation.isPending}
      />

      {/* Pickup Schedule Password Dialog */}
      <PasswordDialog
        open={pickupPasswordDialogOpen}
        onOpenChange={(open) => {
          setPickupPasswordDialogOpen(open);
          if (!open) setPendingPickupChange(null);
        }}
        title={`Agendamento — Pedido #${pendingPickupChange?.pedido || ""}`}
        description={pendingPickupChange?.clear
          ? "Limpar agendamento de coleta deste pedido?"
          : `Agendar coleta para: ${pendingPickupChange?.pickupDate || ""} às ${String(pendingPickupChange?.pickupHour ?? 0).padStart(2, '0')}:00`}
        onConfirm={(password) => {
          if (pendingPickupChange) {
            if (pendingPickupChange.clear) {
              clearPickupMutation.mutate({
                password,
                pedido: pendingPickupChange.pedido,
              });
            } else {
              setPickupMutation.mutate({
                password,
                pedido: pendingPickupChange.pedido,
                pickupDate: pendingPickupChange.pickupDate,
                pickupHour: pendingPickupChange.pickupHour,
              });
            }
          }
        }}
        loading={setPickupMutation.isPending || clearPickupMutation.isPending}
      />

      {/* Billing Observation Password Dialog */}
      <PasswordDialog
        open={obsPasswordDialogOpen}
        onOpenChange={(open) => {
          setObsPasswordDialogOpen(open);
          if (!open) setPendingObsChange(null);
        }}
        title={`Campo de Observação — Pedido #${pendingObsChange?.pedido || ""}`}
        description={pendingObsChange?.observation ? "Salvar campo de observação" : "Remover campo de observação"}
        onConfirm={(password) => {
          if (pendingObsChange) {
            setBillingObsMutation.mutate({
              password,
              pedido: pendingObsChange.pedido,
              observation: pendingObsChange.observation,
            });
          }
        }}
        loading={setBillingObsMutation.isPending}
      />

      {/* Tracking Link Password Dialog */}
      <PasswordDialog
        open={trackingPasswordDialogOpen}
        onOpenChange={(open) => {
          setTrackingPasswordDialogOpen(open);
          if (!open) setPendingTrackingChange(null);
        }}
        title={`Link de Rastreio — Pedido #${pendingTrackingChange?.pedido || ""}`}
        description={pendingTrackingChange?.trackingUrl ? "Salvar link de rastreio" : "Remover link de rastreio"}
        onConfirm={(password) => {
          if (pendingTrackingChange) {
            setTrackingMutation.mutate({
              password,
              pedido: pendingTrackingChange.pedido,
              trackingUrl: pendingTrackingChange.trackingUrl,
            });
          }
        }}
        loading={setTrackingMutation.isPending}
      />
    </div>
  );
}
