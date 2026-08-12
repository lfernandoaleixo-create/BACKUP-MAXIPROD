/**
 * FloatingOrderDraft - Card flutuante que aparece quando há um pedido em andamento
 * Aparece para qualquer vendedor que tenha um rascunho salvo.
 * Mostra resumo do pedido (cliente, itens, valor).
 * Opções: Continuar, Ocultar ou Excluir (com dupla confirmação).
 */
import { useState } from "react";
import { useOrderDraft } from "@/contexts/OrderDraftContext";
import { ShoppingCart, Trash2, X, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";

export default function FloatingOrderDraft() {
  const { draft, hasDraft, clearDraft } = useOrderDraft();
  const [, setLocation] = useLocation();
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSecondConfirm, setShowSecondConfirm] = useState(false);
  const [minimized, setMinimized] = useState(false);

  if (!hasDraft || !draft) return null;

  const itemCount = draft.items?.length || 0;
  const totalValue = (draft.items || []).reduce((sum, i) => sum + (Number(i.precoUnitario) || 0) * (Number(i.quantidade) || 0), 0);
  const clientName = draft.client?.razaoSocial || draft.client?.nomeFantasia || "Cliente não definido";
  const targetPath = `/gestao-comercial/vendedor/${draft.sellerId}?tab=pedidos&resumeDraft=1`;

  // Second confirmation
  if (showSecondConfirm) {
    return (
      <div className="fixed bottom-4 left-4 md:bottom-6 md:left-6 z-[55] bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-red-200 dark:border-red-700 p-4 max-w-xs">
        <p className="text-sm font-bold text-red-600 mb-2">⚠️ Última confirmação</p>
        <p className="text-xs text-slate-600 dark:text-slate-300 mb-3">Essa ação é irreversível. O pedido em andamento será excluído permanentemente.</p>
        <div className="flex gap-2">
          <button onClick={() => { clearDraft(); setShowSecondConfirm(false); setShowConfirm(false); }} className="flex-1 px-3 py-2 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-colors">Sim, excluir</button>
          <button onClick={() => { setShowSecondConfirm(false); setShowConfirm(false); }} className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-lg hover:bg-slate-200 transition-colors">Cancelar</button>
        </div>
      </div>
    );
  }

  // First confirmation
  if (showConfirm) {
    return (
      <div className="fixed bottom-4 left-4 md:bottom-6 md:left-6 z-[55] bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-orange-200 dark:border-orange-700 p-4 max-w-xs">
        <p className="text-sm font-bold text-orange-600 mb-2">Tem certeza que deseja excluir seu pedido?</p>
        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-2 mb-3">
          <p className="text-xs text-slate-600 dark:text-slate-300"><strong>Cliente:</strong> {clientName}</p>
          <p className="text-xs text-slate-600 dark:text-slate-300"><strong>Itens:</strong> {itemCount} | <strong>Valor:</strong> R$ {totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowSecondConfirm(true)} className="flex-1 px-3 py-2 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-colors">Sim, excluir</button>
          <button onClick={() => setShowConfirm(false)} className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-lg hover:bg-slate-200 transition-colors">Não, manter</button>
        </div>
      </div>
    );
  }

  // Minimized - small icon only
  if (minimized) {
    return (
      <div className="fixed bottom-4 left-4 md:bottom-6 md:left-6 z-[55]">
        <button onClick={() => setMinimized(false)} className="w-12 h-12 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center animate-pulse hover:animate-none" title="Pedido em andamento">
          <ShoppingCart className="w-5 h-5" />
        </button>
      </div>
    );
  }

  // Full card with summary
  return (
    <div className="fixed bottom-4 left-4 md:bottom-6 md:left-6 z-[55] bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-orange-200 dark:border-orange-700 p-3 max-w-xs">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-orange-500" />
          <span className="text-xs font-bold text-orange-600">Pedido em Andamento</span>
        </div>
        <button onClick={() => setMinimized(true)} className="text-slate-400 hover:text-slate-600 transition-colors" title="Ocultar">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-2 mb-2">
        <p className="text-[11px] text-slate-700 dark:text-slate-300 font-medium truncate">{clientName}</p>
        <p className="text-[10px] text-slate-500 dark:text-slate-400">{itemCount} {itemCount === 1 ? "item" : "itens"} · R$ {totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
        {draft.sellerName && <p className="text-[10px] text-slate-400 dark:text-slate-500">Vendedor: {draft.sellerName}</p>}
      </div>
      <div className="flex gap-2">
        <button onClick={() => setLocation(targetPath)} className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-xs font-bold rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all">
          <ArrowRight className="w-3 h-3" /> Continuar
        </button>
        <button onClick={() => setShowConfirm(true)} className="px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-500 text-xs font-bold rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors border border-red-200 dark:border-red-700" title="Excluir pedido">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
