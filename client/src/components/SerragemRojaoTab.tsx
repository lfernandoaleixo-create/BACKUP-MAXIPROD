/**
 * Análise Serragem/Rojão - Sub-aba do Financeiro
 * Mostra dois sub-cards (Serragem e Rojão) com layout financeiro
 * Seletor de período: Mês Atual, Mês Anterior, Personalizado
 * Exportar relatório em PDF
 * Valores zerados por enquanto - serão preenchidos via Maxiprod
 */

import React, { useState, useMemo, useRef } from "react";
import { ArrowLeft, Flame, TreePine, Calendar, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/* ---- Helpers ---- */
function formatCurrency(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

function getMonthLabel(date: Date): string {
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function formatDateBR(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

/* ---- Types ---- */
type PeriodType = "mes-atual" | "mes-anterior" | "personalizado";

interface FinancialData {
  vendasFaturamento: number;
  recebido: number;
  contasPagas: number;
  retiradaSocios: number;
  saidasTotal: number;
  saldoDisponivelCaixa: number;
  totalParaDivisao: number;
  totalParaDivisaoDisponivel: number;
  totalParaDivisaoAReceber: number;
}

/* ---- Seletor de Período ---- */
function PeriodSelector({ period, setPeriod, customStart, setCustomStart, customEnd, setCustomEnd }: {
  period: PeriodType;
  setPeriod: (p: PeriodType) => void;
  customStart: string;
  setCustomStart: (s: string) => void;
  customEnd: string;
  setCustomEnd: (s: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-1">
        <button
          onClick={() => setPeriod("mes-atual")}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
            period === "mes-atual"
              ? "bg-teal-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
          }`}
        >
          Mês Atual
        </button>
        <button
          onClick={() => setPeriod("mes-anterior")}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
            period === "mes-anterior"
              ? "bg-teal-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
          }`}
        >
          Mês Anterior
        </button>
        <button
          onClick={() => setPeriod("personalizado")}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
            period === "personalizado"
              ? "bg-teal-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
          }`}
        >
          Personalizado
        </button>
      </div>
      {period === "personalizado" && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="w-36 h-8 text-xs"
          />
          <span className="text-xs text-slate-400">até</span>
          <Input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="w-36 h-8 text-xs"
          />
        </div>
      )}
    </div>
  );
}

/* ---- Layout de Cards Financeiros ---- */
function FinancialCardsLayout({ data, title, icon, periodLabel, onExportPDF, exporting }: {
  data: FinancialData;
  title: string;
  icon: React.ReactNode;
  periodLabel: string;
  onExportPDF: () => void;
  exporting: boolean;
}) {
  return (
    <div className="space-y-4">
      {/* Header do card */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{title}</h3>
          <span className="text-xs text-slate-400 dark:text-slate-500 ml-2">({periodLabel})</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onExportPDF}
          disabled={exporting}
          className="flex items-center gap-1.5 text-xs"
        >
          {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          {exporting ? "Gerando..." : "Exportar PDF"}
        </Button>
      </div>

      {/* Card principal: VENDAS/FATURAMENTO */}
      <div className="bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-900/30 dark:to-emerald-900/30 border border-teal-200 dark:border-teal-700 rounded-xl p-4 shadow-sm">
        <p className="text-xs font-semibold text-teal-700 dark:text-teal-300 uppercase tracking-wider">Vendas/Faturamento</p>
        <p className="text-2xl font-bold text-teal-900 dark:text-teal-100 mt-1">{formatCurrency(data.vendasFaturamento)}</p>
      </div>

      {/* Grid 2 colunas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Coluna Esquerda */}
        <div className="space-y-3">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 shadow-sm">
            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Recebido</p>
            <p className="text-lg font-bold text-green-700 dark:text-green-400 mt-0.5">{formatCurrency(data.recebido)}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 shadow-sm">
            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Contas Pagas</p>
            <p className="text-lg font-bold text-red-600 dark:text-red-400 mt-0.5">{formatCurrency(data.contasPagas)}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 shadow-sm">
            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Retirada Sócios</p>
            <p className="text-lg font-bold text-amber-700 dark:text-amber-400 mt-0.5">{formatCurrency(data.retiradaSocios)}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 shadow-sm">
            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Saídas Total</p>
            <p className="text-lg font-bold text-red-700 dark:text-red-400 mt-0.5">{formatCurrency(data.saidasTotal)}</p>
          </div>
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border border-blue-200 dark:border-blue-700 rounded-xl p-3.5 shadow-sm">
            <p className="text-[10px] font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wider">Saldo Disponível Caixa</p>
            <p className="text-lg font-bold text-blue-900 dark:text-blue-100 mt-0.5">{formatCurrency(data.saldoDisponivelCaixa)}</p>
          </div>
        </div>

        {/* Coluna Direita */}
        <div className="space-y-3">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 shadow-sm">
            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total para Divisão</p>
            <p className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-0.5">{formatCurrency(data.totalParaDivisao)}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 shadow-sm">
            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total para Divisão Disponível</p>
            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">{formatCurrency(data.totalParaDivisaoDisponivel)}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 shadow-sm">
            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total para Divisão à Receber</p>
            <p className="text-lg font-bold text-purple-700 dark:text-purple-400 mt-0.5">{formatCurrency(data.totalParaDivisaoAReceber)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- Componente Principal ---- */
export default function SerragemRojaoTab() {
  const [selectedView, setSelectedView] = useState<"menu" | "serragem" | "rojao">("menu");
  const [period, setPeriod] = useState<PeriodType>("mes-atual");
  const [exporting, setExporting] = useState(false);

  // Datas personalizadas
  const now = new Date();
  const firstDayCurrentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const [customStart, setCustomStart] = useState(firstDayCurrentMonth);
  const [customEnd, setCustomEnd] = useState(today);

  // Calcular label do período
  const periodLabel = useMemo(() => {
    if (period === "mes-atual") {
      return getMonthLabel(now);
    } else if (period === "mes-anterior") {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return getMonthLabel(prev);
    } else {
      if (customStart && customEnd) {
        return `${formatDateBR(customStart)} a ${formatDateBR(customEnd)}`;
      }
      return "Período personalizado";
    }
  }, [period, customStart, customEnd]);

  // Dados zerados - serão preenchidos via Maxiprod futuramente
  const emptyData: FinancialData = {
    vendasFaturamento: 0,
    recebido: 0,
    contasPagas: 0,
    retiradaSocios: 0,
    saidasTotal: 0,
    saldoDisponivelCaixa: 0,
    totalParaDivisao: 0,
    totalParaDivisaoDisponivel: 0,
    totalParaDivisaoAReceber: 0,
  };

  // Exportar PDF
  const handleExportPDF = async (type: "serragem" | "rojao") => {
    setExporting(true);
    try {
      const data = emptyData; // Futuramente virá do backend
      const title = type === "serragem" ? "Serragem" : "Rojão";
      
      // Gerar PDF no frontend usando a API do browser
      const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Relatório ${title} - ${periodLabel}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1e293b; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #0d9488; padding-bottom: 20px; }
            .header h1 { font-size: 24px; color: #0d9488; margin-bottom: 5px; }
            .header p { font-size: 14px; color: #64748b; }
            .main-card { background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 12px; padding: 20px; margin-bottom: 24px; }
            .main-card .label { font-size: 11px; font-weight: 600; color: #0f766e; text-transform: uppercase; letter-spacing: 1px; }
            .main-card .value { font-size: 28px; font-weight: 700; color: #134e4a; margin-top: 4px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
            .card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; }
            .card .label { font-size: 10px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
            .card .value { font-size: 18px; font-weight: 700; margin-top: 4px; }
            .green { color: #15803d; }
            .red { color: #dc2626; }
            .amber { color: #b45309; }
            .blue { color: #1d4ed8; }
            .purple { color: #7c3aed; }
            .dark { color: #1e293b; }
            .emerald { color: #047857; }
            .highlight { background: #eff6ff; border-color: #bfdbfe; }
            .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 15px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Análise ${title} - Grupo Fox</h1>
            <p>Período: ${periodLabel}</p>
            <p style="margin-top: 4px; font-size: 11px;">Gerado em: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
          </div>

          <div class="main-card">
            <div class="label">Vendas/Faturamento</div>
            <div class="value">${formatCurrency(data.vendasFaturamento)}</div>
          </div>

          <div class="grid">
            <div class="card">
              <div class="label">Recebido</div>
              <div class="value green">${formatCurrency(data.recebido)}</div>
            </div>
            <div class="card">
              <div class="label">Total para Divisão</div>
              <div class="value dark">${formatCurrency(data.totalParaDivisao)}</div>
            </div>
            <div class="card">
              <div class="label">Contas Pagas</div>
              <div class="value red">${formatCurrency(data.contasPagas)}</div>
            </div>
            <div class="card">
              <div class="label">Total para Divisão Disponível</div>
              <div class="value emerald">${formatCurrency(data.totalParaDivisaoDisponivel)}</div>
            </div>
            <div class="card">
              <div class="label">Retirada Sócios</div>
              <div class="value amber">${formatCurrency(data.retiradaSocios)}</div>
            </div>
            <div class="card">
              <div class="label">Total para Divisão à Receber</div>
              <div class="value purple">${formatCurrency(data.totalParaDivisaoAReceber)}</div>
            </div>
            <div class="card">
              <div class="label">Saídas Total</div>
              <div class="value red">${formatCurrency(data.saidasTotal)}</div>
            </div>
            <div class="card highlight">
              <div class="label">Saldo Disponível Caixa</div>
              <div class="value blue">${formatCurrency(data.saldoDisponivelCaixa)}</div>
            </div>
          </div>

          <div class="footer">
            Grupo Fox - Dashboard de Análise Financeira
          </div>
        </body>
        </html>
      `;

      // Abrir janela de impressão para gerar PDF
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
        setTimeout(() => {
          printWindow.print();
          // printWindow.close(); // Não fechar automaticamente para o usuário poder salvar
        }, 500);
      }
    } catch (error) {
      console.error("Erro ao exportar PDF:", error);
    } finally {
      setExporting(false);
    }
  };

  if (selectedView === "menu") {
    return (
      <div className="space-y-6">
        <div className="text-center py-4">
          <h3 className="text-lg md:text-2xl font-semibold text-slate-700 dark:text-slate-200">
            Selecione a análise
          </h3>
          <p className="text-xs md:text-sm text-slate-400 mt-1">Escolha entre Serragem ou Rojão</p>
        </div>

        {/* Seletor de período */}
        <div className="flex justify-center">
          <PeriodSelector
            period={period}
            setPeriod={setPeriod}
            customStart={customStart}
            setCustomStart={setCustomStart}
            customEnd={customEnd}
            setCustomEnd={setCustomEnd}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
          {/* Card Serragem */}
          <button
            onClick={() => setSelectedView("serragem")}
            className="group bg-white dark:bg-slate-800 border-2 border-green-200 dark:border-green-700 rounded-2xl p-8 shadow-sm hover:shadow-lg hover:border-green-400 dark:hover:border-green-500 transition-all cursor-pointer"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center group-hover:scale-110 transition-transform">
                <TreePine className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <span className="text-xl font-bold text-green-800 dark:text-green-300">Serragem</span>
              <span className="text-xs text-slate-400">Análise financeira</span>
            </div>
          </button>

          {/* Card Rojão */}
          <button
            onClick={() => setSelectedView("rojao")}
            className="group bg-white dark:bg-slate-800 border-2 border-orange-200 dark:border-orange-700 rounded-2xl p-8 shadow-sm hover:shadow-lg hover:border-orange-400 dark:hover:border-orange-500 transition-all cursor-pointer"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Flame className="w-8 h-8 text-orange-600 dark:text-orange-400" />
              </div>
              <span className="text-xl font-bold text-orange-800 dark:text-orange-300">Rojão</span>
              <span className="text-xs text-slate-400">Análise financeira</span>
            </div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Botão Voltar + Seletor de período */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => setSelectedView("menu")}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar</span>
        </button>
        <PeriodSelector
          period={period}
          setPeriod={setPeriod}
          customStart={customStart}
          setCustomStart={setCustomStart}
          customEnd={customEnd}
          setCustomEnd={setCustomEnd}
        />
      </div>

      {/* Conteúdo */}
      {selectedView === "serragem" && (
        <FinancialCardsLayout
          data={emptyData}
          title="Serragem"
          icon={<TreePine className="w-6 h-6 text-green-600 dark:text-green-400" />}
          periodLabel={periodLabel}
          onExportPDF={() => handleExportPDF("serragem")}
          exporting={exporting}
        />
      )}
      {selectedView === "rojao" && (
        <FinancialCardsLayout
          data={emptyData}
          title="Rojão"
          icon={<Flame className="w-6 h-6 text-orange-600 dark:text-orange-400" />}
          periodLabel={periodLabel}
          onExportPDF={() => handleExportPDF("rojao")}
          exporting={exporting}
        />
      )}
    </div>
  );
}
