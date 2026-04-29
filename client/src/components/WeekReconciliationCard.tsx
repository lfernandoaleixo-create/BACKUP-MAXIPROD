/**
 * Card de Autorização de Pagamentos da Semana
 * Exibe contas a pagar organizadas por dia (seg-sex) com checkbox de autorização
 * Fernando marca as contas → Financeiro executa os pagamentos autorizados
 */

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import {
  CheckCircle2,
  Loader2,
  ClipboardCheck,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  AlertTriangle,
  CheckCheck,
  Landmark,
  ShieldCheck,
  FileDown,
  Lock,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useOperator } from "@/contexts/OperatorContext";

const AUTH_PASSWORDS = ["Fernando", "Bruno"];
const PRIORITY_PASSWORD = "Flavio";
const PRIORITY_VIEWERS = ["Fernando", "Guilherme", "Flavio"];

function formatCurrency(n: number): string {
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

function formatCurrencyShort(n: number): string {
  if (Math.abs(n) >= 1000) {
    return `R$ ${(n / 1000).toFixed(1)}k`;
  }
  return formatCurrency(n);
}

type PayableItem = {
  maxiprodId: number;
  fornecedor: string;
  valor: number;
  vencimento: string;
  vencimentoOriginal?: string;
  emissaoData?: string;
  referenteA: string;
  observacoes?: string;
  documentoVinculadoNumero?: string;
  parcela: string;
  empresaNome: string;
  authorized: boolean;
  authStatus: string | null;
  authNotes: string | null;
  anotacoes?: string;
};

type DayData = {
  date: string;
  dayLabel: string;
  items: PayableItem[];
  total: number;
  authorizedTotal: number;
  authorizedCount: number;
  count: number;
  isPast: boolean;
  isToday: boolean;
  isFuture: boolean;
};

const AUTH_STATUS_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  autorizado: { label: "Autorizado", bg: "bg-emerald-100", text: "text-emerald-700" },
  nao_autorizado: { label: "Nao Autoriz.", bg: "bg-red-100", text: "text-red-700" },
  autorizado_ressalva: { label: "Ressalva", bg: "bg-amber-100", text: "text-amber-700" },
  prorrogar: { label: "Prorrogar", bg: "bg-blue-100", text: "text-blue-700" },
  outros: { label: "Outros", bg: "bg-slate-100", text: "text-slate-600" },
};

