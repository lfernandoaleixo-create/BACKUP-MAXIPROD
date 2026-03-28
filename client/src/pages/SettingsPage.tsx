/**
 * Configurações - Página protegida por senha
 * Painéis: Metas de Vendas, Alertas, Alterar Senha
 */

import { useState, useMemo } from "react";
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
    <div className="min-h-screen bg-slate-50">
      <TopNav />
      <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 3.5rem)' }}>
      <div className="bg-white rounded-xl border border-slate-200 shadow-lg p-8 w-full max-w-sm">
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
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
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
        <div className="p-5 bg-teal-50/50 border-b border-slate-100">
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
                <div className="bg-slate-50 px-4 py-2 border-b border-slate-100">
                  <span className="font-semibold text-sm text-slate-700">{formatMonth(month)}</span>
                </div>
                <div className="divide-y divide-slate-50">
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
      toast.error(result.error || "Erro ao salvar");
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="p-5 border-b border-slate-100 flex items-center gap-3">
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
                  <div className={`w-5 h-5 bg-white rounded-full shadow-sm absolute top-0.5 transition-transform ${stockMinEnabled ? "translate-x-5.5" : "translate-x-0.5"}`} />
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
                  <div className={`w-5 h-5 bg-white rounded-full shadow-sm absolute top-0.5 transition-transform ${salesDailyEnabled ? "translate-x-5.5" : "translate-x-0.5"}`} />
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

// ─── Change Password Panel ─────────────────────────────────────
function ChangePasswordPanel({ adminPassword }: { adminPassword: string }) {
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const changeMutation = trpc.settings.changePassword.useMutation();

  const handleChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPwd !== confirmPwd) {
      toast.error("As senhas não conferem");
      return;
    }
    if (newPwd.length < 4) {
      toast.error("A nova senha deve ter no mínimo 4 caracteres");
      return;
    }
    const result = await changeMutation.mutateAsync({
      currentPassword: currentPwd,
      newPassword: newPwd,
    });
    if (result.success) {
      toast.success("Senha alterada com sucesso");
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
    } else {
      toast.error(result.error || "Erro ao alterar senha");
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="p-5 border-b border-slate-100 flex items-center gap-3">
        <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
          <KeyRound className="w-5 h-5 text-red-500" />
        </div>
        <div>
          <h2 className="font-bold text-slate-800">Alterar Senha</h2>
          <p className="text-xs text-slate-500">Altere a senha de acesso às configurações</p>
        </div>
      </div>

      <form onSubmit={handleChange} className="p-5 space-y-4">
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">Senha Atual</label>
          <Input
            type="password"
            value={currentPwd}
            onChange={(e) => setCurrentPwd(e.target.value)}
            placeholder="Digite a senha atual"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">Nova Senha</label>
          <Input
            type="password"
            value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)}
            placeholder="Digite a nova senha"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">Confirmar Nova Senha</label>
          <Input
            type="password"
            value={confirmPwd}
            onChange={(e) => setConfirmPwd(e.target.value)}
            placeholder="Confirme a nova senha"
          />
        </div>
        <Button
          type="submit"
          disabled={changeMutation.isPending || !currentPwd || !newPwd || !confirmPwd}
          className="w-full bg-red-500 hover:bg-red-600"
        >
          {changeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <KeyRound className="w-4 h-4 mr-2" />}
          Alterar Senha
        </Button>
      </form>
    </div>
  );
}

