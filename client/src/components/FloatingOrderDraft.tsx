/**
 * FloatingOrderDraft - Botão flutuante que aparece quando há um pedido em andamento
 * Visível em qualquer aba do sistema. Clicar navega de volta ao pedido.
 */
import { useOrderDraft } from "@/contexts/OrderDraftContext";
import { ShoppingCart, X } from "lucide-react";
import { useLocation } from "wouter";

export default function FloatingOrderDraft() {
  const { draft, hasDraft, clearDraft } = useOrderDraft();
  const [, setLocation] = useLocation();

  if (!hasDraft || !draft) return null;

  const itemCount = draft.items.length;
  const totalValue = draft.items.reduce((sum, i) => sum + i.precoUnitario * i.quantidade, 0);
  const targetPath = `/gestao-comercial/vendedor/${draft.sellerId}?tab=pedidos&resumeDraft=1`;

  return (
    <div className="fixed bottom-4 left-4 md:bottom-6 md:left-6 z-[55] flex items-center gap-2">
      <button
        onClick={() => setLocation(targetPath)}
        className="flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg hover:shadow-xl hover:from-orange-600 hover:to-orange-700 transition-all animate-pulse hover:animate-none"
        title="Continuar pedido em andamento"
      >
        <ShoppingCart className="w-5 h-5" />
        <div className="flex flex-col items-start">
          <span className="text-xs font-bold leading-tight">Continuar Pedido</span>
          <span className="text-[10px] opacity-90 leading-tight">
            {draft.sellerName} · {itemCount} {itemCount === 1 ? "item" : "itens"} · R$ {totalValue.toFixed(2)}
          </span>
        </div>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (confirm("Deseja descartar o pedido em andamento?")) {
            clearDraft();
          }
        }}
        className="w-8 h-8 rounded-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 shadow-md flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-300 transition-colors"
        title="Descartar pedido"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
