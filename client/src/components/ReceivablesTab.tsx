import { useState, useMemo, useCallback } from "react";
import { useOperator } from "@/contexts/OperatorContext";
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
import MaxiprodSimulator, { getReceivablesSteps } from "@/components/MaxiprodSimulator";


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
              s.highlight ? "bg-amber-50 border-2 border-amber-300 shadow-sm" : "bg-slate-50 border border-slate-200"
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
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
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

  // Finalization with authorized operators (Fernando/Bruno)
  const AUTH_PASSWORDS = ["Fernando", "Bruno"];
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
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Selecionados para Desconto - ${contaLabel}</title></head><body style="font-family:system-ui;padding:30px">
      <div style="text-align:center;margin-bottom:20px">
        <h2 style="color:#0f766e;margin:0">Selecionados para Desconto</h2>
        <p style="color:#64748b;font-size:13px">${empresaNome} - ${contaLabel} - ${mesLabel}</p>
        <p style="color:#64748b;font-size:12px">Gerado em ${new Date().toLocaleString("pt-BR")}</p>
      </div>
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
                    : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
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
                    : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
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
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                    <Filter className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-sm">Resultado do Filtro</h4>
                    <p className="text-indigo-300 text-[10px] font-medium">{filterDescription}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Exportar PDF */}
                  <button
                    onClick={() => exportFilteredPDF(contaLabel, filterDescription, filteredItems, filteredTotals, empresaNome, mesLabel)}
                    className="text-emerald-400 hover:text-white text-[10px] flex items-center gap-1 transition-colors bg-white/5 hover:bg-emerald-500/30 px-2.5 py-1.5 rounded-lg border border-emerald-400/30 hover:border-emerald-400/60"
                    title="Exportar PDF deste filtro"
                  >
                    <FileText className="w-3.5 h-3.5" /> PDF
                  </button>
                  {/* Verificar no Maxiprod */}
                  {canVerifyMaxiprod && (
                    <button
                      onClick={() => setShowVerifyModal(true)}
                      className="text-amber-400 hover:text-white text-[10px] flex items-center gap-1.5 transition-colors bg-white/5 hover:bg-amber-500/30 px-2.5 py-1.5 rounded-lg border border-amber-400/30 hover:border-amber-400/60 shadow-[0_0_8px_rgba(251,191,36,0.15)] hover:shadow-[0_0_12px_rgba(251,191,36,0.3)]"
                      title="Verificar no Maxiprod"
                    >
                      <Eye className="w-3.5 h-3.5" /> Maxiprod
                    </button>
                  )}
                  <button onClick={() => { setStatusFilter("TODOS"); setFormaFilter("TODOS"); }}
                    className="text-indigo-400 hover:text-white text-[10px] flex items-center gap-1 transition-colors bg-white/5 hover:bg-white/10 px-2 py-1 rounded-lg border border-white/10">
                    <X className="w-3 h-3" /> Limpar
                  </button>
                </div>
              </div>

              {/* Valores */}
              <div className="grid grid-cols-3 gap-3">
                {/* Total */}
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-lg blur-sm group-hover:blur-md transition-all" />
                  <div className="relative bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 p-3 hover:border-cyan-400/30 transition-all">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.6)]" />
                      <span className="text-[10px] font-bold text-cyan-300 uppercase tracking-wider">Total</span>
                    </div>
                    <div className="text-lg font-extrabold text-white tracking-tight" style={{ textShadow: "0 0 20px rgba(34,211,238,0.3)" }}>
                      {formatCurrency(filteredTotals.total)}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{filteredTotals.count} {filteredTotals.count === 1 ? "título" : "títulos"}</div>
                  </div>
                </div>

                {/* Vencido */}
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 to-rose-500/20 rounded-lg blur-sm group-hover:blur-md transition-all" />
                  <div className="relative bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 p-3 hover:border-red-400/30 transition-all">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.6)]" />
                      <span className="text-[10px] font-bold text-red-300 uppercase tracking-wider">Vencido</span>
                    </div>
                    <div className="text-lg font-extrabold text-red-300 tracking-tight" style={{ textShadow: "0 0 20px rgba(248,113,113,0.3)" }}>
                      {formatCurrency(filteredTotals.vencido)}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {filteredTotals.total > 0 ? `${((filteredTotals.vencido / filteredTotals.total) * 100).toFixed(1)}%` : "0%"}
                    </div>
                  </div>
                </div>

                {/* A Vencer */}
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-green-500/20 rounded-lg blur-sm group-hover:blur-md transition-all" />
                  <div className="relative bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 p-3 hover:border-emerald-400/30 transition-all">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
                      <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">A Vencer</span>
                    </div>
                    <div className="text-lg font-extrabold text-emerald-300 tracking-tight" style={{ textShadow: "0 0 20px rgba(52,211,153,0.3)" }}>
                      {formatCurrency(filteredTotals.aVencer)}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
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

      {/* Simulador Maxiprod - passo a passo animado */}
      {showVerifyModal && (
        <MaxiprodSimulator
          onClose={() => setShowVerifyModal(false)}
          title="Contraprova: Contas a Receber"
          subtitle={`${empresaNome} - ${mesLabel} - ${contaLabel}`}
          steps={getReceivablesSteps({
            empresa: empresaNome,
            mes: mesKey,
            contaLabel,
            formaCobranca: formaFilter,
            statusFilter,
            valorManus: filteredTotals.total,
          })}
          maxiprodUrl="https://app.maxiprod.com.br/"
          valorManus={filteredTotals.total}
        />
      )}

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
              <div className="flex items-center gap-3">

                <div className="text-right">
                  <div className="text-[10px] text-teal-200 uppercase tracking-wide">Valor Total</div>
                  <div className="text-xl font-bold" style={{ textShadow: "0 0 20px rgba(255,255,255,0.4)" }}>{formatCurrency(selectedContaTotal)}</div>
                </div>
                <div className="flex gap-1.5">
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
                  : "bg-slate-50 border-slate-200 cursor-not-allowed opacity-70"
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
                <span className="text-xs text-slate-400 italic">(somente Fernando/Bruno)</span>
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
          <div className="grid grid-cols-[36px_1fr_120px_100px_90px_80px] gap-2 px-4 py-2 bg-slate-100 border-b border-slate-200">
            <div className="flex items-center justify-center">
              <button onClick={(e) => { e.stopPropagation(); toggleSelectAll(filteredItems); }}
                className="text-slate-500 hover:text-teal-600 transition-colors" title="Selecionar todos">
                {allContaSelected ? <CheckSquare className="w-4 h-4 text-teal-600" />
                  : someContaSelected ? <MinusSquare className="w-4 h-4 text-teal-500" />
                  : <Square className="w-4 h-4" />}
              </button>
            </div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider self-center">Cliente / Documento</div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center self-center">Forma de Pagamento</div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right self-center">Valor</div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider self-center">Vencimento</div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center self-center">Status</div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
            {filteredItems.map((item) => {
              const isSelected = selectedIds.has(item.id);
              const isExp = expandedItem === item.id;

              return (
                <div key={item.id}>
                  <div className={`grid grid-cols-[36px_1fr_120px_100px_90px_80px] gap-2 px-4 py-2.5 items-center transition-all cursor-pointer ${
                    isSelected ? "bg-teal-50/70 hover:bg-teal-50" : item.isOverdue ? "bg-red-50/30 hover:bg-red-50/50" : "hover:bg-slate-50"
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
                        <div className="text-center" onClick={() => setExpandedItem(isExp ? null : item.id)} title={item.formaCobranca || "Não informado"}>
                          {fc.label ? (
                            <span className={`text-xs font-semibold ${fc.color}`}>{fc.label}</span>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </div>
                      );
                    })()}

                    <div className="text-right" onClick={() => setExpandedItem(isExp ? null : item.id)}>
                      <span className={`font-bold text-sm ${isSelected ? "text-teal-700" : item.isOverdue ? "text-red-600" : "text-slate-800"}`}>
                        {formatCurrency(item.valorAReceber)}
                      </span>
                    </div>

                    <div className={`text-sm ${item.isOverdue ? "text-red-600 font-semibold" : "text-slate-600"}`}
                      onClick={() => setExpandedItem(isExp ? null : item.id)}>
                      {formatDate(item.vencimento)}
                    </div>

                    <div className="text-center" onClick={() => setExpandedItem(isExp ? null : item.id)}>
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
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-white rounded-lg border border-slate-100 shadow-sm">
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
                className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">
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
   Main Component
   ============================================================ */
export default function ReceivablesTab() {
  const [estado, setEstado] = useState<"EMITIDO" | "RECEBIDO" | "ALL">("EMITIDO");
  const [search, setSearch] = useState("");
  const [expandedEmpresas, setExpandedEmpresas] = useState<Set<string>>(new Set());
  const [expandedMeses, setExpandedMeses] = useState<Set<string>>(new Set());
  const [expandedContas, setExpandedContas] = useState<Set<string>>(new Set());
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  const [selectedIdsByAccount, setSelectedIdsByAccount] = useState<Record<string, Set<number>>>({});
  const [showHistoryPanel, setShowHistoryPanel] = useState<string | null>(null);

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
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="inline-flex items-center px-3 py-1.5 rounded-lg border-2 border-blue-300 bg-blue-50 text-base font-bold text-blue-700 shadow-[0_0_8px_rgba(59,130,246,0.35)]">
              {totals.count} títulos
            </span>
            <span className="inline-flex items-center px-3 py-1.5 rounded-lg border-2 border-slate-300 bg-slate-50 text-base font-bold text-slate-800 shadow-[0_0_8px_rgba(100,116,139,0.3)]">
              Total: {formatCurrency(totals.total)}
            </span>
            {totals.vencido > 0 && (
              <span className="inline-flex items-center px-3 py-1.5 rounded-lg border-2 border-red-300 bg-red-50 text-base font-bold text-red-600 shadow-[0_0_8px_rgba(239,68,68,0.35)]">
                Vencido: {formatCurrency(totals.vencido)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          {(["EMITIDO", "RECEBIDO", "ALL"] as const).map(e => (
            <button key={e} onClick={() => setEstado(e)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${estado === e ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-800"}`}>
              {e === "EMITIDO" ? "A Receber" : e === "RECEBIDO" ? "Recebidos" : "Todos"}
            </button>
          ))}
        </div>
      </div>

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

          return (
            <button key={emp.nome} onClick={() => toggleSet(setExpandedEmpresas, emp.nome)}
              className={`rounded-2xl border-2 p-0 text-left transition-all hover:shadow-xl ${colors.bg} ${isOpen ? `${colors.border} ring-2 ring-offset-2 ring-blue-400 shadow-xl` : colors.border}`}>
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
                <button onClick={() => toggleSet(setExpandedEmpresas, emp.nome)} className="text-slate-400 hover:text-slate-600 p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-white">
                {emp.meses.map((mes, mi) => {
                  const mesKey = `${emp.nome}|${mes.mes}`;
                  const isMesOpen = expandedMeses.has(mesKey);
                  const today = new Date().toISOString().substring(0, 7);
                  const isOverdueMonth = mes.mes < today;
                  const currentMonth = mes.mes === today;

                  return (
                    <div key={mes.mes} className={`${mi > 0 ? "border-t border-slate-200" : ""}`}>
                      <button onClick={() => toggleSet(setExpandedMeses, mesKey)}
                        className={`w-full px-5 py-3.5 flex items-center justify-between hover:bg-slate-50 transition-all ${
                          isOverdueMonth ? "bg-red-50/40" : currentMonth ? "bg-blue-50/40" : ""
                        }`}>
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
