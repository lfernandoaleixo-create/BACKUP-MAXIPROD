import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useOperator } from "@/contexts/OperatorContext";
import { useDiscountAlerts } from "@/contexts/DiscountAlertContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { trpc } from "@/lib/trpc";
import {
  Building2,
  Landmark,
  Search,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Clock,
  X,
  TrendingUp,
  Calendar,
  CheckSquare,
  Square,
  MinusSquare,
  FileDown,
  Filter,
  CreditCard,
  Banknote,
  Wallet,
  CircleDollarSign,
  Sparkles,
  ExternalLink,
  FileText,
  ClipboardList,
  Eye,
  History,
  Lock,
  CheckCircle2,
  ShieldCheck,
  Pencil,
  DollarSign,
  CalendarRange,
  MessageCircle,
  Send,
  ChevronUp,
  Receipt,
  HandCoins,
  Timer,
  Building,
  RotateCcw,
  Ban,
  Scissors,
  Info,
  Layers,
  Loader2,
  Calculator,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import MaxiprodAutoVerifier from "@/components/MaxiprodAutoVerifier";
import DiscountHistoryPanel from "@/components/DiscountHistoryPanel";


/* ---- Helpers ---- */
function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function formatDate(d: string | null) {
  if (!d) return "-";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}
function formatMonth(mes: string) {
  const [y, m] = mes.split("-");
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[parseInt(m) - 1]} ${y}`;
}

function shortBankName(nome: string) {
  if (nome.toUpperCase().includes("SICREDI")) return "Sicredi";
  if (nome.toUpperCase().includes("SICOOB") || nome.toUpperCase().includes("BANCOOB")) return "Sicoob";
  if (nome.toUpperCase().includes("CAIXA")) return "Caixa";
  if (nome.toUpperCase().includes("BRADESCO")) return "Bradesco";
  if (nome.toUpperCase().includes("ITAU") || nome.toUpperCase().includes("ITAÚ")) return "Itaú";
  if (nome.toUpperCase().includes("BANCO DO BRASIL")) return "BB";
  if (nome === "Sem Banco") return "Sem Banco";
  return nome;
}

function shortEmpresaName(nome: string) {
  if (nome.toUpperCase().includes("PALITOS")) return "PALITOS";
  if (nome.toUpperCase().includes("VARETAS")) return "VARETAS";
  if (nome.toUpperCase().includes("ESPETOS")) return "ESPETOS";
  if (nome.toUpperCase().includes("MESA")) return "MESA";
  return nome;
}

/* ---- Maxiprod Contraprova: senhas autorizadas ---- */
const MAXIPROD_AUTHORIZED_OPERATORS = ["Guilherme", "Fernando", "Bruno"];
const MAXIPROD_LOGIN_URL = "https://app.maxiprod.com.br/";

/* ---- PDF Export ---- */
function exportFilteredPDF(
  contaLabel: string,
  filterDescription: string,
  filteredItems: ItemData[],
  filteredTotals: { total: number; vencido: number; aVencer: number; count: number },
  empresaNome: string,
  mesLabel: string,
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageW, 32, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("GRUPO FOX - Relatório de Recebíveis", 14, 14);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`${empresaNome} | ${mesLabel} | ${contaLabel}`, 14, 22);
  doc.text(`Filtro: ${filterDescription} | Gerado em: ${new Date().toLocaleString("pt-BR")}`, 14, 28);

  // Summary boxes
  const y0 = 38;
  const boxW = 60;
  const gap = 8;
  // Total
  doc.setFillColor(8, 145, 178); // cyan-600
  doc.roundedRect(14, y0, boxW, 18, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text("TOTAL FILTRADO", 18, y0 + 6);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(formatCurrency(filteredTotals.total), 18, y0 + 14);
  // Vencido
  doc.setFillColor(220, 38, 38); // red-600
  doc.roundedRect(14 + boxW + gap, y0, boxW, 18, 2, 2, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("VENCIDO", 18 + boxW + gap, y0 + 6);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(formatCurrency(filteredTotals.vencido), 18 + boxW + gap, y0 + 14);
  // A Vencer
  doc.setFillColor(5, 150, 105); // emerald-600
  doc.roundedRect(14 + 2 * (boxW + gap), y0, boxW, 18, 2, 2, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("A VENCER", 18 + 2 * (boxW + gap), y0 + 6);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(formatCurrency(filteredTotals.aVencer), 18 + 2 * (boxW + gap), y0 + 14);
  // Count
  doc.setFillColor(71, 85, 105); // slate-600
  doc.roundedRect(14 + 3 * (boxW + gap), y0, boxW, 18, 2, 2, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("TÍTULOS", 18 + 3 * (boxW + gap), y0 + 6);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(String(filteredTotals.count), 18 + 3 * (boxW + gap), y0 + 14);

  // Table
  const tableData = filteredItems.map(item => [
    item.cliente,
    item.documento ? `Doc ${item.documento}${item.parcela ? ` · ${item.parcela}` : ""}` : "-",
    shortFormaCobranca(item.formaCobranca).label || "-",
    formatCurrency(item.valorAReceber),
    formatDate(item.vencimento),
    item.isOverdue ? "Vencido" : "A vencer",
  ]);

  autoTable(doc, {
    startY: y0 + 24,
    head: [["Cliente", "Documento", "Forma Pgto", "Valor", "Vencimento", "Status"]],
    body: tableData,
    theme: "grid",
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 7.5, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 70 },
      3: { halign: "right", fontStyle: "bold" },
      5: { halign: "center" },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (data: any) => {
      if (data.section === "body" && data.column.index === 5) {
        if (data.cell.raw === "Vencido") {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = "bold";
        } else {
          data.cell.styles.textColor = [5, 150, 105];
        }
      }
    },
  });

  const fileName = `Recebiveis_${empresaNome.replace(/\s+/g, "_")}_${mesLabel.replace(/\s+/g, "_")}_${filterDescription.replace(/\s+/g, "_")}.pdf`;
  doc.save(fileName);
}

/* ---- Maxiprod Contraprova Modal ---- */
function MaxiprodVerifyModal({
  onClose,
  section,
  context,
}: {
  onClose: () => void;
  section: "recebiveis" | "faturamento" | "vendas" | "entradas" | "contas_pagas";
  context: {
    empresa?: string;
    mes?: string;
    contaLabel?: string;
    formaCobranca?: string;
    statusFilter?: string;
    periodStart?: string;
    periodEnd?: string;
    valorManus?: number;
  };
}) {
  const steps = useMemo(() => {
    const baseSteps: { step: number; text: string; highlight?: boolean }[] = [];
    let n = 1;

    baseSteps.push({ step: n++, text: `Acesse o Maxiprod: app.maxiprod.com.br` });
    baseSteps.push({ step: n++, text: `Login: lfernandoaleixo@gmail.com | Senha: Luizfernando7008*` });

    if (section === "recebiveis") {
      baseSteps.push({ step: n++, text: `Vá em: Financeiro → Contas a receber` });
      baseSteps.push({ step: n++, text: `Estado: marque apenas "A receber"` });
      if (context.mes) {
        const [y, m] = context.mes.split("-");
        const lastDay = new Date(Number(y), Number(m), 0).getDate();
        baseSteps.push({ step: n++, text: `Vencimento: 01/${m}/${y} a ${lastDay}/${m}/${y}` });
      }
      if (context.empresa) {
        baseSteps.push({ step: n++, text: `Empresa: selecione "${context.empresa}"` });
      }
      if (context.formaCobranca && context.formaCobranca !== "TODOS") {
        baseSteps.push({ step: n++, text: `Forma de cobrança: selecione "${context.formaCobranca}"` });
      }
      if (context.contaLabel) {
        const bankMatch = context.contaLabel.match(/^(\w+)/);
        if (bankMatch) {
          baseSteps.push({ step: n++, text: `Banco: filtre por "${bankMatch[1]}" e a conta correspondente` });
        }
      }
      baseSteps.push({ step: n++, text: `Clique em "Ocultar filtros" para ver o total no rodapé da tabela` });
      if (context.valorManus !== undefined) {
        baseSteps.push({ step: n++, text: `Compare o total do Maxiprod com o valor da Manus: ${formatCurrency(context.valorManus)}`, highlight: true });
      }
    } else if (section === "faturamento") {
      baseSteps.push({ step: n++, text: `Vá em: Notas Fiscais → Notas Fiscais de Saída` });
      if (context.periodStart && context.periodEnd) {
        const [sy, sm, sd] = context.periodStart.split("-");
        const [ey, em, ed] = context.periodEnd.split("-");
        baseSteps.push({ step: n++, text: `Emissão: ${sd}/${sm}/${sy} a ${ed}/${em}/${ey}` });
      }
      baseSteps.push({ step: n++, text: `Estado: apenas "Emitida"` });
      baseSteps.push({ step: n++, text: `IMPORTANTE: Exclua manualmente NFs com estado configurável: Amostra, Bonificação, Devolução, Remessa, Recusa, Transferência, Cancelado`, highlight: true });
      baseSteps.push({ step: n++, text: `Tipo: apenas "Saída"` });
      if (context.valorManus !== undefined) {
        baseSteps.push({ step: n++, text: `Compare o total com o valor da Manus: ${formatCurrency(context.valorManus)}`, highlight: true });
      }
    } else if (section === "vendas") {
      baseSteps.push({ step: n++, text: `Vá em: Vendas → Pedidos de Venda` });
      if (context.periodStart && context.periodEnd) {
        const [sy, sm, sd] = context.periodStart.split("-");
        const [ey, em, ed] = context.periodEnd.split("-");
        baseSteps.push({ step: n++, text: `Data do pedido: ${sd}/${sm}/${sy} a ${ed}/${em}/${ey}` });
      }
      baseSteps.push({ step: n++, text: `Exclua pedidos com estado: Cancelado` });
      if (context.valorManus !== undefined) {
        baseSteps.push({ step: n++, text: `Compare o total com o valor da Manus: ${formatCurrency(context.valorManus)}`, highlight: true });
      }
    } else if (section === "entradas") {
      baseSteps.push({ step: n++, text: `Vá em: Financeiro → Contas a receber` });
      baseSteps.push({ step: n++, text: `Estado: marque apenas "Recebidos"` });
      if (context.periodStart && context.periodEnd) {
        const [sy, sm, sd] = context.periodStart.split("-");
        const [ey, em, ed] = context.periodEnd.split("-");
        baseSteps.push({ step: n++, text: `Liquidação: ${sd}/${sm}/${sy} a ${ed}/${em}/${ey}` });
      }
      baseSteps.push({ step: n++, text: `NOTA: O dashboard exclui transferências entre empresas do grupo (Palitos Fox, Mesa Indust, Bambusa, Espetos Ind, Varetas)`, highlight: true });
      if (context.valorManus !== undefined) {
        baseSteps.push({ step: n++, text: `Compare o total com o valor da Manus: ${formatCurrency(context.valorManus)}`, highlight: true });
      }
    } else if (section === "contas_pagas") {
      baseSteps.push({ step: n++, text: `Vá em: Financeiro → Contas a pagar` });
      baseSteps.push({ step: n++, text: `Estado: marque apenas "Pagos"` });
      if (context.periodStart && context.periodEnd) {
        const [sy, sm, sd] = context.periodStart.split("-");
        const [ey, em, ed] = context.periodEnd.split("-");
        baseSteps.push({ step: n++, text: `Liquidação: ${sd}/${sm}/${sy} a ${ed}/${em}/${ey}` });
      }
      baseSteps.push({ step: n++, text: `Exclua contas com estado: Cancelado` });
      if (context.valorManus !== undefined) {
        baseSteps.push({ step: n++, text: `Compare o total com o valor da Manus: ${formatCurrency(context.valorManus)}`, highlight: true });
      }
    }

    return baseSteps;
  }, [section, context]);

  const sectionLabels: Record<string, string> = {
    recebiveis: "Contas a Receber",
    faturamento: "Faturamento (NFs de Saída)",
    vendas: "Pedidos de Venda",
    entradas: "Entradas (Recebimentos)",
    contas_pagas: "Contas a Pagar",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                <Eye className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold text-base">Contraprova Maxiprod</h3>
                <p className="text-indigo-300 text-xs">{sectionLabels[section]}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          {context.valorManus !== undefined && (
            <div className="mt-3 px-4 py-2.5 bg-white/10 rounded-lg border border-white/20">
              <span className="text-indigo-300 text-xs">Valor na Manus:</span>
              <span className="ml-2 text-white font-bold text-lg" style={{ textShadow: "0 0 15px rgba(34,211,238,0.4)" }}>
                {formatCurrency(context.valorManus)}
              </span>
            </div>
          )}
        </div>

        {/* Steps */}
        <div className="px-6 py-5 max-h-[50vh] overflow-y-auto space-y-2.5">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <ClipboardList className="w-4 h-4" />
            Passo a passo para verificação
          </div>
          {steps.map(s => (
            <div key={s.step} className={`flex items-start gap-3 p-3 rounded-lg transition-all ${
              s.highlight ? "bg-amber-50 border-2 border-amber-300 shadow-sm" : "bg-slate-50 dark:bg-slate-800/50 border border-slate-200"
            }`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                s.highlight ? "bg-amber-500 text-white shadow-md shadow-amber-500/30" : "bg-indigo-600 text-white"
              }`}>
                {s.step}
              </div>
              <p className={`text-sm leading-relaxed pt-0.5 ${
                s.highlight ? "text-amber-800 font-semibold" : "text-slate-700"
              }`}>
                {s.text}
              </p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 flex items-center justify-between">
          <a
            href={MAXIPROD_LOGIN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-bold shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all hover:scale-[1.02]"
          >
            <ExternalLink className="w-4 h-4" />
            Abrir Maxiprod
          </a>
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 font-medium">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

const EMPRESA_COLORS: Record<string, { bg: string; border: string; text: string; accent: string; headerBg: string }> = {
  PALITOS: { bg: "bg-blue-50/60", border: "border-blue-400", text: "text-blue-700", accent: "bg-blue-600", headerBg: "bg-blue-100" },
  VARETAS: { bg: "bg-amber-50/60", border: "border-amber-400", text: "text-amber-700", accent: "bg-amber-600", headerBg: "bg-amber-100" },
  ESPETOS: { bg: "bg-emerald-50/60", border: "border-emerald-400", text: "text-emerald-700", accent: "bg-emerald-600", headerBg: "bg-emerald-100" },
  MESA: { bg: "bg-purple-50/60", border: "border-purple-400", text: "text-purple-700", accent: "bg-purple-600", headerBg: "bg-purple-100" },
};
const DEFAULT_EMPRESA_COLOR = { bg: "bg-slate-50/60", border: "border-slate-400", text: "text-slate-700", accent: "bg-slate-600", headerBg: "bg-slate-100" };

function getEmpresaColor(nome: string) {
  return EMPRESA_COLORS[shortEmpresaName(nome)] || DEFAULT_EMPRESA_COLOR;
}

const BANK_ICONS: Record<string, string> = {
  Sicredi: "text-emerald-600",
  Sicoob: "text-green-600",
  Caixa: "text-sky-600",
  Bradesco: "text-red-600",
  BB: "text-amber-600",
  "Itaú": "text-orange-600",
  "Sem Banco": "text-slate-400",
};

function formatContaNumero(num: string): string {
  if (!num) return "";
  if (num.length >= 9) return num.replace(/(\d{3})(\d{3})(\d{3})/, '$1.$2.$3');
  if (num.length === 5) return num.replace(/(\d{2})(\d{3})/, '$1.$2');
  return num;
}

type ItemData = {
  id: number;
  cliente: string;
  valorAReceber: number;
  valorOriginal: number;
  valorPago: number;
  vencimento: string;
  emissao: string;
  liquidacao: string | null;
  referenteA: string;
  tipo: string;
  estado: string | null;
  parcela: string;
  documento: string;
  empresa: string;
  bancoNome: string;
  contaNumero: string;
  agencia: string;
  isOverdue: boolean;
  formaCobranca: string;
  anotacoes: string;
};

function getFormaCobrancaCategory(desc: string): string {
  if (!desc) return "Outros";
  const d = desc.toUpperCase();
  if (d.startsWith("PIX")) return "PIX";
  if (d.startsWith("BOLETO")) return "Boleto";
  if (d.startsWith("CHEQUE")) return "Cheque";
  if (d.startsWith("DEPÓSITO") || d.startsWith("DEPOSITO")) return "Depósito";
  if (d.startsWith("DINHEIRO")) return "Dinheiro";
  return "Outros";
}

function shortFormaCobranca(desc: string): { label: string; color: string } {
  if (!desc) return { label: "", color: "text-slate-400" };
  const d = desc.toUpperCase();
  if (d.startsWith("PIX")) return { label: "PIX", color: "text-emerald-600" };
  if (d.startsWith("BOLETO")) return { label: "Boleto", color: "text-blue-600" };
  if (d.startsWith("CHEQUE")) return { label: "Cheque", color: "text-amber-600" };
  if (d.startsWith("DEPÓSITO") || d.startsWith("DEPOSITO")) return { label: "Depósito", color: "text-purple-600" };
  if (d.startsWith("DINHEIRO")) return { label: "Dinheiro", color: "text-green-700" };
  const first = desc.split(" ")[0];
  return { label: first.charAt(0).toUpperCase() + first.slice(1).toLowerCase(), color: "text-slate-600" };
}

/* ---- Filter types ---- */
type StatusFilter = "TODOS" | "VENCIDO" | "A_VENCER";
type FormaFilter = "TODOS" | "PIX" | "Boleto" | "Cheque" | "Depósito" | "Dinheiro";

const STATUS_OPTIONS: { value: StatusFilter; label: string; icon: any; color: string; activeBg: string; activeBorder: string; activeText: string; glow: string }[] = [
  { value: "TODOS", label: "Todos", icon: Wallet, color: "text-slate-500", activeBg: "bg-slate-800", activeBorder: "border-slate-600", activeText: "text-white", glow: "shadow-[0_0_12px_rgba(100,116,139,0.4)]" },
  { value: "VENCIDO", label: "Vencidos", icon: AlertTriangle, color: "text-red-500", activeBg: "bg-red-600", activeBorder: "border-red-500", activeText: "text-white", glow: "shadow-[0_0_12px_rgba(239,68,68,0.5)]" },
  { value: "A_VENCER", label: "A Vencer", icon: Clock, color: "text-emerald-500", activeBg: "bg-emerald-600", activeBorder: "border-emerald-500", activeText: "text-white", glow: "shadow-[0_0_12px_rgba(16,185,129,0.5)]" },
];

const FORMA_OPTIONS: { value: FormaFilter; label: string; icon: any; color: string; activeBg: string; activeBorder: string; activeText: string; glow: string }[] = [
  { value: "TODOS", label: "Todos", icon: CreditCard, color: "text-slate-500", activeBg: "bg-slate-800", activeBorder: "border-slate-600", activeText: "text-white", glow: "shadow-[0_0_12px_rgba(100,116,139,0.4)]" },
  { value: "PIX", label: "PIX", icon: Sparkles, color: "text-emerald-600", activeBg: "bg-emerald-600", activeBorder: "border-emerald-500", activeText: "text-white", glow: "shadow-[0_0_12px_rgba(16,185,129,0.5)]" },
  { value: "Boleto", label: "Boleto", icon: Banknote, color: "text-blue-600", activeBg: "bg-blue-600", activeBorder: "border-blue-500", activeText: "text-white", glow: "shadow-[0_0_12px_rgba(59,130,246,0.5)]" },
  { value: "Cheque", label: "Cheque", icon: CreditCard, color: "text-amber-600", activeBg: "bg-amber-600", activeBorder: "border-amber-500", activeText: "text-white", glow: "shadow-[0_0_12px_rgba(217,119,6,0.5)]" },
  { value: "Depósito", label: "Depósito", icon: CircleDollarSign, color: "text-purple-600", activeBg: "bg-purple-600", activeBorder: "border-purple-500", activeText: "text-white", glow: "shadow-[0_0_12px_rgba(147,51,234,0.5)]" },
  { value: "Dinheiro", label: "Dinheiro", icon: Wallet, color: "text-green-700", activeBg: "bg-green-700", activeBorder: "border-green-600", activeText: "text-white", glow: "shadow-[0_0_12px_rgba(21,128,61,0.5)]" },
];

/* ============================================================
   Sub-component: Filters + Premium Card + Table for ONE bank account
   Each bank account gets its own independent filter state
   ============================================================ */
function ContaFiltersAndTable({
  allContaItems,
  contaLabel,
  contaKey,
  selectedIds,
  toggleSelect,
  toggleSelectAll,
  clearSelection,
  expandedItem,
  setExpandedItem,
  empresaNome,
  empresaNomeFull,
  bancoNome,
  contaNumero,
  mesLabel,
  mesKey,
  showHistoryPanel,
  setShowHistoryPanel,
}: {
  allContaItems: ItemData[];
  contaLabel: string;
  contaKey: string;
  selectedIds: Set<number>;
  toggleSelect: (id: number) => void;
  toggleSelectAll: (items: ItemData[]) => void;
  clearSelection: () => void;
  expandedItem: number | null;
  setExpandedItem: (id: number | null) => void;
  empresaNome: string;
  empresaNomeFull: string;
  bancoNome: string;
  contaNumero: string;
  mesLabel: string;
  mesKey: string;
  showHistoryPanel: boolean;
  setShowHistoryPanel: (show: boolean) => void;
}) {
  const { operator } = useOperator();
  const canVerifyMaxiprod = operator && MAXIPROD_AUTHORIZED_OPERATORS.includes(operator.name);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("TODOS");
  const [formaFilter, setFormaFilter] = useState<FormaFilter>("TODOS");

  const hasActiveFilters = statusFilter !== "TODOS" || formaFilter !== "TODOS";

  // Filter items based on local filters
  const filteredItems = useMemo(() => {
    return allContaItems.filter(item => {
      if (statusFilter === "VENCIDO" && !item.isOverdue) return false;
      if (statusFilter === "A_VENCER" && item.isOverdue) return false;
      if (formaFilter !== "TODOS") {
        const cat = getFormaCobrancaCategory(item.formaCobranca);
        if (cat !== formaFilter) return false;
      }
      return true;
    });
  }, [allContaItems, statusFilter, formaFilter]);

  // Compute totals for the filtered items
  const filteredTotals = useMemo(() => {
    let total = 0, vencido = 0, aVencer = 0;
    filteredItems.forEach(i => {
      total += i.valorAReceber;
      if (i.isOverdue) vencido += i.valorAReceber;
      else aVencer += i.valorAReceber;
    });
    return { total, vencido, aVencer, count: filteredItems.length };
  }, [filteredItems]);

  const filterDescription = useMemo(() => {
    const parts: string[] = [];
    if (statusFilter !== "TODOS") parts.push(statusFilter === "VENCIDO" ? "Vencidos" : "A Vencer");
    if (formaFilter !== "TODOS") parts.push(formaFilter);
    return parts.length > 0 ? parts.join(" + ") : "Todos";
  }, [statusFilter, formaFilter]);

  const contaItemIds = filteredItems.map(i => i.id);
  const allContaSelected = contaItemIds.length > 0 && contaItemIds.every(id => selectedIds.has(id));
  const someContaSelected = contaItemIds.some(id => selectedIds.has(id));

  // Selected items within this account
  const selectedContaItems = filteredItems.filter(i => selectedIds.has(i.id));
  const selectedContaTotal = selectedContaItems.reduce((a, b) => a + b.valorAReceber, 0);

  // Finalization with authorized operators (Fernando/Bruno/Flavio)
  const AUTH_PASSWORDS = ["Fernando", "Bruno", "Flavio"];
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const isAuthorizer = operator ? AUTH_PASSWORDS.includes(operator.name) : false;
  const [discountsAuthorized, setDiscountsAuthorized] = useState(false);

  const saveHistoryMutation = trpc.financial.saveDiscountSelection.useMutation({
    onSuccess: () => {
      toast.success("Ticagem finalizada e registrada no histórico!");
      clearSelection();
      historyQuery.refetch();
    },
    onError: () => toast.error("Erro ao salvar histórico"),
  });

  const historyQuery = trpc.financial.getDiscountHistory.useQuery(
    { empresa: empresaNome, contaLabel, mesKey, limit: 20 },
    { enabled: showHistoryPanel }
  );

  function handleFinalize() {
    if (!AUTH_PASSWORDS.includes(passwordInput)) {
      setPasswordError("Senha incorreta");
      return;
    }
    setShowFinalizeDialog(false);
    setPasswordInput("");
    setPasswordError("");
    saveHistoryMutation.mutate({
      operatorName: operator?.name || "Desconhecido",
      empresa: empresaNome,
      contaLabel,
      mesKey,
      totalTitulos: selectedContaItems.length,
      valorTotal: selectedContaTotal,
      titulosJson: JSON.stringify(selectedContaItems.map(i => ({
        cliente: i.cliente, documento: i.documento, valor: i.valorAReceber,
        vencimento: i.vencimento, forma: i.formaCobranca,
      }))),
    });
  }

  function exportSelectedPDF() {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const rows = selectedContaItems.map(i => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:12px">${i.cliente}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:12px;text-align:center">${i.documento || "-"}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:12px;text-align:center">${i.formaCobranca}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:12px;text-align:right;font-weight:600">${formatCurrency(i.valorAReceber)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:12px;text-align:center">${formatDate(i.vencimento)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:12px;text-align:center">${i.isOverdue ? "Vencido" : "A Vencer"}</td>
      </tr>
    `).join("");
    const isAuthorizedExport = discountsAuthorized || isAuthorizer;
    const authBanner = isAuthorizedExport
      ? `<div style="background:#ecfdf5;border:3px solid #10b981;border-radius:12px;padding:24px;margin-bottom:24px;text-align:center">
          <div style="font-size:36px;margin-bottom:8px">&#9989;</div>
          <div style="font-size:24px;font-weight:900;color:#059669;text-transform:uppercase;letter-spacing:2px">AUTORIZADO POR ${operator?.name || "FERNANDO"}</div>
          <div style="font-size:13px;color:#047857;margin-top:6px">Desconto aprovado e autorizado antes da exportação</div>
          <div style="font-size:11px;color:#6b7280;margin-top:4px">Data da autorização: ${new Date().toLocaleString("pt-BR")}</div>
        </div>`
      : `<div style="background:#fef2f2;border:3px solid #ef4444;border-radius:12px;padding:24px;margin-bottom:24px;text-align:center">
          <div style="font-size:36px;margin-bottom:8px">&#10060;</div>
          <div style="font-size:24px;font-weight:900;color:#dc2626;text-transform:uppercase;letter-spacing:2px">NÃO AUTORIZADO</div>
          <div style="font-size:13px;color:#b91c1c;margin-top:6px">Este desconto NÃO foi autorizado por Fernando/Bruno/Flavio antes da exportação</div>
          <div style="font-size:11px;color:#6b7280;margin-top:4px">Exportado em: ${new Date().toLocaleString("pt-BR")}</div>
        </div>`;
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Selecionados para Desconto - ${contaLabel}</title></head><body style="font-family:system-ui;padding:30px">
      <div style="text-align:center;margin-bottom:20px">
        <h2 style="color:#0f766e;margin:0">Selecionados para Desconto</h2>
        <p style="color:#64748b;font-size:13px">${empresaNome} - ${contaLabel} - ${mesLabel}</p>
        <p style="color:#64748b;font-size:12px">Gerado em ${new Date().toLocaleString("pt-BR")}</p>
      </div>
      ${authBanner}
      <div style="background:#f0fdfa;border:2px solid #14b8a6;border-radius:8px;padding:16px;margin-bottom:20px;text-align:center">
        <div style="font-size:12px;color:#0f766e;text-transform:uppercase;font-weight:700">Valor Total Selecionado</div>
        <div style="font-size:28px;font-weight:800;color:#0f766e">${formatCurrency(selectedContaTotal)}</div>
        <div style="font-size:12px;color:#64748b">${selectedContaItems.length} título(s)</div>
      </div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px">
        <thead><tr style="background:#f1f5f9">
          <th style="padding:8px;text-align:left;font-size:11px;color:#475569;text-transform:uppercase">Cliente</th>
          <th style="padding:8px;text-align:center;font-size:11px;color:#475569;text-transform:uppercase">Documento</th>
          <th style="padding:8px;text-align:center;font-size:11px;color:#475569;text-transform:uppercase">Forma</th>
          <th style="padding:8px;text-align:right;font-size:11px;color:#475569;text-transform:uppercase">Valor</th>
          <th style="padding:8px;text-align:center;font-size:11px;color:#475569;text-transform:uppercase">Vencimento</th>
          <th style="padding:8px;text-align:center;font-size:11px;color:#475569;text-transform:uppercase">Status</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </body></html>`);
    printWindow.document.close();
    printWindow.print();
  }

  return (
    <div className="border-t border-slate-200">
      {/* ---- FILTROS DENTRO DA CONTA ---- */}
      <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200 space-y-3">
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Filtros</span>
          <div className="ml-auto flex items-center gap-2">
            {hasActiveFilters && (
              <button onClick={() => { setStatusFilter("TODOS"); setFormaFilter("TODOS"); }}
                className="text-[10px] text-slate-400 hover:text-red-500 flex items-center gap-1 transition-colors">
                <X className="w-3 h-3" /> Limpar
              </button>
            )}
          </div>
        </div>

        {/* Status */}
        <div className="flex flex-wrap gap-1.5">
          {STATUS_OPTIONS.map(opt => {
            const Icon = opt.icon;
            const isActive = statusFilter === opt.value;
            return (
              <button key={opt.value} onClick={() => setStatusFilter(opt.value)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 text-xs font-bold transition-all duration-200 ${
                  isActive
                    ? `${opt.activeBg} ${opt.activeBorder} ${opt.activeText} ${opt.glow} scale-[1.02]`
                    : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                }`}>
                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-white" : opt.color}`} />
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Forma de cobrança */}
        <div className="flex flex-wrap gap-1.5">
          {FORMA_OPTIONS.map(opt => {
            const Icon = opt.icon;
            const isActive = formaFilter === opt.value;
            return (
              <button key={opt.value} onClick={() => setFormaFilter(opt.value)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 text-xs font-bold transition-all duration-200 ${
                  isActive
                    ? `${opt.activeBg} ${opt.activeBorder} ${opt.activeText} ${opt.glow} scale-[1.02]`
                    : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                }`}>
                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-white" : opt.color}`} />
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ---- CARD DE RESUMO PREMIUM (dentro da conta) ---- */}
      {hasActiveFilters && (
        <div className="mx-3 my-3">
          <div className="relative overflow-hidden rounded-xl border-2 border-indigo-300 bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 p-4 shadow-xl">
            {/* Background glow effects */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

            <div className="relative z-10">
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 shrink-0">
                    <Filter className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-white font-bold text-xs md:text-sm">Resultado do Filtro</h4>
                    <p className="text-indigo-300 text-[9px] md:text-[10px] font-medium truncate">{filterDescription}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 md:gap-2">
                  {/* Exportar PDF */}
                  <button
                    onClick={() => exportFilteredPDF(contaLabel, filterDescription, filteredItems, filteredTotals, empresaNome, mesLabel)}
                    className="text-emerald-400 hover:text-white text-[9px] md:text-[10px] flex items-center gap-1 transition-colors bg-white/5 hover:bg-emerald-500/30 px-2 py-1.5 rounded-lg border border-emerald-400/30 hover:border-emerald-400/60"
                    title="Exportar PDF deste filtro"
                  >
                    <FileText className="w-3 h-3 md:w-3.5 md:h-3.5" /> PDF
                  </button>
                  {/* Verificar no Maxiprod */}
                  {canVerifyMaxiprod && (
                    <button
                      onClick={() => setShowVerifyModal(true)}
                      className="text-amber-400 hover:text-white text-[9px] md:text-[10px] flex items-center gap-1 transition-colors bg-white/5 hover:bg-amber-500/30 px-2 py-1.5 rounded-lg border border-amber-400/30 hover:border-amber-400/60"
                      title="Verificar no Maxiprod"
                    >
                      <Eye className="w-3 h-3 md:w-3.5 md:h-3.5" /> Maxiprod
                    </button>
                  )}
                  <button onClick={() => { setStatusFilter("TODOS"); setFormaFilter("TODOS"); }}
                    className="text-indigo-400 hover:text-white text-[9px] md:text-[10px] flex items-center gap-1 transition-colors bg-white/5 hover:bg-white/10 px-1.5 py-1 rounded-lg border border-white/10">
                    <X className="w-3 h-3" /> Limpar
                  </button>
                </div>
              </div>

              {/* Valores */}
              <div className="grid grid-cols-3 gap-2">
                {/* Total */}
                <div className="relative group min-w-0">
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-lg blur-sm group-hover:blur-md transition-all" />
                  <div className="relative bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 p-2 md:p-3 hover:border-cyan-400/30 transition-all">
                    <div className="flex items-center gap-1 mb-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.6)] shrink-0" />
                      <span className="text-[9px] md:text-[10px] font-bold text-cyan-300 uppercase tracking-wider">Total</span>
                    </div>
                    <div className="text-sm md:text-lg font-extrabold text-white tracking-tight truncate" style={{ textShadow: "0 0 20px rgba(34,211,238,0.3)" }}>
                      {formatCurrency(filteredTotals.total)}
                    </div>
                    <div className="text-[9px] md:text-[10px] text-slate-400 mt-0.5">{filteredTotals.count} {filteredTotals.count === 1 ? "título" : "títulos"}</div>
                  </div>
                </div>

                {/* Vencido */}
                <div className="relative group min-w-0">
                  <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 to-rose-500/20 rounded-lg blur-sm group-hover:blur-md transition-all" />
                  <div className="relative bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 p-2 md:p-3 hover:border-red-400/30 transition-all">
                    <div className="flex items-center gap-1 mb-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.6)] shrink-0" />
                      <span className="text-[9px] md:text-[10px] font-bold text-red-300 uppercase tracking-wider">Vencido</span>
                    </div>
                    <div className="text-sm md:text-lg font-extrabold text-red-300 tracking-tight truncate" style={{ textShadow: "0 0 20px rgba(248,113,113,0.3)" }}>
                      {formatCurrency(filteredTotals.vencido)}
                    </div>
                    <div className="text-[9px] md:text-[10px] text-slate-400 mt-0.5">
                      {filteredTotals.total > 0 ? `${((filteredTotals.vencido / filteredTotals.total) * 100).toFixed(1)}%` : "0%"}
                    </div>
                  </div>
                </div>

                {/* A Vencer */}
                <div className="relative group min-w-0">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-green-500/20 rounded-lg blur-sm group-hover:blur-md transition-all" />
                  <div className="relative bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 p-2 md:p-3 hover:border-emerald-400/30 transition-all">
                    <div className="flex items-center gap-1 mb-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)] shrink-0" />
                      <span className="text-[9px] md:text-[10px] font-bold text-emerald-300 uppercase tracking-wider">A Vencer</span>
                    </div>
                    <div className="text-sm md:text-lg font-extrabold text-emerald-300 tracking-tight truncate" style={{ textShadow: "0 0 20px rgba(52,211,153,0.3)" }}>
                      {formatCurrency(filteredTotals.aVencer)}
                    </div>
                    <div className="text-[9px] md:text-[10px] text-slate-400 mt-0.5">
                      {filteredTotals.total > 0 ? `${((filteredTotals.aVencer / filteredTotals.total) * 100).toFixed(1)}%` : "0%"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Barra de progresso */}
              {filteredTotals.total > 0 && (
                <div className="mt-3">
                  <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full flex">
                      {filteredTotals.vencido > 0 && (
                        <div className="bg-gradient-to-r from-red-500 to-red-400 h-full transition-all duration-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                          style={{ width: `${(filteredTotals.vencido / filteredTotals.total) * 100}%` }} />
                      )}
                      <div className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-full transition-all duration-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                        style={{ width: `${(filteredTotals.aVencer / filteredTotals.total) * 100}%` }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Verificacao automatica Maxiprod */}
      {showVerifyModal && (() => {
        // Calculate date range from mesKey (YYYY-MM)
        const [y, m] = mesKey.split("-");
        const lastDay = new Date(Number(y), Number(m), 0).getDate();
        const sDate = `${y}-${m}-01`;
        const eDate = `${y}-${m}-${String(lastDay).padStart(2, "0")}`;
        return (
          <MaxiprodAutoVerifier
            onClose={() => setShowVerifyModal(false)}
            title="Conferencia: Contas a Receber"
            subtitle={`${empresaNome} - ${mesLabel} - ${contaLabel}${hasActiveFilters ? ` (${filterDescription})` : ''}`}
            section="recebiveis"
            startDate={sDate}
            endDate={eDate}
            valorManus={filteredTotals.total}
            empresaNome={empresaNomeFull}
            bancoNome={bancoNome}
            contaNumero={contaNumero}
            statusFilter={statusFilter}
            formaFilter={formaFilter}
          />
        );
      })()}

      {/* ---- CARD SELECIONADOS PARA DESCONTO (TOPO da conta) ---- */}
      {selectedIds.size > 0 && (
        <div className="mx-3 mt-3 mb-1">
          <div className="bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-xl p-4 shadow-xl border border-teal-500">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                  <FileDown className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm">Selecionados para Desconto</div>
                  <div className="text-teal-100 text-xs">{selectedIds.size} {selectedIds.size === 1 ? "título" : "títulos"} marcados para antecipação</div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">

                <div className="text-left sm:text-right">
                  <div className="text-[10px] text-teal-200 uppercase tracking-wide">Valor Total</div>
                  <div className="text-lg sm:text-xl font-bold" style={{ textShadow: "0 0 20px rgba(255,255,255,0.4)" }}>{formatCurrency(selectedContaTotal)}</div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={exportSelectedPDF}
                    className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-xs font-medium transition-all flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5" /> Exportar PDF
                  </button>
                  {isAuthorizer && (
                    <button onClick={() => setShowFinalizeDialog(true)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/30 hover:bg-emerald-500/50 border border-emerald-400/40 text-xs font-medium transition-all flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Finalizar
                    </button>
                  )}
                  <button onClick={() => setShowHistoryPanel(!showHistoryPanel)}
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium transition-all flex items-center gap-1">
                    <History className="w-3.5 h-3.5" /> Histórico
                  </button>
                  <button onClick={() => { setDiscountsAuthorized(false); clearSelection(); }}
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium transition-all">
                    Limpar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---- PAINEL DE HISTÓRICO (junto ao card de selecionados) ---- */}
      {showHistoryPanel && (
        <div className="mx-3 mb-1">
          <div className="bg-white border-2 border-indigo-200 rounded-xl p-4 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-600" />
                <h4 className="font-bold text-sm text-slate-800">Histórico de Ticagens</h4>
              </div>
              <button onClick={() => setShowHistoryPanel(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            {historyQuery.isLoading ? (
              <div className="text-center py-4 text-slate-400 text-sm">Carregando...</div>
            ) : historyQuery.data && historyQuery.data.length > 0 ? (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {historyQuery.data.map((h: any) => (
                  <div key={h.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold">
                      {h.operatorName?.charAt(0) || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-slate-800">{h.operatorName}</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(h.createdAt).toLocaleDateString("pt-BR")} às {new Date(h.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">
                        {h.totalTitulos} título(s) • <span className="font-semibold text-teal-700">{formatCurrency(Number(h.valorTotal))}</span>
                      </div>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-slate-400 text-sm">Nenhuma ticagem registrada</div>
            )}
          </div>
        </div>
      )}

      {/* ---- CHECKBOX DESCONTOS AUTORIZADOS (entre card verde e tabela) ---- */}
      {selectedIds.size > 0 && (
        <div className="mx-3 mb-1">
          <label
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all select-none border-2 ${
              discountsAuthorized
                ? "bg-emerald-50 border-emerald-400 shadow-md shadow-emerald-100"
                : isAuthorizer
                  ? "bg-white border-slate-200 hover:border-teal-300 hover:bg-teal-50/30 cursor-pointer"
                  : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 cursor-not-allowed opacity-70"
            }`}
          >
            <input
              type="checkbox"
              checked={discountsAuthorized}
              onChange={(e) => {
                if (isAuthorizer) setDiscountsAuthorized(e.target.checked);
              }}
              disabled={!isAuthorizer}
              className={`w-5 h-5 rounded border-2 border-slate-300 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-0 accent-emerald-600 ${
                isAuthorizer ? "cursor-pointer" : "cursor-not-allowed"
              }`}
            />
            <div className="flex items-center gap-2">
              <CheckCircle2 className={`w-4.5 h-4.5 ${discountsAuthorized ? "text-emerald-600" : "text-slate-400"}`} />
              <span className={`text-sm font-bold ${discountsAuthorized ? "text-emerald-700" : "text-slate-600"}`}>
                Descontos Autorizados
              </span>
              {!isAuthorizer && !discountsAuthorized && (
                <span className="text-xs text-slate-400 italic">(somente Fernando/Bruno/Flavio)</span>
              )}
            </div>
            {discountsAuthorized && (
              <span className="ml-auto text-xs font-semibold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                Autorizado por {operator?.name || "Fernando"}
              </span>
            )}
          </label>
        </div>
      )}

      {/* ---- TABELA DE TÍTULOS ---- */}
      {filteredItems.length > 0 ? (
        <>
          <div className="grid grid-cols-[28px_1fr_80px_70px] md:grid-cols-[36px_1fr_120px_100px_90px_80px] gap-1.5 md:gap-2 px-2 md:px-4 py-2 bg-slate-100 border-b border-slate-200">
            <div className="flex items-center justify-center">
              <button onClick={(e) => { e.stopPropagation(); toggleSelectAll(filteredItems); }}
                className="text-slate-500 hover:text-teal-600 transition-colors" title="Selecionar todos">
                {allContaSelected ? <CheckSquare className="w-4 h-4 text-teal-600" />
                  : someContaSelected ? <MinusSquare className="w-4 h-4 text-teal-500" />
                  : <Square className="w-4 h-4" />}
              </button>
            </div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider self-center">Cliente / Documento</div>
            <div className="hidden md:block text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center self-center">Forma de Pagamento</div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right self-center">Valor</div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider self-center">Vencimento</div>
            <div className="hidden md:block text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center self-center">Status</div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
            {filteredItems.map((item) => {
              const isSelected = selectedIds.has(item.id);
              const isExp = expandedItem === item.id;

              return (
                <div key={item.id}>
                  <div className={`grid grid-cols-[28px_1fr_80px_70px] md:grid-cols-[36px_1fr_120px_100px_90px_80px] gap-1.5 md:gap-2 px-2 md:px-4 py-2.5 items-center transition-all cursor-pointer ${
                    isSelected ? "bg-teal-50/70 hover:bg-teal-50" : item.isOverdue ? "bg-red-50/30 hover:bg-red-50/50" : "hover:bg-slate-50 dark:hover:bg-slate-700"
                  }`}>
                    <div className="flex items-center justify-center">
                      <button onClick={(e) => { e.stopPropagation(); toggleSelect(item.id); }}
                        className={`transition-colors ${isSelected ? "text-teal-600" : "text-slate-300 hover:text-slate-500"}`}>
                        {isSelected ? <CheckSquare className="w-4.5 h-4.5" /> : <Square className="w-4.5 h-4.5" />}
                      </button>
                    </div>

                    <div className="min-w-0 cursor-pointer" onClick={() => setExpandedItem(isExp ? null : item.id)}>
                      <div className="font-medium text-sm text-slate-800 truncate">{item.cliente}</div>
                      <div className="text-xs text-slate-400 truncate">
                        {item.documento && `Doc ${item.documento}`}
                        {item.parcela && ` · ${item.parcela}`}
                        {item.referenteA && ` · ${item.referenteA}`}
                      </div>
                      {item.anotacoes && (
                        <div className="mt-0.5 flex items-center gap-1">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded max-w-full">
                            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
                            <span className="truncate">{item.anotacoes}</span>
                          </span>
                        </div>
                      )}
                    </div>

                    {(() => {
                      const fc = shortFormaCobranca(item.formaCobranca);
                      return (
                        <div className="hidden md:block text-center" onClick={() => setExpandedItem(isExp ? null : item.id)} title={item.formaCobranca || "Não informado"}>
                          {fc.label ? (
                            <span className={`text-xs font-semibold ${fc.color}`}>{fc.label}</span>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </div>
                      );
                    })()}

                    <div className="text-right" onClick={() => setExpandedItem(isExp ? null : item.id)}>
                      <span className={`font-bold text-xs md:text-sm ${isSelected ? "text-teal-700" : item.isOverdue ? "text-red-600" : "text-slate-800"}`}>
                        {formatCurrency(item.valorAReceber)}
                      </span>
                    </div>

                    <div className={`text-xs md:text-sm whitespace-nowrap ${item.isOverdue ? "text-red-600 font-semibold" : "text-slate-600"}`}
                      onClick={() => setExpandedItem(isExp ? null : item.id)}>
                      {formatDate(item.vencimento)}
                    </div>

                    <div className="hidden md:block text-center" onClick={() => setExpandedItem(isExp ? null : item.id)}>
                      {item.isOverdue ? (
                        <span className="inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold">
                          <AlertTriangle className="w-3 h-3" /> Vencido
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-bold">
                          <Clock className="w-3 h-3" /> A vencer
                        </span>
                      )}
                    </div>
                  </div>

                  {isExp && (
                    <div className="px-4 pl-12 pb-3 bg-slate-50">
                      {item.anotacoes && (
                        <div className="mb-2 p-2.5 bg-amber-50 border-l-4 border-amber-400 rounded-r-lg">
                          <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-0.5">Anotações Maxiprod</div>
                          <p className="text-sm font-semibold text-amber-900 whitespace-pre-line">{item.anotacoes}</p>
                        </div>
                      )}
                      {item.referenteA && (
                        <div className="mb-2 p-2.5 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg">
                          <div className="text-[10px] font-bold text-blue-700 uppercase tracking-wider mb-0.5">Referente A</div>
                          <p className="text-sm font-semibold text-blue-900">{item.referenteA}</p>
                        </div>
                      )}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm">
                        <DetailItem label="Valor Original" value={formatCurrency(item.valorOriginal)} />
                        <DetailItem label="Valor Pago" value={formatCurrency(item.valorPago)} />
                        <DetailItem label="Emissão" value={formatDate(item.emissao)} />
                        <DetailItem label="Tipo" value={item.tipo} />
                        <DetailItem label="Estado" value={item.estado || "-"} />
                        {item.liquidacao && <DetailItem label="Liquidação" value={formatDate(item.liquidacao)} />}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="text-center py-6 text-slate-400">
          <p className="text-sm">Nenhum título encontrado para este filtro</p>
          {hasActiveFilters && (
            <button onClick={() => { setStatusFilter("TODOS"); setFormaFilter("TODOS"); }}
              className="mt-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
              Limpar filtros
            </button>
          )}
        </div>
      )}

      {/* Card e histórico movidos para o topo da conta */}

      {/* ---- DIALOG DE FINALIZAÇÃO COM SENHA ---- */}
      {showFinalizeDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowFinalizeDialog(false)}>
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center">
                <Lock className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Finalizar Ticagem</h3>
                <p className="text-xs text-slate-500">Digite a senha para confirmar</p>
              </div>
            </div>
            <div className="bg-teal-50 rounded-lg p-3 mb-4 border border-teal-200">
              <div className="text-xs text-teal-600 font-medium">{selectedContaItems.length} título(s) selecionado(s)</div>
              <div className="text-lg font-bold text-teal-800">{formatCurrency(selectedContaTotal)}</div>
            </div>
            <input
              type="password"
              value={passwordInput}
              onChange={e => { setPasswordInput(e.target.value); setPasswordError(""); }}
              onKeyDown={e => e.key === "Enter" && handleFinalize()}
              placeholder="Senha de autorização"
              className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg text-sm focus:border-teal-500 focus:outline-none mb-2"
              autoFocus
            />
            {passwordError && <p className="text-red-500 text-xs mb-2">{passwordError}</p>}
            <div className="flex gap-2 mt-3">
              <button onClick={() => setShowFinalizeDialog(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700">
                Cancelar
              </button>
              <button onClick={handleFinalize}
                className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-teal-600 to-emerald-600 text-white text-sm font-bold hover:from-teal-700 hover:to-emerald-700 shadow-lg">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Sicoob Palitos - Limite para Troca de Títulos
   ============================================================ */
/* ---- Card genérico Sicoob Palitos (reutilizável) ---- */
function SicoobInfoCard({ title, subtitle, icon: Icon, colorScheme, queryHook, mutationHook }: {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  colorScheme: { border: string; bg: string; iconFrom: string; iconTo: string; iconShadow: string; text: string; textMuted: string; btnBg: string; btnHover: string; inputBorder: string; inputText: string; decoA: string; decoB: string };
  queryHook: () => { data?: { valor: number | null; updatedBy: string | null; updatedAt: string | null } | null | undefined; isLoading: boolean };
  mutationHook: (opts: { onSuccess: () => void; onError: (err: any) => void }) => { mutate: (input: { valor: number; operatorName: string }) => void; isPending: boolean };
}) {
  const { operator } = useOperator();
  const isFlavio = operator?.name === "Flavio";
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingValue, setPendingValue] = useState<number>(0);

  const query = queryHook();
  const utils = trpc.useUtils();
  const mutation = mutationHook({
    onSuccess: () => {
      utils.settings.invalidate();
      setEditing(false);
      toast.success("Valor atualizado com sucesso!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const valor = query.data?.valor;
  const updatedBy = query.data?.updatedBy;
  const updatedAt = query.data?.updatedAt;

  function startEditing() {
    setInputValue(valor != null ? String(valor) : "");
    setEditing(true);
  }

  function handleSave() {
    const parsed = parseFloat(inputValue.replace(/\./g, "").replace(",", "."));
    if (isNaN(parsed) || parsed < 0) {
      toast.error("Valor inválido");
      return;
    }
    setPendingValue(parsed);
    setShowConfirm(true);
  }

  function confirmSave() {
    mutation.mutate({ valor: pendingValue, operatorName: operator!.name });
    setShowConfirm(false);
  }

  function formatUpdatedAt(iso: string) {
    try {
      const d = new Date(iso);
      return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch { return iso; }
  }

  const c = colorScheme;

  return (
    <div className={`relative overflow-hidden rounded-lg border ${c.border} ${c.bg} px-3 py-2.5 shadow-sm`}>
      <div className={`absolute top-0 right-0 w-24 h-24 ${c.decoA} rounded-full blur-3xl -translate-y-1/2 translate-x-1/2`} />
      <div className={`absolute bottom-0 left-0 w-16 h-16 ${c.decoB} rounded-full blur-3xl translate-y-1/2 -translate-x-1/2`} />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-md bg-gradient-to-br ${c.iconFrom} ${c.iconTo} flex items-center justify-center shadow-md ${c.iconShadow}`}>
              <Icon className="w-4 h-4 text-white" />
            </div>
            <div>
              <h4 className={`${c.text} font-bold text-xs leading-tight`}>{title}</h4>
              <p className={`${c.textMuted} text-[9px] font-medium`}>{subtitle}</p>
            </div>
          </div>
          {isFlavio && !editing && (
            <button
              onClick={startEditing}
              className={`flex items-center gap-1 px-2 py-1 rounded-md ${c.btnBg} ${c.btnHover} text-white text-[10px] font-bold transition-all shadow-sm hover:shadow-md`}
            >
              <Pencil className="w-3 h-3" />
              Editar
            </button>
          )}
        </div>

        {editing ? (
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <span className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${c.text} font-bold text-xs`}>R$</span>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="0,00"
                className={`w-full pl-8 pr-3 py-1.5 rounded-md border ${c.inputBorder} bg-white text-sm font-bold ${c.inputText} focus:ring-2 focus:ring-opacity-50`}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                  if (e.key === "Escape") setEditing(false);
                }}
              />
            </div>
            <button
              onClick={handleSave}
              disabled={mutation.isPending}
              className={`px-3 py-1.5 rounded-md ${c.btnBg} ${c.btnHover} text-white font-bold text-xs transition-all shadow-sm disabled:opacity-50`}
            >
              {mutation.isPending ? "..." : "Salvar"}
            </button>
            <button
              onClick={() => setEditing(false)}
              className={`px-2 py-1.5 rounded-md border ${c.inputBorder} ${c.text} font-medium text-xs hover:opacity-80 transition-all`}
            >
              Cancelar
            </button>
          </div>
        ) : (
          <div>
            <div className={`text-2xl font-extrabold ${c.text} tracking-tight`}>
              {valor != null ? formatCurrency(valor) : (
                <span className={`${c.textMuted} text-sm font-medium italic`}>Não definido</span>
              )}
            </div>
            {updatedBy && updatedAt && (
              <p className={`text-[10px] ${c.textMuted} mt-0.5 font-medium`}>
                Atualizado por {updatedBy} em {formatUpdatedAt(updatedAt)}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Dialog de confirmação */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 max-w-sm mx-4 border border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Confirmar alteração</h3>
            <p className="text-sm text-slate-600 mb-1">Tem certeza que deseja alterar o valor?</p>
            <div className="bg-slate-50 rounded-lg p-3 mb-4">
              <p className="text-xs text-slate-500">Valor atual: <span className="font-bold text-slate-700">{valor != null ? formatCurrency(valor) : "Não definido"}</span></p>
              <p className="text-xs text-slate-500 mt-1">Novo valor: <span className="font-bold text-emerald-700">{formatCurrency(pendingValue)}</span></p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={confirmSave}
                disabled={mutation.isPending}
                className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-all disabled:opacity-50"
              >
                {mutation.isPending ? "Salvando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Mini-chat embutido nos cards Sicoob */
function CardChat({ cardKey, colorScheme: c }: { cardKey: string; colorScheme: typeof GREEN_SCHEME }) {
  const { operator } = useOperator();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  const { data: messages = [] } = trpc.settings.getCardMessages.useQuery(
    { cardKey, limit: 50 },
    { refetchInterval: open ? 8000 : false }
  );

  const sendMutation = trpc.settings.sendCardMessage.useMutation({
    onSuccess: () => {
      utils.settings.getCardMessages.invalidate({ cardKey });
      setMsg("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  function handleSend() {
    const trimmed = msg.trim();
    if (!trimmed || !operator) return;
    sendMutation.mutate({ cardKey, operatorName: operator.name, message: trimmed });
  }

  function formatTime(ts: number) {
    return new Date(ts).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit", month: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  }

  const unreadCount = messages.length;

  return (
    <div className="relative z-10 mt-1.5">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 text-[10px] font-bold ${c.text} opacity-70 hover:opacity-100 transition-all`}
      >
        <MessageCircle className="w-3.5 h-3.5" />
        Observações {unreadCount > 0 && <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${c.btnBg} text-white`}>{unreadCount}</span>}
        <ChevronUp className={`w-3 h-3 transition-transform ${open ? '' : 'rotate-180'}`} />
      </button>

      {open && (
        <div className={`mt-1.5 rounded-lg border ${c.border} bg-white/80 backdrop-blur-sm shadow-sm`}>
          <div
            ref={scrollRef}
            className="max-h-36 overflow-y-auto px-2.5 py-2 space-y-1.5"
          >
            {messages.length === 0 ? (
              <p className="text-[10px] text-slate-400 italic text-center py-2">Nenhuma observação ainda</p>
            ) : (
              messages.map((m: any) => {
                const isMe = operator?.name === m.operatorName;
                return (
                  <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[85%] px-2.5 py-1.5 rounded-lg text-[11px] leading-snug ${
                      isMe
                        ? `${c.btnBg} text-white`
                        : 'bg-slate-100 text-slate-800'
                    }`}>
                      {!isMe && <span className="font-bold text-[10px] block mb-0.5">{m.operatorName}</span>}
                      {m.message}
                    </div>
                    <span className="text-[8px] text-slate-400 mt-0.5 px-1">{formatTime(m.createdAt)}</span>
                  </div>
                );
              })
            )}
          </div>

          {operator && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 border-t ${c.border}`}>
              <input
                type="text"
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                placeholder="Escrever observação..."
                className={`flex-1 text-[11px] px-2.5 py-1.5 rounded-md border ${c.inputBorder} bg-white focus:ring-1 focus:outline-none`}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                maxLength={500}
              />
              <button
                onClick={handleSend}
                disabled={!msg.trim() || sendMutation.isPending}
                className={`p-1.5 rounded-md ${c.btnBg} ${c.btnHover} text-white disabled:opacity-40 transition-all`}
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SicoobInfoCardWithChat({ title, subtitle, icon: Icon, colorScheme, queryHook, mutationHook }: {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  colorScheme: typeof GREEN_SCHEME;
  queryHook: () => { data?: { valor: number | null; updatedBy: string | null; updatedAt: string | null } | null | undefined; isLoading: boolean };
  mutationHook: (opts: { onSuccess: () => void; onError: (err: any) => void }) => { mutate: (input: { valor: number; operatorName: string }) => void; isPending: boolean };
}) {
  const cardKey = title.includes("desconto") || title.includes("liberação") ? "sicoob_desconto_semanal" : "sicoob_limite_titulos";
  return (
    <div>
      <SicoobInfoCard title={title} subtitle={subtitle} icon={Icon} colorScheme={colorScheme} queryHook={queryHook} mutationHook={mutationHook} />
      <CardChat cardKey={cardKey} colorScheme={colorScheme} />
    </div>
  );
}

const GREEN_SCHEME = { border: 'border-green-300', bg: 'bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50',
  iconFrom: 'from-green-500', iconTo: 'to-emerald-600', iconShadow: 'shadow-green-500/30',
  text: 'text-green-800', textMuted: 'text-green-600/60',
  btnBg: 'bg-green-600', btnHover: 'hover:bg-green-700',
  inputBorder: 'border-green-300', inputText: 'text-green-800',
  decoA: 'bg-green-200/30', decoB: 'bg-emerald-200/30',
};

const BLUE_SCHEME = {
  border: 'border-blue-300', bg: 'bg-gradient-to-br from-blue-50 via-sky-50 to-cyan-50',
  iconFrom: 'from-blue-500', iconTo: 'to-sky-600', iconShadow: 'shadow-blue-500/30',
  text: 'text-blue-800', textMuted: 'text-blue-600/60',
  btnBg: 'bg-blue-600', btnHover: 'hover:bg-blue-700',
  inputBorder: 'border-blue-300', inputText: 'text-blue-800',
  decoA: 'bg-blue-200/30', decoB: 'bg-sky-200/30',
};

function SicoobDescontoSemanalCard() {
  const { operator } = useOperator();
  const isFlavio = operator?.name === "Flavio";
  const query = trpc.settings.getSicoobDescontoSemanal.useQuery();
  const utils = trpc.useUtils();
  const mutation = trpc.settings.updateSicoobDescontoSemanal.useMutation({
    onSuccess: () => {
      utils.settings.getSicoobDescontoSemanal.invalidate();
      toast.success("Valor atualizado com sucesso!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const [editingWeek, setEditingWeek] = useState<number | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingValue, setPendingValue] = useState<number>(0);
  const [pendingWeekIdx, setPendingWeekIdx] = useState<number>(0);

  const weeks = query.data?.weeks || [];

  // Calculate week date ranges
  function getWeekLabel(weekIndex: number): string {
    const now = new Date();
    // Get Monday of current week
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset + (weekIndex * 7));
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    const fmtDay = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    if (weekIndex === 0) return `Semana Atual (${fmtDay(monday)} - ${fmtDay(friday)})`;
    return `Semana ${weekIndex + 1} (${fmtDay(monday)} - ${fmtDay(friday)})`;
  }

  function startEditing(weekIdx: number) {
    const w = weeks[weekIdx];
    setInputValue(w?.valor != null ? String(w.valor) : "");
    setEditingWeek(weekIdx);
  }

  function handleSave(weekIdx: number) {
    const parsed = parseFloat(inputValue.replace(/\./g, "").replace(",", "."));
    if (isNaN(parsed) || parsed < 0) {
      toast.error("Valor inválido");
      return;
    }
    setPendingValue(parsed);
    setPendingWeekIdx(weekIdx);
    setShowConfirm(true);
  }

  function confirmSave() {
    mutation.mutate({ valor: pendingValue, operatorName: operator!.name, weekIndex: pendingWeekIdx });
    setShowConfirm(false);
    setEditingWeek(null);
  }

  function formatUpdatedAt(iso: string) {
    try {
      const d = new Date(iso);
      return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch { return iso; }
  }

  const c = BLUE_SCHEME;
  const totalSemanas = weeks.reduce((sum: number, w: any) => sum + (w?.valor || 0), 0);

  return (
    <div>
      <div className={`relative overflow-hidden rounded-lg border ${c.border} ${c.bg} px-3 py-2.5 shadow-sm`}>
        <div className={`absolute top-0 right-0 w-24 h-24 ${c.decoA} rounded-full blur-3xl -translate-y-1/2 translate-x-1/2`} />
        <div className={`absolute bottom-0 left-0 w-16 h-16 ${c.decoB} rounded-full blur-3xl translate-y-1/2 -translate-x-1/2`} />

        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-7 h-7 rounded-md bg-gradient-to-br ${c.iconFrom} ${c.iconTo} flex items-center justify-center shadow-md ${c.iconShadow}`}>
              <CalendarRange className="w-4 h-4 text-white" />
            </div>
            <div>
              <h4 className={`${c.text} font-bold text-xs leading-tight`}>Valor previsto de liberação para desconto</h4>
              <p className={`${c.textMuted} text-[9px] font-medium`}>Sicoob Palitos · Próximas 5 semanas</p>
            </div>
          </div>

          {/* Total */}
          {totalSemanas > 0 && (
            <div className="mb-2 px-2 py-1.5 bg-blue-100/50 rounded-md border border-blue-200/50">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-blue-600 uppercase">Total 5 Semanas</span>
                <span className="text-sm font-extrabold text-blue-800">{formatCurrency(totalSemanas)}</span>
              </div>
            </div>
          )}

          {/* Week rows */}
          <div className="space-y-1.5">
            {[0, 1, 2, 3, 4].map((weekIdx) => {
              const w = weeks[weekIdx];
              const isEditing = editingWeek === weekIdx;
              return (
                <div key={weekIdx} className={`flex items-center gap-2 px-2 py-1.5 rounded-md border transition-all ${
                  weekIdx === 0 ? "border-blue-300 bg-blue-50/80" : "border-slate-200/60 bg-white/50 hover:bg-blue-50/30"
                }`}>
                  <div className="flex-1 min-w-0">
                    <div className={`text-[10px] font-bold ${weekIdx === 0 ? "text-blue-700" : "text-slate-600"} truncate`}>
                      {getWeekLabel(weekIdx)}
                    </div>
                    {isEditing ? (
                      <div className="flex items-center gap-1 mt-1">
                        <div className="relative flex-1">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-blue-700 font-bold text-[10px]">R$</span>
                          <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder="0,00"
                            className="w-full pl-7 pr-2 py-1 rounded border border-blue-300 bg-white text-xs font-bold text-blue-800 focus:ring-1 focus:ring-blue-400 focus:outline-none"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSave(weekIdx);
                              if (e.key === "Escape") setEditingWeek(null);
                            }}
                          />
                        </div>
                        <button
                          onClick={() => handleSave(weekIdx)}
                          disabled={mutation.isPending}
                          className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] transition-all disabled:opacity-50"
                        >
                          {mutation.isPending ? "..." : "OK"}
                        </button>
                        <button
                          onClick={() => setEditingWeek(null)}
                          className="px-1.5 py-1 rounded border border-blue-200 text-blue-600 font-medium text-[10px] hover:bg-blue-50"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`text-sm font-extrabold ${w?.valor != null ? "text-blue-800" : "text-slate-300 italic text-xs"}`}>
                          {w?.valor != null ? formatCurrency(w.valor) : "—"}
                        </span>
                        {w?.updatedBy && w?.updatedAt && (
                          <span className="text-[8px] text-blue-500/60 font-medium hidden sm:inline">
                            {w.updatedBy} · {formatUpdatedAt(w.updatedAt)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {isFlavio && !isEditing && (
                    <button
                      onClick={() => startEditing(weekIdx)}
                      className="flex-shrink-0 p-1.5 rounded-md bg-blue-100 hover:bg-blue-200 text-blue-700 transition-all"
                      title="Editar valor"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Dialog de confirmação */}
        {showConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 max-w-sm mx-4 border border-slate-200">
              <h3 className="text-lg font-bold text-slate-800 mb-2">Confirmar alteração</h3>
              <p className="text-sm text-slate-600 mb-1">Atualizar valor da <strong>{getWeekLabel(pendingWeekIdx)}</strong>?</p>
              <div className="bg-slate-50 rounded-lg p-3 mb-4">
                <p className="text-xs text-slate-500">Valor atual: <span className="font-bold text-slate-700">{weeks[pendingWeekIdx]?.valor != null ? formatCurrency(weeks[pendingWeekIdx].valor!) : "Não definido"}</span></p>
                <p className="text-xs text-slate-500 mt-1">Novo valor: <span className="font-bold text-emerald-700">{formatCurrency(pendingValue)}</span></p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmSave}
                  disabled={mutation.isPending}
                  className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-all disabled:opacity-50"
                >
                  {mutation.isPending ? "Salvando..." : "Confirmar"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <CardChat cardKey="sicoob_desconto_semanal" colorScheme={c} />
    </div>
  );
}

function SicoobLimiteCard() {
  return (
    <SicoobInfoCardWithChat
      title="Limite disponível para troca de títulos"
      subtitle="Sicoob Palitos"
      icon={DollarSign}
      colorScheme={GREEN_SCHEME}
      queryHook={() => trpc.settings.getSicoobLimite.useQuery()}
      mutationHook={(opts) => trpc.settings.updateSicoobLimite.useMutation(opts)}
    />
  );
}

const RED_SCHEME = {
  border: 'border-red-300', bg: 'bg-gradient-to-br from-red-50 via-rose-50 to-pink-50',
  iconFrom: 'from-red-500', iconTo: 'to-rose-600', iconShadow: 'shadow-red-500/30',
  text: 'text-red-800', textMuted: 'text-red-600/60',
  btnBg: 'bg-red-600', btnHover: 'hover:bg-red-700',
  inputBorder: 'border-red-300', inputText: 'text-red-800',
  decoA: 'bg-red-200/30', decoB: 'bg-rose-200/30',
};

function BradescoLimiteContaGarantidaCard({ empresa }: { empresa: string }) {
  const { operator } = useOperator();
  const isFlavio = operator?.name === "Flavio";
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingValue, setPendingValue] = useState<number>(0);

  const query = trpc.settings.getBradescoLimiteContaGarantida.useQuery();
  const utils = trpc.useUtils();
  const mutation = trpc.settings.updateBradescoLimiteContaGarantida.useMutation({
    onSuccess: () => {
      utils.settings.getBradescoLimiteContaGarantida.invalidate();
      setEditing(false);
      toast.success("Limite atualizado com sucesso!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const empresaKey = empresa.toLowerCase().includes("palitos") ? "palitos" 
    : empresa.toLowerCase().includes("espetos") ? "espetos" 
    : empresa.toLowerCase().includes("varetas") ? "varetas" 
    : null;

  if (!empresaKey) return null;

  const data = query.data?.[empresaKey];
  const valor = data?.valor ?? null;
  const updatedBy = data?.updatedBy ?? null;
  const updatedAt = data?.updatedAt ?? null;

  function startEditing() {
    setInputValue(valor != null ? String(valor) : "");
    setEditing(true);
  }

  function handleSave() {
    const parsed = parseFloat(inputValue.replace(/\./g, "").replace(",", "."));
    if (isNaN(parsed) || parsed < 0) {
      toast.error("Valor inválido");
      return;
    }
    setPendingValue(parsed);
    setShowConfirm(true);
  }

  function confirmSave() {
    mutation.mutate({ empresa: empresaKey!, valor: pendingValue, operatorName: operator!.name });
    setShowConfirm(false);
  }

  function formatUpdatedAt(iso: string) {
    try {
      const d = new Date(iso);
      return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch { return iso; }
  }

  const c = RED_SCHEME;

  const cardKey = `bradesco_conta_garantida_${empresaKey}`;

  return (
    <div>
    <div className={`relative overflow-hidden rounded-lg border ${c.border} ${c.bg} px-3 py-2.5 shadow-sm`}>
      <div className={`absolute top-0 right-0 w-24 h-24 ${c.decoA} rounded-full blur-3xl -translate-y-1/2 translate-x-1/2`} />
      <div className={`absolute bottom-0 left-0 w-16 h-16 ${c.decoB} rounded-full blur-3xl translate-y-1/2 -translate-x-1/2`} />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-md bg-gradient-to-br ${c.iconFrom} ${c.iconTo} flex items-center justify-center shadow-md ${c.iconShadow}`}>
              <DollarSign className="w-4 h-4 text-white" />
            </div>
            <div>
              <h4 className={`${c.text} font-bold text-xs leading-tight`}>Limite atual da conta garantida</h4>
              <p className={`${c.textMuted} text-[9px] font-medium`}>Bradesco {empresa}</p>
            </div>
          </div>
          {isFlavio && !editing && (
            <button
              onClick={startEditing}
              className={`flex items-center gap-1 px-2 py-1 rounded-md ${c.btnBg} ${c.btnHover} text-white text-[10px] font-bold transition-all shadow-sm hover:shadow-md`}
            >
              <Pencil className="w-3 h-3" />
              Editar
            </button>
          )}
        </div>

        {!editing ? (
          <div>
            <p className={`text-xl font-black ${c.text} tracking-tight`}>
              {valor != null ? `R$ ${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "Não informado"}
            </p>
            {updatedBy && updatedAt && (
              <p className={`text-[10px] ${c.textMuted} mt-0.5`}>
                Atualizado por {updatedBy} em {formatUpdatedAt(updatedAt)}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold ${c.text}`}>R$</span>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="0,00"
                className={`flex-1 px-2 py-1 rounded-md border ${c.inputBorder} ${c.inputText} text-sm font-bold bg-white/80 focus:outline-none focus:ring-2 focus:ring-red-400`}
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="flex-1 px-3 py-1.5 rounded-md bg-white border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={handleSave} className={`flex-1 px-3 py-1.5 rounded-md ${c.btnBg} ${c.btnHover} text-white text-xs font-bold shadow-sm`}>
                Salvar
              </button>
            </div>

            {showConfirm && (
              <div className="mt-2 p-2 rounded-md bg-white/90 border border-red-200 shadow-sm">
                <p className="text-xs text-slate-700 mb-2">
                  Confirmar atualização para <strong>R$ {pendingValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong>?
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setShowConfirm(false)} className="flex-1 px-3 py-1.5 rounded-md bg-slate-100 text-slate-600 text-xs font-semibold">
                    Cancelar
                  </button>
                  <button onClick={confirmSave} disabled={mutation.isPending}
                    className={`flex-1 px-3 py-1.5 rounded-md ${c.btnBg} ${c.btnHover} text-white text-xs font-bold disabled:opacity-50`}
                  >
                    {mutation.isPending ? "Salvando..." : "Confirmar"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
    <CardChat cardKey={cardKey} colorScheme={c} />
    </div>
  );
}

/* ============================================================
   Main Component
   ============================================================ */
/** Helper: short empresa name for matching alerts */
function shortEmpresaNameForAlert(nome: string): string {
  // Alert stores full empresa name like "PALITOS INDUSTRIA", "VARETAS INDUSTRIA", etc.
  return nome;
}

export default function ReceivablesTab() {
  const { operator } = useOperator();
  const [estado, setEstado] = useState<"EMITIDO" | "RECEBIDO" | "ALL">("EMITIDO");
  const [search, setSearch] = useState("");
  const [expandedEmpresas, setExpandedEmpresas] = useState<Set<string>>(new Set());
  const [expandedMeses, setExpandedMeses] = useState<Set<string>>(new Set());
  const [expandedContas, setExpandedContas] = useState<Set<string>>(new Set());
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  const [selectedIdsByAccount, setSelectedIdsByAccount] = useState<Record<string, Set<number>>>({});
  const [showHistoryPanel, setShowHistoryPanel] = useState<string | null>(null);
  const [showGlobalHistory, setShowGlobalHistory] = useState(false);
  const [chequesOpenEmpresa, setChequesOpenEmpresa] = useState<string | null>(null);
  const [chequeSelectedFilter, setChequeSelectedFilter] = useState<string | null>(null);
  const [chequeSearchQuery, setChequeSearchQuery] = useState("");
  const [chequeMesKey, setChequeMesKey] = useState<string | null>(null);

  // Fetch cheques data from backend
  const chequesInput = useMemo(() => {
    const inp: { empresaNome?: string; mesKey?: string } = {};
    if (chequesOpenEmpresa) inp.empresaNome = chequesOpenEmpresa;
    if (chequeMesKey) inp.mesKey = chequeMesKey;
    return inp;
  }, [chequesOpenEmpresa, chequeMesKey]);
  const chequesQuery = trpc.financial.getCheques.useQuery(
    chequesInput,
    { enabled: !!chequesOpenEmpresa }
  );

  // Fetch factoring data
  const factoringInput = useMemo(() => {
    const inp: { empresaNome?: string } = {};
    if (chequesOpenEmpresa) inp.empresaNome = chequesOpenEmpresa;
    return inp;
  }, [chequesOpenEmpresa]);
  const factoringDescontadosQuery = trpc.financial.getChequeFactoringDescontados.useQuery(
    factoringInput,
    { enabled: !!chequesOpenEmpresa }
  );

  // Factoring detail state
  const [selectedFactoringDescontados, setSelectedFactoringDescontados] = useState<string | null>(null);
  const [factoringDescontadosCheckedIds, setFactoringDescontadosCheckedIds] = useState<Set<number>>(new Set());

  // Cheque Exchange (Troca) state
  const [exchangeMode, setExchangeMode] = useState(false);
  const [exchangeSelectedIds, setExchangeSelectedIds] = useState<Set<number>>(new Set());
  const [showExchangePasswordDialog, setShowExchangePasswordDialog] = useState(false);
  const [exchangePasswordInput, setExchangePasswordInput] = useState("");
  const [exchangePasswordError, setExchangePasswordError] = useState(false);
  const [exchangeAuthenticated, setExchangeAuthenticated] = useState(false);
  const [exchangeProcessing, setExchangeProcessing] = useState(false);
  const [showExchangeHistory, setShowExchangeHistory] = useState(false);
  const [showDescontados, setShowDescontados] = useState(false);
  const [showSyncHistory, setShowSyncHistory] = useState(false);
  const [showUnifiedHistory, setShowUnifiedHistory] = useState(false);
  const [unifiedHistoryTab, setUnifiedHistoryTab] = useState<'sync' | 'trocas' | 'descontados'>('sync');
  const [syncHistoryPeriod, setSyncHistoryPeriod] = useState<'mes_atual' | 'mes_anterior' | 'custom'>('mes_atual');
  const [syncHistoryCustomStart, setSyncHistoryCustomStart] = useState('');
  const [syncHistoryCustomEnd, setSyncHistoryCustomEnd] = useState('');
  const [exchangeHistoryPeriod, setExchangeHistoryPeriod] = useState<'mes_atual' | 'mes_anterior' | 'custom'>('mes_atual');
  const [unifiedHistoryCustomStart, setUnifiedHistoryCustomStart] = useState('');
  const [unifiedHistoryCustomEnd, setUnifiedHistoryCustomEnd] = useState('');
  const [unifiedHistoryPeriod, setUnifiedHistoryPeriod] = useState<'mes_atual' | 'mes_anterior' | 'custom'>('mes_atual');

  const createExchangeMutation = trpc.financial.createExchange.useMutation();
  // Exchange history date range calculation
  const exchangeHistoryDates = useMemo(() => {
    const now = new Date();
    const brasiliaOffset = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    if (exchangeHistoryPeriod === 'mes_atual') {
      const start = new Date(brasiliaOffset.getFullYear(), brasiliaOffset.getMonth(), 1);
      const end = new Date(brasiliaOffset.getFullYear(), brasiliaOffset.getMonth() + 1, 0);
      return { startDate: start.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0] };
    } else if (exchangeHistoryPeriod === 'mes_anterior') {
      const start = new Date(brasiliaOffset.getFullYear(), brasiliaOffset.getMonth() - 1, 1);
      const end = new Date(brasiliaOffset.getFullYear(), brasiliaOffset.getMonth(), 0);
      return { startDate: start.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0] };
    }
    return { startDate: undefined, endDate: undefined };
  }, [exchangeHistoryPeriod]);

  // Unified history date range
  const unifiedHistoryDates = useMemo(() => {
    const now = new Date();
    const brasiliaOffset = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    if (unifiedHistoryPeriod === 'mes_atual') {
      const start = new Date(brasiliaOffset.getFullYear(), brasiliaOffset.getMonth(), 1);
      const end = new Date(brasiliaOffset.getFullYear(), brasiliaOffset.getMonth() + 1, 0);
      return { startDate: start.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0] };
    } else if (unifiedHistoryPeriod === 'mes_anterior') {
      const start = new Date(brasiliaOffset.getFullYear(), brasiliaOffset.getMonth() - 1, 1);
      const end = new Date(brasiliaOffset.getFullYear(), brasiliaOffset.getMonth(), 0);
      return { startDate: start.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0] };
    } else if (unifiedHistoryPeriod === 'custom' && unifiedHistoryCustomStart && unifiedHistoryCustomEnd) {
      return { startDate: unifiedHistoryCustomStart, endDate: unifiedHistoryCustomEnd };
    }
    return { startDate: undefined, endDate: undefined };
  }, [unifiedHistoryPeriod, unifiedHistoryCustomStart, unifiedHistoryCustomEnd]);

  const exchangeHistoryQuery = trpc.financial.getExchangeHistory.useQuery(
    { empresaNome: chequesOpenEmpresa || undefined, startDate: unifiedHistoryDates.startDate, endDate: unifiedHistoryDates.endDate },
    { enabled: !!chequesOpenEmpresa && (showExchangeHistory || (showUnifiedHistory && (unifiedHistoryTab === 'trocas' || unifiedHistoryTab === 'sync'))) }
  );
  const descontadosQuery = trpc.financial.getChequeDescontados.useQuery(
    { empresaNome: chequesOpenEmpresa || undefined, limit: 200, startDate: unifiedHistoryDates.startDate, endDate: unifiedHistoryDates.endDate },
    { enabled: !!chequesOpenEmpresa && (showDescontados || (showUnifiedHistory && (unifiedHistoryTab === 'descontados' || unifiedHistoryTab === 'sync'))) }
  );

  // Sync history date range calculation
  const syncHistoryDates = useMemo(() => {
    const now = new Date();
    const brasiliaOffset = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    if (syncHistoryPeriod === 'mes_atual') {
      const start = new Date(brasiliaOffset.getFullYear(), brasiliaOffset.getMonth(), 1);
      const end = new Date(brasiliaOffset.getFullYear(), brasiliaOffset.getMonth() + 1, 0);
      return { startDate: start.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0] };
    } else if (syncHistoryPeriod === 'mes_anterior') {
      const start = new Date(brasiliaOffset.getFullYear(), brasiliaOffset.getMonth() - 1, 1);
      const end = new Date(brasiliaOffset.getFullYear(), brasiliaOffset.getMonth(), 0);
      return { startDate: start.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0] };
    } else {
      return { startDate: syncHistoryCustomStart || undefined, endDate: syncHistoryCustomEnd || undefined };
    }
  }, [syncHistoryPeriod, syncHistoryCustomStart, syncHistoryCustomEnd]);

  const syncHistoryQuery = trpc.financial.getChequeSyncHistory.useQuery(
    { startDate: unifiedHistoryDates.startDate, endDate: unifiedHistoryDates.endDate, changeType: 'todos' },
    { enabled: showSyncHistory || (showUnifiedHistory && unifiedHistoryTab === 'sync') }
  );

  const handleExchangePasswordSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (exchangePasswordInput === "Fernando" || exchangePasswordInput === "Flavio") {
      setExchangeAuthenticated(true);
      setShowExchangePasswordDialog(false);
      setExchangePasswordError(false);
      setExchangeMode(true);
      toast.success("Acesso autorizado para troca de cheques!");
    } else {
      setExchangePasswordError(true);
    }
  };

  const handleExchangeToggle = (chequeId: number) => {
    setExchangeSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(chequeId)) next.delete(chequeId);
      else next.add(chequeId);
      return next;
    });
  };

  const handleExchangeComplete = async () => {
    if (exchangeSelectedIds.size === 0) return;
    const allCheques = chequesQuery.data?.cheques || [];
    const selectedCheques = allCheques.filter((c: any) => exchangeSelectedIds.has(c.id));
    if (selectedCheques.length === 0) return;

    setExchangeProcessing(true);
    try {
      const result = await createExchangeMutation.mutateAsync({
        password: operator?.name || "Fernando",
        empresaNome: chequesOpenEmpresa || "",
        cheques: selectedCheques.map((c: any) => ({
          id: c.id,
          cliente: c.cliente || "",
          valor: c.valor,
          vencimentoData: c.vencimentoData || undefined,
          emissaoData: c.emissaoData || undefined,
          formaPagamento: c.formaPagamento || undefined,
          descricao: c.descricao || undefined,
          parcela: c.parcela || undefined,
          parcelasTotal: c.parcelasTotal || undefined,
        })),
      });
      if (result.success && result.pdfUrl) {
        toast.success(`Troca concluída! ${result.totalCheques} cheques — R$ ${result.totalValor?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
        window.open(result.pdfUrl, "_blank");
        // Reset exchange mode
        setExchangeMode(false);
        setExchangeSelectedIds(new Set());
        setExchangeAuthenticated(false);
        exchangeHistoryQuery.refetch();
      } else {
        toast.error(result.error || "Erro ao processar troca");
      }
    } catch (err: any) {
      toast.error("Erro ao processar troca: " + (err.message || "erro desconhecido"));
    } finally {
      setExchangeProcessing(false);
    }
  };

  // Discount alert cascading blink
  let discountAlerts: ReturnType<typeof useDiscountAlerts> | null = null;
  try { discountAlerts = useDiscountAlerts(); } catch { /* not in provider */ }

  const { data, isLoading } = trpc.financial.getReceivablesByBank.useQuery({ estado });

  // Flatten all items for selection logic
  const allItems = useMemo(() => {
    if (!data?.empresas) return [] as ItemData[];
    const items: ItemData[] = [];
    data.empresas.forEach(emp =>
      emp.meses.forEach(mes =>
        mes.contas.forEach(conta =>
          conta.tipos.forEach(tipo =>
            tipo.items.forEach(item => items.push(item))
          )
        )
      )
    );
    return items;
  }, [data]);

  // Search-only filtered data (no status/forma filters at global level anymore)
  const filteredData = useMemo(() => {
    if (!data?.empresas) return data;
    const s = search.toUpperCase();
    if (!s) return data;

    const empresas = data.empresas.map(emp => {
      const meses = emp.meses.map(mes => {
        const contas = mes.contas.map(conta => {
          const tipos = conta.tipos.map(tipo => {
            const items = tipo.items.filter(i => {
              return i.cliente.toUpperCase().includes(s) ||
                i.referenteA.toUpperCase().includes(s) ||
                i.documento.toUpperCase().includes(s) ||
                (i.formaCobranca || "").toUpperCase().includes(s) ||
                (i.anotacoes || "").toUpperCase().includes(s);
            });
            return { ...tipo, items, total: items.reduce((a, b) => a + b.valorAReceber, 0), count: items.length };
          }).filter(t => t.count > 0);
          return { ...conta, tipos, total: tipos.reduce((a, b) => a + b.total, 0), count: tipos.reduce((a, b) => a + b.count, 0) };
        }).filter(c => c.count > 0);
        return { ...mes, contas, total: contas.reduce((a, b) => a + b.total, 0), count: contas.reduce((a, b) => a + b.count, 0) };
      }).filter(m => m.count > 0);

      let empVencido = 0, empAVencer = 0;
      meses.forEach(m => m.contas.forEach(c => c.tipos.forEach(t => t.items.forEach(i => {
        if (i.isOverdue) empVencido += i.valorAReceber;
        else empAVencer += i.valorAReceber;
      }))));

      return { ...emp, meses, total: meses.reduce((a, b) => a + b.total, 0), count: meses.reduce((a, b) => a + b.count, 0), vencido: empVencido, aVencer: empAVencer };
    }).filter(e => e.count > 0);

    let totalVencido = 0, totalAVencer = 0, totalCount = 0, totalVal = 0;
    empresas.forEach(e => { totalVencido += e.vencido; totalAVencer += e.aVencer; totalCount += e.count; totalVal += e.total; });

    return { empresas, totals: { total: totalVal, count: totalCount, vencido: totalVencido, aVencer: totalAVencer } };
  }, [data, search]);

  // Get ALL items for a specific conta (unfiltered by status/forma — the sub-component handles that)
  const getContaItems = useCallback((emp: string, mes: string, bancoNome: string, contaNumero: string) => {
    if (!filteredData?.empresas) return [] as ItemData[];
    const empresa = filteredData.empresas.find(e => e.nome === emp);
    if (!empresa) return [];
    const month = empresa.meses.find(m => m.mes === mes);
    if (!month) return [];
    const conta = month.contas.find(c => c.bancoNome === bancoNome && c.contaNumero === contaNumero);
    if (!conta) return [];
    const items: ItemData[] = [];
    conta.tipos.forEach(t => items.push(...t.items));
    items.sort((a, b) => a.vencimento.localeCompare(b.vencimento));
    return items;
  }, [filteredData]);

  function toggleSet(setter: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) {
    setter(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  }

  function getSelectedIds(contaKey: string): Set<number> {
    return selectedIdsByAccount[contaKey] || new Set();
  }

  function toggleSelect(contaKey: string, id: number) {
    setSelectedIdsByAccount(prev => {
      const current = new Set(prev[contaKey] || []);
      if (current.has(id)) current.delete(id); else current.add(id);
      return { ...prev, [contaKey]: current };
    });
  }

  function toggleSelectAll(contaKey: string, items: ItemData[]) {
    const ids = items.map(i => i.id);
    setSelectedIdsByAccount(prev => {
      const current = new Set(prev[contaKey] || []);
      const allSelected = ids.every(id => current.has(id));
      if (allSelected) ids.forEach(id => current.delete(id));
      else ids.forEach(id => current.add(id));
      return { ...prev, [contaKey]: current };
    });
  }

  function clearSelection(contaKey: string) {
    setSelectedIdsByAccount(prev => {
      const next = { ...prev };
      delete next[contaKey];
      return next;
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => <div key={i} className="h-40 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
        <div className="h-96 bg-slate-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  const { empresas = [], totals = { total: 0, count: 0, vencido: 0, aVencer: 0 } } = filteredData || {};

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Controle de Recebíveis
          </h2>
          <div className="flex flex-wrap items-center gap-1.5 md:gap-2 mt-2">
            <span className="inline-flex items-center px-2 md:px-3 py-1 md:py-1.5 rounded-lg border-2 border-blue-300 bg-blue-50 text-xs md:text-base font-bold text-blue-700 shadow-[0_0_8px_rgba(59,130,246,0.35)]">
              {totals.count} títulos
            </span>
            <span className="inline-flex items-center px-2 md:px-3 py-1 md:py-1.5 rounded-lg border-2 border-slate-300 bg-slate-50 text-xs md:text-base font-bold text-slate-800 shadow-[0_0_8px_rgba(100,116,139,0.3)]">
              Total: {formatCurrency(totals.total)}
            </span>
            {totals.vencido > 0 && (
              <span className="inline-flex items-center px-2 md:px-3 py-1 md:py-1.5 rounded-lg border-2 border-red-300 bg-red-50 text-xs md:text-base font-bold text-red-600 shadow-[0_0_8px_rgba(239,68,68,0.35)]">
                Vencido: {formatCurrency(totals.vencido)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGlobalHistory(!showGlobalHistory)}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              showGlobalHistory
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30"
                : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200 border border-indigo-200"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Histórico de Descontos
          </button>
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            {(["EMITIDO", "RECEBIDO", "ALL"] as const).map(e => (
              <button key={e} onClick={() => setEstado(e)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${estado === e ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-800"}`}>
                {e === "EMITIDO" ? "A Receber" : e === "RECEBIDO" ? "Recebidos" : "Todos"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Painel de Histórico Global de Descontos */}
      {showGlobalHistory && (
        <DiscountHistoryPanel onClose={() => setShowGlobalHistory(false)} />
      )}

      {/* Busca global */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input type="text" placeholder="Buscar por cliente, documento ou referência..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        )}
      </div>



      {/* Cards resumo por empresa */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {empresas.map(emp => {
          const colors = getEmpresaColor(emp.nome);
          const pctVencido = emp.total > 0 ? (emp.vencido / emp.total) * 100 : 0;
          const isOpen = expandedEmpresas.has(emp.nome);
          const bancosSet = new Set<string>();
          emp.meses.forEach(m => m.contas.forEach(c => bancosSet.add(`${c.bancoNome}|${c.contaNumero}`)));
          const numBancos = bancosSet.size;
          const today = new Date().toISOString().substring(0, 7);
          const mesesVencidos = emp.meses.filter(m => m.mes < today).length;

          // Check if this empresa card should blink for discount alerts
          const empresaHasAlert = discountAlerts?.isAlertOperator 
            && discountAlerts.blinkLevel === "empresa-card" 
            && discountAlerts.alertEmpresas.has(emp.nome);

          return (
            <button key={emp.nome} onClick={() => {
              if (empresaHasAlert && discountAlerts) {
                discountAlerts.advanceBlink("empresa-card");
              }
              toggleSet(setExpandedEmpresas, emp.nome);
            }}
              className={`rounded-2xl border-2 p-0 text-left transition-all hover:shadow-xl ${colors.bg} ${isOpen ? `${colors.border} ring-2 ring-offset-2 ring-blue-400 shadow-xl` : colors.border} ${empresaHasAlert ? "animate-discount-glow" : ""}`}>
              <div className={`px-5 py-4 flex items-center justify-between ${colors.headerBg} rounded-t-xl`}>
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-white shadow-sm border ${colors.border}`}>
                    <Building2 className={`w-6 h-6 ${colors.text}`} />
                  </div>
                  <div>
                    <h3 className={`font-bold text-lg ${colors.text}`}>{shortEmpresaName(emp.nome)}</h3>
                    <span className="text-xs text-slate-500">{emp.nome}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="text-2xl font-extrabold text-slate-800">{formatCurrency(emp.total)}</div>
                    <div className="text-xs text-slate-500">{emp.count} títulos</div>
                  </div>
                  {isOpen ? <ChevronDown className="w-5 h-5 text-slate-400 ml-2" /> : <ChevronRight className="w-5 h-5 text-slate-400 ml-2" />}
                </div>
              </div>

              <div className="px-5 py-4 space-y-3">
                <div className="w-full h-3 rounded-full bg-white/70 overflow-hidden shadow-inner">
                  <div className="h-full flex">
                    {pctVencido > 0 && <div className="bg-red-400 h-full transition-all" style={{ width: `${pctVencido}%` }} />}
                    <div className={`${colors.accent} h-full opacity-60 transition-all`} style={{ width: `${100 - pctVencido}%` }} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-red-50 rounded-lg px-3 py-2.5 border border-red-200">
                    <div className="flex items-center gap-1.5 mb-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                      <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Vencido</span>
                    </div>
                    <div className="text-base font-bold text-red-700">{formatCurrency(emp.vencido)}</div>
                  </div>
                  <div className={`${colors.bg} rounded-lg px-3 py-2.5 border ${colors.border}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Clock className={`w-3.5 h-3.5 ${colors.text}`} />
                      <span className={`text-[10px] font-bold ${colors.text} uppercase tracking-wider`}>A Vencer</span>
                    </div>
                    <div className={`text-base font-bold ${colors.text}`}>{formatCurrency(emp.aVencer)}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {emp.meses.length} {emp.meses.length === 1 ? "mês" : "meses"}
                      {mesesVencidos > 0 && <span className="text-red-500 font-medium">({mesesVencidos} venc.)</span>}
                    </span>
                    <span className="flex items-center gap-1">
                      <Landmark className="w-3.5 h-3.5" />
                      {numBancos} {numBancos === 1 ? "conta" : "contas"}
                    </span>
                  </div>
                  <span className={`text-xs font-semibold ${colors.text} flex items-center gap-1`}>
                    {isOpen ? "Recolher" : "Expandir"}
                    {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Card Total Consolidado */}
      {empresas.length > 1 && (
        <div className="rounded-2xl border-2 border-slate-300 bg-gradient-to-r from-slate-50 to-slate-100 overflow-hidden">
          <div className="px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-slate-700 shadow-sm">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-800">TOTAL CONSOLIDADO</h3>
                <span className="text-xs text-slate-500">{empresas.map(e => shortEmpresaName(e.nome)).join(" + ")}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-extrabold text-slate-800">{formatCurrency(totals.total)}</div>
              <div className="text-xs text-slate-500">{totals.count} títulos</div>
            </div>
          </div>
          <div className="px-5 pb-4">
            <div className="w-full h-3 rounded-full bg-white/70 overflow-hidden shadow-inner mb-3">
              <div className="h-full flex">
                {totals.vencido > 0 && totals.total > 0 && <div className="bg-red-400 h-full transition-all" style={{ width: `${(totals.vencido / totals.total) * 100}%` }} />}
                <div className="bg-slate-500 h-full opacity-60 transition-all" style={{ width: `${totals.total > 0 ? ((totals.aVencer / totals.total) * 100) : 100}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-red-50 rounded-lg px-4 py-3 border border-red-200">
                <div className="flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <span className="text-xs font-bold text-red-500 uppercase tracking-wider">Total Vencido</span>
                </div>
                <div className="text-xl font-bold text-red-700">{formatCurrency(totals.vencido)}</div>
              </div>
              <div className="bg-blue-50 rounded-lg px-4 py-3 border border-blue-200">
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Total A Vencer</span>
                </div>
                <div className="text-xl font-bold text-blue-700">{formatCurrency(totals.aVencer)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hierarquia expandida: Empresa → Mês → Banco → Filtros + Card + Lista */}
      <div className="space-y-6">
        {empresas.filter(emp => expandedEmpresas.has(emp.nome)).map(emp => {
          const empColors = getEmpresaColor(emp.nome);

          return (
            <div key={emp.nome} className={`rounded-2xl border-2 ${empColors.border} overflow-hidden shadow-sm`}>
              <div className={`px-5 py-3.5 ${empColors.headerBg} flex items-center justify-between border-b-2 ${empColors.border}`}>
                <div className="flex items-center gap-3">
                  <Building2 className={`w-5 h-5 ${empColors.text}`} />
                  <div>
                    <h3 className={`font-bold text-base ${empColors.text}`}>{emp.nome}</h3>
                    <span className="text-xs text-slate-500">{emp.count} títulos · {formatCurrency(emp.total)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setChequesOpenEmpresa(prev => prev === emp.nome ? null : emp.nome);
                    }}
                    className="group relative inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 text-white shadow-md hover:shadow-lg hover:shadow-amber-300/40 hover:scale-[1.04] active:scale-[0.98] border border-amber-300/30"
                  >
                    <Receipt className="w-4 h-4 transition-transform group-hover:rotate-[-8deg]" />
                    <span>Cheques</span>
                    <span className="ml-0.5 w-5 h-5 rounded-full bg-white/25 flex items-center justify-center text-[10px] font-extrabold">
                      {chequesOpenEmpresa === emp.nome ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </span>
                    <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                  <button onClick={() => toggleSet(setExpandedEmpresas, emp.nome)} className="text-slate-400 hover:text-slate-600 p-1">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Cheques Panel */}
              {chequesOpenEmpresa === emp.nome && (
                <div className="mx-4 my-3 rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50/80 via-white to-orange-50/50 shadow-lg overflow-hidden">
                  <div className="px-5 py-4 bg-gradient-to-r from-amber-500 via-amber-500 to-orange-500 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 shadow-inner">
                        <Receipt className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h4 className="text-white font-bold text-base tracking-wide">Controle de Cheques</h4>
                        <p className="text-amber-100 text-xs">{shortEmpresaName(emp.nome)} — {chequeMesKey ? formatMonth(chequeMesKey) : "Gestão completa de cheques"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Month filter dropdown */}
                      <div className="relative">
                        <select
                          value={chequeMesKey || ""}
                          onChange={(e) => {
                            setChequeMesKey(e.target.value || null);
                            setChequeSelectedFilter(null);
                          }}
                          className="appearance-none bg-white/20 backdrop-blur-sm text-white text-xs font-medium border border-white/30 rounded-lg pl-7 pr-7 py-1.5 cursor-pointer hover:bg-white/30 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 [&>option]:text-slate-800 [&>option]:bg-white"
                        >
                          <option value="">Todos os Meses</option>
                          {(() => {
                            // Generate months from current -6 to +12
                            const options: { value: string; label: string }[] = [];
                            const now = new Date();
                            for (let i = -6; i <= 12; i++) {
                              const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
                              const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                              options.push({ value: val, label: formatMonth(val) });
                            }
                            return options.map(o => <option key={o.value} value={o.value}>{o.label}</option>);
                          })()}
                        </select>
                        <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/80 pointer-events-none" />
                        <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/80 pointer-events-none" />
                      </div>
                      <button
                        onClick={() => { setChequesOpenEmpresa(null); setChequeMesKey(null); }}
                        className="text-white/70 hover:text-white hover:bg-white/10 rounded-lg p-1.5 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="px-5 py-4">
                    {/* Search bar */}
                    <div className="relative mb-4">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Buscar por cliente, forma de pagamento, descrição..."
                        value={chequeSearchQuery}
                        onChange={(e) => setChequeSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-10 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-all placeholder:text-slate-400"
                      />
                      {chequeSearchQuery && (
                        <button
                          onClick={() => setChequeSearchQuery("")}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {/* Filter: Todos */}
                    <button
                      onClick={() => setChequeSelectedFilter(chequeSelectedFilter === null ? null : null)}
                      className={`w-full mb-3 px-4 py-3 rounded-xl border-2 transition-all duration-200 flex items-center gap-3 ${
                        chequeSelectedFilter === null
                          ? "border-amber-400 bg-amber-50 shadow-md ring-2 ring-amber-300/50"
                          : "border-slate-200 bg-white hover:border-amber-300 hover:bg-amber-50/30"
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                        chequeSelectedFilter === null ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-500"
                      }`}>
                        <Layers className="w-5 h-5" />
                      </div>
                      <div className="flex-1 text-left">
                        <div className={`text-sm font-bold ${chequeSelectedFilter === null ? "text-amber-700" : "text-slate-700"}`}>TODOS OS CHEQUES</div>
                        <div className="text-xs text-slate-500">
                          {chequesQuery.data ? `${chequesQuery.data.totalGeralCount} cheques — R$ ${chequesQuery.data.totalGeral.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "Visualizar todos os cheques de todos os estados"}
                        </div>
                      </div>
                      {chequeSelectedFilter === null && <CheckCircle2 className="w-5 h-5 text-amber-500" />}
                    </button>

                    {/* Grid of 9 cheque states */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {[
                        { id: "DISPONIVEL", num: 1, label: "Cheque Disponível", desc: "Cheques que estão em nossas mãos", icon: HandCoins, color: "emerald" },
                        { id: "A_RECEBER", num: 2, label: "Cheque a Receber de Clientes", desc: "Clientes se comprometeram a encaminhar para empresa", icon: Clock, color: "blue" },
                        { id: "COMPENSACAO", num: 3, label: "Cheque em Compensação", desc: "Depositados no banco aguardando creditar na conta", icon: Timer, color: "cyan" },
                        { id: "CUSTODIA_SICOOB", num: 4, label: "Cheque Custódia Sicoob", desc: "Depositados no Sicoob aguardando depósito automático", icon: Building, color: "violet" },
                        { id: "CUSTODIA_SICREDI", num: 5, label: "Cheque Custódia Sicredi", desc: "Depositados no Sicredi aguardando depósito automático", icon: Building, color: "purple" },
                        { id: "LINHA_11", num: 6, label: "Cheque Linha 11", desc: "Voltaram porque não tinha valor na conta do cliente", icon: RotateCcw, color: "red" },
                        { id: "LINHA_12", num: 7, label: "Cheque Linha 12", desc: "Já foi 2 vezes na conta do cliente e não tinha saldo", icon: Ban, color: "rose" },
                        { id: "VOLTOU_OUTROS", num: 8, label: "Cheque Voltou Outros Motivos", desc: "Voltaram por vários motivos (rasuras, assinaturas, etc.)", icon: AlertTriangle, color: "orange" },
                        { id: "FACTORING_SAMONEY", num: 9, label: "Cheque Factoring Samoney", desc: "Cheques disponíveis na Samoney", icon: Scissors, color: "amber" },
                        { id: "FACTORING_CIFRAS", num: 10, label: "Cheque Factoring Cifras", desc: "Cheques disponíveis na Cifras (CMI)", icon: Scissors, color: "pink" },
                        { id: "FACTORING_FINANZA", num: 11, label: "Cheque Factoring Finanza", desc: "Cheques disponíveis na Finanza", icon: Scissors, color: "violet" },
                      ].map((state) => {
                        const isActive = chequeSelectedFilter === state.id;
                        const colorMap: Record<string, { bg: string; activeBg: string; border: string; activeBorder: string; iconBg: string; activeIconBg: string; text: string; activeText: string; num: string; activeNum: string }> = {
                          emerald: { bg: "bg-white", activeBg: "bg-emerald-50", border: "border-slate-200", activeBorder: "border-emerald-400", iconBg: "bg-emerald-100 text-emerald-600", activeIconBg: "bg-emerald-500 text-white", text: "text-slate-700", activeText: "text-emerald-700", num: "bg-slate-100 text-slate-500", activeNum: "bg-emerald-500 text-white" },
                          blue: { bg: "bg-white", activeBg: "bg-blue-50", border: "border-slate-200", activeBorder: "border-blue-400", iconBg: "bg-blue-100 text-blue-600", activeIconBg: "bg-blue-500 text-white", text: "text-slate-700", activeText: "text-blue-700", num: "bg-slate-100 text-slate-500", activeNum: "bg-blue-500 text-white" },
                          cyan: { bg: "bg-white", activeBg: "bg-cyan-50", border: "border-slate-200", activeBorder: "border-cyan-400", iconBg: "bg-cyan-100 text-cyan-600", activeIconBg: "bg-cyan-500 text-white", text: "text-slate-700", activeText: "text-cyan-700", num: "bg-slate-100 text-slate-500", activeNum: "bg-cyan-500 text-white" },
                          violet: { bg: "bg-white", activeBg: "bg-violet-50", border: "border-slate-200", activeBorder: "border-violet-400", iconBg: "bg-violet-100 text-violet-600", activeIconBg: "bg-violet-500 text-white", text: "text-slate-700", activeText: "text-violet-700", num: "bg-slate-100 text-slate-500", activeNum: "bg-violet-500 text-white" },
                          purple: { bg: "bg-white", activeBg: "bg-purple-50", border: "border-slate-200", activeBorder: "border-purple-400", iconBg: "bg-purple-100 text-purple-600", activeIconBg: "bg-purple-500 text-white", text: "text-slate-700", activeText: "text-purple-700", num: "bg-slate-100 text-slate-500", activeNum: "bg-purple-500 text-white" },
                          red: { bg: "bg-white", activeBg: "bg-red-50", border: "border-slate-200", activeBorder: "border-red-400", iconBg: "bg-red-100 text-red-600", activeIconBg: "bg-red-500 text-white", text: "text-slate-700", activeText: "text-red-700", num: "bg-slate-100 text-slate-500", activeNum: "bg-red-500 text-white" },
                          rose: { bg: "bg-white", activeBg: "bg-rose-50", border: "border-slate-200", activeBorder: "border-rose-400", iconBg: "bg-rose-100 text-rose-600", activeIconBg: "bg-rose-500 text-white", text: "text-slate-700", activeText: "text-rose-700", num: "bg-slate-100 text-slate-500", activeNum: "bg-rose-500 text-white" },
                          orange: { bg: "bg-white", activeBg: "bg-orange-50", border: "border-slate-200", activeBorder: "border-orange-400", iconBg: "bg-orange-100 text-orange-600", activeIconBg: "bg-orange-500 text-white", text: "text-slate-700", activeText: "text-orange-700", num: "bg-slate-100 text-slate-500", activeNum: "bg-orange-500 text-white" },
                          amber: { bg: "bg-white", activeBg: "bg-amber-50", border: "border-slate-200", activeBorder: "border-amber-400", iconBg: "bg-amber-100 text-amber-600", activeIconBg: "bg-amber-500 text-white", text: "text-slate-700", activeText: "text-amber-700", num: "bg-slate-100 text-slate-500", activeNum: "bg-amber-500 text-white" },
                          pink: { bg: "bg-white", activeBg: "bg-pink-50", border: "border-slate-200", activeBorder: "border-pink-400", iconBg: "bg-pink-100 text-pink-600", activeIconBg: "bg-pink-500 text-white", text: "text-slate-700", activeText: "text-pink-700", num: "bg-slate-100 text-slate-500", activeNum: "bg-pink-500 text-white" },
                        };
                        const c = colorMap[state.color] || colorMap.amber;
                        const StateIcon = state.icon;
                        return (
                          <button
                            key={state.id}
                            onClick={() => setChequeSelectedFilter(isActive ? null : state.id)}
                            className={`group relative px-3 py-3 rounded-xl border-2 transition-all duration-200 text-left flex items-start gap-2.5 ${
                              isActive
                                ? `${c.activeBg} ${c.activeBorder} shadow-md ring-1 ring-offset-1 ${c.activeBorder.replace("border", "ring")}`
                                : `${c.bg} ${c.border} hover:shadow-sm hover:${c.activeBorder}`
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                              isActive ? c.activeIconBg : c.iconBg
                            }`}>
                              <StateIcon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className={`text-xs font-bold leading-tight truncate block ${
                                isActive ? c.activeText : c.text
                              }`}>{state.label}</span>
                              <p className="text-[10px] text-slate-500 leading-snug mt-0.5 line-clamp-2">{state.desc}</p>
                              {chequesQuery.data?.totaisPorEstado?.[state.id] ? (
                                <p className={`text-sm font-extrabold mt-1.5 ${isActive ? c.activeText : "text-slate-800"}`}>
                                  {chequesQuery.data.totaisPorEstado[state.id].count} cheques — R$ {chequesQuery.data.totaisPorEstado[state.id].valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </p>
                              ) : (
                                <p className={`text-sm font-extrabold mt-1.5 ${isActive ? c.activeText : "text-slate-400"}`}>
                                  0 cheques — R$ 0,00
                                </p>
                              )}
                            </div>
                            {isActive && <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${c.activeText}`} />}
                          </button>
                        );
                      })}
                    </div>


                    {/* Cheques Data Table */}
                    <div className="mt-4">
                      {chequesQuery.isLoading ? (
                        <div className="flex items-center justify-center py-8 gap-2 text-slate-400">
                          <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                          <span className="text-sm">Carregando cheques...</span>
                        </div>
                      ) : chequesQuery.error ? (
                        <div className="text-center py-6 text-red-500 text-sm">Erro ao carregar cheques</div>
                      ) : (() => {
                        const allCheques = chequesQuery.data?.cheques || [];
                        // Agrupar cheques com mesmo banco+número (ex: "SICREDI - Nº 7")
                        const groupedCheques = (() => {
                          const groups = new Map<string, any[]>();
                          const ungrouped: any[] = [];
                          for (const c of allCheques) {
                            if (c.dadosCheque) {
                              // Extract banco + número + titular for grouping
                              // Format: "BANCO - Nº X - TITULAR" -> key = full dadosCheque string
                              // Only group if SAME banco + SAME número + SAME titular (cliente)
                              const key = (c.dadosCheque as string).trim();
                              if (!groups.has(key)) groups.set(key, []);
                              groups.get(key)!.push(c);
                            } else {
                              ungrouped.push(c);
                            }
                          }
                          const result: any[] = [];
                          for (const [key, items] of Array.from(groups.entries())) {
                            if (items.length > 1) {
                              // Merge into single entry
                              const totalValor = items.reduce((s: number, i: any) => s + i.valor, 0);
                              const clientes = Array.from(new Set(items.map((i: any) => i.cliente).filter(Boolean)));
                              const vencimentos = items.map((i: any) => i.vencimentoData).filter(Boolean).sort();
                              const emissoes = items.map((i: any) => i.emissaoData).filter(Boolean).sort();
                              result.push({
                                ...items[0],
                                id: items[0].id,
                                _groupedIds: items.map((i: any) => i.id),
                                _groupedCount: items.length,
                                _groupedItems: items,
                                valor: totalValor,
                                cliente: clientes.join(", "),
                                dadosCheque: key,
                                vencimentoData: vencimentos[vencimentos.length - 1] || null,
                                emissaoData: emissoes[0] || null,
                                descricao: items.map((i: any) => i.descricao + (i.parcela ? ` (${i.parcela}/${i.parcelasTotal || "?"})` : "")).join(" | "),
                                _isGrouped: true,
                              });
                            } else {
                              result.push(items[0]);
                            }
                          }
                          return [...result, ...ungrouped];
                        })();
                        const searchLower = chequeSearchQuery.toLowerCase().trim();
                        const searchFiltered = searchLower
                          ? groupedCheques.filter((c: any) =>
                              (c.cliente || "").toLowerCase().includes(searchLower) ||
                              (c.formaPagamento || "").toLowerCase().includes(searchLower) ||
                              (c.descricao || "").toLowerCase().includes(searchLower) ||
                              (c.estadoCheque || "").toLowerCase().includes(searchLower) ||
                              (c.dadosCheque || "").toLowerCase().includes(searchLower)
                            )
                          : groupedCheques;
                        const displayCheques = chequeSelectedFilter
                          ? searchFiltered.filter((c: any) => c.estadoCheque === chequeSelectedFilter)
                          : searchFiltered;
                        const totalDisplay = displayCheques.reduce((s: number, c: any) => s + c.valor, 0);
                        if (displayCheques.length === 0) {
                          return (
                            <div className="text-center py-6 text-slate-400 text-sm">
                              <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40" />
                              Nenhum cheque encontrado{chequeSelectedFilter ? " para este filtro" : ""}
                            </div>
                          );
                        }
                        return (
                          <div className="border border-slate-200 rounded-xl overflow-hidden">
                            <div className="px-2 sm:px-3 py-2 sm:py-2.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-1.5 sm:gap-2">
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-semibold text-slate-600">
                                  {displayCheques.length} cheque{displayCheques.length !== 1 ? "s" : ""}
                                  {chequeSelectedFilter ? " filtrado" + (displayCheques.length !== 1 ? "s" : "") : ""}
                                </span>
                                {exchangeMode && exchangeSelectedIds.size > 0 && (
                                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                                    {exchangeSelectedIds.size} selecionado{exchangeSelectedIds.size !== 1 ? "s" : ""}
                                    {" "}— R$ {displayCheques.filter((c: any) => exchangeSelectedIds.has(c.id)).reduce((s: number, c: any) => s + c.valor, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-bold text-amber-600">
                                  Total: R$ {totalDisplay.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </span>
                                {!exchangeMode ? (
                                  <button
                                    onClick={() => {
                                      if (!exchangeAuthenticated) {
                                        setShowExchangePasswordDialog(true);
                                        setExchangePasswordInput("");
                                        setExchangePasswordError(false);
                                      } else {
                                        setExchangeMode(true);
                                      }
                                    }}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-indigo-100 text-indigo-700 hover:bg-indigo-200 border border-indigo-200 transition-colors"
                                    title="Selecionar cheques para troca"
                                  >
                                    <Scissors className="w-3 h-3" />
                                    Troca
                                  </button>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={() => { setExchangeMode(false); setExchangeSelectedIds(new Set()); }}
                                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200 transition-colors"
                                    >
                                      <X className="w-3 h-3" />
                                      Cancelar
                                    </button>
                                    <button
                                      onClick={handleExchangeComplete}
                                      disabled={exchangeSelectedIds.size === 0 || exchangeProcessing}
                                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-600 text-white hover:bg-emerald-700 border border-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      {exchangeProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                                      Concluído
                                    </button>
                                  </div>
                                )}
                                <button
                                  onClick={() => setShowUnifiedHistory(true)}
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-indigo-100 text-indigo-700 hover:bg-indigo-200 border border-indigo-200 transition-colors dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700"
                                  title="Histórico de cheques"
                                >
                                  <History className="w-3 h-3" />
                                  Histórico
                                </button>
                              </div>
                            </div>
                            <div className="overflow-x-auto max-h-[500px] overflow-y-auto -mx-1 px-1">
                              <table className="w-full text-xs min-w-[850px]">
                                <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 z-10">
                                  <tr className="border-b border-slate-200">
                                    {exchangeMode && (
                                      <th className="px-2 py-2 text-center w-8">
                                        <input
                                          type="checkbox"
                                          checked={displayCheques.length > 0 && displayCheques.every((c: any) => exchangeSelectedIds.has(c.id))}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              setExchangeSelectedIds(new Set(displayCheques.map((c: any) => c.id)));
                                            } else {
                                              setExchangeSelectedIds(new Set());
                                            }
                                          }}
                                          className="w-3.5 h-3.5 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                          title="Selecionar todos"
                                        />
                                      </th>
                                    )}
                                    <th className="px-2 sm:px-3 py-2 text-center font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap text-[10px] sm:text-xs">Vencimento</th>
                                    <th className="px-2 sm:px-3 py-2 text-center font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap text-[10px] sm:text-xs">Emissão</th>
                                    <th className="px-2 sm:px-3 py-2 text-center font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap text-[10px] sm:text-xs">Cliente</th>
                                    <th className="px-2 sm:px-3 py-2 text-center font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap text-[10px] sm:text-xs min-w-[160px] sm:min-w-[200px]">Dados do Cheque</th>
                                    <th className="px-2 sm:px-3 py-2 text-center font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap text-[10px] sm:text-xs">Valor</th>
                                    <th className="px-2 sm:px-3 py-2 text-center font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap text-[10px] sm:text-xs">Forma Pgto</th>
                                    <th className="px-2 sm:px-3 py-2 text-center font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap text-[10px] sm:text-xs">Descrição</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {displayCheques.map((cheque: any, idx: number) => {
                                    const venc = cheque.vencimentoData ? new Date(cheque.vencimentoData).toLocaleDateString("pt-BR") : "-";
                                    const emis = cheque.emissaoData ? new Date(cheque.emissaoData).toLocaleDateString("pt-BR") : "-";
                                    const isVencido = cheque.vencimentoData && new Date(cheque.vencimentoData) < new Date();
                                    // Extract short forma name (after "Cheque ")
                                    const formaShort = (cheque.formaPagamento || "").replace(/^Cheque\s*/i, "").replace(/À/g, "A").replace(/à/g, "a").trim() || cheque.formaPagamento;
                                    // Color badge for estado
                                    const estadoColors: Record<string, string> = {
                                      DISPONIVEL: "bg-emerald-100 text-emerald-700",
                                      A_RECEBER: "bg-blue-100 text-blue-700",
                                      COMPENSACAO: "bg-cyan-100 text-cyan-700",
                                      CUSTODIA_SICOOB: "bg-violet-100 text-violet-700",
                                      CUSTODIA_SICREDI: "bg-purple-100 text-purple-700",
                                      LINHA_11: "bg-red-100 text-red-700",
                                      LINHA_12: "bg-rose-100 text-rose-700",
                                      VOLTOU_OUTROS: "bg-orange-100 text-orange-700",
                                      FACTORING: "bg-amber-100 text-amber-700",
                                    };
                                    const badgeColor = estadoColors[cheque.estadoCheque] || "bg-slate-100 text-slate-700";
                                    return (
                                      <tr key={cheque.id || idx} className={`border-b border-slate-100 dark:border-slate-700 hover:bg-amber-50/30 dark:hover:bg-slate-700/30 transition-colors ${idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/30 dark:bg-slate-800/30"} ${exchangeMode && exchangeSelectedIds.has(cheque.id) ? "!bg-indigo-50 ring-1 ring-inset ring-indigo-200" : ""}`}>
                                        {exchangeMode && (
                                          <td className="px-2 py-2 text-center">
                                            <input
                                              type="checkbox"
                                              checked={exchangeSelectedIds.has(cheque.id)}
                                              onChange={() => handleExchangeToggle(cheque.id)}
                                              className="w-3.5 h-3.5 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                            />
                                          </td>
                                        )}
                                        <td className={`px-2 sm:px-3 py-2 text-center whitespace-nowrap font-medium text-[10px] sm:text-xs ${isVencido ? "text-red-600" : "text-slate-700 dark:text-slate-300"}`}>{venc}</td>
                                        <td className="px-2 sm:px-3 py-2 text-center whitespace-nowrap text-slate-500 dark:text-slate-400 text-[10px] sm:text-xs">{emis}</td>
                                        <td className="px-2 sm:px-3 py-2 text-center text-slate-700 dark:text-slate-300 text-[10px] sm:text-xs whitespace-normal">{cheque.cliente}</td>
                                        <td className="px-2 sm:px-3 py-2 text-center text-[10px] sm:text-xs">
                                          {cheque.dadosCheque ? (
                                            <span className="inline-block px-1.5 sm:px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium whitespace-nowrap text-[10px] sm:text-xs">{cheque.dadosCheque}</span>
                                          ) : (
                                            <span className="text-slate-300 dark:text-slate-600 italic">—</span>
                                          )}
                                        </td>
                                        <td className="px-2 sm:px-3 py-2 text-center font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap text-[10px] sm:text-xs">
                                          R$ {cheque.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                          {cheque._isGrouped && <span className="ml-1 inline-block px-1 py-0 rounded bg-amber-100 text-amber-700 text-[8px] sm:text-[9px] font-bold" title={`${cheque._groupedCount} cheques agrupados`}>{cheque._groupedCount}x</span>}
                                        </td>
                                        <td className="px-2 sm:px-3 py-2 text-center">
                                          <span className={`inline-block px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold whitespace-nowrap ${badgeColor}`}>
                                            {formaShort}
                                          </span>
                                        </td>
                                        <td className="px-2 sm:px-3 py-2 text-left text-slate-500 dark:text-slate-400 text-[10px] sm:text-xs whitespace-normal">
                                          <span>{cheque.descricao}{!cheque._isGrouped && cheque.parcela ? ` (${cheque.parcela}/${cheque.parcelasTotal || "?"})` : ""}</span>
                                        </td>

                                      </tr>
                                    );
                                  })}
                                </tbody>
                                <tfoot>
                                  <tr className="bg-amber-50 border-t-2 border-amber-300">
                                    <td colSpan={exchangeMode ? 5 : 4} className="px-2 sm:px-3 py-2 sm:py-2.5 text-left text-[10px] sm:text-xs font-bold text-amber-800 whitespace-nowrap">TOTAL ({displayCheques.length} cheques)</td>
                                    <td className="px-2 sm:px-3 py-2 sm:py-2.5 text-center text-xs sm:text-sm font-extrabold text-amber-700 whitespace-nowrap">R$ {totalDisplay.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                                    <td colSpan={2}></td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                    {/* Factoring Descontados Section */}
                    {factoringDescontadosQuery.data && factoringDescontadosQuery.data.totalCount > 0 && (
                      <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-amber-50/80 via-orange-50/50 to-yellow-50/60 border border-amber-200/60">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                            <Landmark className="w-4 h-4 text-amber-600" />
                          </div>
                          <h5 className="text-sm font-bold text-amber-800 tracking-wide">CHEQUES DESCONTADOS</h5>
                          <span className="ml-auto text-xs font-semibold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                            {factoringDescontadosQuery.data.totalCount} cheques — R$ {factoringDescontadosQuery.data.totalGeral.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {Object.entries(factoringDescontadosQuery.data.porFactoring).map(([company, data]) => {
                            const colorMap: Record<string, { bg: string; border: string; icon: string; text: string; badge: string }> = {
                              CIFRAS: { bg: "bg-gradient-to-br from-teal-50 to-emerald-50", border: "border-teal-300", icon: "bg-teal-500 text-white", text: "text-teal-800", badge: "bg-teal-100 text-teal-700" },
                              FINANZA: { bg: "bg-gradient-to-br from-blue-50 to-sky-50", border: "border-blue-300", icon: "bg-blue-500 text-white", text: "text-blue-800", badge: "bg-blue-100 text-blue-700" },
                              SAMONEY: { bg: "bg-gradient-to-br from-violet-50 to-purple-50", border: "border-violet-300", icon: "bg-violet-500 text-white", text: "text-violet-800", badge: "bg-violet-100 text-violet-700" },
                              OUTROS: { bg: "bg-gradient-to-br from-slate-50 to-gray-50", border: "border-slate-300", icon: "bg-slate-500 text-white", text: "text-slate-800", badge: "bg-slate-100 text-slate-700" },
                            };
                            const colors = colorMap[company] || colorMap.OUTROS;
                            return (
                              <div key={company} onClick={() => setSelectedFactoringDescontados(selectedFactoringDescontados === company ? null : company)} className={`relative p-4 rounded-xl border-2 ${colors.border} ${colors.bg} shadow-sm hover:shadow-md transition-shadow cursor-pointer ${selectedFactoringDescontados === company ? 'ring-2 ring-offset-1 ring-amber-400' : ''}`}>
                                <div className="flex items-center gap-2.5 mb-2">
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors.icon} shadow-sm`}>
                                    <Landmark className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <h6 className={`text-xs font-extrabold uppercase tracking-wider ${colors.text}`}>Factoring {company}</h6>
                                    <p className="text-[10px] text-slate-500">Cheques descontados</p>
                                  </div>
                                </div>
                                <div className="flex items-baseline justify-between mt-3">
                                  <span className={`text-lg font-black ${colors.text}`}>
                                    R$ {(data as any).valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                  </span>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${colors.badge}`}>
                                    {(data as any).count} cheque{(data as any).count !== 1 ? "s" : ""}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Descontados Detail Table */}
                        {selectedFactoringDescontados && factoringDescontadosQuery.data?.porFactoring[selectedFactoringDescontados] && (() => {
                          const factData = factoringDescontadosQuery.data.porFactoring[selectedFactoringDescontados] as any;
                          const cheques = factData.cheques || [];
                          const detailColorMap: Record<string, { border: string; headerBg: string; headerText: string; headBg: string; headText: string; hoverBg: string; divider: string; footBg: string; footBorder: string; footText: string; closeText: string; closeHover: string }> = {
                            CIFRAS: { border: "border-teal-300", headerBg: "bg-teal-100/80", headerText: "text-teal-800", headBg: "bg-teal-50", headText: "text-teal-700", hoverBg: "hover:bg-teal-50/50", divider: "divide-teal-100", footBg: "bg-teal-50", footBorder: "border-t border-teal-200", footText: "text-teal-800", closeText: "text-teal-600", closeHover: "hover:text-teal-800" },
                            FINANZA: { border: "border-blue-300", headerBg: "bg-blue-100/80", headerText: "text-blue-800", headBg: "bg-blue-50", headText: "text-blue-700", hoverBg: "hover:bg-blue-50/50", divider: "divide-blue-100", footBg: "bg-blue-50", footBorder: "border-t border-blue-200", footText: "text-blue-800", closeText: "text-blue-600", closeHover: "hover:text-blue-800" },
                            SAMONEY: { border: "border-violet-300", headerBg: "bg-violet-100/80", headerText: "text-violet-800", headBg: "bg-violet-50", headText: "text-violet-700", hoverBg: "hover:bg-violet-50/50", divider: "divide-violet-100", footBg: "bg-violet-50", footBorder: "border-t border-violet-200", footText: "text-violet-800", closeText: "text-violet-600", closeHover: "hover:text-violet-800" },
                          };
                          const dc = detailColorMap[selectedFactoringDescontados] || detailColorMap.FINANZA;
                          const selectedSum = cheques.filter((c: any) => factoringDescontadosCheckedIds.has(c.id)).reduce((sum: number, c: any) => sum + (c.valor || 0), 0);
                          const selectedCount = cheques.filter((c: any) => factoringDescontadosCheckedIds.has(c.id)).length;
                          const allChecked = cheques.length > 0 && cheques.every((c: any) => factoringDescontadosCheckedIds.has(c.id));
                          return (
                            <div className={`mt-4 border ${dc.border} rounded-lg overflow-hidden`}>
                              <div className={`${dc.headerBg} px-4 py-2 flex items-center justify-between`}>
                                <h6 className={`text-xs font-bold ${dc.headerText}`}>FACTORING {selectedFactoringDescontados} — {cheques.length} cheque{cheques.length !== 1 ? 's' : ''} descontados</h6>
                                <div className="flex items-center gap-3">
                                  {selectedCount > 0 && (
                                    <span className={`text-xs font-bold ${dc.headerText} bg-white/60 px-2 py-0.5 rounded flex items-center gap-1.5`}>
                                      <Calculator className="w-3.5 h-3.5" />
                                      {selectedCount} selecionado{selectedCount !== 1 ? 's' : ''} = R$ {selectedSum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                  )}
                                  <button onClick={(e) => { e.stopPropagation(); setSelectedFactoringDescontados(null); setFactoringDescontadosCheckedIds(new Set()); }} className={`text-xs ${dc.closeText} ${dc.closeHover} font-medium`}>Fechar</button>
                                </div>
                              </div>
                              <div className="max-h-[400px] overflow-y-auto">
                                <table className="w-full text-xs">
                                  <thead className={`${dc.headBg} sticky top-0`}>
                                    <tr>
                                      <th className={`px-2 py-2 text-center ${dc.headText}`}>
                                        <input type="checkbox" checked={allChecked} onChange={() => {
                                          if (allChecked) { setFactoringDescontadosCheckedIds(new Set()); }
                                          else { setFactoringDescontadosCheckedIds(new Set(cheques.map((c: any) => c.id))); }
                                        }} className="w-3.5 h-3.5 rounded cursor-pointer accent-amber-600" />
                                      </th>
                                      <th className={`px-3 py-2 text-left font-semibold ${dc.headText}`}>Cliente</th>
                                      <th className={`px-3 py-2 text-left font-semibold ${dc.headText}`}>Descrição</th>
                                      <th className={`px-3 py-2 text-left font-semibold ${dc.headText}`}>Dados do Cheque</th>
                                      <th className={`px-3 py-2 text-right font-semibold ${dc.headText}`}>Valor Original</th>
                                      <th className={`px-3 py-2 text-right font-semibold ${dc.headText}`}>Valor Recebido</th>
                                      <th className={`px-3 py-2 text-center font-semibold ${dc.headText}`}>Vencimento</th>
                                    </tr>
                                  </thead>
                                  <tbody className={`${dc.divider}`}>
                                    {cheques.map((c: any) => {
                                      const isChecked = factoringDescontadosCheckedIds.has(c.id);
                                      return (
                                        <tr key={c.id} className={`${dc.hoverBg} ${isChecked ? 'bg-amber-50/50' : ''}`}>
                                          <td className="px-2 py-2 text-center">
                                            <input type="checkbox" checked={isChecked} onChange={() => {
                                              setFactoringDescontadosCheckedIds(prev => {
                                                const next = new Set(prev);
                                                if (next.has(c.id)) next.delete(c.id);
                                                else next.add(c.id);
                                                return next;
                                              });
                                            }} className="w-3.5 h-3.5 rounded cursor-pointer accent-amber-600" />
                                          </td>
                                          <td className="px-3 py-2 font-medium text-slate-800 whitespace-normal">{c.cliente}</td>
                                          <td className="px-3 py-2 text-slate-600 whitespace-normal">{c.descricao || '-'}</td>
                                          <td className="px-3 py-2 text-slate-600 whitespace-normal">{c.dadosCheque || '-'}</td>
                                          <td className="px-3 py-2 text-right font-semibold text-slate-800 whitespace-nowrap">R$ {(c.valorOriginal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                          <td className="px-3 py-2 text-right font-semibold text-green-700 whitespace-nowrap">R$ {(c.valorRecebido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                          <td className="px-3 py-2 text-center text-slate-600 whitespace-nowrap">{c.vencimentoData ? (() => { const parts = c.vencimentoData.split('T')[0].split('-'); return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : c.vencimentoData; })() : '-'}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                  <tfoot className={`${dc.footBg} ${dc.footBorder}`}>
                                    <tr>
                                      <td></td>
                                      <td colSpan={3} className={`px-3 py-2 font-bold ${dc.footText}`}>Total</td>
                                      <td className={`px-3 py-2 text-right font-bold ${dc.footText}`}>R$ {cheques.reduce((s: number, c: any) => s + (c.valorOriginal || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                      <td className={`px-3 py-2 text-right font-bold text-green-700`}>R$ {factData.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                      <td></td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                              {selectedCount > 0 && (
                                <div className={`${dc.headerBg} px-4 py-2.5 border-t ${dc.border} flex items-center justify-between`}>
                                  <span className={`text-xs ${dc.headerText} flex items-center gap-1.5`}>
                                    <Calculator className="w-4 h-4" />
                                    {selectedCount} cheque{selectedCount !== 1 ? 's' : ''} selecionado{selectedCount !== 1 ? 's' : ''}
                                  </span>
                                  <span className={`text-sm font-black ${dc.headerText}`}>Soma: R$ {selectedSum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}

                </div>
              )}

              <div className="bg-white">
                {emp.meses.map((mes, mi) => {
                  const mesKey = `${emp.nome}|${mes.mes}`;
                  const isMesOpen = expandedMeses.has(mesKey);
                  const today = new Date().toISOString().substring(0, 7);
                  const isOverdueMonth = mes.mes < today;
                  const currentMonth = mes.mes === today;

                  // Check if this month should blink for discount alerts
                  const mesHasAlert = discountAlerts?.isAlertOperator
                    && discountAlerts.blinkLevel === "mes-card"
                    && discountAlerts.alertMeses.get(emp.nome)?.has(mes.mes);

                  return (
                    <div key={mes.mes} className={`${mi > 0 ? "border-t border-slate-200" : ""}`}>
                      <button onClick={() => {
                        if (mesHasAlert && discountAlerts) {
                          discountAlerts.advanceBlink("mes-card");
                          // Mark all alerts for this empresa/month as read
                          discountAlerts.markAlertsReadForMes(emp.nome, mes.mes);
                        }
                        toggleSet(setExpandedMeses, mesKey);
                      }}
                        className={`w-full px-5 py-3.5 flex items-center justify-between hover:bg-slate-50 transition-all ${
                          isOverdueMonth ? "bg-red-50/40" : currentMonth ? "bg-blue-50/40" : ""
                        } ${mesHasAlert ? "animate-discount-glow" : ""}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                            isOverdueMonth ? "bg-red-100 border border-red-200" : currentMonth ? "bg-blue-100 border border-blue-200" : "bg-slate-100 border border-slate-200"
                          }`}>
                            <Calendar className={`w-4 h-4 ${isOverdueMonth ? "text-red-500" : currentMonth ? "text-blue-600" : "text-slate-500"}`} />
                          </div>
                          <div>
                            <span className={`font-bold text-sm ${isOverdueMonth ? "text-red-700" : "text-slate-700"}`}>
                              {formatMonth(mes.mes)}
                            </span>
                            {currentMonth && <span className="ml-2 text-[10px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">MÊS ATUAL</span>}
                            <span className="ml-2 text-xs text-slate-400">{mes.count} títulos · {mes.contas.length} {mes.contas.length === 1 ? "conta" : "contas"}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`font-bold text-sm ${isOverdueMonth ? "text-red-600" : "text-slate-700"}`}>{formatCurrency(mes.total)}</span>
                          {isMesOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                        </div>
                      </button>

                      {isMesOpen && (
                        <div className={`pl-6 pr-4 pb-5 pt-3 space-y-3 border-l-4 ml-4 mr-2 mb-2 rounded-bl-xl ${isOverdueMonth ? "bg-red-100/60 border-l-red-400" : currentMonth ? "bg-blue-100/60 border-l-blue-400" : "bg-slate-200/70 border-l-slate-400"}`}>
                          {mes.contas.map((conta, ci) => {
                            const contaKey = `${mesKey}|${conta.bancoNome}|${conta.contaNumero}`;
                            const isContaOpen = expandedContas.has(contaKey);
                            const bankShort = shortBankName(conta.bancoNome);
                            const bankIconColor = BANK_ICONS[bankShort] || "text-slate-500";
                            const contaEmpresa = (conta as any).contaEmpresa as string | null;
                            const contaLabel = conta.contaNumero
                              ? `${bankShort}${contaEmpresa ? ` ${contaEmpresa}` : ''} · Ag ${conta.agencia || "-"} · Cc ${formatContaNumero(conta.contaNumero)}`
                              : bankShort;
                            const contaItems = isContaOpen ? getContaItems(emp.nome, mes.mes, conta.bancoNome, conta.contaNumero) : [];

                            return (
                              <div key={ci} className="rounded-xl border-2 border-slate-300 bg-white overflow-hidden shadow-md">
                                <button onClick={() => toggleSet(setExpandedContas, contaKey)}
                                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-all cursor-pointer">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center">
                                      <Landmark className={`w-4 h-4 ${bankIconColor}`} />
                                    </div>
                                    <div>
                                      <span className="text-sm font-semibold text-slate-700">{contaLabel}</span>
                                      <span className="ml-2 text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md font-medium">{conta.count} títulos</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="font-bold text-sm text-slate-700">{formatCurrency(conta.total)}</span>
                                    {isContaOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                                  </div>
                                </button>

                                {/* Cards Sicoob Palitos - aparecem apenas na conta Sicoob da empresa PALITOS */}
                                {isContaOpen && bankShort === "Sicoob" && shortEmpresaName(emp.nome) === "PALITOS" && (
                                  <div className="mx-3 my-2 space-y-2">
                                    <SicoobDescontoSemanalCard />
                                    <SicoobLimiteCard />
                                  </div>
                                )}

                                {/* Card Bradesco - Limite atual da conta garantida */}
                                {isContaOpen && bankShort === "Bradesco" && (
                                  <div className="mx-3 my-2">
                                    <BradescoLimiteContaGarantidaCard empresa={shortEmpresaName(emp.nome)} />
                                  </div>
                                )}

                                {/* Filtros + Card + Tabela DENTRO da conta bancária */}
                                {isContaOpen && contaItems.length > 0 && (
                                  <ContaFiltersAndTable
                                    allContaItems={contaItems}
                                    contaLabel={contaLabel}
                                    contaKey={contaKey}
                                    selectedIds={getSelectedIds(contaKey)}
                                    toggleSelect={(id: number) => toggleSelect(contaKey, id)}
                                    toggleSelectAll={(items: ItemData[]) => toggleSelectAll(contaKey, items)}
                                    clearSelection={() => clearSelection(contaKey)}
                                    expandedItem={expandedItem}
                                    setExpandedItem={setExpandedItem}
                                    empresaNome={shortEmpresaName(emp.nome)}
                                    empresaNomeFull={emp.nome}
                                    bancoNome={conta.bancoNome}
                                    contaNumero={conta.contaNumero}
                                    mesLabel={formatMonth(mes.mes)}
                                    mesKey={mes.mes}
                                    showHistoryPanel={showHistoryPanel === contaKey}
                                    setShowHistoryPanel={(show: boolean) => setShowHistoryPanel(show ? contaKey : null)}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mensagem quando nenhuma empresa expandida */}
      {empresas.length > 0 && expandedEmpresas.size === 0 && (
        <div className="text-center py-10 text-slate-400">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">Clique em uma empresa acima para ver os detalhes</p>
          <p className="text-xs mt-1 text-slate-300">Os recebíveis serão organizados por mês e conta bancária</p>
        </div>
      )}

      {empresas.length === 0 && !isLoading && (
        <div className="text-center py-12 text-slate-400">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>Nenhum recebível encontrado</p>
        </div>
      )}

      {/* Exchange Password Dialog */}
      <Dialog open={showExchangePasswordDialog} onOpenChange={(v) => { if (!v) { setExchangePasswordInput(""); setExchangePasswordError(false); } setShowExchangePasswordDialog(v); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-indigo-600" />
              Autorização para Troca de Cheques
            </DialogTitle>
            <DialogDescription>
              Digite a senha do Fernando para selecionar cheques para troca.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleExchangePasswordSubmit}>
            <div className="py-4">
              <Input
                type="password"
                placeholder="Digite a senha..."
                value={exchangePasswordInput}
                onChange={(e) => { setExchangePasswordInput(e.target.value); setExchangePasswordError(false); }}
                autoFocus
                className={exchangePasswordError ? "border-red-500 focus-visible:ring-red-500" : ""}
              />
              {exchangePasswordError && (
                <p className="text-xs text-red-500 mt-2">Senha incorreta. Tente novamente.</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setExchangePasswordInput(""); setExchangePasswordError(false); setShowExchangePasswordDialog(false); }}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!exchangePasswordInput.trim()} className="bg-indigo-600 hover:bg-indigo-700">
                <ShieldCheck className="w-4 h-4 mr-2" />
                Confirmar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Exchange History Panel */}
      {/* Dialog Cheques Descontados (legacy - kept for backward compat, hidden) */}
      <Dialog open={false} onOpenChange={setShowDescontados}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Histórico de Cheques Descontados
            </DialogTitle>
            <DialogDescription>
              Cheques que foram compensados/descontados e saíram do controle ativo.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {descontadosQuery.isLoading ? (
              <div className="text-center py-8 text-slate-400">
                <Loader2 className="w-6 h-6 mx-auto animate-spin mb-2" />
                Carregando histórico...
              </div>
            ) : !descontadosQuery.data || descontadosQuery.data.cheques.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-40" />
                Nenhum cheque descontado encontrado.
              </div>
            ) : (
              <div className="space-y-3">
                {/* Summary */}
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-green-800">{descontadosQuery.data.count} cheques descontados</div>
                    <div className="text-xs text-green-600">Total compensado</div>
                  </div>
                  <div className="text-lg font-bold text-green-700">
                    R$ {descontadosQuery.data.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-xs min-w-[700px]">
                    <thead className="bg-slate-50">
                      <tr className="border-b border-slate-200">
                        <th className="px-3 py-2 text-left font-semibold text-slate-600">Cliente</th>
                        <th className="px-3 py-2 text-right font-semibold text-slate-600">Valor</th>
                        <th className="px-3 py-2 text-center font-semibold text-slate-600">Origem</th>
                        <th className="px-3 py-2 text-center font-semibold text-slate-600">Vencimento</th>
                        <th className="px-3 py-2 text-center font-semibold text-slate-600">Liquidado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {descontadosQuery.data.cheques.map((cheque: any) => {
                        const estadoLabels: Record<string, string> = {
                          DISPONIVEL: "Disponível",
                          A_RECEBER: "A Receber",
                          COMPENSACAO: "Compensação",
                          CUSTODIA_SICOOB: "Cust. Sicoob",
                          CUSTODIA_SICREDI: "Cust. Sicredi",
                          LINHA_11: "Linha 11",
                          LINHA_12: "Linha 12",
                          VOLTOU_OUTROS: "Voltou",
                          FACTORING: "Factoring",
                          OUTROS: "Outros",
                        };
                        const estadoColors: Record<string, string> = {
                          DISPONIVEL: "bg-emerald-100 text-emerald-700",
                          A_RECEBER: "bg-blue-100 text-blue-700",
                          COMPENSACAO: "bg-cyan-100 text-cyan-700",
                          CUSTODIA_SICOOB: "bg-violet-100 text-violet-700",
                          CUSTODIA_SICREDI: "bg-purple-100 text-purple-700",
                          LINHA_11: "bg-red-100 text-red-700",
                          LINHA_12: "bg-rose-100 text-rose-700",
                          VOLTOU_OUTROS: "bg-orange-100 text-orange-700",
                          FACTORING: "bg-amber-100 text-amber-700",
                          OUTROS: "bg-slate-100 text-slate-700",
                        };
                        const formatDateShort = (d: string | null) => {
                          if (!d) return "—";
                          const date = d.split("T")[0];
                          const [y, m, day] = date.split("-");
                          return `${day}/${m}/${y}`;
                        };
                        return (
                          <tr key={cheque.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700">
                            <td className="px-3 py-2 text-slate-700 font-medium max-w-[180px] truncate" title={cheque.cliente}>{cheque.cliente}</td>
                            <td className="px-3 py-2 text-right font-bold text-slate-800 whitespace-nowrap">R$ {cheque.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                            <td className="px-3 py-2 text-center">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${estadoColors[cheque.estadoOrigem] || "bg-slate-100 text-slate-600"}`}>
                                {estadoLabels[cheque.estadoOrigem] || cheque.estadoOrigem}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center text-slate-500 whitespace-nowrap">{formatDateShort(cheque.vencimentoData)}</td>
                            <td className="px-3 py-2 text-center text-green-600 font-medium whitespace-nowrap">{formatDateShort(cheque.liquidacaoData)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={false} onOpenChange={setShowExchangeHistory}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-600" />
              Histórico de Trocas de Cheques
            </DialogTitle>
            <DialogDescription>
              Registro de todas as trocas realizadas com PDFs salvos.
            </DialogDescription>
          </DialogHeader>

          {/* Period filters for exchange history */}
          <div className="flex flex-wrap items-center gap-2 py-2 border-b border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setExchangeHistoryPeriod('mes_atual')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                exchangeHistoryPeriod === 'mes_atual'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              Mês Atual
            </button>
            <button
              onClick={() => setExchangeHistoryPeriod('mes_anterior')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                exchangeHistoryPeriod === 'mes_anterior'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              Mês Anterior
            </button>
            <button
              onClick={() => setExchangeHistoryPeriod('custom')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                exchangeHistoryPeriod === 'custom'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              Todos
            </button>
          </div>

          <div className="py-4 space-y-3">
            {exchangeHistoryQuery.isLoading ? (
              <div className="text-center py-8 text-slate-400">
                <Loader2 className="w-6 h-6 mx-auto animate-spin mb-2" />
                Carregando histórico...
              </div>
            ) : !exchangeHistoryQuery.data || exchangeHistoryQuery.data.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-40" />
                Nenhuma troca registrada ainda.
              </div>
            ) : (
              exchangeHistoryQuery.data.map((exchange: any) => (
                <div key={exchange.id} className="border border-slate-200 rounded-xl p-4 hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                        {exchange.totalCheques} cheque{exchange.totalCheques !== 1 ? "s" : ""}
                      </span>
                      <span className="text-xs font-bold text-amber-700">
                        R$ {exchange.totalValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400">
                        {new Date(exchange.createdAt).toLocaleDateString("pt-BR")} às {new Date(exchange.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {exchange.pdfUrl && (
                        <a
                          href={exchange.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors"
                        >
                          <FileDown className="w-3 h-3" />
                          PDF
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    <span className="font-medium">Empresa:</span> {exchange.empresaNome} • <span className="font-medium">Autorizado por:</span> {exchange.operador}
                  </div>
                  {exchange.cheques && exchange.cheques.length > 0 && (
                    <div className="mt-2 border-t border-slate-100 pt-2">
                      <div className="grid grid-cols-1 gap-0.5">
                        {exchange.cheques.slice(0, 5).map((c: any, i: number) => (
                          <div key={i} className="flex items-center justify-between text-[10px] text-slate-500 py-0.5">
                            <span className="truncate max-w-[200px]">{c.cliente || "-"}</span>
                            <span className="font-medium text-slate-700">R$ {c.valor?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                          </div>
                        ))}
                        {exchange.cheques.length > 5 && (
                          <div className="text-[10px] text-slate-400 italic">... e mais {exchange.cheques.length - 5} cheque(s)</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Histórico Unificado de Cheques - REDESIGNED */}
      <Dialog open={showUnifiedHistory} onOpenChange={setShowUnifiedHistory}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-amber-600" />
              Movimentação de Cheques
            </DialogTitle>
            <DialogDescription>
              Resumo mensal e diário: entradas, descontos e trocas de cheques.
            </DialogDescription>
          </DialogHeader>

          {/* Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-700 pb-2">
            <button
              onClick={() => setUnifiedHistoryTab('sync')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                unifiedHistoryTab === 'sync'
                  ? 'bg-amber-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Resumo</span>
            </button>
            <button
              onClick={() => setUnifiedHistoryTab('descontados')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                unifiedHistoryTab === 'descontados'
                  ? 'bg-green-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Descontados</span>
            </button>
            <button
              onClick={() => setUnifiedHistoryTab('trocas')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                unifiedHistoryTab === 'trocas'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              <span className="flex items-center gap-1"><Scissors className="w-3 h-3" /> Trocas</span>
            </button>
          </div>

          {/* Period filters */}
          <div className="flex flex-wrap items-center gap-2 py-2 border-b border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setUnifiedHistoryPeriod('mes_atual')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                unifiedHistoryPeriod === 'mes_atual'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              Mês Atual
            </button>
            <button
              onClick={() => setUnifiedHistoryPeriod('mes_anterior')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                unifiedHistoryPeriod === 'mes_anterior'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              Mês Anterior
            </button>
            <button
              onClick={() => setUnifiedHistoryPeriod('custom')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                unifiedHistoryPeriod === 'custom'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              Personalizado
            </button>
            {unifiedHistoryPeriod === 'custom' && (
              <div className="flex items-center gap-2 ml-2">
                <input
                  type="date"
                  value={unifiedHistoryCustomStart}
                  onChange={(e) => setUnifiedHistoryCustomStart(e.target.value)}
                  className="px-2 py-1 text-xs border border-slate-300 rounded-lg dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
                />
                <span className="text-xs text-slate-400">até</span>
                <input
                  type="date"
                  value={unifiedHistoryCustomEnd}
                  onChange={(e) => setUnifiedHistoryCustomEnd(e.target.value)}
                  className="px-2 py-1 text-xs border border-slate-300 rounded-lg dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
                />
              </div>
            )}
          </div>

          {/* Tab Content: Resumo (entradas + saídas por dia) */}
          {unifiedHistoryTab === 'sync' && (
            <div className="py-4 space-y-4">
              {syncHistoryQuery.isLoading ? (
                <div className="text-center py-8 text-slate-400">
                  <Loader2 className="w-6 h-6 mx-auto animate-spin mb-2" />
                  Carregando movimentação...
                </div>
              ) : (() => {
                const syncData = syncHistoryQuery.data;
                const byDate = syncData?.byDate || [];
                // Also include descontados grouped by liquidacaoData
                const descontados = descontadosQuery.data?.cheques || [];
                const trocas = exchangeHistoryQuery.data || [];

                // Build combined daily summary
                const dailySummary: Record<string, {
                  date: string;
                  entradas: number;
                  valorEntradas: number;
                  descontados: number;
                  valorDescontados: number;
                  trocas: number;
                  valorTrocas: number;
                  detailEntradas: any[];
                  detailDescontados: any[];
                  detailTrocas: any[];
                }> = {};

                // Add sync entradas/saidas
                for (const day of byDate) {
                  if (!dailySummary[day.date]) {
                    dailySummary[day.date] = { date: day.date, entradas: 0, valorEntradas: 0, descontados: 0, valorDescontados: 0, trocas: 0, valorTrocas: 0, detailEntradas: [], detailDescontados: [], detailTrocas: [] };
                  }
                  dailySummary[day.date].entradas += day.totalEntradas;
                  dailySummary[day.date].valorEntradas += day.valorEntradas;
                  dailySummary[day.date].descontados += day.totalSaidas;
                  dailySummary[day.date].valorDescontados += day.valorSaidas;
                  dailySummary[day.date].detailEntradas = day.entradas;
                  dailySummary[day.date].detailDescontados = day.saidas;
                }

                // Add descontados by liquidacaoData
                for (const ch of descontados) {
                  const dateStr = ch.liquidacaoData ? ch.liquidacaoData.split('T')[0] : null;
                  if (!dateStr) continue;
                  if (!dailySummary[dateStr]) {
                    dailySummary[dateStr] = { date: dateStr, entradas: 0, valorEntradas: 0, descontados: 0, valorDescontados: 0, trocas: 0, valorTrocas: 0, detailEntradas: [], detailDescontados: [], detailTrocas: [] };
                  }
                  // Only add if not already counted from sync saidas
                  if (!dailySummary[dateStr].detailDescontados.some((d: any) => d.maxiprodId === ch.maxiprodId)) {
                    dailySummary[dateStr].descontados++;
                    dailySummary[dateStr].valorDescontados += ch.valor;
                    dailySummary[dateStr].detailDescontados.push(ch);
                  }
                }

                // Add trocas by createdAt date
                for (const t of trocas) {
                  const dateStr = t.createdAt ? new Date(t.createdAt).toISOString().split('T')[0] : null;
                  if (!dateStr) continue;
                  if (!dailySummary[dateStr]) {
                    dailySummary[dateStr] = { date: dateStr, entradas: 0, valorEntradas: 0, descontados: 0, valorDescontados: 0, trocas: 0, valorTrocas: 0, detailEntradas: [], detailDescontados: [], detailTrocas: [] };
                  }
                  dailySummary[dateStr].trocas += t.totalCheques;
                  dailySummary[dateStr].valorTrocas += t.totalValor;
                  dailySummary[dateStr].detailTrocas.push(t);
                }

                const sortedDays = Object.values(dailySummary).sort((a, b) => b.date.localeCompare(a.date));

                // Monthly totals
                const monthlyTotals = {
                  entradas: sortedDays.reduce((s, d) => s + d.entradas, 0),
                  valorEntradas: sortedDays.reduce((s, d) => s + d.valorEntradas, 0),
                  descontados: sortedDays.reduce((s, d) => s + d.descontados, 0),
                  valorDescontados: sortedDays.reduce((s, d) => s + d.valorDescontados, 0),
                  trocas: sortedDays.reduce((s, d) => s + d.trocas, 0),
                  valorTrocas: sortedDays.reduce((s, d) => s + d.valorTrocas, 0),
                };

                if (sortedDays.length === 0) {
                  return (
                    <div className="text-center py-8 text-slate-400">
                      <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p>Nenhuma movimentação de cheques neste período.</p>
                      <p className="text-[10px] mt-1">As movimentações são detectadas automaticamente a cada sincronização com o Maxiprod.</p>
                    </div>
                  );
                }

                return (
                  <>
                    {/* Monthly Summary Cards */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl p-3 text-center">
                        <div className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase">Entraram</div>
                        <div className="text-lg font-extrabold text-green-700 dark:text-green-300">{monthlyTotals.entradas}</div>
                        <div className="text-xs font-bold text-green-600 dark:text-green-400">R$ {monthlyTotals.valorEntradas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                      </div>
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl p-3 text-center">
                        <div className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase">Descontados</div>
                        <div className="text-lg font-extrabold text-red-700 dark:text-red-300">{monthlyTotals.descontados}</div>
                        <div className="text-xs font-bold text-red-600 dark:text-red-400">R$ {monthlyTotals.valorDescontados.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                      </div>
                      <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-xl p-3 text-center">
                        <div className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase">Trocas</div>
                        <div className="text-lg font-extrabold text-indigo-700 dark:text-indigo-300">{monthlyTotals.trocas}</div>
                        <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400">R$ {monthlyTotals.valorTrocas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                      </div>
                    </div>

                    {/* Daily Breakdown */}
                    <div className="space-y-2">
                      {sortedDays.map((day) => {
                        const fmtDayDate = new Date(day.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
                        const hasActivity = day.entradas > 0 || day.descontados > 0 || day.trocas > 0;
                        if (!hasActivity) return null;
                        return (
                          <details key={day.date} className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden group">
                            <summary className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-amber-500" />
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{fmtDayDate}</span>
                              </div>
                              <div className="flex items-center gap-2 text-[10px]">
                                {day.entradas > 0 && (
                                  <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-bold dark:bg-green-900/30 dark:text-green-400">
                                    +{day.entradas} (R$ {day.valorEntradas.toLocaleString('pt-BR', { minimumFractionDigits: 0 })})
                                  </span>
                                )}
                                {day.descontados > 0 && (
                                  <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold dark:bg-red-900/30 dark:text-red-400">
                                    -{day.descontados} (R$ {day.valorDescontados.toLocaleString('pt-BR', { minimumFractionDigits: 0 })})
                                  </span>
                                )}
                                {day.trocas > 0 && (
                                  <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-bold dark:bg-indigo-900/30 dark:text-indigo-400">
                                    ⇄{day.trocas} (R$ {day.valorTrocas.toLocaleString('pt-BR', { minimumFractionDigits: 0 })})
                                  </span>
                                )}
                                <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-open:rotate-180 transition-transform" />
                              </div>
                            </summary>
                            <div className="px-4 pb-3 space-y-2 border-t border-slate-100 dark:border-slate-700 pt-2">
                              {day.detailEntradas.length > 0 && (
                                <div>
                                  <div className="text-[10px] font-bold text-green-600 dark:text-green-400 mb-1 uppercase">Cheques que Entraram</div>
                                  <div className="space-y-0.5">
                                    {day.detailEntradas.map((ch: any, i: number) => (
                                      <div key={ch.id || i} className="flex items-center justify-between text-[11px] py-1 px-2 rounded bg-green-50/50 dark:bg-green-900/10">
                                        <span className="text-slate-700 dark:text-slate-300 truncate max-w-[220px]">{ch.cliente}</span>
                                        <div className="flex items-center gap-2">
                                          {ch.vencimentoData && <span className="text-[9px] text-slate-400">{new Date(ch.vencimentoData + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>}
                                          <span className="font-bold text-green-700 dark:text-green-400 whitespace-nowrap">R$ {(ch.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {day.detailDescontados.length > 0 && (
                                <div>
                                  <div className="text-[10px] font-bold text-red-600 dark:text-red-400 mb-1 uppercase">Cheques Descontados / Saíram</div>
                                  <div className="space-y-0.5">
                                    {day.detailDescontados.map((ch: any, i: number) => (
                                      <div key={ch.id || i} className="flex items-center justify-between text-[11px] py-1 px-2 rounded bg-red-50/50 dark:bg-red-900/10">
                                        <span className="text-slate-700 dark:text-slate-300 truncate max-w-[220px]">{ch.cliente}</span>
                                        <div className="flex items-center gap-2">
                                          {(ch.vencimentoData || ch.liquidacaoData) && <span className="text-[9px] text-slate-400">{new Date((ch.liquidacaoData || ch.vencimentoData) + (ch.liquidacaoData?.includes('T') ? '' : 'T12:00:00')).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>}
                                          <span className="font-bold text-red-700 dark:text-red-400 whitespace-nowrap">R$ {(ch.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {day.detailTrocas.length > 0 && (
                                <div>
                                  <div className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 mb-1 uppercase">Trocas Realizadas</div>
                                  <div className="space-y-0.5">
                                    {day.detailTrocas.map((t: any, i: number) => (
                                      <div key={t.id || i} className="flex items-center justify-between text-[11px] py-1 px-2 rounded bg-indigo-50/50 dark:bg-indigo-900/10">
                                        <span className="text-slate-700 dark:text-slate-300">{t.totalCheques} cheque{t.totalCheques !== 1 ? 's' : ''} — {t.empresaNome}</span>
                                        <span className="font-bold text-indigo-700 dark:text-indigo-400 whitespace-nowrap">R$ {(t.totalValor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </details>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* Tab Content: Trocas */}
          {unifiedHistoryTab === 'trocas' && (
            <div className="py-4 space-y-3">
              {exchangeHistoryQuery.isLoading ? (
                <div className="text-center py-8 text-slate-400">
                  <Loader2 className="w-6 h-6 mx-auto animate-spin mb-2" />
                  Carregando histórico de trocas...
                </div>
              ) : !exchangeHistoryQuery.data || exchangeHistoryQuery.data.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  Nenhuma troca registrada neste período.
                </div>
              ) : (
                exchangeHistoryQuery.data.map((exchange: any) => (
                  <div key={exchange.id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors dark:hover:border-indigo-700 dark:hover:bg-indigo-900/10">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full dark:bg-indigo-900/40 dark:text-indigo-300">
                          {exchange.totalCheques} cheque{exchange.totalCheques !== 1 ? 's' : ''}
                        </span>
                        <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                          R$ {exchange.totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400">
                          {new Date(exchange.createdAt).toLocaleDateString('pt-BR')} às {new Date(exchange.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {exchange.pdfUrl && (
                          <a
                            href={exchange.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors dark:bg-red-900/30 dark:text-red-400 dark:border-red-700"
                          >
                            <FileDown className="w-3 h-3" />
                            PDF
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      <span className="font-medium">Empresa:</span> {exchange.empresaNome} • <span className="font-medium">Autorizado por:</span> {exchange.operador}
                    </div>
                    {exchange.cheques && exchange.cheques.length > 0 && (
                      <div className="mt-2 border-t border-slate-100 dark:border-slate-700 pt-2">
                        <div className="grid grid-cols-1 gap-0.5">
                          {exchange.cheques.slice(0, 5).map((c: any, i: number) => (
                            <div key={i} className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 py-0.5">
                              <span className="truncate max-w-[200px]">{c.cliente || '-'}</span>
                              <span className="font-medium text-slate-700 dark:text-slate-300">R$ {c.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                          ))}
                          {exchange.cheques.length > 5 && (
                            <div className="text-[10px] text-slate-400 italic">... e mais {exchange.cheques.length - 5} cheque(s)</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab Content: Descontados */}
          {unifiedHistoryTab === 'descontados' && (
            <div className="py-4">
              {descontadosQuery.isLoading ? (
                <div className="text-center py-8 text-slate-400">
                  <Loader2 className="w-6 h-6 mx-auto animate-spin mb-2" />
                  Carregando cheques descontados...
                </div>
              ) : !descontadosQuery.data || descontadosQuery.data.cheques.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  Nenhum cheque descontado encontrado neste período.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-green-800 dark:text-green-300">{descontadosQuery.data.count} cheques descontados</div>
                      <div className="text-xs text-green-600 dark:text-green-400">Total compensado</div>
                    </div>
                    <div className="text-lg font-bold text-green-700 dark:text-green-300">
                      R$ {descontadosQuery.data.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                    <table className="w-full text-xs min-w-[600px]">
                      <thead className="bg-slate-50 dark:bg-slate-800">
                        <tr className="border-b border-slate-200 dark:border-slate-700">
                          <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">Cliente</th>
                          <th className="px-3 py-2 text-right font-semibold text-slate-600 dark:text-slate-300">Valor</th>
                          <th className="px-3 py-2 text-center font-semibold text-slate-600 dark:text-slate-300">Origem</th>
                          <th className="px-3 py-2 text-center font-semibold text-slate-600 dark:text-slate-300">Vencimento</th>
                          <th className="px-3 py-2 text-center font-semibold text-slate-600 dark:text-slate-300">Liquidado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {descontadosQuery.data.cheques.map((cheque: any) => {
                          const estadoLabels: Record<string, string> = {
                            DISPONIVEL: 'Disponível', A_RECEBER: 'A Receber', COMPENSACAO: 'Compensação',
                            CUSTODIA_SICOOB: 'Cust. Sicoob', CUSTODIA_SICREDI: 'Cust. Sicredi',
                            LINHA_11: 'Linha 11', LINHA_12: 'Linha 12', VOLTOU_OUTROS: 'Voltou',
                            FACTORING: 'Factoring', OUTROS: 'Outros',
                          };
                          const estadoColors: Record<string, string> = {
                            DISPONIVEL: 'bg-emerald-100 text-emerald-700', A_RECEBER: 'bg-blue-100 text-blue-700',
                            COMPENSACAO: 'bg-cyan-100 text-cyan-700', CUSTODIA_SICOOB: 'bg-violet-100 text-violet-700',
                            CUSTODIA_SICREDI: 'bg-purple-100 text-purple-700', LINHA_11: 'bg-red-100 text-red-700',
                            LINHA_12: 'bg-rose-100 text-rose-700', VOLTOU_OUTROS: 'bg-orange-100 text-orange-700',
                            FACTORING: 'bg-amber-100 text-amber-700', OUTROS: 'bg-slate-100 text-slate-700',
                          };
                          const fmtDate = (d: string | null) => {
                            if (!d) return '—';
                            const [y, m, day] = d.split('T')[0].split('-');
                            return `${day}/${m}/${y}`;
                          };
                          return (
                            <tr key={cheque.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700">
                              <td className="px-3 py-2 text-slate-700 dark:text-slate-300 font-medium max-w-[180px] truncate" title={cheque.cliente}>{cheque.cliente}</td>
                              <td className="px-3 py-2 text-right font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">R$ {cheque.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                              <td className="px-3 py-2 text-center">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${estadoColors[cheque.estadoOrigem] || 'bg-slate-100 text-slate-600'}`}>
                                  {estadoLabels[cheque.estadoOrigem] || cheque.estadoOrigem}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-center text-slate-500 dark:text-slate-400 whitespace-nowrap">{fmtDate(cheque.vencimentoData)}</td>
                              <td className="px-3 py-2 text-center text-green-600 dark:text-green-400 font-medium whitespace-nowrap">{fmtDate(cheque.liquidacaoData)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Histórico de Sincronização de Cheques (legacy - hidden) */}
      <Dialog open={false} onOpenChange={setShowSyncHistory}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-blue-600" />
              Histórico de Sincronização de Cheques
            </DialogTitle>
            <DialogDescription>
              Cheques que entraram ou saíram a cada sincronização com o Maxiprod.
            </DialogDescription>
          </DialogHeader>

          {/* Period filters */}
          <div className="flex flex-wrap items-center gap-2 py-2 border-b border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setSyncHistoryPeriod('mes_atual')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                syncHistoryPeriod === 'mes_atual'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              Mês Atual
            </button>
            <button
              onClick={() => setSyncHistoryPeriod('mes_anterior')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                syncHistoryPeriod === 'mes_anterior'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              Mês Anterior
            </button>
            <button
              onClick={() => setSyncHistoryPeriod('custom')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                syncHistoryPeriod === 'custom'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              Personalizado
            </button>
            {syncHistoryPeriod === 'custom' && (
              <div className="flex items-center gap-2 ml-2">
                <input
                  type="date"
                  value={syncHistoryCustomStart}
                  onChange={(e) => setSyncHistoryCustomStart(e.target.value)}
                  className="px-2 py-1 text-xs border border-slate-300 rounded-lg dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
                />
                <span className="text-xs text-slate-400">até</span>
                <input
                  type="date"
                  value={syncHistoryCustomEnd}
                  onChange={(e) => setSyncHistoryCustomEnd(e.target.value)}
                  className="px-2 py-1 text-xs border border-slate-300 rounded-lg dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
                />
              </div>
            )}
          </div>

          <div className="py-4 space-y-4">
            {syncHistoryQuery.isLoading ? (
              <div className="text-center py-8 text-slate-400">
                <Loader2 className="w-6 h-6 mx-auto animate-spin mb-2" />
                Carregando histórico de sincronização...
              </div>
            ) : !syncHistoryQuery.data || syncHistoryQuery.data.byDate.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <RotateCcw className="w-8 h-8 mx-auto mb-2 opacity-40" />
                Nenhuma mudança de cheques registrada neste período.
                <p className="text-[10px] mt-1 text-slate-300">As mudanças são detectadas automaticamente a cada sincronização com o Maxiprod.</p>
              </div>
            ) : (
              syncHistoryQuery.data.byDate.map((dayGroup: any) => (
                <div key={dayGroup.date} className="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-500" />
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                        {new Date(dayGroup.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px]">
                      {dayGroup.totalEntradas > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-bold dark:bg-green-900/30 dark:text-green-400">
                          +{dayGroup.totalEntradas} entrada{dayGroup.totalEntradas !== 1 ? 's' : ''} (R$ {dayGroup.valorEntradas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                        </span>
                      )}
                      {dayGroup.totalSaidas > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold dark:bg-red-900/30 dark:text-red-400">
                          -{dayGroup.totalSaidas} saída{dayGroup.totalSaidas !== 1 ? 's' : ''} (R$ {dayGroup.valorSaidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Entradas */}
                  {dayGroup.entradas.length > 0 && (
                    <div className="mb-2">
                      <div className="text-[10px] font-bold text-green-600 dark:text-green-400 mb-1 uppercase tracking-wider">Entraram</div>
                      <div className="space-y-0.5">
                        {dayGroup.entradas.map((ch: any) => (
                          <div key={ch.id} className="flex items-center justify-between text-[11px] py-1 px-2 rounded bg-green-50/50 dark:bg-green-900/10">
                            <div className="flex items-center gap-2">
                              <TrendingUp className="w-3 h-3 text-green-500" />
                              <span className="text-slate-700 dark:text-slate-300 truncate max-w-[200px]">{ch.cliente}</span>
                              {ch.empresaNome && <span className="text-[9px] text-slate-400">({ch.empresaNome})</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              {ch.vencimentoData && <span className="text-[9px] text-slate-400">Venc: {formatDate(ch.vencimentoData)}</span>}
                              <span className="font-bold text-green-700 dark:text-green-400">R$ {ch.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Saídas */}
                  {dayGroup.saidas.length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold text-red-600 dark:text-red-400 mb-1 uppercase tracking-wider">Saíram</div>
                      <div className="space-y-0.5">
                        {dayGroup.saidas.map((ch: any) => (
                          <div key={ch.id} className="flex items-center justify-between text-[11px] py-1 px-2 rounded bg-red-50/50 dark:bg-red-900/10">
                            <div className="flex items-center gap-2">
                              <TrendingUp className="w-3 h-3 text-red-500 rotate-180" />
                              <span className="text-slate-700 dark:text-slate-300 truncate max-w-[200px]">{ch.cliente}</span>
                              {ch.empresaNome && <span className="text-[9px] text-slate-400">({ch.empresaNome})</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              {ch.vencimentoData && <span className="text-[9px] text-slate-400">Venc: {formatDate(ch.vencimentoData)}</span>}
                              <span className="font-bold text-red-700 dark:text-red-400">R$ {ch.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{label}</div>
      <div className="text-sm font-medium text-slate-700 mt-0.5">{value}</div>
    </div>
  );
}
