/**
 * Métrica de Clientes - Análise da carteira de clientes do GRUPO
 * 
 * Foco: grupo como um todo (não por vendedor individual)
 * Métricas:
 * 1. Clientes Novos por mês (primeira compra + reativados 6+ meses)
 * 2. Ranking de Frequência (últimos 12 meses)
 * 3. Alerta de Intervalo Vencido (clientes que deveriam ter recomprado)
 */

import React, { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  Users,
  UserPlus,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  Clock,
  Search,
  ChevronDown,
  ChevronUp,
  Loader2,
  BarChart3,
  Filter,
} from "lucide-react";
import { Input } from "@/components/ui/input";

export default function MetricaClientesTab() {
  const [segmentoProduto, setSegmentoProduto] = useState("all");
  const [segmentoCliente, setSegmentoCliente] = useState("all");
  const [activeSection, setActiveSection] = useState<"novos" | "frequencia" | "atrasados">("novos");
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch segment options
  const { data: segmentOptions } = trpc.sales.getClientSegmentOptions.useQuery();

  // Fetch group metrics
  const { data: metrics, isLoading } = trpc.sales.getGroupClientMetrics.useQuery({
    segmentoProduto: segmentoProduto !== "all" ? segmentoProduto : undefined,
    segmentoCliente: segmentoCliente !== "all" ? segmentoCliente : undefined,
  });

  const filteredFrequency = useMemo(() => {
    if (!metrics?.frequencyRanking) return [];
    if (!searchTerm) return metrics.frequencyRanking;
    const term = searchTerm.toLowerCase();
    return metrics.frequencyRanking.filter(c => c.cliente.toLowerCase().includes(term));
  }, [metrics?.frequencyRanking, searchTerm]);

  const filteredOverdue = useMemo(() => {
    if (!metrics?.overdueClients) return [];
    if (!searchTerm) return metrics.overdueClients;
    const term = searchTerm.toLowerCase();
    return metrics.overdueClients.filter(c => c.cliente.toLowerCase().includes(term));
  }, [metrics?.overdueClients, searchTerm]);

  const formatCurrency = (val: number) => {
    return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  return (
    <div className="space-y-4 md:space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <Users className="w-4 h-4 md:w-5 md:h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          Métrica de Clientes — Carteira do Grupo
        </h2>
        <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Análise da carteira de clientes: novos, frequência de compra e alertas de recompra
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
          <select
            value={segmentoProduto}
            onChange={(e) => setSegmentoProduto(e.target.value)}
            className="text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
          >
            <option value="all">Todos Produtos</option>
            {segmentOptions?.produtoSegmentos.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <select
            value={segmentoCliente}
            onChange={(e) => setSegmentoCliente(e.target.value)}
            className="text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
          >
            <option value="all">Todos Segmentos</option>
            {segmentOptions?.clienteSegmentos.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
          <span className="ml-2 text-sm text-slate-500">Calculando métricas...</span>
        </div>
      ) : metrics ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-3">
            <KPICard
              icon={<Users className="w-4 h-4" />}
              label="Total Clientes"
              value={metrics.summary.totalClientes}
              color="blue"
              subtitle="Clientes distintos com pelo menos 1 pedido no histórico"
            />
            <KPICard
              icon={<UserPlus className="w-4 h-4" />}
              label="Novos (3 meses)"
              value={metrics.summary.totalNovosUltimos3Meses}
              color="emerald"
              subtitle="Primeira compra nos últimos 3 meses (nunca compraram antes)"
            />
            <KPICard
              icon={<RefreshCw className="w-4 h-4" />}
              label="Reativados (3m)"
              value={metrics.summary.totalReativadosUltimos3Meses}
              color="amber"
              subtitle="Inativos há 6+ meses que voltaram a comprar nos últimos 3 meses"
            />
            <KPICard
              icon={<TrendingUp className="w-4 h-4" />}
              label="Recorrentes"
              value={metrics.summary.clientesRecorrentes}
              color="purple"
              subtitle="Clientes com 2 ou mais pedidos no histórico (já recompraram)"
            />
            <KPICard
              icon={<Clock className="w-4 h-4" />}
              label="Só 1 Compra"
              value={metrics.summary.clientesCom1Pedido}
              color="slate"
              subtitle="Clientes que fizeram apenas 1 pedido e nunca mais voltaram"
            />
            <KPICard
              icon={<AlertTriangle className="w-4 h-4" />}
              label="Atrasados"
              value={metrics.summary.clientesInadimplentes}
              color="red"
              subtitle="Clientes recorrentes que já passaram do intervalo médio de recompra"
            />
          </div>

          {/* Section Tabs */}
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
            <TabButton
              active={activeSection === "novos"}
              onClick={() => setActiveSection("novos")}
              icon={<UserPlus className="w-3.5 h-3.5" />}
              label="Novos por Mês"
            />
            <TabButton
              active={activeSection === "frequencia"}
              onClick={() => setActiveSection("frequencia")}
              icon={<BarChart3 className="w-3.5 h-3.5" />}
              label="Frequência"
            />
            <TabButton
              active={activeSection === "atrasados"}
              onClick={() => setActiveSection("atrasados")}
              icon={<AlertTriangle className="w-3.5 h-3.5" />}
              label="Atrasados"
            />
          </div>

          {/* Search (for frequencia and atrasados) */}
          {(activeSection === "frequencia" || activeSection === "atrasados") && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input
                placeholder="Buscar cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-8 text-xs"
              />
            </div>
          )}

          {/* Section Content */}
          {activeSection === "novos" && (
            <NovosSection data={metrics.clientesNovosPorMes} />
          )}
          {activeSection === "frequencia" && (
            <FrequenciaSection data={filteredFrequency} formatCurrency={formatCurrency} />
          )}
          {activeSection === "atrasados" && (
            <AtrasadosSection data={filteredOverdue} formatCurrency={formatCurrency} />
          )}
        </>
      ) : (
        <div className="text-center py-8 text-sm text-slate-500">
          Sem dados disponíveis. Verifique se há pedidos de venda sincronizados.
        </div>
      )}
    </div>
  );
}

