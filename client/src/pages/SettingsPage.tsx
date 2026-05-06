/**
 * Configurações - Página protegida por senha
 * Painéis: Metas de Vendas, Alertas, Alterar Senha
 */

import React, { useState, useMemo, Fragment, useRef, useEffect } from "react";
import { useOperator } from "@/contexts/OperatorContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Settings,
  Lock,
  Target,
  Bell,
  KeyRound,
  ArrowLeft,
  Save,
  Trash2,
  Plus,
  Check,
  X,
  Loader2,
  BarChart3,
  Package,
  AlertTriangle,
  ArrowRightLeft,
  Search,
  Filter,
  Landmark,
  DollarSign,
  Calendar,
  Edit3,
  RefreshCw,
  ShieldAlert,
  GitBranch,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  TreePine,
  ToggleLeft,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { toast } from "sonner";
import TopNav from "@/components/TopNav";

// ─── Password Gate ─────────────────────────────────────────────
function PasswordGate({ onUnlock }: { onUnlock: (pwd: string) => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const verifyMutation = trpc.settings.verifyPassword.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await verifyMutation.mutateAsync({ password });
      if (result.success) {
        onUnlock(password);
      } else {
        setError("Senha incorreta");
        setPassword("");
      }
    } catch {
      setError("Erro ao verificar senha");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <TopNav />
      <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 3.5rem)' }}>
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-slate-500" />
          </div>
          <h1 className="text-xl font-bold text-slate-800">Configurações</h1>
          <p className="text-sm text-slate-500 mt-1">Digite a senha de administrador</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="text-center text-lg tracking-widest"
            autoFocus
          />
          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}
          <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700" disabled={loading || !password}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
            Acessar
          </Button>
        </form>
        <div className="mt-4 text-center">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-slate-400">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Voltar ao Dashboard
            </Button>
          </Link>
        </div>
      </div>
      </div>
    </div>
  );
}

