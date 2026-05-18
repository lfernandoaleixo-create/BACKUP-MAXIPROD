import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { keepPreviousData, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Manter dados anteriores visíveis enquanto novos dados carregam
      // Evita tela branca durante sincronização/refetch
      placeholderData: keepPreviousData,
      // Não mostrar loading spinner em refetch (só no primeiro carregamento)
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Controle de refresh: evita múltiplas tentativas simultâneas de refresh
 * quando vários erros de auth acontecem ao mesmo tempo.
 */
let isRefreshing = false;
let refreshAttempted = false;

const attemptRefreshBeforeRedirect = async () => {
  // Se já tentou refresh nesta "sessão de erros", redireciona direto
  if (refreshAttempted) {
    window.location.href = getLoginUrl();
    return;
  }

  // Se já está fazendo refresh, aguarda
  if (isRefreshing) return;

  isRefreshing = true;
  refreshAttempted = true;

  try {
    // Tenta renovar a sessão silenciosamente
    const response = await fetch("/api/trpc/auth.refreshSession", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({}),
    });

    if (response.ok) {
      const result = await response.json();
      // superjson wraps in { result: { data: { json: ... } } }
      const data = result?.result?.data?.json ?? result?.result?.data ?? result;
      
      if (data?.success) {
        console.log("[Session] Token renovado com sucesso após erro de auth");
        // Refresh bem-sucedido: invalidar todas as queries para refazer com novo token
        refreshAttempted = false;
        queryClient.invalidateQueries();
        isRefreshing = false;
        return;
      }
    }

    // Refresh falhou: redirecionar para login
    console.warn("[Session] Refresh falhou, redirecionando para login");
    window.location.href = getLoginUrl();
  } catch (error) {
    console.error("[Session] Erro ao tentar refresh:", error);
    window.location.href = getLoginUrl();
  } finally {
    isRefreshing = false;
  }
};

// Resetar flag de tentativa a cada 5 minutos (permite nova tentativa após um tempo)
setInterval(() => {
  refreshAttempted = false;
}, 5 * 60 * 1000);

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  // Tentar refresh antes de redirecionar para login
  attemptRefreshBeforeRedirect();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
