/**
 * FloatingOrderDraft - Sistema "Em Digitação"
 * Mostra todos os pedidos em digitação do vendedor.
 * Permite: retomar qualquer pedido, excluir (com dupla confirmação), ocultar.
 */
import { useState } from "react";
import { useOperator } from "@/contexts/OperatorContext";
import { useOrderDraft } from "@/contexts/OrderDraftContext";
import { ShoppingCart, Trash2, X, ArrowRight, FileText } from "lucide-react";
import { useLocation } from "wouter";

export default function FloatingOrderDraft() {
  const { allDrafts, removeDraft, setActiveDraft } = useOrderDraft();
  const { operator } = useOperator();
  const [, setLocation] = useLocation();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [secondConfirmId, setSecondConfirmId] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Filter drafts for this operator only
  const operatorName = (operator?.name || "").toUpperCase().trim();
  const myDrafts = allDrafts.filter(d => {
    if (!d.items || d.items.length === 0) return false;
    const draftSeller = (d.sellerName || "").toUpperCase().trim();
    if (!operatorName || !draftSeller) return true;
    const opFirst = operatorName.split(" ")[0];
    const draftFirst = draftSeller.split(" ")[0];
    return draftSeller.includes(opFirst) || operatorName.includes(draftFirst);
  });

  if (myDrafts.length === 0) return null;

  // Second confirmation
  if (secondConfirmId) {
    const d = myDrafts.find(x => x.id === secondConfirmId);
    return (
      <div className="fixed bottom-4 left-4 md:bottom-6 md:left-6 z-[55] bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-red-200 dark:border-red-700 p-4 max-w-xs">
        <p className="text-sm font-bold text-red-600 mb-2">⚠️ Última confirmação</p>
        <p className="text-xs text-slate-600 dark:text-slate-300 mb-3">Essa ação é irreversível. O pedido de <strong>{d?.client?.razaoSocial || "?"}</strong> será excluído permanentemente.</p>
        <div className="flex gap-2">
          <button onClick={() => { removeDraft(secondConfirmId); setSecondConfirmId(null); setConfirmDeleteId(null); }} className="flex-1 px-3 py-2 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-colors">Sim, excluir</button>
          <button onClick={() => { setSecondConfirmId(null); setConfirmDeleteId(null); }} className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-lg hover:bg-slate-200 transition-colors">Cancelar</button>
        </div>
      </div>
    );
  }

  // First confirmation
  if (confirmDeleteId) {
    const d = myDrafts.find(x => x.id === confirmDeleteId);
    const itemCount = d?.items?.length || 0;
    const totalValue = (d?.items || []).reduce((sum, i) => sum + (Number(i.precoUnitario) || 0) * (Number(i.quantidade) || 0), 0);
    return (
      <div className="fixed bottom-4 left-4 md:bottom-6 md:left-6 z-[55] bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-orange-200 dark:border-orange-700 p-4 max-w-xs">
        <p className="text-sm font-bold text-orange-600 mb-2">Tem certeza que deseja excluir?</p>
        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-2 mb-3">
          <p className="text-xs text-slate-600 dark:text-slate-300"><strong>Cliente:</strong> {d?.client?.razaoSocial || "?"}</p>
          <p className="text-xs text-slate-600 dark:text-slate-300"><strong>Itens:</strong> {itemCount} | <strong>Valor:</strong> R$ {totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setSecondConfirmId(confirmDeleteId)} className="flex-1 px-3 py-2 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-colors">Sim, excluir</button>
          <button onClick={() => setConfirmDeleteId(null)} className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-lg hover:bg-slate-200 transition-colors">Não, manter</button>
        </div>
      </div>
    );
  }

  // Minimized - small icon with badge count
  if (minimized) {
    return (
      <div className="fixed bottom-4 left-4 md:bottom-6 md:left-6 z-[55]">
        <button onClick={() => setMinimized(false)} className="relative w-12 h-12 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center animate-pulse hover:animate-none" title={`${myDrafts.length} pedido(s) em digitação`}>
          <ShoppingCart className="w-5 h-5" />
          {myDrafts.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{myDrafts.length}</span>
          )}
        </button>
      </div>
    );
  }

  // Full card - show list of all drafts
  return (
    <div className="fixed bottom-4 left-4 md:bottom-6 md:left-6 z-[55] bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-orange-200 dark:border-orange-700 p-3 max-w-sm w-80">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-orange-500" />
          <span className="text-xs font-bold text-orange-600">Em Digitação ({myDrafts.length})</span>
        </div>
        <button onClick={() => setMinimized(true)} className="text-slate-400 hover:text-slate-600 transition-colors" title="Ocultar">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* List of drafts */}
      <div className={`space-y-2 ${expanded ? "max-h-80" : "max-h-40"} overflow-y-auto`}>
        {myDrafts.map((d) => {
          const itemCount = d.items?.length || 0;
          const totalValue = (d.items || []).reduce((sum, i) => sum + (Number(i.precoUnitario) || 0) * (Number(i.quantidade) || 0), 0);
          const clientName = d.client?.razaoSocial || d.client?.nomeFantasia || "Cliente não definido";
          const targetPath = `/gestao-comercial/vendedor/${d.sellerId}?tab=pedidos&resumeDraft=${d.id}`;
          const timeAgo = Math.round((Date.now() - d.updatedAt) / 60000);
          const timeLabel = timeAgo < 60 ? `${timeAgo}min` : timeAgo < 1440 ? `${Math.round(timeAgo / 60)}h` : `${Math.round(timeAgo / 1440)}d`;

          return (
            <div key={d.id} className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-2 border border-orange-100 dark:border-orange-800">
              <div className="flex items-start justify-between gap-1">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-slate-700 dark:text-slate-300 font-medium truncate">{clientName}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">{itemCount} {itemCount === 1 ? "item" : "itens"} · R$ {totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} · {timeLabel} atrás</p>
                </div>
                <span className="text-[9px] text-orange-400 font-medium whitespace-nowrap">{d.step === "cliente" ? "📋" : d.step === "produtos" ? "📦" : "✅"}</span>
              </div>
              <div className="flex gap-1.5 mt-1.5">
                <button onClick={() => { setActiveDraft(d.id); setLocation(targetPath); }} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-[10px] font-bold rounded-md hover:from-orange-600 hover:to-orange-700 transition-all">
                  <ArrowRight className="w-3 h-3" /> Continuar
                </button>
                <button onClick={() => setConfirmDeleteId(d.id)} className="px-2 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-500 text-[10px] font-bold rounded-md hover:bg-red-100 transition-colors border border-red-200 dark:border-red-700" title="Excluir">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {myDrafts.length > 2 && (
        <button onClick={() => setExpanded(!expanded)} className="w-full mt-2 text-[10px] text-orange-500 font-medium hover:text-orange-600 transition-colors">
          {expanded ? "▲ Mostrar menos" : `▼ Ver todos (${myDrafts.length})`}
        </button>
      )}
    </div>
  );
}
