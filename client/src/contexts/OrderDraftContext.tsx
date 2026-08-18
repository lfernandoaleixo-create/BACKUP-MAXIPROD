/**
 * OrderDraftContext - Sistema "Em Digitação"
 * Suporta MÚLTIPLOS rascunhos de pedidos simultaneamente.
 * O vendedor pode ter 10, 20 ou mais pedidos em digitação sem limite.
 * Cada rascunho tem um ID único e pode ser retomado a qualquer momento.
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
  id: string; // unique ID for each draft
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
  createdAt?: number; // when the draft was first created
  valorFrete?: string;
  tipoFrete?: string;
  transportadoraSelecionada?: string;
  observacoesInternas?: string;
  operacaoFiscal?: string;
  protocoloCotacao?: string;
  naturezaOperacao?: string;
  temBonificacao?: "" | "sim" | "nao";
  itensBonificacao?: Array<{ codigoItem: string; descricaoItem: string; quantidade: number; valorUnitario: number; pesoBrutoCaixa: number; dimsStr: string }>;
  situacaoCobranca?: string;
  estadoConfiguravel?: string;
  dataEntregaPedido?: string;
  previsaoEntregaPedido?: string;
  tipoFaturamento?: string;
}

const STORAGE_KEY = "grupo-fox-order-draft";
const MULTI_STORAGE_KEY = "grupo-fox-order-drafts-multi";

interface OrderDraftContextType {
  // Legacy single-draft API (backwards compatible)
  draft: OrderDraft | null;
  saveDraft: (draft: OrderDraft) => void;
  clearDraft: () => void;
  hasDraft: boolean;
  // Multi-draft API
  allDrafts: OrderDraft[];
  saveDraftById: (draft: OrderDraft) => void;
  removeDraft: (id: string) => void;
  setActiveDraft: (id: string) => void;
  createNewDraft: (sellerId: number, sellerName: string) => string; // returns new draft ID
  activeDraftId: string | null;
}

const OrderDraftContext = createContext<OrderDraftContextType>({
  draft: null,
  saveDraft: () => {},
  clearDraft: () => {},
  hasDraft: false,
  allDrafts: [],
  saveDraftById: () => {},
  removeDraft: () => {},
  setActiveDraft: () => {},
  createNewDraft: () => "",
  activeDraftId: null,
});

function generateDraftId(): string {
  return `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function loadAllDrafts(): OrderDraft[] {
  try {
    // First check multi-storage
    const multiStored = localStorage.getItem(MULTI_STORAGE_KEY);
    if (multiStored) {
      const drafts = JSON.parse(multiStored) as OrderDraft[];
      // Remove expired drafts (> 30 days)
      const valid = drafts.filter(d => Date.now() - d.updatedAt < 30 * 24 * 60 * 60 * 1000);
      return valid;
    }
    // Migrate from legacy single-draft
    const legacyStored = localStorage.getItem(STORAGE_KEY);
    if (legacyStored) {
      const parsed = JSON.parse(legacyStored) as OrderDraft;
      if (Date.now() - parsed.updatedAt < 30 * 24 * 60 * 60 * 1000) {
        const migrated = { ...parsed, id: parsed.id || generateDraftId(), createdAt: parsed.createdAt || parsed.updatedAt };
        localStorage.setItem(MULTI_STORAGE_KEY, JSON.stringify([migrated]));
        localStorage.removeItem(STORAGE_KEY);
        return [migrated];
      }
    }
  } catch {
    // ignore parse errors
  }
  return [];
}

function saveAllDrafts(drafts: OrderDraft[]) {
  try {
    localStorage.setItem(MULTI_STORAGE_KEY, JSON.stringify(drafts));
    // Also keep legacy key for backwards compat (active draft)
    if (drafts.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts[0]));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // localStorage full
  }
}

export function OrderDraftProvider({ children }: { children: ReactNode }) {
  const [allDrafts, setAllDrafts] = useState<OrderDraft[]>(() => loadAllDrafts());
  const [activeDraftId, setActiveDraftIdState] = useState<string | null>(() => {
    const drafts = loadAllDrafts();
    return drafts.length > 0 ? drafts[0].id : null;
  });

  // Active draft (the one currently being edited)
  const draft = allDrafts.find(d => d.id === activeDraftId) || allDrafts[0] || null;
  const hasDraft = allDrafts.length > 0 && allDrafts.some(d => d.items.length > 0);

  const saveDraft = useCallback((newDraft: OrderDraft) => {
    const draftWithMeta = {
      ...newDraft,
      id: newDraft.id || activeDraftId || generateDraftId(),
      updatedAt: Date.now(),
      createdAt: newDraft.createdAt || Date.now(),
    };
    setAllDrafts(prev => {
      const idx = prev.findIndex(d => d.id === draftWithMeta.id);
      let updated: OrderDraft[];
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = draftWithMeta;
      } else {
        updated = [draftWithMeta, ...prev];
      }
      saveAllDrafts(updated);
      return updated;
    });
    setActiveDraftIdState(draftWithMeta.id);
  }, [activeDraftId]);

  const saveDraftById = useCallback((draftData: OrderDraft) => {
    const draftWithMeta = { ...draftData, updatedAt: Date.now(), createdAt: draftData.createdAt || Date.now() };
    setAllDrafts(prev => {
      const idx = prev.findIndex(d => d.id === draftWithMeta.id);
      let updated: OrderDraft[];
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = draftWithMeta;
      } else {
        updated = [draftWithMeta, ...prev];
      }
      saveAllDrafts(updated);
      return updated;
    });
  }, []);

  const clearDraft = useCallback(() => {
    if (activeDraftId) {
      setAllDrafts(prev => {
        const updated = prev.filter(d => d.id !== activeDraftId);
        saveAllDrafts(updated);
        return updated;
      });
    }
    setActiveDraftIdState(null);
  }, [activeDraftId]);

  const removeDraft = useCallback((id: string) => {
    setAllDrafts(prev => {
      const updated = prev.filter(d => d.id !== id);
      saveAllDrafts(updated);
      return updated;
    });
    if (activeDraftId === id) {
      setActiveDraftIdState(null);
    }
  }, [activeDraftId]);

  const setActiveDraft = useCallback((id: string) => {
    setActiveDraftIdState(id);
  }, []);

  const createNewDraft = useCallback((sellerId: number, sellerName: string): string => {
    const newId = generateDraftId();
    const newDraft: OrderDraft = {
      id: newId,
      sellerId,
      sellerName,
      step: "cliente",
      items: [],
      client: null,
      observacoes: "",
      formaPagamento: "",
      meioPagamento: "",
      condicaoPagamento: "",
      updatedAt: Date.now(),
      createdAt: Date.now(),
    };
    setAllDrafts(prev => {
      const updated = [newDraft, ...prev];
      saveAllDrafts(updated);
      return updated;
    });
    setActiveDraftIdState(newId);
    return newId;
  }, []);

  return (
    <OrderDraftContext.Provider value={{
      draft, saveDraft, clearDraft, hasDraft,
      allDrafts, saveDraftById, removeDraft, setActiveDraft, createNewDraft, activeDraftId,
    }}>
      {children}
    </OrderDraftContext.Provider>
  );
}

export function useOrderDraft() {
  return useContext(OrderDraftContext);
}