function PayableRow({
  item,
  onToggle,
  isToggling,
  isPriorityMarked,
  isPriorityEditor,
  isPriorityViewer,
  onTogglePriority,
}: {
  item: PayableItem;
  onToggle: () => void;
  isToggling: boolean;
  isPriorityMarked: boolean;
  isPriorityEditor: boolean;
  isPriorityViewer: boolean;
  onTogglePriority: () => void;
}) {
  const badge = item.authStatus ? AUTH_STATUS_BADGE[item.authStatus] : null;

  // Montar metadados secundários: NF, parcela, empresa
  const metaParts: string[] = [];
  if (item.documentoVinculadoNumero) metaParts.push(`NF ${item.documentoVinculadoNumero}`);
  if (item.parcela) metaParts.push(`Parcela ${item.parcela}`);
  if (item.empresaNome) metaParts.push(item.empresaNome);
  const metaText = metaParts.join(" · ");

  // Descrição principal: referenteA é o campo "Anotações - Descrição" do Maxiprod
  const descricao = item.referenteA || item.observacoes || "";
  const anotacoes = item.anotacoes || "";

  return (
    <div
      className={`flex items-start gap-2 px-3 py-2.5 border-b border-slate-100 last:border-b-0 transition-colors ${
        item.authorized
          ? "bg-emerald-100 hover:bg-emerald-200/80"
          : "hover:bg-slate-50/50"
      }`}
    >
      <div className="flex-shrink-0 pt-0.5">
        {isToggling ? (
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        ) : (
          <Checkbox
            checked={item.authorized}
            onCheckedChange={onToggle}
            className={`w-5 h-5 ${
              item.authorized
                ? "border-emerald-600 bg-emerald-600 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                : "border-slate-300"
            }`}
          />
        )}
      </div>
      <div className="flex-1 min-w-0">
        {/* Linha 1: Fornecedor + Badge + Priority dot */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {item.authorized && (
            <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          )}
          <span
            className={`text-sm font-semibold ${
              item.authorized ? "text-emerald-900" : "text-slate-800"
            }`}
            style={{ wordBreak: "break-word" }}
          >
            {item.fornecedor}
          </span>
          {/* Priority dot for editor (Flávio): always visible, clickable */}
          {isPriorityEditor && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePriority();
              }}
              className="flex-shrink-0 transition-all duration-200 hover:scale-125"
              title={isPriorityMarked ? "Remover prioridade" : "Marcar como prioridade/urgência"}
            >
              <span className={`inline-block w-3.5 h-3.5 rounded-full border-2 transition-colors duration-200 ${
                isPriorityMarked
                  ? "bg-red-500 border-red-600 shadow-sm shadow-red-300"
                  : "bg-white border-slate-300 hover:border-red-400"
              }`} />
            </button>
          )}
          {/* Priority dot for viewers (Fernando/Guilherme): only when marked */}
          {!isPriorityEditor && isPriorityViewer && isPriorityMarked && (
            <span className="flex-shrink-0 relative group/priority">
              <span className="inline-block w-3.5 h-3.5 rounded-full bg-red-500 border-2 border-red-600 shadow-sm shadow-red-300 animate-pulse cursor-help" />
              <span className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-red-600 text-white text-xs font-semibold rounded-lg shadow-lg opacity-0 group-hover/priority:opacity-100 transition-opacity duration-200 pointer-events-none z-[100] w-max max-w-[280px] leading-relaxed">
                Se não pagar, gera restrições no nome da empresa
                <span className="absolute top-full left-4 -mt-px border-4 border-transparent border-t-red-600" />
              </span>
            </span>
          )}
          {badge && (
            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${badge.bg} ${badge.text} shrink-0`}>
              {badge.label}
            </span>
          )}
        </div>
        {/* Linha 2: Descrição/Anotação (referenteA) - DESTAQUE */}
        {descricao && (
          <p
            className={`text-xs mt-0.5 whitespace-normal break-words font-medium ${
              item.authorized ? "text-emerald-700/80" : "text-indigo-700"
            }`}
            style={{ wordBreak: "break-word" }}
          >
            {descricao}
          </p>
        )}
        {/* Linha 2b: Anotações Maxiprod - DESTAQUE ROSA */}
        {anotacoes && (
          <div className="mt-1">
            <span className={`inline-flex items-center text-[11px] font-bold px-2 py-1 rounded border whitespace-normal break-words ${
              item.authorized
                ? "text-emerald-800 bg-emerald-50 border-emerald-300"
                : "text-pink-800 bg-pink-100 border-pink-300"
            }`} style={{ wordBreak: "break-word" }}>
              📌 {anotacoes}
            </span>
          </div>
        )}
        {/* Linha 3: Metadados (NF, Parcela, Empresa) */}
        {metaText && (
          <p
            className={`text-sm mt-0.5 whitespace-normal break-words ${
              item.authorized ? "text-emerald-500/70" : "text-slate-500"
            }`}
          >
            {metaText}
          </p>
        )}
        {/* Linha 4: Notas de autorização */}
        {item.authNotes && (
          <p className="text-[9px] text-slate-500 italic mt-0.5" style={{ wordBreak: "break-word" }}>
            {item.authNotes}
          </p>
        )}
      </div>
      {/* Value column */}
      <div className="flex-shrink-0">
        <div className="min-w-[120px] text-right">
          <span
            className={`text-base font-bold tabular-nums ${
              item.authorized ? "text-emerald-700" : "text-red-600"
            }`}
          >
            {formatCurrency(item.valor)}
          </span>
          <div
            className={`text-sm ${
              item.authorized ? "text-emerald-400" : "text-slate-500"
            }`}
          >
            Venc. {item.vencimento.split("-").reverse().join("/")}
          </div>
          {item.vencimentoOriginal && (
            <div
              className={`text-sm font-medium ${
                item.vencimentoOriginal !== item.vencimento
                  ? "text-orange-500"
                  : item.authorized ? "text-emerald-400/70" : "text-slate-300"
              }`}
            >
              Venc. Orig. {item.vencimentoOriginal.split("-").reverse().join("/")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Gera PDF com contas autorizadas e saldo restante */
function exportAuthPDF(
  authorizedItems: PayableItem[],
  saldoBancario: number,
  totalAutorizado: number,
  dayLabel: string
) {
  const saldoRestante = saldoBancario - totalAutorizado;
  const hoje = new Date().toLocaleDateString('pt-BR');

  // Agrupar por fornecedor (estilo relatório Maxiprod)
  const sorted = [...authorizedItems].sort((a, b) => {
    const cmpForn = a.fornecedor.localeCompare(b.fornecedor, 'pt-BR');
    if (cmpForn !== 0) return cmpForn;
    return (a.referenteA || '').localeCompare(b.referenteA || '', 'pt-BR');
  });
  let rows = '';
  let currentForn = '';
  let idx = 0;
  for (const item of sorted) {
    if (item.fornecedor !== currentForn) {
      currentForn = item.fornecedor;
      rows += `<tr><td colspan="5" style="padding:8px 8px 4px;font-size:12px;font-weight:800;color:#92400e;background:#fffbeb;border-bottom:2px solid #fbbf24;text-transform:uppercase;">${currentForn}</td></tr>`;
    }
    idx++;
    const pdfDetailParts: string[] = [];
    if (item.referenteA) pdfDetailParts.push(item.referenteA);
    if (item.observacoes && item.observacoes !== item.referenteA) pdfDetailParts.push(item.observacoes);
    if (item.documentoVinculadoNumero) pdfDetailParts.push(`NF ${item.documentoVinculadoNumero}`);
    if (item.parcela) pdfDetailParts.push(`Parcela ${item.parcela}`);
    const pdfDetail = pdfDetailParts.join(' – ');
    rows += `
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:6px 8px;font-size:11px;color:#334155;">${idx}</td>
        <td style="padding:6px 8px;font-size:11px;color:#334155;">
          ${pdfDetail ? `<span style="font-size:10px;color:#475569;">${pdfDetail}</span>` : '<span style="font-size:10px;color:#94a3b8;">Sem descrição</span>'}
        </td>
        <td style="padding:6px 8px;font-size:11px;color:#334155;">${item.empresaNome || ''}</td>
        <td style="padding:6px 8px;font-size:11px;color:#334155;text-align:right;">${item.vencimento.split('-').reverse().join('/')}</td>
        <td style="padding:6px 8px;font-size:11px;color:#dc2626;text-align:right;font-weight:700;">${formatCurrency(item.valor)}</td>
      </tr>
    `;
  }

  const html = `
    <html>
    <head>
      <title>Autorização de Pagamentos - ${dayLabel}</title>
      <style>
        @page { margin: 20mm 15mm; size: A4; }
        body { font-family: Arial, Helvetica, sans-serif; color: #1e293b; margin: 0; padding: 0; }
        .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #4f46e5; padding-bottom: 12px; }
        .header h1 { font-size: 18px; color: #4f46e5; margin: 0 0 4px 0; }
        .header p { font-size: 11px; color: #64748b; margin: 0; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { background: #f1f5f9; padding: 8px; font-size: 10px; text-transform: uppercase; color: #475569; text-align: left; border-bottom: 2px solid #cbd5e1; }
        th:last-child, th:nth-child(4) { text-align: right; }
        .summary { margin-top: 16px; border: 2px solid #4f46e5; border-radius: 8px; padding: 16px; }
        .summary-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
        .summary-row.total { border-top: 2px solid #e2e8f0; margin-top: 8px; padding-top: 12px; font-size: 15px; font-weight: 800; }
        .green { color: #16a34a; }
        .red { color: #dc2626; }
        .blue { color: #2563eb; }
        .footer { margin-top: 24px; text-align: center; font-size: 9px; color: #94a3b8; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Autorização de Pagamentos</h1>
        <p>${dayLabel} &mdash; Emitido em ${hoje}</p>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width:30px;">#</th>
            <th>Descrição</th>
            <th>Empresa</th>
            <th style="text-align:right;">Vencimento</th>
            <th style="text-align:right;">Valor</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr style="background:#f8fafc;">
            <td colspan="4" style="padding:8px;font-size:12px;font-weight:700;text-align:right;">Total Autorizado (${authorizedItems.length} conta${authorizedItems.length > 1 ? 's' : ''}):</td>
            <td style="padding:8px;font-size:13px;font-weight:800;color:#dc2626;text-align:right;">${formatCurrency(totalAutorizado)}</td>
          </tr>
        </tbody>
      </table>

      <div class="summary">
        <div class="summary-row">
          <span>Saldo sem Caixa Dinheiro:</span>
          <span class="green" style="font-weight:700;">${formatCurrency(saldoBancario)}</span>
        </div>
        <div class="summary-row">
          <span>Total Autorizado a Pagar:</span>
          <span class="red" style="font-weight:700;">- ${formatCurrency(totalAutorizado)}</span>
        </div>
        <div class="summary-row total">
          <span>Saldo Após Pagamento:</span>
          <span class="${saldoRestante >= 0 ? 'blue' : 'red'}">${formatCurrency(saldoRestante)}</span>
        </div>
      </div>

      <div class="footer">
        Grupo Fox &mdash; Dashboard de Gestão &mdash; Gerado automaticamente
      </div>
    </body>
    </html>
  `;

  // Abrir em nova janela para impressão/PDF
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 300);
  }
}

function DayCard({
  day,
  onToggleItem,
  onToggleAll,
  togglingIds,
  isVencidas,
  saldoBancario,
  isAuthenticated,
  onRequestAuth,
  prioritySet,
  isPriorityEditor,
  isPriorityViewer,
  onTogglePriority,
}: {
  day:
    | DayData
    | {
        dayLabel: string;
        items: PayableItem[];
        total: number;
        authorizedTotal: number;
        authorizedCount: number;
        count: number;
      };
  onToggleItem: (id: number, authorized: boolean) => void;
  onToggleAll: (ids: number[], authorized: boolean) => void;
  togglingIds: Set<number>;
  isVencidas?: boolean;
  saldoBancario: number;
  isAuthenticated: boolean;
  onRequestAuth: (callback: () => void) => void;
  prioritySet: Set<number>;
  isPriorityEditor: boolean;
  isPriorityViewer: boolean;
  onTogglePriority: (maxiprodId: number, fornecedor: string, date: string) => void;
}) {
  const isToday = "isToday" in day ? day.isToday : false;
  const isPast = "isPast" in day ? day.isPast : false;
  const dayDate = "date" in day ? day.date : "";
  const [expanded, setExpanded] = useState(isVencidas || isToday);
  const allAuthorized = day.count > 0 && day.authorizedCount === day.count;
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [initialCollapseApplied, setInitialCollapseApplied] = useState(false);

  // Items na ordem padrão do backend (por fornecedor)
  const sortedItems = day.items;

  // Agrupar por fornecedor para exibir cabeçalhos como no relatório Maxiprod
  const groupedItems = useMemo(() => {
    const groups: { fornecedor: string; items: PayableItem[] }[] = [];
    let currentGroup: { fornecedor: string; items: PayableItem[] } | null = null;
    for (const item of sortedItems) {
      if (!currentGroup || currentGroup.fornecedor !== item.fornecedor) {
        currentGroup = { fornecedor: item.fornecedor, items: [] };
        groups.push(currentGroup);
      }
      currentGroup.items.push(item);
    }
    return groups;
  }, [sortedItems]);

  // Colapsar todos os grupos por padrão quando os dados carregam
  useEffect(() => {
    if (!initialCollapseApplied && groupedItems.length > 0) {
      setCollapsedGroups(new Set(groupedItems.map(g => g.fornecedor)));
      setInitialCollapseApplied(true);
    }
  }, [groupedItems, initialCollapseApplied]);

  const toggleGroupCollapse = (fornecedor: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(fornecedor)) {
        next.delete(fornecedor);
      } else {
        next.add(fornecedor);
      }
      return next;
    });
  };

  // Wrapper para proteger toggle com senha
  const handleProtectedToggleItem = (id: number, authorized: boolean) => {
    if (isAuthenticated) {
      onToggleItem(id, authorized);
    } else {
      onRequestAuth(() => onToggleItem(id, authorized));
    }
  };

  const handleProtectedToggleAll = (ids: number[], authorized: boolean) => {
    if (isAuthenticated) {
      onToggleAll(ids, authorized);
    } else {
      onRequestAuth(() => onToggleAll(ids, authorized));
    }
  };

  let borderColor = "border-slate-200";
  if (isVencidas) {
    borderColor = "border-red-200";
  } else if (isToday) {
    borderColor = "border-blue-300";
  } else if (allAuthorized && day.count > 0) {
    borderColor = "border-emerald-200";
  } else if (isPast && day.count > 0) {
    borderColor = "border-amber-200";
  }

  if (day.count === 0) return null;

  const pendingIds = day.items
    .filter((i) => !i.authorized)
    .map((i) => i.maxiprodId);
  const allIds = day.items.map((i) => i.maxiprodId);

  return (
    <div className={`rounded-lg border ${borderColor} overflow-hidden`}>
      {/* Header - Clickable to expand/collapse */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full cursor-pointer hover:brightness-95 transition-all"
      >
        {/* Top bar: Saldo (verde) | Autorizado (vermelho) | Total do dia (azul) */}
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100">
          {/* Saldo Bancário - VERDE */}
          <div className="flex items-center gap-2">
            <Landmark className="w-5 h-5 text-emerald-600" />
            <div>
              <span className="text-[10px] text-emerald-500 font-medium block leading-tight">Saldo sem Caixa Dinheiro</span>
              <span className="text-lg font-extrabold tabular-nums text-emerald-600">
                {formatCurrency(saldoBancario)}
              </span>
            </div>
          </div>

          {/* Autorizado - VERMELHO + Botão Exportar PDF */}
          <div className="flex items-center gap-3">
            {day.authorizedTotal > 0 && (
              <>
                <ShieldCheck className="w-5 h-5 text-red-500" />
                <div>
                  <span className="text-[10px] text-red-400 font-medium block leading-tight">Autorizado</span>
                  <span className="text-lg font-extrabold tabular-nums text-red-600">
                    {formatCurrency(day.authorizedTotal)}
                  </span>
                </div>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    exportAuthPDF(sortedItems.filter(i => i.authorized), saldoBancario, day.authorizedTotal, day.dayLabel);
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); exportAuthPDF(sortedItems.filter(i => i.authorized), saldoBancario, day.authorizedTotal, day.dayLabel); } }}
                  className="flex items-center gap-1 px-2 py-1 rounded-md bg-red-50 hover:bg-red-100 border border-red-200 cursor-pointer transition-colors"
                >
                  <FileDown className="w-3.5 h-3.5 text-red-600" />
                  <span className="text-[10px] font-semibold text-red-600 whitespace-nowrap">Exportar PDF</span>
                </div>
              </>
            )}
          </div>

          {/* Total do dia - AZUL (direita) */}
          <div className="flex items-center gap-2">
            <div className="text-right">
              <span className="text-[10px] text-blue-400 font-medium block leading-tight">Total</span>
              <span className="text-lg font-extrabold tabular-nums text-blue-600">
                {formatCurrency(day.total)}
              </span>
            </div>
          </div>
        </div>

        {/* Day label row */}
        <div
          className={`px-3 py-2 flex items-center justify-between ${
            isVencidas
              ? "bg-red-50"
              : isToday
                ? "bg-blue-50"
                : allAuthorized
                  ? "bg-emerald-50"
                  : "bg-slate-50"
          }`}
        >
          <div className="flex items-center gap-2">
            {isVencidas ? (
              <AlertTriangle className="w-4 h-4 text-red-500" />
            ) : allAuthorized ? (
              <CheckCheck className="w-4 h-4 text-emerald-500" />
            ) : (
              <CheckCircle2
                className={`w-4 h-4 ${isToday ? "text-blue-500" : "text-slate-400"}`}
              />
            )}
            <span
              className={`text-sm font-bold ${
                isVencidas
                  ? "text-red-700"
                  : isToday
                    ? "text-blue-700"
                    : allAuthorized
                      ? "text-emerald-700"
                      : "text-slate-700"
              }`}
            >
              {day.dayLabel}
            </span>
            {isToday && (
              <span className="text-[10px] font-semibold bg-blue-500 text-white px-1.5 py-0.5 rounded-full">
                HOJE
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400">
              {day.authorizedCount}/{day.count}
            </span>
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </div>
        </div>
      </button>

      {/* Content */}
      {expanded && (
        <div className="bg-white">
          {/* Authorize all / none toggle + Sort buttons */}
          {day.count > 1 && (
            <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <button
                onClick={() => {
                  if (allAuthorized) {
                    handleProtectedToggleAll(allIds, false);
                  } else {
                    handleProtectedToggleAll(pendingIds, true);
                  }
                }}
                className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 cursor-pointer transition-colors"
              >
                {allAuthorized ? "Desmarcar todos" : "Autorizar todos"}
              </button>

            </div>
          )}

          {/* Items list - agrupados por fornecedor (estilo relatório Maxiprod) */}
          <div className="max-h-[400px] overflow-y-auto">
            {groupedItems.map((group, gi) => {
              const isGroupCollapsed = collapsedGroups.has(group.fornecedor);
              const groupTotal = group.items.reduce((s, i) => s + i.valor, 0);
              const groupAllAuthorized = group.items.length > 0 && group.items.every(i => i.authorized);
              const groupPendingIds = group.items.filter(i => !i.authorized).map(i => i.maxiprodId);
              const groupAllIds = group.items.map(i => i.maxiprodId);
              return (
                <div key={group.fornecedor || `flat-${gi}`}>
                  {/* Cabeçalho do fornecedor - colapsável com seta + Selecionar Tudo */}
                  {group.fornecedor && (
                    <div
                      className={`border-b border-t transition-colors ${
                        groupAllAuthorized
                          ? "bg-emerald-50 border-emerald-200 border-t-emerald-100"
                          : "bg-amber-50 border-amber-200 border-t-amber-100"
                      }`}
                    >
                      <div className="grid py-1.5 px-3" style={{ gridTemplateColumns: '1fr auto 1fr' }}>
                        {/* Lado esquerdo: seta + nome + contagem */}
                        <button
                          onClick={() => toggleGroupCollapse(group.fornecedor)}
                          className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity justify-self-start"
                        >
                          {isGroupCollapsed ? (
                            <ChevronRight className={`w-3.5 h-3.5 ${groupAllAuthorized ? "text-emerald-600" : "text-amber-600"}`} />
                          ) : (
                            <ChevronDown className={`w-3.5 h-3.5 ${groupAllAuthorized ? "text-emerald-600" : "text-amber-600"}`} />
                          )}
                          <span className={`text-xs font-bold uppercase tracking-wide ${
                            groupAllAuthorized ? "text-emerald-900" : "text-amber-900"
                          }`}>
                            {group.fornecedor}
                          </span>
                          <span className={`text-[9px] ${groupAllAuthorized ? "text-emerald-600" : "text-amber-600"}`}>({group.items.length})</span>
                        </button>

                        {/* Centro: Checkbox Selecionar Tudo */}
                        <label
                          className="flex items-center gap-1.5 cursor-pointer select-none justify-self-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Checkbox
                            checked={groupAllAuthorized}
                            onCheckedChange={() => {
                              if (groupAllAuthorized) {
                                handleProtectedToggleAll(groupAllIds, false);
                              } else {
                                handleProtectedToggleAll(groupPendingIds, true);
                              }
                            }}
                            className={`w-4 h-4 ${
                              groupAllAuthorized
                                ? "border-emerald-600 bg-emerald-600 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                                : "border-amber-400 bg-white"
                            }`}
                          />
                          <span className={`text-[10px] font-semibold whitespace-nowrap ${
                            groupAllAuthorized ? "text-emerald-700" : "text-amber-700"
                          }`}>
                            Selecionar tudo
                          </span>
                        </label>

                        {/* Lado direito: Valor Autorizado + Valor Total */}
                        <div className="flex items-center gap-4 justify-self-end" onClick={(e) => e.stopPropagation()}>
                          {/* Valor Autorizado (azul) */}
                          <div className="flex flex-col items-start min-w-[120px]">
                            <span className="text-[9px] text-blue-500 font-medium leading-none">Autorizado</span>
                            <span className="text-xs font-bold tabular-nums text-blue-600">
                              {formatCurrency(group.items.filter(i => i.authorized).reduce((s, i) => s + i.valor, 0))}
                            </span>
                          </div>
                          {/* Valor Total (castanho amarelado) */}
                          <div className="flex flex-col items-start min-w-[120px]">
                            <span className={`text-[9px] font-medium leading-none ${
                              groupAllAuthorized ? "text-emerald-500" : "text-amber-500"
                            }`}>Total</span>
                            <span className={`text-xs font-bold tabular-nums ${
                              groupAllAuthorized ? "text-emerald-800" : "text-amber-800"
                            }`}>
                              {formatCurrency(groupTotal)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {!isGroupCollapsed && group.items.map((item) => (
                    <PayableRow
                      key={item.maxiprodId}
                      item={item}
                      onToggle={() =>
                        handleProtectedToggleItem(item.maxiprodId, !item.authorized)
                      }
                      isToggling={togglingIds.has(item.maxiprodId)}
                      isPriorityMarked={prioritySet.has(item.maxiprodId)}
                      isPriorityEditor={isPriorityEditor}
                      isPriorityViewer={isPriorityViewer}
                      onTogglePriority={() => onTogglePriority(item.maxiprodId, item.fornecedor, dayDate)}
                    />
                  ))}
                </div>
              );
            })}
          </div>

          {/* Footer summary */}
          <div className="px-3 py-2 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-medium">
              {day.count} conta{day.count > 1 ? "s" : ""}
            </span>
            <span className="text-sm font-bold text-blue-600 tabular-nums">
              {formatCurrency(day.total)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WeekReconciliationCard() {
  const { data, isLoading } = trpc.financial.getWeekReconciliation.useQuery();
  const { data: bankData } = trpc.financial.getBankBalances.useQuery();
  const { data: authCompletionData } = trpc.financial.getAuthCompletionStatus.useQuery();
  const setAuthCompletionMut = trpc.financial.setAuthCompletion.useMutation();
  const utils = trpc.useUtils();
  const { operator } = useOperator();
  const [togglingIds, setTogglingIds] = useState<Set<number>>(new Set());

  // ─── Priority dots (Flávio) ───
  const [isPriorityAuthenticated, setIsPriorityAuthenticated] = useState(false);
  const [showPriorityDialog, setShowPriorityDialog] = useState(false);
  const [priorityPasswordInput, setPriorityPasswordInput] = useState("");
  const [priorityPasswordError, setPriorityPasswordError] = useState(false);

  const isPriorityEditor = isPriorityAuthenticated;
  const isPriorityViewer = operator ? PRIORITY_VIEWERS.includes(operator.name) : false;

  const { data: priorityData } = trpc.financial.getPaymentPriorities.useQuery(
    { weekStart: data?.mondayStr ?? "", weekEnd: data?.fridayStr ?? "" },
    { enabled: !!data?.mondayStr }
  );

  const prioritySet = useMemo(() => {
    const s = new Set<number>();
    if (priorityData?.marks) {
      for (const m of priorityData.marks) {
        if (m.maxiprodId) s.add(m.maxiprodId);
      }
    }
    return s;
  }, [priorityData]);

  const togglePriorityMut = trpc.financial.togglePaymentPriority.useMutation({
    onSuccess: () => {
      utils.financial.getPaymentPriorities.invalidate();
    },
  });

  const handleTogglePriority = useCallback((maxiprodId: number, fornecedor: string, date: string) => {
    if (!isPriorityAuthenticated) {
      setShowPriorityDialog(true);
      setPriorityPasswordInput("");
      setPriorityPasswordError(false);
      return;
    }
    togglePriorityMut.mutate({
      fornecedor,
      date,
      maxiprodId,
      operatorName: operator?.name || "Flavio",
    });
  }, [isPriorityAuthenticated, operator, togglePriorityMut]);

  const handlePriorityPasswordSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    if (priorityPasswordInput === PRIORITY_PASSWORD) {
      setIsPriorityAuthenticated(true);
      setShowPriorityDialog(false);
      setPriorityPasswordError(false);
      toast.success("Acesso de prioridade liberado para Flávio!");
    } else {
      setPriorityPasswordError(true);
      toast.error("Senha incorreta");
    }
  }, [priorityPasswordInput]);
  // Auth completion password dialog
  const [showAuthCompletionDialog, setShowAuthCompletionDialog] = useState(false);
  const [authCompletionPassword, setAuthCompletionPassword] = useState("");
  const [authCompletionError, setAuthCompletionError] = useState(false);
  const [authCompletionLoading, setAuthCompletionLoading] = useState(false);

  const toggleMutation = trpc.financial.togglePaymentAuth.useMutation({
    onMutate: ({ accountPayableId }) => {
      setTogglingIds((prev) => new Set(prev).add(accountPayableId));
    },
    onSettled: (_data, _err, { accountPayableId }) => {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(accountPayableId);
        return next;
      });
      utils.financial.getWeekReconciliation.invalidate();
    },
  });

  const batchToggleMutation =
    trpc.financial.batchTogglePaymentAuth.useMutation({
      onMutate: ({ accountPayableIds }) => {
        setTogglingIds((prev) => {
          const next = new Set(prev);
          accountPayableIds.forEach((id) => next.add(id));
          return next;
        });
      },
      onSettled: (_data, _err, { accountPayableIds }) => {
        setTogglingIds((prev) => {
          const next = new Set(prev);
          accountPayableIds.forEach((id) => next.delete(id));
          return next;
        });
        utils.financial.getWeekReconciliation.invalidate();
      },
    });

  const [collapsed, setCollapsed] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [passwordError, setPasswordError] = useState(false);

  const handleRequestAuth = useCallback((callback: () => void) => {
    setPendingAction(() => callback);
    setPasswordInput("");
    setPasswordError(false);
    setShowPasswordDialog(true);
  }, []);

  const handlePasswordSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    if (AUTH_PASSWORDS.includes(passwordInput)) {
      setIsAuthenticated(true);
      setShowPasswordDialog(false);
      setPasswordError(false);
      toast.success("Acesso autorizado!");
      if (pendingAction) {
        pendingAction();
        setPendingAction(null);
      }
    } else {
      setPasswordError(true);
      toast.error("Senha incorreta");
    }
  }, [passwordInput, pendingAction]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-indigo-200 shadow-sm p-6">
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Carregando autorizações...</span>
        </div>
      </div>
    );
  }

  if (
    !data ||
    (data.days.every((d) => d.count === 0))
  ) {
    return null;
  }

  const visibleDays = data.days.filter((d) => !d.isPast || d.isToday);
  const totalContas =
    visibleDays.reduce((s, d) => s + d.count, 0);
  const totalValor =
    visibleDays.reduce((s, d) => s + d.total, 0);
  const totalAuthorized =
    visibleDays.reduce((s, d) => s + d.authorizedCount, 0);
  const totalAuthorizedValor =
    visibleDays.reduce((s, d) => s + d.authorizedTotal, 0);

  const saldoBancario = bankData?.totalSaldo ?? 0;

  const handleToggleItem = (id: number, authorized: boolean) => {
    toggleMutation.mutate({ accountPayableId: id, authorized });
  };

  const handleToggleAll = (ids: number[], authorized: boolean) => {
    if (ids.length === 0) return;
    batchToggleMutation.mutate({ accountPayableIds: ids, authorized });
  };

  return (
    <div className="bg-white rounded-xl border-2 border-indigo-200 shadow-sm overflow-hidden">
      {/* Main Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full bg-indigo-50 border-b border-indigo-200 px-4 py-3 cursor-pointer hover:bg-indigo-100/70 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-bold text-indigo-700">
                Autorização de Pagamentos
              </h3>
              <p className="text-xs text-indigo-500">
                Semana {data.weekLabel} — {totalAuthorized}/{totalContas}{" "}
                autorizados
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {totalAuthorized === totalContas && totalContas > 0 ? (
              <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-1 rounded-full">
                Tudo Autorizado
              </span>
            ) : (
              <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-1 rounded-full">
                {totalContas - totalAuthorized} pendente
                {totalContas - totalAuthorized > 1 ? "s" : ""}
              </span>
            )}
            {collapsed ? (
              <ChevronDown className="w-5 h-5 text-indigo-400" />
            ) : (
              <ChevronUp className="w-5 h-5 text-indigo-400" />
            )}
          </div>
        </div>
      </button>

      {/* Content */}
      {!collapsed && (
        <div className="p-4">
          {/* Progress bar */}
          <div className="mb-4">
            <div className="flex justify-between text-[10px] text-slate-500 mb-1">
              <span>
                {totalAuthorized} de {totalContas} contas autorizadas
              </span>
              <span>
                {formatCurrency(totalAuthorizedValor)} de{" "}
                {formatCurrency(totalValor)}
              </span>
            </div>
            <div className="flex h-2 rounded-full overflow-hidden bg-slate-100">
              <div
                className="bg-emerald-500 transition-all duration-500"
                style={{
                  width: `${totalContas > 0 ? (totalAuthorized / totalContas) * 100 : 0}%`,
                }}
              />
            </div>
          </div>

          {/* Autorização Concluída checkbox */}
          <div className="mb-4 flex items-center justify-between bg-indigo-50/50 border border-indigo-200 rounded-lg px-4 py-3">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={!!authCompletionData?.completed}
                onCheckedChange={() => {
                  if (authCompletionData?.completed) {
                    // Desmarcar também precisa de senha
                    setAuthCompletionPassword("");
                    setAuthCompletionError(false);
                    setShowAuthCompletionDialog(true);
                  } else {
                    // Marcar precisa de senha
                    setAuthCompletionPassword("");
                    setAuthCompletionError(false);
                    setShowAuthCompletionDialog(true);
                  }
                }}
                className={`w-5 h-5 ${
                  authCompletionData?.completed
                    ? "border-emerald-600 bg-emerald-600 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                    : "border-indigo-400"
                }`}
              />
              <div>
                <span className={`text-sm font-bold ${
                  authCompletionData?.completed ? "text-emerald-700" : "text-indigo-700"
                }`}>
                  Autorização Concluída
                </span>
                {authCompletionData?.completed && authCompletionData.completedBy && (
                  <p className="text-[10px] text-emerald-600">
                    Marcado por {authCompletionData.completedBy} hoje
                  </p>
                )}
              </div>
            </div>
            {authCompletionData?.completed && (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            )}
          </div>

          {/* Priority unlock button (Flávio) */}
          <div className="mb-4 flex items-center justify-between bg-red-50/50 border border-red-200 rounded-lg px-4 py-2.5">
            <div className="flex items-center gap-3">
              <span className={`inline-block w-4 h-4 rounded-full border-2 ${
                isPriorityAuthenticated ? "bg-red-500 border-red-600" : "bg-white border-red-300"
              }`} />
              <div>
                <span className={`text-sm font-bold ${
                  isPriorityAuthenticated ? "text-red-700" : "text-red-600"
                }`}>
                  Marcar Prioridades
                </span>
                <p className="text-[10px] text-red-500">
                  {isPriorityAuthenticated
                    ? "Acesso liberado — clique nas bolinhas ao lado dos fornecedores"
                    : "Apenas Flávio — clique para liberar acesso"}
                </p>
              </div>
            </div>
            {!isPriorityAuthenticated ? (
              <Button
                size="sm"
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-100 hover:text-red-700"
                onClick={() => { setShowPriorityDialog(true); setPriorityPasswordInput(""); setPriorityPasswordError(false); }}
              >
                <Lock className="w-3.5 h-3.5 mr-1" />
                Liberar
              </Button>
            ) : (
              <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded-full">
                Ativo
              </span>
            )}
          </div>

          {/* Day cards */}
          <div className="space-y-3">
            {/* Week days */}
            {data.days
              .filter((day) => !day.isPast || day.isToday)
              .map((day) => (
                <DayCard
                  key={day.date}
                  day={day}
                  onToggleItem={handleToggleItem}
                  onToggleAll={handleToggleAll}
                  togglingIds={togglingIds}
                  saldoBancario={saldoBancario}
                  isAuthenticated={isAuthenticated}
                  onRequestAuth={handleRequestAuth}
                  prioritySet={prioritySet}
                  isPriorityEditor={isPriorityEditor}
                  isPriorityViewer={isPriorityViewer}
                  onTogglePriority={handleTogglePriority}
                />
              ))}
          </div>
        </div>
      )}

      {/* Auth Completion Password Dialog */}
      <Dialog open={showAuthCompletionDialog} onOpenChange={(v) => { if (!v) { setAuthCompletionPassword(""); setAuthCompletionError(false); } setShowAuthCompletionDialog(v); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-indigo-600" />
              {authCompletionData?.completed ? "Desmarcar Autorização" : "Confirmar Autorização Concluída"}
            </DialogTitle>
            <DialogDescription>
              Digite a senha para {authCompletionData?.completed ? "desmarcar" : "marcar"} a autorização como concluída.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={async (e) => {
            e.preventDefault();
            setAuthCompletionLoading(true);
            try {
              const result = await setAuthCompletionMut.mutateAsync({
                password: authCompletionPassword,
                completed: !authCompletionData?.completed,
              });
              if (result.success) {
                toast.success(authCompletionData?.completed ? "Autorização desmarcada" : "Autorização marcada como concluída!");
                setShowAuthCompletionDialog(false);
                utils.financial.getAuthCompletionStatus.invalidate();
              } else {
                setAuthCompletionError(true);
                toast.error(result.error || "Senha incorreta");
              }
            } catch {
              toast.error("Erro ao salvar");
            } finally {
              setAuthCompletionLoading(false);
            }
          }}>
            <div className="py-4">
              <Input
                type="password"
                placeholder="Digite a senha..."
                value={authCompletionPassword}
                onChange={(e) => { setAuthCompletionPassword(e.target.value); setAuthCompletionError(false); }}
                autoFocus
                className={`text-center text-lg tracking-widest ${authCompletionError ? 'border-red-400 ring-1 ring-red-400' : ''}`}
              />
              {authCompletionError && (
                <p className="text-xs text-red-500 text-center mt-2">Senha incorreta. Tente novamente.</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setAuthCompletionPassword(""); setAuthCompletionError(false); setShowAuthCompletionDialog(false); }}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!authCompletionPassword.trim() || authCompletionLoading} className="bg-indigo-600 hover:bg-indigo-700">
                {authCompletionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                Confirmar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={(v) => { if (!v) { setPasswordInput(""); setPasswordError(false); setPendingAction(null); } setShowPasswordDialog(v); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-600" />
              Autorização Necessária
            </DialogTitle>
            <DialogDescription>
              Digite a senha para autorizar ou desautorizar pagamentos.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordSubmit}>
            <div className="py-4">
              <Input
                type="password"
                placeholder="Digite a senha..."
                value={passwordInput}
                onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(false); }}
                autoFocus
                className={`text-center text-lg tracking-widest ${passwordError ? 'border-red-400 ring-1 ring-red-400' : ''}`}
              />
              {passwordError && (
                <p className="text-xs text-red-500 text-center mt-2">Senha incorreta. Tente novamente.</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setPasswordInput(""); setPasswordError(false); setPendingAction(null); setShowPasswordDialog(false); }}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!passwordInput.trim()} className="bg-amber-600 hover:bg-amber-700">
                <ShieldCheck className="w-4 h-4 mr-2" />
                Confirmar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Priority Password Dialog (Flávio) */}
      <Dialog open={showPriorityDialog} onOpenChange={(v) => { if (!v) { setPriorityPasswordInput(""); setPriorityPasswordError(false); } setShowPriorityDialog(v); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="inline-block w-4 h-4 rounded-full bg-red-500 border-2 border-red-600" />
              Acesso Prioridade (Flávio)
            </DialogTitle>
            <DialogDescription>
              Digite a senha do Flávio para marcar fornecedores como prioridade/urgência.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePriorityPasswordSubmit}>
            <div className="py-4">
              <Input
                type="password"
                placeholder="Senha do Flávio..."
                value={priorityPasswordInput}
                onChange={(e) => { setPriorityPasswordInput(e.target.value); setPriorityPasswordError(false); }}
                autoFocus
                className={`text-center text-lg tracking-widest ${priorityPasswordError ? 'border-red-400 ring-1 ring-red-400' : ''}`}
              />
              {priorityPasswordError && (
                <p className="text-xs text-red-500 text-center mt-2">Senha incorreta. Tente novamente.</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setPriorityPasswordInput(""); setPriorityPasswordError(false); setShowPriorityDialog(false); }}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!priorityPasswordInput.trim()} className="bg-red-600 hover:bg-red-700 text-white">
                <ShieldCheck className="w-4 h-4 mr-2" />
                Liberar Acesso
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