// ==================== Sub-components ====================

function KPICard({ icon, label, value, color, subtitle }: { icon: React.ReactNode; label: string; value: number; color: string; subtitle: string }) {
  const colorClasses: Record<string, string> = {
    blue: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300",
    emerald: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300",
    amber: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300",
    purple: "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300",
    slate: "bg-slate-50 dark:bg-slate-700/40 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300",
    red: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300",
  };

  return (
    <div className={`rounded-xl border p-2.5 md:p-3 ${colorClasses[color]}`}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[9px] md:text-[10px] font-medium uppercase truncate">{label}</span>
      </div>
      <p className="text-lg md:text-xl font-bold">{value}</p>
      <p className="text-[8px] md:text-[9px] mt-1 opacity-70 leading-tight">{subtitle}</p>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
        active
          ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 shadow-sm"
          : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

// ==================== Novos por Mês ====================

function NovosSection({ data }: { data: Array<{ month: string; novos: number; reativados: number; total: number; listaNovos: string[]; listaReativados: string[] }> }) {
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  // Show last 6 months by default
  const recentData = data.slice(-6);
  const maxTotal = Math.max(...recentData.map(d => d.total), 1);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="px-3 md:px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
        <h3 className="text-xs md:text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <UserPlus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          Clientes Novos + Reativados por Mês
        </h3>
        <p className="text-[10px] md:text-xs text-slate-500 mt-0.5">
          Novo = primeira compra | Reativado = voltou após 6+ meses sem comprar
        </p>
      </div>

      <div className="p-3 md:p-4 space-y-2">
        {recentData.map((item) => {
          const monthLabel = formatMonthLabel(item.month);
          const isExpanded = expandedMonth === item.month;
          const barWidth = (item.total / maxTotal) * 100;
          const novosWidth = item.total > 0 ? (item.novos / item.total) * barWidth : 0;
          const reativadosWidth = item.total > 0 ? (item.reativados / item.total) * barWidth : 0;

          return (
            <div key={item.month}>
              <button
                onClick={() => setExpandedMonth(isExpanded ? null : item.month)}
                className="w-full text-left"
              >
                <div className="flex items-center gap-2 md:gap-3">
                  <span className="text-[10px] md:text-xs font-medium text-slate-600 dark:text-slate-400 w-16 md:w-20 flex-shrink-0">
                    {monthLabel}
                  </span>
                  <div className="flex-1 h-5 md:h-6 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden flex">
                    {novosWidth > 0 && (
                      <div
                        className="h-full bg-emerald-500 dark:bg-emerald-400 rounded-l-full transition-all"
                        style={{ width: `${novosWidth}%` }}
                      />
                    )}
                    {reativadosWidth > 0 && (
                      <div
                        className="h-full bg-amber-500 dark:bg-amber-400 transition-all"
                        style={{ width: `${reativadosWidth}%` }}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="text-[10px] md:text-xs font-bold text-slate-800 dark:text-slate-200 w-6 text-right">
                      {item.total}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-3 h-3 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-3 h-3 text-slate-400" />
                    )}
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div className="mt-2 ml-16 md:ml-20 space-y-2 pb-2">
                  {item.listaNovos.length > 0 && (
                    <div>
                      <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                        Novos ({item.novos}):
                      </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {item.listaNovos.map((c, i) => (
                          <span key={i} className="text-[9px] md:text-[10px] bg-emerald-100 dark:bg-emerald-800/40 text-emerald-800 dark:text-emerald-200 px-1.5 py-0.5 rounded break-all">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {item.listaReativados.length > 0 && (
                    <div>
                      <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                        Reativados ({item.reativados}):
                      </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {item.listaReativados.map((c, i) => (
                          <span key={i} className="text-[9px] md:text-[10px] bg-amber-100 dark:bg-amber-800/40 text-amber-800 dark:text-amber-200 px-1.5 py-0.5 rounded break-all">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="px-3 md:px-4 py-2 border-t border-slate-100 dark:border-slate-700 flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-emerald-500" />
          <span className="text-[10px] text-slate-600 dark:text-slate-400">Novos</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-amber-500" />
          <span className="text-[10px] text-slate-600 dark:text-slate-400">Reativados (6+ meses)</span>
        </div>
      </div>
    </div>
  );
}

// ==================== Frequência ====================

function FrequenciaSection({ data, formatCurrency }: { data: Array<{ cliente: string; numPedidos: number; primeiraCompra: string; ultimaCompra: string; intervaloMedioDias: number; valorTotal: number; uf: string; segmento: string }>; formatCurrency: (v: number) => string }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="px-3 md:px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
        <h3 className="text-xs md:text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <BarChart3 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
          Ranking de Frequência (últimos 12 meses)
        </h3>
        <p className="text-[10px] md:text-xs text-slate-500 mt-0.5">
          {data.length} clientes com pedidos nos últimos 12 meses
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[10px] md:text-xs">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
              <th className="text-left px-2 md:px-3 py-2 font-semibold text-slate-600 dark:text-slate-400">#</th>
              <th className="text-left px-2 md:px-3 py-2 font-semibold text-slate-600 dark:text-slate-400">Cliente</th>
              <th className="text-center px-2 py-2 font-semibold text-slate-600 dark:text-slate-400">Pedidos</th>
              <th className="text-center px-2 py-2 font-semibold text-slate-600 dark:text-slate-400 hidden sm:table-cell">Intervalo</th>
              <th className="text-right px-2 md:px-3 py-2 font-semibold text-slate-600 dark:text-slate-400">Valor Total</th>
              <th className="text-center px-2 py-2 font-semibold text-slate-600 dark:text-slate-400 hidden md:table-cell">UF</th>
              <th className="text-center px-2 py-2 font-semibold text-slate-600 dark:text-slate-400 hidden lg:table-cell">Última Compra</th>
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 50).map((item, idx) => (
              <tr key={idx} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                <td className="px-2 md:px-3 py-1.5 text-slate-500 font-medium">{idx + 1}</td>
                <td className="px-2 md:px-3 py-1.5 text-slate-800 dark:text-slate-200 font-medium max-w-[150px] md:max-w-[250px] truncate" title={item.cliente}>
                  {item.cliente}
                </td>
                <td className="px-2 py-1.5 text-center">
                  <span className={`inline-flex items-center justify-center w-6 h-5 rounded-full text-[9px] font-bold ${
                    item.numPedidos >= 6 ? "bg-emerald-100 dark:bg-emerald-800/40 text-emerald-700 dark:text-emerald-300" :
                    item.numPedidos >= 3 ? "bg-blue-100 dark:bg-blue-800/40 text-blue-700 dark:text-blue-300" :
                    "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                  }`}>
                    {item.numPedidos}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-center text-slate-600 dark:text-slate-400 hidden sm:table-cell">
                  {item.intervaloMedioDias > 0 ? `${item.intervaloMedioDias}d` : "—"}
                </td>
                <td className="px-2 md:px-3 py-1.5 text-right text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">
                  {formatCurrency(item.valorTotal)}
                </td>
                <td className="px-2 py-1.5 text-center text-slate-500 hidden md:table-cell">{item.uf || "—"}</td>
                <td className="px-2 py-1.5 text-center text-slate-500 hidden lg:table-cell">{formatDate(item.ultimaCompra)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.length > 50 && (
          <div className="px-3 py-2 text-center text-[10px] text-slate-500 border-t border-slate-100 dark:border-slate-700">
            Mostrando 50 de {data.length} clientes
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== Atrasados ====================

function AtrasadosSection({ data, formatCurrency }: { data: Array<{ cliente: string; numPedidos: number; intervaloMedioDias: number; ultimaCompra: string; diasDesdeUltimaCompra: number; diasAtrasado: number; valorTotal: number; uf: string }>; formatCurrency: (v: number) => string }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="px-3 md:px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
        <h3 className="text-xs md:text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400 flex-shrink-0" />
          Clientes com Intervalo Vencido
        </h3>
        <p className="text-[10px] md:text-xs text-slate-500 mt-0.5">
          Clientes que já passaram do intervalo médio de recompra ({data.length} alertas)
        </p>
      </div>

      {data.length === 0 ? (
        <div className="p-6 text-center text-sm text-slate-500">
          Nenhum cliente com intervalo vencido no momento.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[10px] md:text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                <th className="text-left px-2 md:px-3 py-2 font-semibold text-slate-600 dark:text-slate-400">Cliente</th>
                <th className="text-center px-2 py-2 font-semibold text-slate-600 dark:text-slate-400">Pedidos</th>
                <th className="text-center px-2 py-2 font-semibold text-slate-600 dark:text-slate-400">Intervalo Médio</th>
                <th className="text-center px-2 py-2 font-semibold text-slate-600 dark:text-slate-400">Última Compra</th>
                <th className="text-center px-2 py-2 font-semibold text-red-600 dark:text-red-400">Dias Atrasado</th>
                <th className="text-right px-2 md:px-3 py-2 font-semibold text-slate-600 dark:text-slate-400 hidden sm:table-cell">Valor Total</th>
                <th className="text-center px-2 py-2 font-semibold text-slate-600 dark:text-slate-400 hidden md:table-cell">UF</th>
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 50).map((item, idx) => (
                <tr key={idx} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-red-50/30 dark:hover:bg-red-900/10">
                  <td className="px-2 md:px-3 py-1.5 text-slate-800 dark:text-slate-200 font-medium max-w-[150px] md:max-w-[250px] truncate" title={item.cliente}>
                    {item.cliente}
                  </td>
                  <td className="px-2 py-1.5 text-center text-slate-600 dark:text-slate-400">{item.numPedidos}</td>
                  <td className="px-2 py-1.5 text-center text-slate-600 dark:text-slate-400">{item.intervaloMedioDias}d</td>
                  <td className="px-2 py-1.5 text-center text-slate-600 dark:text-slate-400">{formatDate(item.ultimaCompra)}</td>
                  <td className="px-2 py-1.5 text-center">
                    <span className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                      item.diasAtrasado > 60 ? "bg-red-100 dark:bg-red-800/40 text-red-700 dark:text-red-300" :
                      item.diasAtrasado > 30 ? "bg-orange-100 dark:bg-orange-800/40 text-orange-700 dark:text-orange-300" :
                      "bg-amber-100 dark:bg-amber-800/40 text-amber-700 dark:text-amber-300"
                    }`}>
                      +{item.diasAtrasado}d
                    </span>
                  </td>
                  <td className="px-2 md:px-3 py-1.5 text-right text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap hidden sm:table-cell">
                    {formatCurrency(item.valorTotal)}
                  </td>
                  <td className="px-2 py-1.5 text-center text-slate-500 hidden md:table-cell">{item.uf || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.length > 50 && (
            <div className="px-3 py-2 text-center text-[10px] text-slate-500 border-t border-slate-100 dark:border-slate-700">
              Mostrando 50 de {data.length} clientes com atraso
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ==================== Helpers ====================

function formatMonthLabel(monthStr: string): string {
  const [year, month] = monthStr.split("-");
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[parseInt(month) - 1]}/${year.slice(2)}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}