// ─── Sales Targets Panel ───────────────────────────────────────
function SalesTargetsPanel({ adminPassword }: { adminPassword: string }) {
  const utils = trpc.useUtils();
  const { data: targets, isLoading } = trpc.settings.getSalesTargets.useQuery();
  const setTargetMutation = trpc.settings.setSalesTarget.useMutation({
    onSuccess: () => utils.settings.getSalesTargets.invalidate(),
  });
  const deleteTargetMutation = trpc.settings.deleteSalesTarget.useMutation({
    onSuccess: () => utils.settings.getSalesTargets.invalidate(),
  });

  const [newMonth, setNewMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [newSegment, setNewSegment] = useState("all");
  const [newValue, setNewValue] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const segmentLabel = (s: string) => {
    switch (s) {
      case "all": return "Geral";
      case "industrializacao": return "Industrialização";
      case "importacao": return "Importação";
      default: return s;
    }
  };

  const formatMonth = (ym: string) => {
    const [y, m] = ym.split("-");
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return `${months[parseInt(m) - 1]}/${y}`;
  };

  const handleAdd = async () => {
    const val = parseFloat(newValue.replace(/\./g, "").replace(",", "."));
    if (isNaN(val) || val <= 0) {
      toast.error("Valor inválido");
      return;
    }
    const result = await setTargetMutation.mutateAsync({
      password: adminPassword,
      yearMonth: newMonth,
      segment: newSegment as "all" | "industrializacao" | "importacao",
      targetValue: val,
    });
    if (result.success) {
      toast.success("Meta salva com sucesso");
      setNewValue("");
      setShowAdd(false);
    } else {
      toast.error(result.error || "Erro ao salvar meta");
    }
  };

  const handleDelete = async (id: number) => {
    const result = await deleteTargetMutation.mutateAsync({ password: adminPassword, id });
    if (result.success) {
      toast.success("Meta removida");
    } else {
      toast.error(result.error || "Erro ao remover");
    }
  };

  // Group targets by month
  const grouped = useMemo(() => {
    if (!targets) return {};
    const g: Record<string, typeof targets> = {};
    for (const t of targets) {
      if (!g[t.yearMonth]) g[t.yearMonth] = [];
      g[t.yearMonth].push(t);
    }
    // Sort by month descending
    return Object.fromEntries(
      Object.entries(g).sort(([a], [b]) => b.localeCompare(a))
    );
  }, [targets]);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-teal-50 rounded-lg flex items-center justify-center">
            <Target className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <h2 className="font-bold text-slate-800">Metas de Vendas</h2>
            <p className="text-xs text-slate-500">Defina metas mensais por segmento</p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => setShowAdd(!showAdd)}
          className={showAdd ? "bg-slate-200 text-slate-600 hover:bg-slate-300" : "bg-teal-600 hover:bg-teal-700"}
        >
          {showAdd ? <X className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
          {showAdd ? "Cancelar" : "Nova Meta"}
        </Button>
      </div>

      {/* Add new target form */}
      {showAdd && (
        <div className="p-5 bg-teal-50/50 border-b border-slate-100 dark:border-slate-700">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Mês</label>
              <Input
                type="month"
                value={newMonth}
                onChange={(e) => setNewMonth(e.target.value)}
                className="bg-white"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Segmento</label>
              <Select value={newSegment} onValueChange={setNewSegment}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Geral (Total)</SelectItem>
                  <SelectItem value="industrializacao">Industrialização</SelectItem>
                  <SelectItem value="importacao">Importação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Meta (R$)</label>
              <Input
                type="text"
                placeholder="Ex: 500.000"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                className="bg-white"
              />
            </div>
            <Button
              onClick={handleAdd}
              disabled={setTargetMutation.isPending || !newValue}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {setTargetMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
              Salvar
            </Button>
          </div>
        </div>
      )}

      {/* Targets list */}
      <div className="p-5">
        {isLoading ? (
          <div className="text-center py-8 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            <p className="text-sm">Carregando metas...</p>
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <Target className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nenhuma meta definida</p>
            <p className="text-xs mt-1">Clique em "Nova Meta" para começar</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([month, monthTargets]) => (
              <div key={month} className="border border-slate-100 rounded-lg overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 dark:border-slate-700">
                  <span className="font-semibold text-sm text-slate-700">{formatMonth(month)}</span>
                </div>
                <div className="divide-y divide-slate-50 dark:divide-slate-700">
                  {monthTargets.map((t) => (
                    <div key={t.id} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <Badge
                          className={`text-xs border-0 ${
                            t.segment === "all"
                              ? "bg-blue-100 text-blue-700"
                              : t.segment === "industrializacao"
                              ? "bg-violet-100 text-violet-700"
                              : "bg-teal-100 text-teal-700"
                          }`}
                        >
                          {segmentLabel(t.segment)}
                        </Badge>
                        <span className="font-bold text-slate-800">
                          R$ {Number(t.targetValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(t.id)}
                        disabled={deleteTargetMutation.isPending}
                        className="text-red-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Alert Settings Panel ──────────────────────────────────────
function AlertSettingsPanel({ adminPassword }: { adminPassword: string }) {
  const utils = trpc.useUtils();
  const { data: alerts, isLoading } = trpc.settings.getAlertSettings.useQuery();
  const setAlertsMutation = trpc.settings.setAlertSettings.useMutation({
    onSuccess: () => utils.settings.getAlertSettings.invalidate(),
  });

  const [stockMinEnabled, setStockMinEnabled] = useState(false);
  const [stockMinThreshold, setStockMinThreshold] = useState("10");
  const [salesDailyEnabled, setSalesDailyEnabled] = useState(false);
  const [salesDailyThreshold, setSalesDailyThreshold] = useState("20000");
  const [initialized, setInitialized] = useState(false);

  // Load initial values from server
  if (alerts && !initialized) {
    setStockMinEnabled(alerts.stockMinEnabled);
    setStockMinThreshold(String(alerts.stockMinThreshold));
    setSalesDailyEnabled(alerts.salesDailyEnabled);
    setSalesDailyThreshold(String(alerts.salesDailyThreshold));
    setInitialized(true);
  }

  const handleSave = async () => {
    const result = await setAlertsMutation.mutateAsync({
      password: adminPassword,
      stockMinEnabled,
      stockMinThreshold: parseInt(stockMinThreshold) || 10,
      salesDailyEnabled,
      salesDailyThreshold: parseFloat(salesDailyThreshold) || 20000,
    });
    if (result.success) {
      toast.success("Configurações de alertas salvas");
    } else {
      toast.error("Erro ao salvar");
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3">
        <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
          <Bell className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h2 className="font-bold text-slate-800">Alertas</h2>
          <p className="text-xs text-slate-500">Configure notificações automáticas</p>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {isLoading ? (
          <div className="text-center py-4">
            <Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" />
          </div>
        ) : (
          <>
            {/* Stock minimum alert */}
            <div className="border border-slate-100 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-teal-600" />
                  <span className="font-medium text-sm text-slate-700">Estoque Mínimo</span>
                </div>
                <button
                  onClick={() => setStockMinEnabled(!stockMinEnabled)}
                  className={`w-11 h-6 rounded-full transition-colors relative ${stockMinEnabled ? "bg-teal-500" : "bg-slate-200"}`}
                >
                  <div className={`w-5 h-5 bg-white dark:bg-slate-800 rounded-full shadow-sm absolute top-0.5 transition-transform ${stockMinEnabled ? "translate-x-5.5" : "translate-x-0.5"}`} />
                </button>
              </div>
              <p className="text-xs text-slate-500 mb-2">Alerta quando um produto tiver estoque disponível abaixo do limite</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Limite:</span>
                <Input
                  type="number"
                  value={stockMinThreshold}
                  onChange={(e) => setStockMinThreshold(e.target.value)}
                  className="w-24 h-8 text-sm"
                  disabled={!stockMinEnabled}
                />
                <span className="text-xs text-slate-500">caixas</span>
              </div>
            </div>

            {/* Sales daily alert */}
            <div className="border border-slate-100 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-orange-600" />
                  <span className="font-medium text-sm text-slate-700">Vendas Diárias</span>
                </div>
                <button
                  onClick={() => setSalesDailyEnabled(!salesDailyEnabled)}
                  className={`w-11 h-6 rounded-full transition-colors relative ${salesDailyEnabled ? "bg-teal-500" : "bg-slate-200"}`}
                >
                  <div className={`w-5 h-5 bg-white dark:bg-slate-800 rounded-full shadow-sm absolute top-0.5 transition-transform ${salesDailyEnabled ? "translate-x-5.5" : "translate-x-0.5"}`} />
                </button>
              </div>
              <p className="text-xs text-slate-500 mb-2">Alerta quando as vendas do dia ficarem abaixo do valor esperado</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Mínimo:</span>
                <span className="text-xs text-slate-500">R$</span>
                <Input
                  type="text"
                  value={salesDailyThreshold}
                  onChange={(e) => setSalesDailyThreshold(e.target.value)}
                  className="w-32 h-8 text-sm"
                  disabled={!salesDailyEnabled}
                />
                <span className="text-xs text-slate-500">/dia</span>
              </div>
            </div>

            <Button
              onClick={handleSave}
              disabled={setAlertsMutation.isPending}
              className="w-full bg-teal-600 hover:bg-teal-700"
            >
              {setAlertsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar Alertas
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Feature Toggles Panel ────────────────────────────────────
const FEATURE_TOGGLES = [
  { key: "vendas_a_faturar_completo", label: "A Faturar (Completo)", description: "Exibir card 'A Faturar (Completo)' na aba Vendas com todos os pedidos dos últimos 90 dias" },
];

function FeatureTogglesPanel() {
  const utils = trpc.useUtils();

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3">
        <div className="w-10 h-10 bg-cyan-50 rounded-lg flex items-center justify-center">
          <Eye className="w-5 h-5 text-cyan-600" />
        </div>
        <div>
          <h2 className="font-bold text-slate-800">Visibilidade de Seções</h2>
          <p className="text-xs text-slate-500">Ativar ou desativar seções para todos os operadores</p>
        </div>
      </div>
      <div className="p-5 space-y-4">
        {FEATURE_TOGGLES.map((ft) => (
          <FeatureToggleRow key={ft.key} featureKey={ft.key} label={ft.label} description={ft.description} utils={utils} />
        ))}
      </div>
    </div>
  );
}

function FeatureToggleRow({ featureKey, label, description, utils }: { featureKey: string; label: string; description: string; utils: any }) {
  const { data, isLoading } = trpc.settings.getFeatureToggle.useQuery({ key: featureKey });
  const toggleMutation = trpc.settings.setFeatureToggle.useMutation({
    onSuccess: () => {
      utils.settings.getFeatureToggle.invalidate({ key: featureKey });
      toast.success(`${label} ${!data?.enabled ? "ativado" : "desativado"}`);
    },
  });

  const enabled = data?.enabled ?? false;

  return (
    <div className="border border-slate-100 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <span className="font-medium text-sm text-slate-700">{label}</span>
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        </div>
        <button
          onClick={() => toggleMutation.mutate({ key: featureKey, enabled: !enabled })}
          disabled={isLoading || toggleMutation.isPending}
          className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ml-4 ${
            enabled ? "bg-teal-500" : "bg-slate-200"
          } ${(isLoading || toggleMutation.isPending) ? "opacity-50" : ""}`}
        >
          <div className={`w-5 h-5 bg-white dark:bg-slate-800 rounded-full shadow-sm absolute top-0.5 transition-transform ${
            enabled ? "translate-x-5.5" : "translate-x-0.5"
          }`} />
        </button>
      </div>
    </div>
  );
}

// ─── Operator Management Panel ─────────────────────────────────────
const PERMISSION_COLS = [
  { key: "accessEstoque" as const, label: "Estoque", color: "bg-teal-500" },
  { key: "accessValorizacao" as const, label: "Valoriz.", color: "bg-amber-500", sub: true },
  { key: "accessVendas" as const, label: "Vendas", color: "bg-blue-500" },
  { key: "accessFaturamento" as const, label: "Faturamento", color: "bg-violet-500" },
  { key: "accessFinanceiro" as const, label: "Financeiro", color: "bg-emerald-500" },
  { key: "accessProducao" as const, label: "Produção", color: "bg-orange-500" },
  { key: "accessConfiguracoes" as const, label: "Config.", color: "bg-red-500" },
];

// Definição de permissões granulares por aba
interface GranularPermDef {
  key: string;
  label: string;
  parentTab: string; // qual aba principal (faturamento, financeiro, configuracoes)
}

const GRANULAR_ESTOQUE: GranularPermDef[] = [
  { key: "est.valorizacao", label: "Valorização de Estoque", parentTab: "estoque" },
];

const GRANULAR_FATURAMENTO: GranularPermDef[] = [
  { key: "fat.toggleValores", label: "Ocultar/Mostrar Valores", parentTab: "faturamento" },
  { key: "fat.aceiteProducao", label: "Aceitar Pedido (Produc.)", parentTab: "faturamento" },
  { key: "fat.autorizarFaturamento", label: "Autorizar Faturamento", parentTab: "faturamento" },
  { key: "fat.desautorizarFaturamento", label: "Desautorizar Faturamento", parentTab: "faturamento" },
  { key: "fat.notaProducao", label: "Nota de Produc.", parentTab: "faturamento" },
  { key: "fat.statusProducao", label: "Status Produc.", parentTab: "faturamento" },
  { key: "fat.imprimirPedido", label: "Imprimir Pedido", parentTab: "faturamento" },
  { key: "fat.pedidoColeta", label: "Pedido de Coleta", parentTab: "faturamento" },
  { key: "fat.coletado", label: "Marcar Coletado", parentTab: "faturamento" },
  { key: "fat.transportadora", label: "Selec. Transportadora", parentTab: "faturamento" },
  { key: "fat.agendamentoColeta", label: "Agendar Coleta", parentTab: "faturamento" },
  { key: "fat.observacaoFaturar", label: "Obs. Autorizado a Faturar", parentTab: "faturamento" },
  { key: "fat.verRastreio", label: "Ver Link de Rastreio", parentTab: "faturamento" },
  { key: "fat.rastreio", label: "Editar Link de Rastreio", parentTab: "faturamento" },
];

const GRANULAR_FINANCEIRO: GranularPermDef[] = [
  { key: "fin.autorizacaoPagamento", label: "Autorizar Pagamento", parentTab: "financeiro" },
  { key: "fin.comentarioPagamento", label: "Comentar Pagamento", parentTab: "financeiro" },
  { key: "fin.verContasPagar", label: "Ver Contas a Pagar", parentTab: "financeiro" },
  { key: "fin.verContasReceber", label: "Ver Contas a Receber", parentTab: "financeiro" },
  { key: "fin.verInadimplencia", label: "Ver Inadimplência", parentTab: "financeiro" },
  { key: "fin.verSaldoBancario", label: "Ver Saldo Bancário", parentTab: "financeiro" },
  { key: "fin.verFluxoCaixa", label: "Ver Fluxo de Caixa", parentTab: "financeiro" },
  { key: "fin.verResumoFinanceiro", label: "Ver Resumo Financeiro", parentTab: "financeiro" },
  { key: "fin.cobranca", label: "Ações de Cobrança", parentTab: "financeiro" },
];

const GRANULAR_CONFIGURACOES: GranularPermDef[] = [
  { key: "cfg.senhas", label: "Senhas", parentTab: "configuracoes" },
  { key: "cfg.produtos", label: "Produto Importado", parentTab: "configuracoes" },
  { key: "cfg.alertas", label: "Alertas", parentTab: "configuracoes" },
  { key: "cfg.bancos", label: "Bancos", parentTab: "configuracoes" },
  { key: "cfg.variacoes", label: "Variações", parentTab: "configuracoes" },
  { key: "cfg.dados", label: "Dados", parentTab: "configuracoes" },
];

const ALL_GRANULAR_PERMS = [...GRANULAR_ESTOQUE, ...GRANULAR_FATURAMENTO, ...GRANULAR_FINANCEIRO, ...GRANULAR_CONFIGURACOES];

const GRANULAR_GROUPS = [
  { parentTab: "estoque", label: "Estoque", color: "bg-teal-500", perms: GRANULAR_ESTOQUE },
  { parentTab: "faturamento", label: "Faturamento", color: "bg-violet-500", perms: GRANULAR_FATURAMENTO },
  { parentTab: "financeiro", label: "Financeiro", color: "bg-emerald-500", perms: GRANULAR_FINANCEIRO },
  { parentTab: "configuracoes", label: "Configurações", color: "bg-red-500", perms: GRANULAR_CONFIGURACOES },
];

function OperatorManagementPanel() {
  const utils = trpc.useUtils();
  const { data: operatorList, isLoading } = trpc.settings.getOperators.useQuery();
  const { data: allGranularPerms } = trpc.settings.getAllGranularPermissions.useQuery();
  const seedMutation = trpc.settings.seedOperators.useMutation({
    onSuccess: () => utils.settings.getOperators.invalidate(),
  });
  const updatePasswordMutation = trpc.settings.updateOperatorPassword.useMutation({
    onSuccess: () => utils.settings.getOperators.invalidate(),
  });
  const updatePermissionMutation = trpc.settings.updateOperatorPermission.useMutation({
    onSuccess: () => utils.settings.getOperators.invalidate(),
  });
  const setGranularMutation = trpc.settings.setGranularPermission.useMutation({
    onSuccess: () => utils.settings.getAllGranularPermissions.invalidate(),
  });
  const createMutation = trpc.settings.createOperator.useMutation({
    onSuccess: () => {
      utils.settings.getOperators.invalidate();
      setNewName("");
    },
  });
  const deleteMutation = trpc.settings.deleteOperator.useMutation({
    onSuccess: () => utils.settings.getOperators.invalidate(),
  });

  const [passwordVisibility, setPasswordVisibility] = useState<Record<number, boolean>>({});
  const [editingPasswords, setEditingPasswords] = useState<Record<number, string>>({});
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [expandedOperator, setExpandedOperator] = useState<number | null>(null);

  // Build a map: operatorId -> { permKey -> enabled }
  const granularMap = useMemo(() => {
    const map: Record<number, Record<string, boolean>> = {};
    if (allGranularPerms) {
      for (const gp of allGranularPerms) {
        if (!map[gp.operatorId]) map[gp.operatorId] = {};
        map[gp.operatorId][gp.permissionKey] = !!gp.enabled;
      }
    }
    return map;
  }, [allGranularPerms]);

  const getGranularValue = (operatorId: number, key: string): boolean => {
    // Se não existe no mapa, default = autorizado (true)
    if (!granularMap[operatorId] || !(key in granularMap[operatorId])) return true;
    return granularMap[operatorId][key] === true;
  };

  const handleGranularToggle = (operatorId: number, key: string) => {
    const current = getGranularValue(operatorId, key);
    setGranularMutation.mutate({ operatorId, permissionKey: key, enabled: !current });
  };

  // Auto-seed operators if table is empty
  const hasSeeded = useMemo(() => {
    if (operatorList && operatorList.length === 0) {
      seedMutation.mutate();
      return false;
    }
    return true;
  }, [operatorList]);

  const togglePasswordVisibility = (id: number) => {
    setPasswordVisibility(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handlePasswordChange = (id: number, value: string) => {
    setEditingPasswords(prev => ({ ...prev, [id]: value }));
  };

  const savePassword = (id: number) => {
    const pwd = editingPasswords[id];
    if (pwd !== undefined) {
      // Find the original password from the server data
      const originalOp = operatorList?.find(op => op.id === id);
      const originalPwd = originalOp?.password || "";
      
      // Only save if the password actually changed
      if (pwd === originalPwd) {
        // No change - just exit editing mode silently
        setEditingPasswords(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        return;
      }
      
      // Don't allow saving empty passwords
      if (!pwd.trim()) {
        toast.error("Senha não pode ficar vazia");
        // Revert to original
        setEditingPasswords(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        return;
      }
      
      updatePasswordMutation.mutate({ id, password: pwd });
      setEditingPasswords(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      toast.success(`Senha de ${originalOp?.name || 'operador'} atualizada`);
    }
  };

  const handlePermissionToggle = (id: number, field: typeof PERMISSION_COLS[number]["key"], currentValue: boolean) => {
    updatePermissionMutation.mutate({ id, field, value: !currentValue });
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-10 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
            <Lock className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h2 className="font-bold text-slate-800">Controle de Acesso</h2>
            <p className="text-xs text-slate-500">Defina senhas e permissões para cada operador</p>
          </div>
        </div>
        <Badge variant="outline" className="text-xs">{operatorList?.length || 0} operadores</Badge>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full table-fixed" style={{ minWidth: "800px" }}>
          <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200">
            <tr>
              <th className="px-2 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider" style={{ width: "120px" }}>Operador</th>
              <th className="px-2 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider" style={{ width: "130px" }}>Senha</th>
              {PERMISSION_COLS.map(col => (
                <th key={col.key} className={`px-1 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider ${'sub' in col && col.sub ? 'text-[10px]' : ''}`} style={{ width: "80px" }}>
                  <div className="flex flex-col items-center gap-1">
                    {'sub' in col && col.sub && <span className="text-[9px] text-slate-400 -mb-1">&#8627; sub</span>}
                    <div className={`w-3 h-3 rounded-full ${col.color}`} />
                    {col.label}
                  </div>
                </th>
              ))}
              <th className="px-1 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider" style={{ width: "50px" }}>Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {operatorList?.map((op) => {
              const isEditing = editingPasswords[op.id] !== undefined;
              const displayPwd = isEditing ? editingPasswords[op.id] : op.password;
              const showPwd = passwordVisibility[op.id];
              const isExpanded = expandedOperator === op.id;
              const hasAnyParentTab = (tab: string) => {
                if (tab === "estoque") return op.accessEstoque;
                if (tab === "faturamento") return op.accessFaturamento;
                if (tab === "financeiro") return op.accessFinanceiro;
                if (tab === "configuracoes") return op.accessConfiguracoes;
                return false;
              };

              return (
                <Fragment key={op.id}>
                <tr className="hover:bg-slate-50 transition-colors">
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setExpandedOperator(isExpanded ? null : op.id)}
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                        title="Ver permissões detalhadas"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      <span className="font-medium text-slate-800 text-sm">{op.name}</span>
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1">
                      <div className="relative flex-1">
                        <Input
                          type={showPwd ? "text" : "password"}
                          value={displayPwd}
                          onChange={(e) => handlePasswordChange(op.id, e.target.value)}
                          placeholder="Definir senha"
                          className="h-8 text-sm pr-8"
                          onBlur={() => {
                            // Small delay to allow click on the save button to fire first
                            setTimeout(() => {
                              if (editingPasswords[op.id] !== undefined) savePassword(op.id);
                            }, 150);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && isEditing) savePassword(op.id);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => togglePasswordVisibility(op.id)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          {showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      {isEditing && (
                        <button
                          onClick={() => savePassword(op.id)}
                          className="text-emerald-500 hover:text-emerald-700 transition-colors"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                  {PERMISSION_COLS.map(col => (
                    <td key={col.key} className="px-1 py-2 text-center">
                      <button
                        onClick={() => handlePermissionToggle(op.id, col.key, (op as any)[col.key])}
                        className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
                          (op as any)[col.key]
                            ? `${col.color} border-transparent text-white`
                            : "border-slate-300 hover:border-slate-400 bg-white"
                        }`}
                      >
                        {(op as any)[col.key] && <Check className="w-3.5 h-3.5" />}
                      </button>
                    </td>
                  ))}
                  <td className="px-1 py-2 text-center">
                    <button
                      onClick={() => {
                        if (confirm(`Excluir operador ${op.name}?`)) {
                          deleteMutation.mutate({ id: op.id });
                        }
                      }}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
                {isExpanded && (
                  <tr key={`${op.id}-granular`}>
                    <td colSpan={PERMISSION_COLS.length + 3} className="px-4 py-4 bg-slate-50/80">
                      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                        Permissões Detalhadas de {op.name}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {GRANULAR_GROUPS.map(group => {
                          const parentEnabled = hasAnyParentTab(group.parentTab);
                          return (
                            <div key={group.parentTab} className={`rounded-lg border p-3 ${parentEnabled ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-50'}`}>
                              <div className="flex items-center gap-2 mb-3">
                                <div className={`w-3 h-3 rounded-full ${group.color}`} />
                                <span className="text-xs font-bold text-slate-700 uppercase">{group.label}</span>
                                {!parentEnabled && <span className="text-[10px] text-red-400">(aba desabilitada)</span>}
                              </div>
                              <div className="space-y-2">
                                {group.perms.map(perm => {
                                  const enabled = getGranularValue(op.id, perm.key);
                                  return (
                                    <div key={perm.key} className="flex items-center justify-between">
                                      <span className="text-xs text-slate-600">{perm.label}</span>
                                      <button
                                        onClick={() => parentEnabled && handleGranularToggle(op.id, perm.key)}
                                        disabled={!parentEnabled}
                                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                                          enabled
                                            ? `${group.color} border-transparent text-white`
                                            : parentEnabled
                                              ? "border-slate-300 hover:border-slate-400 bg-white"
                                              : "border-slate-200 bg-slate-100 cursor-not-allowed"
                                        }`}
                                      >
                                        {enabled && <Check className="w-3 h-3" />}
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add new operator */}
      <div className="p-4 border-t border-slate-100">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Novo Usuário</p>
        <div className="flex items-center gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nome"
            className="h-8 text-sm flex-1 max-w-[200px]"
          />
          <Input
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Senha"
            type="password"
            className="h-8 text-sm flex-1 max-w-[160px]"
            onKeyDown={(e) => {
              if (e.key === "Enter" && newName.trim() && newPassword.trim()) {
                createMutation.mutate({ name: newName.trim(), password: newPassword.trim() });
                setNewPassword("");
              }
            }}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (newName.trim() && newPassword.trim()) {
                createMutation.mutate({ name: newName.trim(), password: newPassword.trim() });
                setNewPassword("");
              }
            }}
            disabled={!newName.trim() || !newPassword.trim() || createMutation.isPending}
            className="h-8"
          >
            <Plus className="w-4 h-4 mr-1" />
            Adicionar
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Data Info Panel ───────────────────────────────────────────
function DataInfoPanel() {
  const { data: status } = trpc.dashboard.getStatus.useQuery();
  const { data: dashData } = trpc.dashboard.getData.useQuery();

  const stockCount = dashData?.items?.length || 0;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
          <Package className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h2 className="font-bold text-slate-800">Dados do Sistema</h2>
          <p className="text-xs text-slate-500">Informações sobre os dados carregados</p>
        </div>
      </div>

      <div className="p-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="border border-slate-100 rounded-lg p-3">
            <p className="text-xs text-slate-500">Status Conexão</p>
            <p className={`font-bold text-sm ${status?.isConnected ? "text-emerald-600" : "text-red-500"}`}>
              {status?.isConnected ? "Conectado" : "Desconectado"}
            </p>
          </div>
          <div className="border border-slate-100 rounded-lg p-3">
            <p className="text-xs text-slate-500">Última Sincronização</p>
            <p className="font-bold text-sm text-slate-700">
              {status?.lastSyncAt
                ? new Date(status.lastSyncAt).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—"}
            </p>
          </div>
          <div className="border border-slate-100 rounded-lg p-3">
            <p className="text-xs text-slate-500">Produtos no Estoque</p>
            <p className="font-bold text-sm text-slate-700">{stockCount} itens</p>
          </div>
          <div className="border border-slate-100 rounded-lg p-3">
            <p className="text-xs text-slate-500">Status Sync</p>
            <p className="font-bold text-sm text-slate-700 truncate">{status?.lastSyncStatus || "—"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Product Segments Panel ───────────────────────────────────
function ProductSegmentsPanel({ adminPassword }: { adminPassword: string }) {
  const utils = trpc.useUtils();
  const { data: products, isLoading } = trpc.settings.getProductSegments.useQuery();
  const setSegmentMutation = trpc.settings.setProductSegment.useMutation({
    onSuccess: () => {
      utils.settings.getProductSegments.invalidate();
      utils.sales.getAnalytics.invalidate();
      utils.sales.getCumulativeComparison.invalidate();
    },
  });
  const removeOverrideMutation = trpc.settings.removeProductSegment.useMutation({
    onSuccess: () => {
      utils.settings.getProductSegments.invalidate();
      utils.sales.getAnalytics.invalidate();
      utils.sales.getCumulativeComparison.invalidate();
    },
  });
  const toggleVisibilityMutation = trpc.settings.toggleProductVisibility.useMutation({
    onSuccess: () => {
      utils.settings.getProductSegments.invalidate();
      utils.settings.getHiddenProducts.invalidate();
    },
  });

  // Product classification
  const { data: classifications } = trpc.settings.getProductClassifications.useQuery();
  const setClassificationMutation = trpc.settings.setProductClassification.useMutation({
    onSuccess: () => utils.settings.getProductClassifications.invalidate(),
  });
  const removeClassificationMutation = trpc.settings.removeProductClassification.useMutation({
    onSuccess: () => utils.settings.getProductClassifications.invalidate(),
  });
  const autoClassifyMutation = trpc.settings.autoClassifyProducts.useMutation({
    onSuccess: (data) => {
      utils.settings.getProductClassifications.invalidate();
      if (data.success) {
        toast.success(`Auto-classificação concluída: ${data.estoque} em estoque, ${data.encomenda} sob encomenda`);
      }
    },
  });

  // Product pricing
  const { data: pricingData } = trpc.settings.getProductPricing.useQuery();
  const { data: avgPrices } = trpc.dashboard.getAvgSalesPrices.useQuery();
  const setPricingMutation = trpc.settings.setProductPricing.useMutation({
    onSuccess: () => {
      utils.settings.getProductPricing.invalidate();
      utils.dashboard.getAvgSalesPrices.invalidate();
    },
  });
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [editPriceValue, setEditPriceValue] = useState("");

  // Stock settings (estoque regulador + prazo compra)
  const setStockSettingsMutation = trpc.settings.setProductStockSettings.useMutation({
    onSuccess: () => {
      utils.settings.getProductPricing.invalidate();
    },
  });
  const [editingStockField, setEditingStockField] = useState<{ codigoItem: string; field: "vendaMensal" | "fatorMultiplicacao" | "prazoCompraDias" } | null>(null);
  const [editStockValue, setEditStockValue] = useState("");

  const pricingMap = useMemo(() => {
    const map = new Map<string, { mode: string; manualPrice: string | null; vendaMensal: number | null; fatorMultiplicacao: string | null; prazoCompraDias: number | null }>();
    if (pricingData) {
      for (const p of pricingData) {
        map.set(p.codigoItem, { mode: p.mode, manualPrice: p.manualPrice, vendaMensal: p.vendaMensal, fatorMultiplicacao: p.fatorMultiplicacao, prazoCompraDias: p.prazoCompraDias });
      }
    }
    return map;
  }, [pricingData]);

  // avgPrices keys are by product description, need to map to codigoItem
  const autoPriceMap = useMemo(() => {
    const map = new Map<string, number>();
    if (avgPrices?.prices && products) {
      const descToPrice = new Map<string, number>();
      for (const [desc, data] of Object.entries(avgPrices.prices)) {
        descToPrice.set(desc, (data as any).avgPrice);
      }
      // Map each product's codigoItem to its price via descricao
      for (const product of products) {
        if (product.codigoItem && product.descricao) {
          const price = descToPrice.get(product.descricao);
          if (price) map.set(product.codigoItem, price);
        }
      }
    }
    return map;
  }, [avgPrices, products]);

  const handlePricingMode = async (codigoItem: string, mode: "auto" | "manual") => {
    const current = pricingMap.get(codigoItem);
    if (mode === "manual") {
      const autoPrice = autoPriceMap.get(codigoItem);
      const currentManual = current?.manualPrice ? parseFloat(current.manualPrice) : null;
      setEditingPrice(codigoItem);
      setEditPriceValue(currentManual ? currentManual.toFixed(2) : autoPrice ? autoPrice.toFixed(2) : "");
      await setPricingMutation.mutateAsync({ codigoItem, mode: "manual", manualPrice: currentManual ?? autoPrice ?? null });
    } else {
      await setPricingMutation.mutateAsync({ codigoItem, mode: "auto", manualPrice: null });
      setEditingPrice(null);
      toast.success("Preço automático ativado");
    }
  };

  const handleSaveManualPrice = async (codigoItem: string) => {
    const val = parseFloat(editPriceValue.replace(",", "."));
    if (isNaN(val) || val <= 0) {
      toast.error("Digite um valor válido");
      return;
    }
    await setPricingMutation.mutateAsync({ codigoItem, mode: "manual", manualPrice: val });
    setEditingPrice(null);
    toast.success(`Preço manual salvo: R$ ${val.toFixed(2)}`);
  };

  const classificationMap = useMemo(() => {
    const map = new Map<string, string>();
    if (classifications) {
      for (const c of classifications) {
        map.set(c.codigoItem, c.classification);
      }
    }
    return map;
  }, [classifications]);

  const [search, setSearch] = useState("");
  const [filterSegment, setFilterSegment] = useState("all");
  const [filterOverride, setFilterOverride] = useState("all"); // all, with, without
  const [filterVisibility, setFilterVisibility] = useState("all"); // all, visible, hidden

  const segmentLabel = (s: string) => {
    switch (s) {
      case "industrializacao": return "Industrializados";
      case "importacao": return "Import. (Revenda)";
      case "importacao_mp": return "Import. Mat. Prima";
      case "outros": return "Outros";
      default: return s;
    }
  };

  const segmentColor = (s: string) => {
    switch (s) {
      case "industrializacao": return "bg-violet-100 text-violet-700";
      case "importacao": return "bg-teal-100 text-teal-700";
      case "importacao_mp": return "bg-blue-100 text-blue-700";
      default: return "bg-slate-100 text-slate-600";
    }
  };

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const filtered = useMemo(() => {
    if (!products) return [];
    let result = products.map(p => ({
      ...p,
      _classification: classificationMap.get(p.codigoItem || "") || null,
    }));
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(p => 
        p.descricao.toLowerCase().includes(s) ||
        (p.codigoItem && p.codigoItem.toLowerCase().includes(s)) ||
        (p.palavraChave && p.palavraChave.toLowerCase().includes(s)) ||
        (p.descricaoOriginal && p.descricaoOriginal.toLowerCase().includes(s)) ||
        (p.codigos && p.codigos.some((c: string) => c.toLowerCase().includes(s)))
      );
    }
    if (filterSegment !== "all") {
      result = result.filter(p => p.currentSegment === filterSegment);
    }
    if (filterOverride === "with") {
      result = result.filter(p => p.hasOverride);
    } else if (filterOverride === "without") {
      result = result.filter(p => !p.hasOverride);
    }
    if (filterVisibility === "visible") {
      result = result.filter(p => p.visible);
    } else if (filterVisibility === "hidden") {
      result = result.filter(p => !p.visible);
    }

    // Ordenar por semelhança: primeiro por tipo de produto (extraído do nome), depois por medida
    result.sort((a, b) => {
      // Extrair tipo base do produto (ex: "ESPETO DE BAMBU", "PALITO DE DENTE", "VARETA DE FIBRA")
      const getProductType = (desc: string) => {
        const d = desc.toUpperCase();
        // Extrair as primeiras palavras significativas (até encontrar medida numérica)
        const words = d.split(/\s+/);
        const typeWords: string[] = [];
        for (const w of words) {
          if (/^\d/.test(w) || w === "C/" || w === "C" || w === "X") break;
          typeWords.push(w);
        }
        return typeWords.join(" ");
      };

      // Extrair medida numérica principal (ex: 4.0, 3.0, 200)
      const getMeasure = (desc: string) => {
        const match = desc.match(/(\d+[,.]?\d*)\s*[xX*]\s*(\d+[,.]?\d*)/);
        if (match) {
          return parseFloat(match[1].replace(",", ".")) * 1000 + parseFloat(match[2].replace(",", "."));
        }
        const singleMatch = desc.match(/(\d+[,.]?\d*)\s*(?:MM|mm|CM|cm)/);
        if (singleMatch) return parseFloat(singleMatch[1].replace(",", "."));
        return 0;
      };

      const typeA = getProductType(a.descricao);
      const typeB = getProductType(b.descricao);
      
      if (typeA !== typeB) return typeA.localeCompare(typeB, "pt-BR");
      
      // Mesmo tipo: ordenar por medida
      const measureA = getMeasure(a.descricao);
      const measureB = getMeasure(b.descricao);
      if (measureA !== measureB) return measureA - measureB;
      
      // Mesma medida: ordenar por descrição completa
      return a.descricao.localeCompare(b.descricao, "pt-BR");
    });

    return result;
  }, [products, search, filterSegment, filterOverride, filterVisibility, classificationMap]);

  const handleToggleVisibility = async (descricao: string, codigoItem: string, visible: boolean) => {
    const result = await toggleVisibilityMutation.mutateAsync({
      password: adminPassword,
      descricao,
      codigoItem: codigoItem || undefined,
      visible,
    });
    if (result.success) {
      toast.success(visible ? "Produto visível no dashboard" : "Produto oculto do dashboard");
    } else {
      toast.error(result.error || "Erro ao alterar visibilidade");
    }
  };

  const handleChangeSegment = async (descricao: string, codigoGrupo: string, newSegment: string) => {
    const result = await setSegmentMutation.mutateAsync({
      password: adminPassword,
      descricao,
      codigoGrupo,
      segment: newSegment as "industrializacao" | "importacao" | "importacao_mp",
    });
    if (result.success) {
      toast.success(`Segmento alterado para ${segmentLabel(newSegment)}`);
    } else {
      toast.error(result.error || "Erro ao alterar segmento");
    }
  };

  const handleClassification = async (codigoItem: string, descricao: string, classification: "estoque" | "encomenda" | "outros") => {
    const current = classificationMap.get(codigoItem);
    if (current === classification) {
      // Desmarcar se já está selecionado
      await removeClassificationMutation.mutateAsync({ codigoItem });
      toast.success("Classificação removida");
    } else {
      await setClassificationMutation.mutateAsync({ codigoItem, descricao, classification });
      const labels: Record<string, string> = { estoque: "Manter em Estoque", encomenda: "Sob Encomenda", outros: "Outros" };
      toast.success(`Classificado como: ${labels[classification]}`);
    }
  };

  const handleRemoveOverride = async (descricao: string) => {
    const result = await removeOverrideMutation.mutateAsync({
      password: adminPassword,
      descricao,
    });
    if (result.success) {
      toast.success("Segmento restaurado ao padrão");
    } else {
      toast.error(result.error || "Erro ao restaurar");
    }
  };

  const overrideCount = products?.filter(p => p.hasOverride).length || 0;
  const hiddenCount = products?.filter(p => !p.visible).length || 0;
  const indCount = filtered.filter(p => p.currentSegment === "industrializacao").length;
  const impCount = filtered.filter(p => p.currentSegment === "importacao").length;
  const impMpCount = filtered.filter(p => p.currentSegment === "importacao_mp").length;
  const outrosCount = filtered.filter(p => p.currentSegment === "outros").length;
  const visibleCount = filtered.filter(p => p.visible).length;
  const filteredHiddenCount = filtered.filter(p => !p.visible).length;

  // Compute alert: estoque < vendaMensal * fator (consumo no lead time)
  const alertCount = filtered.filter(p => {
    const pricing = pricingMap.get(p.codigoItem || "");
    if (!pricing?.vendaMensal) return false;
    const fator = parseFloat(pricing.fatorMultiplicacao || "2.3") || 2.3;
    const isKg = (p as any).isKgProduct;
    const estoqueAtual = isKg ? ((p as any).estoqueUn ?? 0) : ((p as any).estoqueCx ?? 0);
    const consumoLeadTime = Math.round(pricing.vendaMensal * fator);
    return estoqueAtual < consumoLeadTime;
  }).length;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="p-5 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-50 rounded-lg flex items-center justify-center">
              <ArrowRightLeft className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800">Produto Importado</h2>
              <p className="text-xs text-slate-500">Gerencie grupos, classificações e parâmetros de estoque</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(() => {
              const estoqueCount = filtered.filter(p => (p as any)._classification === "estoque").length;
              const encomendaCount = filtered.filter(p => (p as any)._classification === "encomenda").length;
              const semClassificacao = filtered.filter(p => !(p as any)._classification).length;
              return (
                <>
                  {estoqueCount > 0 && (
                    <Badge className="bg-emerald-50 text-emerald-600 border-0 text-xs">
                      {estoqueCount} em estoque
                    </Badge>
                  )}
                  {encomendaCount > 0 && (
                    <Badge className="bg-amber-50 text-amber-600 border-0 text-xs">
                      {encomendaCount} sob encomenda
                    </Badge>
                  )}
                  {semClassificacao > 0 && (
                    <button
                      onClick={() => autoClassifyMutation.mutate()}
                      disabled={autoClassifyMutation.isPending}
                      className="text-[10px] px-2 py-1 rounded bg-teal-50 text-teal-600 hover:bg-teal-100 transition-colors disabled:opacity-50"
                      title="Classificar automaticamente produtos sem classificação baseado na aba Estoque"
                    >
                      {autoClassifyMutation.isPending ? "Classificando..." : `Auto-classificar ${semClassificacao} pendentes`}
                    </button>
                  )}
                </>
              );
            })()}
            {hiddenCount > 0 && (
              <Badge className="bg-red-100 text-red-700 border-0 text-xs">
                {hiddenCount} oculto{hiddenCount > 1 ? "s" : ""}
              </Badge>
            )}
            {overrideCount > 0 && (
              <Badge className="bg-violet-100 text-violet-700 border-0 text-xs">
                {overrideCount} alterado{overrideCount > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Buscar produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterSegment} onValueChange={setFilterSegment}>
            <SelectTrigger className="w-full sm:w-52">
              <SelectValue placeholder="Grupo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Grupos</SelectItem>
              <SelectItem value="importacao">Import. (Revenda)</SelectItem>
              <SelectItem value="importacao_mp">Import. Mat. Prima</SelectItem>
              <SelectItem value="industrializacao">Industrializados</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterOverride} onValueChange={setFilterOverride}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="with">Alterados</SelectItem>
              <SelectItem value="without">Padrão</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterVisibility} onValueChange={setFilterVisibility}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Visibilidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="visible">Visíveis</SelectItem>
              <SelectItem value="hidden">Ocultos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Summary badges */}
        <div className="flex flex-wrap gap-2 mt-3">
          <Badge variant="outline" className="text-xs">
            {filtered.length} produtos
          </Badge>
          <Badge className="bg-teal-50 text-teal-600 border-0 text-xs">
            {impCount} Import. (Revenda)
          </Badge>
          <Badge className="bg-blue-50 text-blue-600 border-0 text-xs">
            {impMpCount} Import. Mat. Prima
          </Badge>
          <Badge className="bg-violet-50 text-violet-600 border-0 text-xs">
            {indCount} Industrializados
          </Badge>
          {outrosCount > 0 && (
            <Badge className="bg-slate-50 text-slate-500 border-0 text-xs">
              {outrosCount} Outros
            </Badge>
          )}
          {alertCount > 0 && (
            <Badge className="bg-red-50 text-red-600 border-0 text-xs">
              <ShieldAlert className="w-3 h-3 mr-1" />
              {alertCount} Alerta{alertCount > 1 ? "s" : ""} de Reposição
            </Badge>
          )}
          {filteredHiddenCount > 0 && (
            <Badge className="bg-red-50 text-red-500 border-0 text-xs">
              {filteredHiddenCount} Oculto{filteredHiddenCount > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </div>

      {/* Product list */}
      <div className="max-h-[600px] overflow-auto">
        {isLoading ? (
          <div className="text-center py-12 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            <p className="text-sm">Carregando produtos...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nenhum produto encontrado</p>
          </div>
        ) : (
          <table className="w-full" style={{ minWidth: "1400px" }}>
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="px-2 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase" style={{ width: "50px" }}>Vis.</th>
                <th className="px-2 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase" style={{ width: "70px" }}>Cód</th>
                <th className="px-2 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase">Produto</th>
                <th className="px-2 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase" style={{ width: "45px" }}>Grp</th>
                <th className="px-2 py-2.5 text-right text-[10px] font-semibold text-slate-500 uppercase" style={{ width: "75px" }}>Estoque</th>
                <th className="px-2 py-2.5 text-right text-[10px] font-semibold text-slate-500 uppercase" style={{ width: "80px" }}>Dispon.</th>
                <th className="px-2 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase" style={{ width: "140px" }}>Grupo</th>
                <th className="px-2 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase" style={{ width: "65px" }} title="Manter em Estoque">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[8px] leading-tight">Em</span>
                    <span className="text-[8px] leading-tight">Estoque</span>
                    <span className="inline-block w-3 h-3 rounded-full bg-emerald-400 mt-0.5"></span>
                  </div>
                </th>
                <th className="px-2 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase" style={{ width: "65px" }} title="Sob Encomenda">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[8px] leading-tight">Sob</span>
                    <span className="text-[8px] leading-tight">Encomenda</span>
                    <span className="inline-block w-3 h-3 rounded-full bg-amber-400 mt-0.5"></span>
                  </div>
                </th>
                <th className="px-2 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase" style={{ width: "35px" }} title="A = Automático (marcado) ou Manual (desmarcado). Aplica-se à classificação e ao preço.">A</th>
                <th className="px-2 py-2.5 text-right text-[10px] font-semibold text-slate-500 uppercase" style={{ width: "120px" }}>R$/Cx</th>
                <th className="px-2 py-2.5 text-right text-[10px] font-semibold text-slate-500 uppercase" style={{ width: "90px" }} title="Estoque Regulador - Venda mensal em caixas (editável)">Vd. Mensal</th>
                <th className="px-2 py-2.5 text-right text-[10px] font-semibold text-slate-500 uppercase" style={{ width: "60px" }} title="Fator de multiplicação (padrão 2,3 - editável)">Fator</th>
                <th className="px-2 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase" style={{ width: "70px" }} title="Alerta de Reposição: Fator × Estoque ≤ Vd. Mensal">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[8px] leading-tight">Alerta</span>
                    <span className="text-[8px] leading-tight">Reposição</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
              {filtered.map((product) => {
                const pricing = pricingMap.get(product.codigoItem || "");
                const isManual = pricing?.mode === "manual";
                const autoPrice = autoPriceMap.get(product.codigoItem || "");
                const manualPrice = pricing?.manualPrice ? parseFloat(pricing.manualPrice) : null;
                const isEditing = editingPrice === product.codigoItem;
                const displayPrice = isManual && manualPrice ? manualPrice : autoPrice ?? null;

                return (
                  <tr key={product.codigoItem || product.descricao} className={`hover:bg-slate-50/80 transition-colors ${!product.visible ? "opacity-40 bg-red-50/20" : product.hasOverride ? "bg-violet-50/20" : ""}`}>
                    {/* Visibilidade */}
                    <td className="px-2 py-2 text-center">
                      <button
                        onClick={() => handleToggleVisibility(product.descricao, product.codigoItem || "", !product.visible)}
                        className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                          product.visible
                            ? "bg-emerald-100 text-emerald-600 hover:bg-emerald-200"
                            : "bg-red-100 text-red-500 hover:bg-red-200"
                        }`}
                        title={product.visible ? "Ocultar do dashboard" : "Mostrar no dashboard"}
                      >
                        {product.visible ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      </button>
                    </td>
                    {/* Código */}
                    <td className="px-2 py-2">
                      <span className="text-[11px] font-mono text-slate-500">{product.codigoItem || "—"}</span>
                    </td>
                    {/* Produto */}
                    <td className="px-2 py-2">
                      <div className="text-[12px] font-medium text-slate-800 leading-tight" title={product.descricao}>
                        {product.descricao}
                      </div>
                      {product.hasOverride && (
                        <button
                          onClick={() => handleRemoveOverride(product.descricao)}
                          className="text-[10px] text-violet-500 hover:text-red-500 hover:underline mt-0.5"
                          title={`Restaurar para ${segmentLabel(product.defaultSegment)}`}
                        >
                          resetar segmento
                        </button>
                      )}
                    </td>
                    {/* Grupo */}
                    <td className="px-2 py-2 text-center">
                      <span className="text-[11px] text-slate-500 font-mono">{product.codigoGrupo || "—"}</span>
                    </td>
                    {/* Estoque */}
                    <td className="px-2 py-2 text-right">
                      <span className="text-[12px] font-semibold text-slate-700">
                        {(product as any).isKgProduct
                          ? `${((product as any).estoqueUn ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} kg`
                          : `${(product as any).estoqueCx ?? 0} cx`
                        }
                      </span>
                    </td>
                    {/* Disponível */}
                    <td className="px-2 py-2 text-right">
                      {(() => {
                        const isKg = (product as any).isKgProduct;
                        const val = isKg ? ((product as any).disponivelUn ?? 0) : ((product as any).disponivelCx ?? 0);
                        const unit = isKg ? "kg" : "cx";
                        const displayVal = isKg ? val.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) : val;
                        return (
                          <span className={`text-[12px] font-semibold ${val < 0 ? "text-red-600" : val === 0 ? "text-amber-600" : "text-emerald-600"}`}>
                            {displayVal} {unit}
                          </span>
                        );
                      })()}
                    </td>
                    {/* Grupo */}
                    <td className="px-2 py-2">
                      <Select
                        value={product.currentSegment}
                        onValueChange={(val) => handleChangeSegment(product.descricao, product.codigoGrupo, val)}
                      >
                        <SelectTrigger className={`h-7 text-[11px] font-medium ${segmentColor(product.currentSegment)} border-0 px-2`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="importacao">Import. (Revenda)</SelectItem>
                          <SelectItem value="importacao_mp">Import. Mat. Prima</SelectItem>
                          <SelectItem value="industrializacao">Industrializados</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    {/* Classificação: Em Estoque */}
                    <td className="px-2 py-2 text-center">
                      <input
                        type="radio"
                        name={`class-${product.codigoItem}`}
                        checked={(product as any)._classification === "estoque"}
                        onChange={() => handleClassification(product.codigoItem || "", product.descricao, "estoque")}
                        className="w-4 h-4 accent-emerald-600 cursor-pointer"
                        title="Em Estoque"
                      />
                    </td>
                    {/* Classificação: Sob Encomenda */}
                    <td className="px-2 py-2 text-center">
                      <input
                        type="radio"
                        name={`class-${product.codigoItem}`}
                        checked={(product as any)._classification === "encomenda"}
                        onChange={() => handleClassification(product.codigoItem || "", product.descricao, "encomenda")}
                        className="w-4 h-4 accent-amber-600 cursor-pointer"
                        title="Sob Encomenda"
                      />
                    </td>
                    {/* Auto checkbox - aplica-se à classificação e ao preço */}
                    <td className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={!isManual}
                        onChange={() => handlePricingMode(product.codigoItem || "", isManual ? "auto" : "manual")}
                        className="w-4 h-4 accent-teal-600 cursor-pointer rounded"
                        title={isManual ? "Marque para usar preço automático" : "Desmarque para digitar preço manual"}
                      />
                    </td>
                    {/* Preço R$/Cx */}
                    <td className="px-2 py-2 text-right">
                      {isEditing ? (
                        <div className="flex items-center gap-1 justify-end">
                          <span className="text-[10px] text-slate-400">R$</span>
                          <Input
                            value={editPriceValue}
                            onChange={(e) => setEditPriceValue(e.target.value)}
                            className="w-20 h-6 text-[11px] text-right px-1"
                            placeholder="0,00"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveManualPrice(product.codigoItem || "");
                              if (e.key === "Escape") { setEditingPrice(null); handlePricingMode(product.codigoItem || "", "auto"); }
                            }}
                          />
                          <button
                            onClick={() => handleSaveManualPrice(product.codigoItem || "")}
                            className="w-5 h-5 rounded bg-emerald-100 text-emerald-600 flex items-center justify-center hover:bg-emerald-200"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        </div>
                      ) : isManual && manualPrice ? (
                        <button
                          onClick={() => {
                            setEditingPrice(product.codigoItem || "");
                            setEditPriceValue(manualPrice.toFixed(2));
                          }}
                          className="text-[12px] font-bold text-blue-700 hover:underline cursor-pointer"
                          title="Clique para editar preço manual"
                        >
                          {formatCurrency(manualPrice)}
                        </button>
                      ) : displayPrice ? (
                        <span className="text-[12px] text-slate-500" title="Preço médio das últimas 5 vendas (automático)">
                          {formatCurrency(displayPrice)}
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            handlePricingMode(product.codigoItem || "", "manual");
                            setEditingPrice(product.codigoItem || "");
                            setEditPriceValue("");
                          }}
                          className="text-[10px] text-slate-300 italic hover:text-teal-500 hover:underline cursor-pointer transition-colors"
                          title="Clique para inserir preço manualmente"
                        >
                          s/ preço
                        </button>
                      )}
                    </td>
                    {/* Venda Mensal */}
                    <td className="px-2 py-2 text-right">
                      {editingStockField?.codigoItem === product.codigoItem && editingStockField?.field === "vendaMensal" ? (
                        <div className="flex items-center gap-1 justify-end">
                          <Input
                            value={editStockValue}
                            onChange={(e) => setEditStockValue(e.target.value)}
                            className="w-16 h-6 text-[11px] text-right px-1"
                            placeholder="0"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const val = parseInt(editStockValue);
                                setStockSettingsMutation.mutate({
                                  codigoItem: product.codigoItem || "",
                                  vendaMensal: isNaN(val) ? null : val,
                                  fatorMultiplicacao: pricing?.fatorMultiplicacao ?? "2.3",
                                  prazoCompraDias: pricing?.prazoCompraDias ?? null,
                                });
                                setEditingStockField(null);
                                toast.success("Venda mensal salva");
                              }
                              if (e.key === "Escape") setEditingStockField(null);
                            }}
                            onBlur={() => {
                              const val = parseInt(editStockValue);
                              if (editStockValue !== "") {
                                setStockSettingsMutation.mutate({
                                  codigoItem: product.codigoItem || "",
                                  vendaMensal: isNaN(val) ? null : val,
                                  fatorMultiplicacao: pricing?.fatorMultiplicacao ?? "2.3",
                                  prazoCompraDias: pricing?.prazoCompraDias ?? null,
                                });
                              }
                              setEditingStockField(null);
                            }}
                          />
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingStockField({ codigoItem: product.codigoItem || "", field: "vendaMensal" });
                            setEditStockValue(pricing?.vendaMensal != null ? String(pricing.vendaMensal) : "");
                          }}
                          className={`text-[12px] cursor-pointer hover:underline ${pricing?.vendaMensal != null ? "font-semibold text-slate-700" : "text-slate-300 italic"}`}
                          title="Clique para definir venda mensal"
                        >
                          {pricing?.vendaMensal != null ? `${pricing.vendaMensal} ${(product as any).isKgProduct ? "kg" : "cx"}` : "—"}
                        </button>
                      )}
                    </td>
                    {/* Fator */}
                    <td className="px-2 py-2 text-right">
                      {editingStockField?.codigoItem === product.codigoItem && editingStockField?.field === "fatorMultiplicacao" ? (
                        <div className="flex items-center gap-1 justify-end">
                          <Input
                            value={editStockValue}
                            onChange={(e) => setEditStockValue(e.target.value)}
                            className="w-14 h-6 text-[11px] text-right px-1"
                            placeholder="2.3"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const val = editStockValue.replace(",", ".");
                                setStockSettingsMutation.mutate({
                                  codigoItem: product.codigoItem || "",
                                  vendaMensal: pricing?.vendaMensal ?? null,
                                  fatorMultiplicacao: val || "2.3",
                                  prazoCompraDias: pricing?.prazoCompraDias ?? null,
                                });
                                setEditingStockField(null);
                                toast.success("Fator salvo");
                              }
                              if (e.key === "Escape") setEditingStockField(null);
                            }}
                            onBlur={() => {
                              if (editStockValue !== "") {
                                const val = editStockValue.replace(",", ".");
                                setStockSettingsMutation.mutate({
                                  codigoItem: product.codigoItem || "",
                                  vendaMensal: pricing?.vendaMensal ?? null,
                                  fatorMultiplicacao: val || "2.3",
                                  prazoCompraDias: pricing?.prazoCompraDias ?? null,
                                });
                              }
                              setEditingStockField(null);
                            }}
                          />
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingStockField({ codigoItem: product.codigoItem || "", field: "fatorMultiplicacao" });
                            setEditStockValue(pricing?.fatorMultiplicacao != null ? pricing.fatorMultiplicacao : "2.3");
                          }}
                          className={`text-[12px] cursor-pointer hover:underline ${pricing?.fatorMultiplicacao != null ? "font-semibold text-slate-700" : "text-slate-400"}`}
                          title="Clique para alterar fator de multiplicação"
                        >
                          {pricing?.fatorMultiplicacao != null ? parseFloat(pricing.fatorMultiplicacao).toLocaleString("pt-BR", { minimumFractionDigits: 1 }) : "2,3"}
                        </button>
                      )}
                    </td>
                    {/* Alerta de Reposição */}
                    <td className="px-2 py-2 text-center">
                      {(() => {
                        const vendaMensal = pricing?.vendaMensal;
                        if (!vendaMensal) return <span className="text-[10px] text-slate-300">—</span>;
                        const fator = parseFloat(pricing?.fatorMultiplicacao || "2.3") || 2.3;
                        const isKg = (product as any).isKgProduct;
                        const estoqueAtual = isKg ? ((product as any).estoqueUn ?? 0) : ((product as any).estoqueCx ?? 0);
                        const unit = isKg ? "kg" : "cx";
                        const consumoLeadTime = Math.round(vendaMensal * fator);
                        const needsAlert = estoqueAtual < consumoLeadTime;
                        const qtdPedir = needsAlert ? consumoLeadTime - estoqueAtual : 0;
                        return needsAlert ? (
                          <div className="flex flex-col items-center" title={`Consumo no lead time: ${vendaMensal} ${unit}/mês × ${fator.toLocaleString("pt-BR")} meses = ${consumoLeadTime} ${unit}\nEstoque atual: ${estoqueAtual} ${unit}\n${estoqueAtual} < ${consumoLeadTime} → Pedir ${qtdPedir} ${unit}`}>
                            <ShieldAlert className="w-4 h-4 text-red-500" />
                            <span className="text-[9px] text-red-500 font-semibold">PEDIR {qtdPedir} {unit}</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center" title={`Consumo no lead time: ${vendaMensal} ${unit}/mês × ${fator.toLocaleString("pt-BR")} meses = ${consumoLeadTime} ${unit}\nEstoque atual: ${estoqueAtual} ${unit}\n${estoqueAtual} ≥ ${consumoLeadTime} → OK`}>
                            <span className="inline-block w-3 h-3 rounded-full bg-emerald-400"></span>
                            <span className="text-[9px] text-emerald-600 font-medium">OK</span>
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Legenda */}
      <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50">
        <div className="flex flex-wrap items-center gap-4 text-[10px] text-slate-400">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span> Em Estoque</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span> Sob Encomenda</span>
          <span>A = Automático (marcado) / Manual (desmarcado)</span>
          <span>R$/Cx = Média das últimas 5 vendas (auto) ou preço manual</span>
          <span className="ml-auto">Alerta: Estoque &lt; (Vd. Mensal × Fator) = Hora de pedir!</span>
        </div>
      </div>
    </div>
  );
}

// ─── Bank Balances Panel ──────────────────────────────────────
function BankBalancesPanel() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.financial.getBankBalances.useQuery();
  const syncMutation = trpc.dashboard.syncBankBalances.useMutation({
    onSuccess: (result) => {
      utils.financial.getBankBalances.invalidate();
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    },
    onError: () => toast.error("Erro ao sincronizar saldos"),
  });

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // Contas já vem com nomeConta no formato "Banco + Empresa" do backend
  const accounts = data?.accounts || [];

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="p-5 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
              <Landmark className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800">Saldos Bancários</h2>
              <p className="text-xs text-slate-500">Saldos do balancete contábil do Maxiprod (automático)</p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {syncMutation.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-1" />Sincronizando...</>
            ) : (
              <><RefreshCw className="w-4 h-4 mr-1" />Atualizar Saldos</>
            )}
          </Button>
        </div>

        {data && data.totalSaldoContabil !== undefined && data.totalSaldoContabil !== 0 && (
          <div className="mt-3 p-3 bg-indigo-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-indigo-700">Saldo Total (Balancete)</span>
                {data.accounts[0]?.saldoContabilAtualizadoEm && (
                  <p className="text-xs text-indigo-500 mt-0.5">
                    Atualizado em {new Date(data.accounts[0].saldoContabilAtualizadoEm).toLocaleString("pt-BR")}
                  </p>
                )}
              </div>
              <span className={`text-lg font-bold ${data.totalSaldoContabil >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                {formatCurrency(data.totalSaldoContabil)}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="p-5">
        {isLoading ? (
          <div className="text-center py-8 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            <p className="text-sm">Carregando contas...</p>
          </div>
        ) : !data || data.accounts.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <Landmark className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nenhuma conta bancária encontrada</p>
            <p className="text-xs mt-1">Clique em "Atualizar Saldos" para buscar do Maxiprod</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {accounts.map((acc: any) => (
              <div key={acc.maxiprodId} className="flex items-center justify-between py-3 px-3 hover:bg-slate-50 transition-colors">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-slate-800">
                    {acc.nomeConta || acc.bancoNome}
                  </span>
                  <span className="text-xs text-slate-400">{acc.codigoEstruturado}</span>
                </div>
                <div className="text-right">
                  <span className={`text-sm font-bold tabular-nums ${acc.saldoAtual >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {formatCurrency(acc.saldoAtual)}
                  </span>
                  {acc.totalDebitos > 0 && (
                    <div className="text-xs text-slate-400">
                      D: {formatCurrency(acc.totalDebitos)} | C: {formatCurrency(acc.totalCreditos)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Variants Panel (Variações Pai/Filho) ───────────────────────────────────
function VariantsPanel() {
  const utils = trpc.useUtils();
  const { data: variants, isLoading } = trpc.settings.getVariants.useQuery();
  const { data: dashData } = trpc.dashboard.getData.useQuery();
  const addMutation = trpc.settings.addVariant.useMutation({
    onSuccess: () => {
      utils.settings.getVariants.invalidate();
      toast.success("Variação adicionada");
    },
  });
  const removeMutation = trpc.settings.removeVariant.useMutation({
    onSuccess: () => {
      utils.settings.getVariants.invalidate();
      toast.success("Variação removida");
    },
  });

  const [parentCode, setParentCode] = useState("");
  const [childCode, setChildCode] = useState("");
  const [showForm, setShowForm] = useState(false);

  // Mapa de produtos para mostrar nomes
  const productMap = useMemo(() => {
    const map = new Map<string, { descricao: string; unPorCx: number | null }>();
    if (dashData?.items) {
      for (const item of dashData.items as any[]) {
        map.set(item.codigoItem, { descricao: item.descricaoItem, unPorCx: item.unidadesPorCaixa });
      }
    }
    return map;
  }, [dashData]);

  // Agrupar variações por pai
  const grouped = useMemo(() => {
    const map = new Map<string, Array<{ childCode: string; conversionFactor: string }>>(); 
    if (variants) {
      for (const v of variants) {
        const list = map.get(v.parentCode) || [];
        list.push({ childCode: v.childCode, conversionFactor: v.conversionFactor });
        map.set(v.parentCode, list);
      }
    }
    return map;
  }, [variants]);

  const handleAdd = () => {
    if (!parentCode || !childCode) {
      toast.error("Selecione o produto pai e o produto filho");
      return;
    }
    if (parentCode === childCode) {
      toast.error("Produto pai e filho não podem ser iguais");
      return;
    }
    const parentInfo = productMap.get(parentCode);
    const childInfo = productMap.get(childCode);
    if (!parentInfo?.unPorCx || !childInfo?.unPorCx) {
      toast.error("Ambos os produtos precisam ter unidades por caixa definidas");
      return;
    }
    const factor = childInfo.unPorCx / parentInfo.unPorCx;
    addMutation.mutate({ parentCode, childCode, conversionFactor: factor });
    setChildCode("");
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-teal-600" />
              Variações de Produto
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Configure quais produtos são variações de um produto pai. Quando uma variação é vendida, o estoque do pai é descontado proporcionalmente.
            </p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} size="sm" className="bg-teal-600 hover:bg-teal-700">
            <Plus className="w-4 h-4 mr-1" /> Nova Variação
          </Button>
        </div>

        {/* Formulário para adicionar */}
        {showForm && (
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 mb-4">
            <p className="text-sm font-medium text-teal-800 mb-3">Adicionar Variação</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Produto Pai (estoque principal)</label>
                <Select value={parentCode} onValueChange={setParentCode}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Selecione o pai..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from(productMap.entries()).map(([code, info]) => (
                      <SelectItem key={code} value={code}>
                        {code} - {info.descricao?.substring(0, 50)} ({info.unPorCx || '?'} un/cx)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Produto Filho (variação)</label>
                <Select value={childCode} onValueChange={setChildCode}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Selecione o filho..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from(productMap.entries()).filter(([code]) => code !== parentCode).map(([code, info]) => (
                      <SelectItem key={code} value={code}>
                        {code} - {info.descricao?.substring(0, 50)} ({info.unPorCx || '?'} un/cx)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {parentCode && childCode && productMap.get(parentCode)?.unPorCx && productMap.get(childCode)?.unPorCx && (
              <div className="mt-3 p-2 bg-white rounded border border-teal-200">
                <p className="text-xs text-slate-600">
                  Fator de conversão calculado: <strong className="text-teal-700">
                    {(productMap.get(childCode)!.unPorCx! / productMap.get(parentCode)!.unPorCx!).toFixed(4)}x
                  </strong>
                  <span className="text-slate-400 ml-2">
                    ({productMap.get(childCode)!.unPorCx} un ÷ {productMap.get(parentCode)!.unPorCx} un)
                  </span>
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  1 cx vendida do filho = {(productMap.get(childCode)!.unPorCx! / productMap.get(parentCode)!.unPorCx!).toFixed(4)} cx descontada do pai
                </p>
              </div>
            )}
            <div className="flex gap-2 mt-3">
              <Button onClick={handleAdd} size="sm" className="bg-teal-600 hover:bg-teal-700" disabled={addMutation.isPending}>
                {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                Adicionar
              </Button>
              <Button onClick={() => { setShowForm(false); setParentCode(''); setChildCode(''); }} size="sm" variant="outline">
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Lista de variações agrupadas por pai */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
          </div>
        ) : grouped.size === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <GitBranch className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhuma variação configurada</p>
            <p className="text-xs mt-1">Clique em "Nova Variação" para começar</p>
          </div>
        ) : (
          <div className="space-y-3">
            {Array.from(grouped.entries()).map(([pCode, children]) => {
              const parentInfo = productMap.get(pCode);
              return (
                <div key={pCode} className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-50 px-4 py-3 flex items-center gap-3">
                    <Package className="w-4 h-4 text-teal-600" />
                    <div className="flex-1">
                      <span className="font-medium text-sm text-slate-800">{pCode}</span>
                      <span className="text-xs text-slate-500 ml-2">{parentInfo?.descricao?.substring(0, 60) || 'Produto não encontrado'}</span>
                      {parentInfo?.unPorCx && <span className="text-xs text-teal-600 ml-2">({parentInfo.unPorCx} un/cx)</span>}
                    </div>
                    <Badge variant="outline" className="text-xs text-teal-600">{children.length} variaç{children.length > 1 ? 'ões' : 'ão'}</Badge>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {children.map((child) => {
                      const childInfo = productMap.get(child.childCode);
                      return (
                        <div key={child.childCode} className="px-4 py-2 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700">
                          <span className="text-slate-300 text-sm">└</span>
                          <div className="flex-1">
                            <span className="text-sm text-slate-700">{child.childCode}</span>
                            <span className="text-xs text-slate-500 ml-2">{childInfo?.descricao?.substring(0, 50) || '?'}</span>
                            {childInfo?.unPorCx && <span className="text-xs text-slate-400 ml-1">({childInfo.unPorCx} un/cx)</span>}
                          </div>
                          <span className="text-xs font-mono text-teal-600 bg-teal-50 px-2 py-0.5 rounded">
                            {parseFloat(child.conversionFactor).toFixed(4)}x
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:text-red-600 hover:bg-red-50 h-7 w-7 p-0"
                            onClick={() => removeMutation.mutate({ parentCode: pCode, childCode: child.childCode })}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
// ─── Madeira Config Input (inline editable for R$/CX and Alerta) ───────────────────
function MadeiraConfigInput({ codigoItem, field, visibilityData, placeholder, prefix, type }: {
  codigoItem: string;
  field: "precoCaixa" | "alertaReposicao";
  visibilityData: any;
  placeholder: string;
  prefix?: string;
  type: "money" | "number";
}) {
  const utils = trpc.useUtils();
  const updateConfig = trpc.settings.updateMadeiraItemConfig.useMutation({
    onSuccess: () => {
      utils.settings.getMadeiraVisibility.invalidate();
      toast.success(field === "precoCaixa" ? "Preço atualizado!" : "Alerta atualizado!");
    },
    onError: () => toast.error("Erro ao atualizar"),
  });

  // Get current value from visibility data (use first card entry that has a value)
  const currentValue = useMemo(() => {
    if (!visibilityData?.items) return null;
    for (const row of visibilityData.items) {
      if (row.codigoItem === codigoItem && row[field] != null) {
        return Number(row[field]);
      }
    }
    return null;
  }, [visibilityData, codigoItem, field]);

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  const handleSave = () => {
    const numVal = type === "money" ? parseFloat(value.replace(",", ".")) : parseInt(value);
    if (isNaN(numVal) || numVal < 0) {
      setEditing(false);
      return;
    }
    // Save for all 3 cards at once
    const cards: Array<"madeira" | "semiPronto" | "aguardandoEscolha"> = ["madeira", "semiPronto", "aguardandoEscolha"];
    for (const card of cards) {
      updateConfig.mutate({ codigoItem, card, [field]: numVal });
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1 justify-center">
        {prefix && <span className="text-xs text-slate-400">{prefix}</span>}
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
          className="w-16 text-center text-xs border border-blue-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
          placeholder={placeholder}
        />
      </div>
    );
  }

  return (
    <button
      onClick={() => { setValue(currentValue != null ? String(currentValue) : ""); setEditing(true); }}
      className="text-xs text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded px-2 py-0.5 transition-colors min-w-[50px]"
      title="Clique para editar"
    >
      {currentValue != null
        ? (type === "money" ? `R$ ${currentValue.toFixed(2)}` : String(currentValue))
        : <span className="text-slate-300">—</span>
      }
    </button>
  );
}

// ─── Madeira Visibility Panel ──────────────────────────────────────────────────────────────────────────────
function MadeiraVisibilityPanel() {
  const { data: dashData } = trpc.dashboard.getData.useQuery();
  const { data: visibilityData, isLoading: visLoading } = trpc.settings.getMadeiraVisibility.useQuery();
  const { data: autoPricesData } = trpc.settings.getMadeiraAutoPrices.useQuery();
  const utils = trpc.useUtils();
  const { operator } = useOperator();
  const [searchTerm, setSearchTerm] = useState("");

  const autoFillMutation = trpc.settings.autoFillMadeiraPrices.useMutation({
    onSuccess: (data) => {
      utils.settings.getMadeiraVisibility.invalidate();
      utils.settings.getMadeiraAutoPrices.invalidate();
      toast.success(`Preços atualizados! ${data.updated} produtos preenchidos, ${data.skipped} já tinham preço, ${data.noSales} sem vendas.`);
    },
    onError: () => toast.error("Erro ao preencher preços"),
  });

  const setBulkVisibility = trpc.settings.setBulkMadeiraVisibility.useMutation({
    onSuccess: () => {
      utils.settings.getMadeiraVisibility.invalidate();
      toast.success("Visibilidade atualizada!");
    },
    onError: () => toast.error("Erro ao atualizar visibilidade"),
  });

  // Get madeira items from dashboard items
  const madeiraItems = useMemo(() => {
    if (!dashData?.items) return [];
    return (dashData.items as any[])
      .filter((i: any) => i.grupo === "industrializacao")
      .sort((a: any, b: any) => (a.codigoItem || "").localeCompare(b.codigoItem || ""));
  }, [dashData]);

  // Build visibility map: { codigoItem: { madeira: bool, semiPronto: bool, aguardandoEscolha: bool } }
  const visibilityMap = useMemo(() => {
    const map: Record<string, { madeira: boolean; semiPronto: boolean; aguardandoEscolha: boolean }> = {};
    if (visibilityData?.items) {
      for (const row of visibilityData.items) {
        if (!map[row.codigoItem]) map[row.codigoItem] = { madeira: true, semiPronto: true, aguardandoEscolha: true };
        if (row.card === "madeira") map[row.codigoItem].madeira = row.visible;
        if (row.card === "semiPronto") map[row.codigoItem].semiPronto = row.visible;
        if (row.card === "aguardandoEscolha") map[row.codigoItem].aguardandoEscolha = row.visible;
      }
    }
    return map;
  }, [visibilityData]);

  const getVisibility = (codigoItem: string) => {
    return visibilityMap[codigoItem] || { madeira: true, semiPronto: true, aguardandoEscolha: true };
  };

  const toggleVisibility = (codigoItem: string, card: "madeira" | "semiPronto" | "aguardandoEscolha") => {
    const current = getVisibility(codigoItem);
    setBulkVisibility.mutate({
      codigoItem,
      madeira: card === "madeira" ? !current.madeira : current.madeira,
      semiPronto: card === "semiPronto" ? !current.semiPronto : current.semiPronto,
      aguardandoEscolha: card === "aguardandoEscolha" ? !current.aguardandoEscolha : current.aguardandoEscolha,
      updatedBy: operator?.name || undefined,
    });
  };

  const filtered = madeiraItems.filter((item: any) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (item.codigoItem || "").toLowerCase().includes(term) ||
           (item.descricaoItem || "").toLowerCase().includes(term);
  });

  // Count visible items per card
  const countVisible = (card: "madeira" | "semiPronto" | "aguardandoEscolha") => {
    return madeiraItems.filter((item: any) => {
      const vis = getVisibility(item.codigoItem);
      return vis[card];
    }).length;
  };

  if (visLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-green-600" /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
            <TreePine className="w-5 h-5 text-green-700" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Visibilidade dos Produtos de Madeira - Produto Acabado</h3>
            <p className="text-sm text-slate-500">Controle quais produtos aparecem em cada card na aba Estoque</p>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-emerald-50 rounded-lg p-3 text-center border border-emerald-200">
            <p className="text-xs text-emerald-600 font-medium">Madeira</p>
            <p className="text-lg font-bold text-emerald-700">{countVisible("madeira")}/{madeiraItems.length}</p>
            <p className="text-xs text-emerald-500">visíveis</p>
          </div>
          <div className="bg-amber-50 rounded-lg p-3 text-center border border-amber-200">
            <p className="text-xs text-amber-600 font-medium">Semi Pronto</p>
            <p className="text-lg font-bold text-amber-700">{countVisible("semiPronto")}/{madeiraItems.length}</p>
            <p className="text-xs text-amber-500">visíveis</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 text-center border border-purple-200">
            <p className="text-xs text-purple-600 font-medium">Aguardando Escolha</p>
            <p className="text-lg font-bold text-purple-700">{countVisible("aguardandoEscolha")}/{madeiraItems.length}</p>
            <p className="text-xs text-purple-500">visíveis</p>
          </div>
        </div>

        {/* Auto-fill prices button + Search */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Buscar por código ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <button
            onClick={() => autoFillMutation.mutate()}
            disabled={autoFillMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
            title="Preencher automaticamente R$/CX com a média das últimas 5 vendas para produtos sem preço"
          >
            {autoFillMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <DollarSign className="w-4 h-4" />
            )}
            Auto-preencher Preços
          </button>
        </div>
      </div>

      {/* Products table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200">
              <th className="text-left px-4 py-3 font-medium text-slate-600">Código</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Descrição</th>
              <th className="text-center px-4 py-3 font-medium text-emerald-600">
                <div className="flex items-center justify-center gap-1">
                  <TreePine className="w-3.5 h-3.5" />
                  Madeira
                </div>
              </th>
              <th className="text-center px-4 py-3 font-medium text-amber-600">
                <div className="flex items-center justify-center gap-1">
                  <ToggleLeft className="w-3.5 h-3.5" />
                  Semi Pronto
                </div>
              </th>
              <th className="text-center px-4 py-3 font-medium text-purple-600">
                <div className="flex items-center justify-center gap-1">
                  <ToggleLeft className="w-3.5 h-3.5" />
                  Ag. Escolha
                </div>
              </th>
              <th className="text-center px-3 py-3 font-medium text-blue-600 whitespace-nowrap">R$/CX</th>
              <th className="text-center px-3 py-3 font-medium text-red-600 whitespace-nowrap">Alerta de Reposição</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-slate-400">
                {madeiraItems.length === 0 ? "Aguardando sincronização dos dados..." : "Nenhum produto encontrado"}
              </td></tr>
            ) : (
              filtered.map((item: any, idx: number) => {
                const vis = getVisibility(item.codigoItem);
                return (
                  <tr key={item.codigoItem || idx} className={`border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 ${idx % 2 === 0 ? "bg-white" : "bg-slate-25"}`}>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{item.codigoItem}</td>
                    <td className="px-4 py-2.5 text-slate-700 text-xs">{item.descricaoItem}</td>
                    <td className="px-4 py-2.5 text-center">
                      <button
                        onClick={() => toggleVisibility(item.codigoItem, "madeira")}
                        className={`w-8 h-5 rounded-full transition-colors relative ${vis.madeira ? "bg-emerald-500" : "bg-slate-300"}`}
                        disabled={setBulkVisibility.isPending}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${vis.madeira ? "left-3.5" : "left-0.5"}`} />
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <button
                        onClick={() => toggleVisibility(item.codigoItem, "semiPronto")}
                        className={`w-8 h-5 rounded-full transition-colors relative ${vis.semiPronto ? "bg-amber-500" : "bg-slate-300"}`}
                        disabled={setBulkVisibility.isPending}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${vis.semiPronto ? "left-3.5" : "left-0.5"}`} />
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <button
                        onClick={() => toggleVisibility(item.codigoItem, "aguardandoEscolha")}
                        className={`w-8 h-5 rounded-full transition-colors relative ${vis.aguardandoEscolha ? "bg-purple-500" : "bg-slate-300"}`}
                        disabled={setBulkVisibility.isPending}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${vis.aguardandoEscolha ? "left-3.5" : "left-0.5"}`} />
                      </button>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <MadeiraConfigInput
                        codigoItem={item.codigoItem}
                        field="precoCaixa"
                        visibilityData={visibilityData}
                        placeholder="R$"
                        prefix="R$ "
                        type="money"
                      />
                      {/* Mostrar preço sugerido se não tem preço definido */}
                      {(() => {
                        const hasPrice = visibilityData?.items?.some((r: any) => r.codigoItem === item.codigoItem && r.precoCaixa != null && parseFloat(r.precoCaixa) > 0);
                        const autoPrice = autoPricesData?.prices?.[item.codigoItem];
                        if (!hasPrice && autoPrice) {
                          return <span className="text-[10px] text-blue-400" title={`Média de ${autoPrice.salesCount} vendas`}>sugest: R$ {autoPrice.avgPrice.toFixed(2)}</span>;
                        }
                        return null;
                      })()}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <MadeiraConfigInput
                        codigoItem={item.codigoItem}
                        field="alertaReposicao"
                        visibilityData={visibilityData}
                        placeholder="Qtd"
                        type="number"
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

// ─── Main Settings Page ────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { hasGranularAccess, operator } = useOperator();
  // TEMPORÁRIO: senha desabilitada
  const [adminPassword, setAdminPassword] = useState<string>("bypass");
  // Se o operador não tem accessConfiguracoes (entrou via cfg.produtos), iniciar na aba Madeira
  const defaultTab = operator?.accessConfiguracoes ? "passwords" : "madeira";
  const [activeTab, setActiveTab] = useState<"passwords" | "alerts" | "products" | "data" | "bank" | "variants" | "visibility" | "madeira">(defaultTab);

  // if (!adminPassword) {
  //   return <PasswordGate onUnlock={setAdminPassword} />;
  // }

  const allTabs = [
    { id: "passwords" as const, label: "Senhas", icon: Lock, color: "text-red-600", perm: "cfg.senhas" },
    { id: "products" as const, label: "Produto Importado", icon: ArrowRightLeft, color: "text-violet-600", perm: "cfg.produtos" },
    { id: "alerts" as const, label: "Alertas", icon: Bell, color: "text-amber-600", perm: "cfg.alertas" },
    { id: "visibility" as const, label: "Visibilidade", icon: Eye, color: "text-cyan-600", perm: "cfg.alertas" },
    { id: "bank" as const, label: "Bancos", icon: Landmark, color: "text-indigo-600", perm: "cfg.bancos" },
    { id: "variants" as const, label: "Variações", icon: GitBranch, color: "text-teal-500", perm: "cfg.variacoes" },
    { id: "data" as const, label: "Dados", icon: Package, color: "text-blue-600", perm: "cfg.dados" },
    { id: "madeira" as const, label: "Madeira - Produto Acabado", icon: TreePine, color: "text-green-700", perm: "cfg.produtos" },
  ];
  // Se o operador tem accessConfiguracoes, mostra todas as tabs com permissão
  // Se não tem (entrou via cfg.produtos), mostra apenas a aba Madeira
  const tabs = operator?.accessConfiguracoes
    ? allTabs.filter(t => hasGranularAccess(t.perm))
    : allTabs.filter(t => t.id === "madeira" && hasGranularAccess(t.perm));

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <TopNav />

      <div className="container">
        <div className="text-center py-4">
          <h2 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            <span className="text-slate-700">Configurações</span>
            <span className="text-teal-600 ml-2">Grupo Fox</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1 tracking-widest uppercase">Senhas, Produto Importado, Alertas e Dados</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-slate-200">
        <div className="container px-0 md:px-4">
          <div className="flex gap-0.5 md:gap-1 overflow-x-auto pb-1 scrollbar-thin px-2 md:px-0" style={{ WebkitOverflowScrolling: 'touch' }}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1 md:gap-2 px-2 md:px-4 py-2.5 md:py-3 text-[10px] md:text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === tab.id
                    ? `${tab.color} border-current`
                    : "text-slate-400 border-transparent hover:text-slate-600"
                }`}
              >
                <tab.icon className="w-3 h-3 md:w-4 md:h-4 hidden md:block" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className={`container py-6 pb-20 md:pb-6 ${(activeTab === "products" || activeTab === "passwords") ? "max-w-7xl px-6" : "max-w-3xl"}`}>
        {activeTab === "passwords" && <OperatorManagementPanel />}
        {activeTab === "products" && <ProductSegmentsPanel adminPassword={adminPassword} />}
        {activeTab === "alerts" && <AlertSettingsPanel adminPassword={adminPassword} />}
        {activeTab === "visibility" && <FeatureTogglesPanel />}
        {activeTab === "bank" && <BankBalancesPanel />}
        {activeTab === "variants" && <VariantsPanel />}
        {activeTab === "data" && <DataInfoPanel />}
        {activeTab === "madeira" && <MadeiraVisibilityPanel />}
      </main>
    </div>
  );
}
