import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useOperator } from "@/contexts/OperatorContext";
import { toast } from "sonner";
import { X, Plus, History, AlertTriangle, CheckCircle2, Clock, DollarSign, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function UnidentifiedPaymentsButton() {
  const [open, setOpen] = useState(false);
  const { data: count } = trpc.unidentifiedPayments.getPendingCount.useQuery(undefined, { refetchInterval: 30000 });
  const { data: activePayments } = trpc.unidentifiedPayments.getActive.useQuery(undefined, { refetchInterval: 15000 });
  const identifiedCount = activePayments?.filter(p => p.status === "identificado").length || 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`relative flex items-center gap-2 px-3 py-2 rounded-lg text-white text-xs font-semibold transition-colors shadow-sm ${identifiedCount > 0 ? "bg-green-600 hover:bg-green-700 animate-pulse" : "bg-purple-600 hover:bg-purple-700"}`}
      >
        <DollarSign className="w-3.5 h-3.5" />
        Pagamentos Não Identificados
        {(count || 0) > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center animate-pulse">
            {count}
          </span>
        )}
        {identifiedCount > 0 && (
          <span className="absolute -top-1.5 -left-1.5 bg-emerald-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {identifiedCount}
          </span>
        )}
      </button>
      {open && <UnidentifiedPaymentsDialog onClose={() => setOpen(false)} />}
    </>
  );
}

/** Alert badge for the Sales tab - shows when there are pending unidentified payments */
export function UnidentifiedPaymentsAlert() {
  const [open, setOpen] = useState(false);
  const { data: count } = trpc.unidentifiedPayments.getPendingCount.useQuery(undefined, { refetchInterval: 15000 });
  const { data: activePayments } = trpc.unidentifiedPayments.getActive.useQuery(undefined, { refetchInterval: 15000 });
  const pendingForCommercial = activePayments?.filter(p => p.status === "pendente") || [];

  if (pendingForCommercial.length === 0) return null;

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        className="cursor-pointer bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-300 rounded-xl p-4 shadow-sm animate-pulse hover:animate-none hover:shadow-md transition-all"
      >
        <div className="flex items-center gap-3">
          <div className="bg-purple-100 rounded-full p-2">
            <AlertTriangle className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-purple-800">
              {pendingForCommercial.length} Pagamento{pendingForCommercial.length > 1 ? "s" : ""} Não Identificado{pendingForCommercial.length > 1 ? "s" : ""}
            </h3>
            <p className="text-xs text-purple-600">Clique para identificar o cliente</p>
            <p className="text-[10px] text-purple-500 mt-0.5">{pendingForCommercial.map(p => `${(p as any).nomePagador || "?"} - ${p.formaPagamento} ${formatCurrency(Number(p.valorPagamento))}`).join(" | ")}</p>
          </div>
          <div className="ml-auto text-right">
            <span className="text-lg font-bold text-purple-700">
              {formatCurrency(pendingForCommercial.reduce((sum, p) => sum + Number(p.valorPagamento), 0))}
            </span>
          </div>
        </div>
      </div>
      {open && <UnidentifiedPaymentsDialog onClose={() => setOpen(false)} mode="commercial" />}
    </>
  );
}

