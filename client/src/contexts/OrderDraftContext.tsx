/**
 * OrderDraftContext - Persiste rascunhos de pedidos no localStorage
 * Permite que o vendedor navegue entre abas sem perder o pedido em andamento.
 * O rascunho só é removido quando o pedido é concluído ou excluído manualmente.
 */
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

export interface DraftOrderItem {
  codigoItem: string;
  descricaoItem: string;
  quantidade: number;
  unidadeMedida: string;
  precoUnitario: number;
  precoMinimo: number | null;
  precoVendedor: number | null;
  grupo: string;
  disponivel: string;
  pesoBrutoCaixa?: number;
  dimsStr?: string;
}

export interface DraftClientData {
  cnpjCpf: string;
  razaoSocial: string;
  nomeFantasia: string;
  inscricaoEstadual: string;
  cep: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  telefone1: string;
  emailNfe: string;
  segmento: string;
  tipoContribuinte: string;
  regimeTributario: string;
  telefone2?: string;
  emailContato?: string;
}

export interface OrderDraft {
  sellerId: number;
  sellerName: string;
  step: "cliente" | "produtos" | "pagamento" | "revisao" | "resumo_final";
  items: DraftOrderItem[];
  client: DraftClientData | null;
  observacoes: string;
  formaPagamento: string;
  meioPagamento: string;
  condicaoPagamento: string;
  updatedAt: number; // timestamp
  valorFrete?: string;
  tipoFrete?: string;
  transportadoraSelecionada?: string;
  observacoesInternas?: string;
}

const STORAGE_KEY = "grupo-fox-order-draft";

interface OrderDraftContextType {
  draft: OrderDraft | null;
  saveDraft: (draft: OrderDraft) => void;
  clearDraft: () => void;
  hasDraft: boolean;
}

const OrderDraftContext = createContext<OrderDraftContextType>({
  draft: null,
  saveDraft: () => {},
  clearDraft: () => {},
  hasDraft: false,
});

export function OrderDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<OrderDraft | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as OrderDraft;
        // Expirar drafts com mais de 7 dias
        if (Date.now() - parsed.updatedAt > 7 * 24 * 60 * 60 * 1000) {
          localStorage.removeItem(STORAGE_KEY);
          return null;
        }
        return parsed;
      }
    } catch {
      // ignore parse errors
    }
    return null;
  });

  const saveDraft = useCallback((newDraft: OrderDraft) => {
    const draftWithTimestamp = { ...newDraft, updatedAt: Date.now() };
    setDraft(draftWithTimestamp);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draftWithTimestamp));
    } catch {
      // localStorage full - ignore
    }
  }, []);

  const clearDraft = useCallback(() => {
    setDraft(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <OrderDraftContext.Provider value={{ draft, saveDraft, clearDraft, hasDraft: draft !== null && draft.items.length > 0 }}>
      {children}
    </OrderDraftContext.Provider>
  );
}

export function useOrderDraft() {
  return useContext(OrderDraftContext);
}