// ─── Data Info Panel ───────────────────────────────────────────
function DataInfoPanel() {
  const { data: status } = trpc.dashboard.getStatus.useQuery();
  const { data: dashData } = trpc.dashboard.getData.useQuery();

  const stockCount = dashData?.items?.length || 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="p-5 border-b border-slate-100 flex items-center gap-3">
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
      case "industrializacao": return "Industrialização";
      case "importacao": return "Importação";
      case "outros": return "Outros";
      default: return s;
    }
  };

  const segmentColor = (s: string) => {
    switch (s) {
      case "industrializacao": return "bg-violet-100 text-violet-700";
      case "importacao": return "bg-teal-100 text-teal-700";
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
      segment: newSegment as "industrializacao" | "importacao",
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
  const outrosCount = filtered.filter(p => p.currentSegment === "outros").length;
  const visibleCount = filtered.filter(p => p.visible).length;
  const filteredHiddenCount = filtered.filter(p => !p.visible).length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-50 rounded-lg flex items-center justify-center">
              <ArrowRightLeft className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800">Segmentos dos Produtos</h2>
              <p className="text-xs text-slate-500">Reclassifique produtos entre segmentos</p>
            </div>
          </div>
          <div className="flex gap-2">
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
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Segmento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Segmentos</SelectItem>
              <SelectItem value="industrializacao">Industrialização</SelectItem>
              <SelectItem value="importacao">Importação</SelectItem>
              <SelectItem value="outros">Outros</SelectItem>
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
          <Badge className="bg-violet-50 text-violet-600 border-0 text-xs">
            {indCount} Industrialização
          </Badge>
          <Badge className="bg-teal-50 text-teal-600 border-0 text-xs">
            {impCount} Importação
          </Badge>
          {outrosCount > 0 && (
            <Badge className="bg-slate-50 text-slate-500 border-0 text-xs">
              {outrosCount} Outros
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
          <table className="w-full" style={{ minWidth: "1300px" }}>
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="px-2 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase" style={{ width: "50px" }}>Vis.</th>
                <th className="px-2 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase" style={{ width: "70px" }}>Cód</th>
                <th className="px-2 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase">Produto</th>
                <th className="px-2 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase" style={{ width: "45px" }}>Grp</th>
                <th className="px-2 py-2.5 text-right text-[10px] font-semibold text-slate-500 uppercase" style={{ width: "75px" }}>Estoque</th>
                <th className="px-2 py-2.5 text-right text-[10px] font-semibold text-slate-500 uppercase" style={{ width: "80px" }}>Dispon.</th>
                <th className="px-2 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase" style={{ width: "120px" }}>Segmento</th>
                <th className="px-2 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase" style={{ width: "40px" }} title="Manter em Estoque"><span className="inline-block w-3 h-3 rounded-full bg-emerald-400"></span></th>
                <th className="px-2 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase" style={{ width: "40px" }} title="Sob Encomenda"><span className="inline-block w-3 h-3 rounded-full bg-amber-400"></span></th>
                <th className="px-2 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase" style={{ width: "40px" }} title="Outros"><span className="inline-block w-3 h-3 rounded-full bg-slate-400"></span></th>
                <th className="px-2 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase" style={{ width: "35px" }} title="Auto = preço automático (bolinha marcada). Desmarque para digitar preço manual.">A</th>
                <th className="px-2 py-2.5 text-right text-[10px] font-semibold text-slate-500 uppercase" style={{ width: "120px" }}>R$/Cx</th>
                <th className="px-2 py-2.5 text-right text-[10px] font-semibold text-slate-500 uppercase" style={{ width: "90px" }} title="Venda mensal em caixas (preenchido manualmente)">Vd. Mensal</th>
                <th className="px-2 py-2.5 text-right text-[10px] font-semibold text-slate-500 uppercase" style={{ width: "60px" }} title="Fator de multiplicação (padrão 2,3)">Fator</th>
                <th className="px-2 py-2.5 text-right text-[10px] font-semibold text-slate-500 uppercase" style={{ width: "80px" }} title="Prazo em dias para acionar compra (preenchido manualmente)">Prazo (d)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
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
                      <span className="text-[12px] font-semibold text-slate-700">{(product as any).estoqueCx ?? 0} cx</span>
                    </td>
                    {/* Disponível */}
                    <td className="px-2 py-2 text-right">
                      <span className={`text-[12px] font-semibold ${((product as any).disponivelCx ?? 0) < 0 ? "text-red-600" : ((product as any).disponivelCx ?? 0) === 0 ? "text-amber-600" : "text-emerald-600"}`}>
                        {(product as any).disponivelCx ?? 0} cx
                      </span>
                    </td>
                    {/* Segmento */}
                    <td className="px-2 py-2">
                      <Select
                        value={product.currentSegment}
                        onValueChange={(val) => handleChangeSegment(product.descricao, product.codigoGrupo, val)}
                      >
                        <SelectTrigger className={`h-7 text-[11px] font-medium ${segmentColor(product.currentSegment)} border-0 px-2`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="industrializacao">Industrialização</SelectItem>
                          <SelectItem value="importacao">Importação</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    {/* Classificação: Estoque */}
                    <td className="px-2 py-2 text-center">
                      <input
                        type="radio"
                        name={`class-${product.codigoItem}`}
                        checked={(product as any)._classification === "estoque"}
                        onChange={() => handleClassification(product.codigoItem || "", product.descricao, "estoque")}
                        className="w-4 h-4 accent-emerald-600 cursor-pointer"
                        title="Manter em Estoque"
                      />
                    </td>
                    {/* Classificação: Encomenda */}
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
                    {/* Classificação: Outros */}
                    <td className="px-2 py-2 text-center">
                      <input
                        type="radio"
                        name={`class-${product.codigoItem}`}
                        checked={(product as any)._classification === "outros"}
                        onChange={() => handleClassification(product.codigoItem || "", product.descricao, "outros")}
                        className="w-4 h-4 accent-slate-500 cursor-pointer"
                        title="Outros"
                      />
                    </td>
                    {/* Auto checkbox */}
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
                        <span className="text-[10px] text-slate-300 italic">s/ preço</span>
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
                          {pricing?.vendaMensal != null ? `${pricing.vendaMensal} cx` : "—"}
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
                    {/* Prazo Compra */}
                    <td className="px-2 py-2 text-right">
                      {editingStockField?.codigoItem === product.codigoItem && editingStockField?.field === "prazoCompraDias" ? (
                        <div className="flex items-center gap-1 justify-end">
                          <Input
                            value={editStockValue}
                            onChange={(e) => setEditStockValue(e.target.value)}
                            className="w-14 h-6 text-[11px] text-right px-1"
                            placeholder="0"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const val = parseInt(editStockValue);
                                setStockSettingsMutation.mutate({
                                  codigoItem: product.codigoItem || "",
                                  vendaMensal: pricing?.vendaMensal ?? null,
                                  fatorMultiplicacao: pricing?.fatorMultiplicacao ?? "2.3",
                                  prazoCompraDias: isNaN(val) ? null : val,
                                });
                                setEditingStockField(null);
                                toast.success("Prazo de compra salvo");
                              }
                              if (e.key === "Escape") setEditingStockField(null);
                            }}
                            onBlur={() => {
                              const val = parseInt(editStockValue);
                              if (editStockValue !== "") {
                                setStockSettingsMutation.mutate({
                                  codigoItem: product.codigoItem || "",
                                  vendaMensal: pricing?.vendaMensal ?? null,
                                  fatorMultiplicacao: pricing?.fatorMultiplicacao ?? "2.3",
                                  prazoCompraDias: isNaN(val) ? null : val,
                                });
                              }
                              setEditingStockField(null);
                            }}
                          />
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingStockField({ codigoItem: product.codigoItem || "", field: "prazoCompraDias" });
                            setEditStockValue(pricing?.prazoCompraDias != null ? String(pricing.prazoCompraDias) : "");
                          }}
                          className={`text-[12px] cursor-pointer hover:underline ${pricing?.prazoCompraDias != null ? "font-semibold text-slate-700" : "text-slate-300 italic"}`}
                          title="Clique para definir prazo de compra em dias"
                        >
                          {pricing?.prazoCompraDias != null ? `${pricing.prazoCompraDias} d` : "—"}
                        </button>
                      )}
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
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span> Manter em Estoque</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span> Sob Encomenda</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span> Outros</span>
          <span>A = Auto (bolinha marcada). Desmarque para digitar preço manual.</span>
          <span className="ml-auto">Vd. Mensal = Venda mensal (cx) | Fator = Multiplicação (padrão 2,3) | Prazo (d) = Prazo de compra (dias)</span>
        </div>
      </div>
    </div>
  );
}

