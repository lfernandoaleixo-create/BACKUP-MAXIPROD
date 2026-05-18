import { trpc } from "@/lib/trpc";
import { useEffect, useRef } from "react";

/**
 * Hook que renova automaticamente a sessão do usuário a cada 30 minutos.
 * Também renova ao retornar de inatividade (visibilitychange).
 * Isso evita que o token JWT expire e o usuário seja deslogado inesperadamente.
 */

// Intervalo de refresh: 30 minutos
const REFRESH_INTERVAL_MS = 30 * 60 * 1000;

// Tempo mínimo entre refreshes para evitar chamadas duplicadas: 5 minutos
const MIN_REFRESH_GAP_MS = 5 * 60 * 1000;

export function useSessionRefresh() {
  const lastRefreshRef = useRef<number>(Date.now());
  const refreshMutation = trpc.auth.refreshSession.useMutation();

  const doRefresh = () => {
    const now = Date.now();
    // Evitar refresh muito frequente
    if (now - lastRefreshRef.current < MIN_REFRESH_GAP_MS) {
      return;
    }
    lastRefreshRef.current = now;
    
    refreshMutation.mutate(undefined, {
      onSuccess: (data) => {
        if (data.success) {
          console.log("[Session] Token renovado com sucesso");
        } else {
          console.warn("[Session] Falha ao renovar token:", data.reason);
        }
      },
      onError: (error) => {
        console.warn("[Session] Erro ao renovar token:", error.message);
      },
    });
  };

  useEffect(() => {
    // Refresh periódico a cada 30 minutos
    const intervalId = setInterval(doRefresh, REFRESH_INTERVAL_MS);

    // Refresh quando a aba volta a ficar visível (usuário voltou após inatividade)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        doRefresh();
      }
    };

    // Refresh quando a janela ganha foco (usuário voltou de outra aba)
    const handleFocus = () => {
      doRefresh();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    // Fazer um refresh inicial após 1 minuto (para renovar tokens antigos)
    const initialTimeout = setTimeout(doRefresh, 60 * 1000);

    return () => {
      clearInterval(intervalId);
      clearTimeout(initialTimeout);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