function UnidentifiedPaymentsDialog({ onClose, mode = "financial" }: { onClose: () => void; mode?: "financial" | "commercial" }) {
  const { operator } = useOperator();
  const [showHistory, setShowHistory] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newForma, setNewForma] = useState("");
  const [newValor, setNewValor] = useState("");
  const [newPagador, setNewPagador] = useState("");
  const [identifyId, setIdentifyId] = useState<number | null>(null);
  const [clientName, setClientName] = useState("");

  const utils = trpc.useUtils();
  const { data: activePayments, isLoading } = trpc.unidentifiedPayments.getActive.useQuery();
  const { data: history } = trpc.unidentifiedPayments.getHistory.useQuery(undefined, { enabled: showHistory });

  const createMutation = trpc.unidentifiedPayments.create.useMutation({
    onSuccess: () => { utils.unidentifiedPayments.invalidate(); toast.success("Pagamento registrado!"); setNewDate(""); setNewForma(""); setNewValor(""); setNewPagador(""); },
    onError: () => toast.error("Erro ao registrar"),
  });
  const identifyMutation = trpc.unidentifiedPayments.identify.useMutation({
    onSuccess: () => { utils.unidentifiedPayments.invalidate(); toast.success("Cliente identificado!"); setIdentifyId(null); setClientName(""); },
    onError: () => toast.error("Erro ao identificar"),
  });
  const resolveMutation = trpc.unidentifiedPayments.resolve.useMutation({
    onSuccess: () => { utils.unidentifiedPayments.invalidate(); toast.success("Resolvido!"); },
    onError: () => toast.error("Erro ao resolver"),
  });
  const deleteAnyMutation = trpc.unidentifiedPayments.deleteAny.useMutation({
    onSuccess: () => { utils.unidentifiedPayments.invalidate(); toast.success("Registro apagado!"); },
    onError: () => toast.error("Erro ao apagar"),
  });
  const isGuilherme = operator?.name?.toLowerCase().includes("guilherme");

  const handleCreate = () => {
    if (!newDate || !newForma || !newValor || !newPagador.trim()) { toast.error("Preencha todos os campos"); return; }
    createMutation.mutate({ dataPagamento: newDate, formaPagamento: newForma, valorPagamento: newValor, nomePagador: newPagador.trim(), criadoPor: operator?.name || "Sistema" });
  };

  const handleIdentify = (id: number) => {
    if (!clientName.trim()) { toast.error("Preencha o nome do cliente"); return; }
    identifyMutation.mutate({ id, nomeCliente: clientName.trim(), vendedorResponsavel: operator?.name || "Desconhecido" });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-purple-800">
            <DollarSign className="w-5 h-5" />
            Planilha de Pagamentos Não Identificados
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Toggle history */}
          <div className="flex gap-2">
            <Button variant={showHistory ? "outline" : "default"} size="sm" onClick={() => setShowHistory(false)}>
              <Clock className="w-3.5 h-3.5 mr-1" /> Ativos
            </Button>
            <Button variant={showHistory ? "default" : "outline"} size="sm" onClick={() => setShowHistory(true)}>
              <History className="w-3.5 h-3.5 mr-1" /> Histórico
            </Button>
          </div>

          {!showHistory && (
            <>
              {/* New payment form (only for financial) */}
              {mode === "financial" && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 space-y-2">
                  <h4 className="text-xs font-bold text-purple-700 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Novo Pagamento</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500">Data *</label>
                      <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="h-8 text-xs" />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500">Forma *</label>
                      <select value={newForma} onChange={e => setNewForma(e.target.value)} className="w-full h-8 text-xs border rounded px-2">
                        <option value="">Selecione</option>
                        <option value="PIX">PIX</option>
                        <option value="Boleto">Boleto</option>
                        <option value="Transferência">Transferência</option>
                        <option value="Depósito">Depósito</option>
                        <option value="Cheque">Cheque</option>
                        <option value="Outro">Outro</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500">Valor (R$) *</label>
                      <Input type="number" step="0.01" value={newValor} onChange={e => setNewValor(e.target.value)} placeholder="0,00" className="h-8 text-xs" />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500">Pagador *</label>
                      <Input value={newPagador} onChange={e => setNewPagador(e.target.value)} placeholder="Nome de quem pagou" className="h-8 text-xs" />
                    </div>
                  </div>
                  <Button size="sm" onClick={handleCreate} disabled={createMutation.isPending} className="bg-purple-600 hover:bg-purple-700">
                    {createMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
                    Registrar
                  </Button>
                </div>
              )}

              {/* Active payments table */}
              {isLoading ? (
                <div className="text-center py-8 text-slate-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
              ) : activePayments && activePayments.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] uppercase text-slate-500">
                        <th className="text-left py-2 px-2">Data</th>
                        <th className="text-left py-2 px-2">Forma</th>
                        <th className="text-right py-2 px-2">Valor</th>
                        <th className="text-left py-2 px-2">Pagador</th>
                        <th className="text-left py-2 px-2">Cliente</th>
                        <th className="text-left py-2 px-2">Vendedor</th>
                        <th className="text-center py-2 px-2">Status</th>
                        <th className="text-center py-2 px-2">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activePayments.map(p => (
                        <tr key={p.id} className={`border-b border-slate-100 hover:bg-slate-50 ${p.status === "identificado" ? "bg-green-50 animate-pulse" : ""}`}>
                          <td className="py-2 px-2 text-slate-700">{p.dataPagamento}</td>
                          <td className="py-2 px-2 text-slate-700">{p.formaPagamento}</td>
                          <td className="py-2 px-2 text-right font-semibold text-slate-800">{formatCurrency(Number(p.valorPagamento))}</td>
                          <td className="py-2 px-2 text-slate-700 font-medium">{(p as any).nomePagador || "-"}</td>
                          <td className="py-2 px-2">
                            {p.nomeCliente ? (
                              <span className="text-emerald-700 font-medium">{p.nomeCliente}</span>
                            ) : identifyId === p.id ? (
                              <div className="flex gap-1">
                                <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Nome do cliente" className="h-6 text-xs w-32" />
                                <Button size="sm" className="h-6 px-2 text-[10px]" onClick={() => handleIdentify(p.id)} disabled={identifyMutation.isPending}>OK</Button>
                                <Button size="sm" variant="ghost" className="h-6 px-1" onClick={() => setIdentifyId(null)}><X className="w-3 h-3" /></Button>
                              </div>
                            ) : (
                              <button onClick={() => setIdentifyId(p.id)} className="text-purple-600 hover:text-purple-800 font-medium underline">
                                Identificar
                              </button>
                            )}
                          </td>
                          <td className="py-2 px-2 text-slate-600">{p.vendedorResponsavel || "-"}</td>
                          <td className="py-2 px-2 text-center">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                              p.status === "pendente" ? "bg-amber-100 text-amber-700" :
                              p.status === "identificado" ? "bg-blue-100 text-blue-700" :
                              "bg-emerald-100 text-emerald-700"
                            }`}>
                              {p.status === "pendente" ? "Pendente" : p.status === "identificado" ? "Identificado" : "Resolvido"}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-center">
                            {p.status === "identificado" && mode === "financial" && (
                              <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] text-emerald-600 border-emerald-300" onClick={() => resolveMutation.mutate({ id: p.id, resolvidoPor: operator?.name || "Sistema" })}>
                                <CheckCircle2 className="w-3 h-3 mr-0.5" /> Resolvido
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400 text-sm">Nenhum pagamento não identificado no momento.</div>
              )}
            </>
          )}

          {/* History */}
          {showHistory && history && history.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 text-[10px] uppercase text-slate-500">
                    <th className="text-left py-2 px-2">Data Pgto</th>
                    <th className="text-left py-2 px-2">Forma</th>
                    <th className="text-right py-2 px-2">Valor</th>
                    <th className="text-left py-2 px-2">Pagador</th>
                    <th className="text-left py-2 px-2">Cliente</th>
                    <th className="text-left py-2 px-2">Vendedor</th>
                    <th className="text-left py-2 px-2">Resolvido por</th>
                    <th className="text-left py-2 px-2">Data Resolução</th>
                    {isGuilherme && <th className="text-center py-2 px-2">Ação</th>}
                  </tr>
                </thead>
                <tbody>
                  {history.map(p => (
                    <tr key={p.id} className="border-b border-slate-100">
                      <td className="py-1.5 px-2 text-slate-600">{p.dataPagamento}</td>
                      <td className="py-1.5 px-2 text-slate-600">{p.formaPagamento}</td>
                      <td className="py-1.5 px-2 text-right font-medium text-slate-700">{formatCurrency(Number(p.valorPagamento))}</td>
                      <td className="py-1.5 px-2 text-slate-700 font-medium">{p.nomeCliente || "-"}</td>
                      <td className="py-1.5 px-2 text-slate-600">{p.vendedorResponsavel || "-"}</td>
                      <td className="py-1.5 px-2 text-slate-600">{(p as any).nomePagador || "-"}</td>
                      <td className="py-1.5 px-2 text-slate-600">{p.resolvidoPor || "-"}</td>
                      <td className="py-1.5 px-2 text-slate-500">{p.dataResolvido ? new Date(p.dataResolvido).toLocaleDateString("pt-BR") : "-"}</td>
                      {isGuilherme && (
                        <td className="py-1.5 px-2 text-center">
                          <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[10px] text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => { if (confirm("Apagar este registro do histórico?")) deleteAnyMutation.mutate({ id: p.id }); }}>
                            <X className="w-3 h-3" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {showHistory && (!history || history.length === 0) && (
            <div className="text-center py-8 text-slate-400 text-sm">Nenhum registro no histórico.</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