// ─── Bank Balances Panel ──────────────────────────────────────
function BankBalancesPanel() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.financial.getBankBalances.useQuery();
  const updateMutation = trpc.financial.updateBankBalance.useMutation({
    onSuccess: () => {
      utils.financial.getBankBalances.invalidate();
      toast.success("Saldo atualizado com sucesso");
    },
    onError: () => toast.error("Erro ao atualizar saldo"),
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editSaldo, setEditSaldo] = useState("");
  const [editData, setEditData] = useState("");
  const [globalDate, setGlobalDate] = useState(() => new Date().toISOString().split("T")[0]);

  const startEdit = (acc: any) => {
    setEditingId(acc.maxiprodId);
    setEditSaldo(acc.saldoInicial ? String(acc.saldoInicial) : "0");
    setEditData(acc.saldoInicialData || globalDate);
  };

  const saveEdit = async (maxiprodId: number) => {
    const val = parseFloat(editSaldo.replace(/\./g, "").replace(",", "."));
    if (isNaN(val)) {
      toast.error("Valor inválido");
      return;
    }
    await updateMutation.mutateAsync({
      maxiprodId,
      saldoInicial: String(val),
      saldoInicialData: editData,
    });
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditSaldo("");
    setEditData("");
  };

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const shortBankName = (name: string) => {
    if (name.includes("Bradesco")) return "Bradesco";
    if (name.includes("Sicredi")) return "Sicredi";
    if (name.includes("BANCOOB") || name.includes("Sicoob")) return "Sicoob";
    if (name.includes("Caixa")) return "Caixa";
    if (name.includes("Brasil")) return "BB";
    return name.substring(0, 15);
  };

  const shortCompany = (name: string) => {
    if (name.includes("PALITOS")) return "Palitos";
    if (name.includes("VARETAS")) return "Varetas";
    if (name.includes("ESPETOS")) return "Espetos";
    if (name.includes("MESA")) return "Mesa";
    return name;
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
            <Landmark className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="font-bold text-slate-800">Saldos Bancários</h2>
            <p className="text-xs text-slate-500">Defina o saldo inicial de cada conta para cálculo do saldo atual</p>
          </div>
        </div>
        {/* Seletor de data de referência global */}
        <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <span className="text-sm font-medium text-slate-700">Data de referência dos saldos:</span>
              <Input
                type="date"
                value={globalDate}
                onChange={(e) => setGlobalDate(e.target.value)}
                className="bg-white w-44 h-8 text-sm"
              />
            </div>
            <p className="text-xs text-slate-400">Informe o saldo de cada conta nesta data. O sistema calcula o saldo atual com as movimentações posteriores.</p>
          </div>
        </div>

        {data && (
          <div className="mt-3 p-3 bg-indigo-50 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-indigo-700">Saldo Total Consolidado</span>
              <span className={`text-lg font-bold ${data.totalSaldo >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                {formatCurrency(data.totalSaldo)}
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
            <p className="text-xs mt-1">Sincronize os dados do Maxiprod primeiro</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.accounts.map((acc) => (
              <div
                key={acc.maxiprodId}
                className="border border-slate-100 rounded-lg p-4 hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-800">
                      {shortBankName(acc.bancoNome || "")}
                    </span>
                    <span className="text-xs text-slate-400">
                      Ag {acc.agencia || "—"} / Cc {acc.contaNumero}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {shortCompany(acc.empresaNome || "")}
                    </Badge>
                  </div>
                  <span className={`font-bold text-sm ${acc.saldoAtual >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {formatCurrency(acc.saldoAtual)}
                  </span>
                </div>

                {editingId === acc.maxiprodId ? (
                  <div className="bg-indigo-50/50 rounded-lg p-3 mt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                      <div>
                        <label className="text-xs font-medium text-slate-600 mb-1 block">
                          <DollarSign className="w-3 h-3 inline mr-1" />
                          Saldo Inicial (R$)
                        </label>
                        <Input
                          type="text"
                          value={editSaldo}
                          onChange={(e) => setEditSaldo(e.target.value)}
                          placeholder="Ex: 50000.00"
                          className="bg-white"
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600 mb-1 block">
                          <Calendar className="w-3 h-3 inline mr-1" />
                          Data de Referência
                        </label>
                        <Input
                          type="date"
                          value={editData}
                          onChange={(e) => setEditData(e.target.value)}
                          className="bg-white"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => saveEdit(acc.maxiprodId)}
                          disabled={updateMutation.isPending}
                          className="bg-indigo-600 hover:bg-indigo-700 flex-1"
                        >
                          {updateMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <><Save className="w-4 h-4 mr-1" />Salvar</>
                          )}
                        </Button>
                        <Button size="sm" variant="outline" onClick={cancelEdit}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-4">
                      <span>
                        Saldo inicial: <strong className="text-slate-700">{formatCurrency(acc.saldoInicial)}</strong>
                        {acc.saldoInicialData && (
                          <span className="ml-1">em {acc.saldoInicialData.split("-").reverse().join("/")}</span>
                        )}
                      </span>
                      <span>
                        Movimentação: <strong className={acc.movimentacao >= 0 ? "text-emerald-600" : "text-red-600"}>
                          {acc.movimentacao >= 0 ? "+" : ""}{formatCurrency(acc.movimentacao)}
                        </strong>
                      </span>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => startEdit(acc)} className="text-indigo-600 hover:text-indigo-700">
                      <Edit3 className="w-3 h-3 mr-1" />
                      Editar
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Settings Page ────────────────────────────────────────
export default function SettingsPage() {
  // TEMPORÁRIO: senha desabilitada
  const [adminPassword, setAdminPassword] = useState<string>("bypass");
  const [activeTab, setActiveTab] = useState<"targets" | "alerts" | "products" | "data" | "bank" | "password">("targets");

  // if (!adminPassword) {
  //   return <PasswordGate onUnlock={setAdminPassword} />;
  // }

  const tabs = [
    { id: "targets" as const, label: "Metas", icon: Target, color: "text-teal-600" },
    { id: "products" as const, label: "Produtos", icon: ArrowRightLeft, color: "text-violet-600" },
    { id: "alerts" as const, label: "Alertas", icon: Bell, color: "text-amber-600" },
    { id: "bank" as const, label: "Bancos", icon: Landmark, color: "text-indigo-600" },
    { id: "data" as const, label: "Dados", icon: Package, color: "text-blue-600" },
    { id: "password" as const, label: "Senha", icon: KeyRound, color: "text-red-500" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <TopNav />

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-slate-200">
        <div className="container">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? `${tab.color} border-current`
                    : "text-slate-400 border-transparent hover:text-slate-600"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className={`container py-6 ${activeTab === "products" ? "max-w-7xl px-6" : "max-w-3xl"}`}>
        {activeTab === "targets" && <SalesTargetsPanel adminPassword={adminPassword} />}
        {activeTab === "products" && <ProductSegmentsPanel adminPassword={adminPassword} />}
        {activeTab === "alerts" && <AlertSettingsPanel adminPassword={adminPassword} />}
        {activeTab === "bank" && <BankBalancesPanel />}
        {activeTab === "data" && <DataInfoPanel />}
        {activeTab === "password" && <ChangePasswordPanel adminPassword={adminPassword} />}
      </main>
    </div>
  );
}
