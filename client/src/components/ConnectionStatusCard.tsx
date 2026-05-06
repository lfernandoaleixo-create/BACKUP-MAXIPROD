/**
 * ConnectionStatusCard - Card de status de conexão com o Maxiprod
 * Componente reutilizável para todas as páginas
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

function timeAgo(dateStr: string | Date): string {
  const now = new Date();
  const past = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  const diffMs = now.getTime() - past.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}min atras`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h atras`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d atras`;
}

export default function ConnectionStatusCard() {
  const { data: status, isLoading } = trpc.dashboard.getStatus.useQuery(undefined, {
    refetchInterval: 15000,
  });
  const forceSync = trpc.dashboard.forceSync.useMutation();
  const utils = trpc.useUtils();
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSync = async () => {
    setSyncResult(null);
    try {
      const result = await forceSync.mutateAsync();
      setSyncResult({ success: result.success, message: result.message });
      utils.dashboard.getStatus.invalidate();
      utils.dashboard.getData.invalidate();
      utils.sales.getAnalytics.invalidate();
      setTimeout(() => setSyncResult(null), 5000);
    } catch (err: any) {
      setSyncResult({ success: false, message: err.message || "Erro desconhecido" });
      setTimeout(() => setSyncResult(null), 5000);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3 shadow-sm animate-pulse">
        <div className="h-6 bg-slate-100 dark:bg-slate-700 rounded w-48" />
      </div>
    );
  }

  const isConnected = status?.isConnected ?? false;
  const isSyncing = forceSync.isPending;

  return (
    <div className={`rounded-lg border p-2.5 md:p-3 shadow-sm ${
      isConnected ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700" : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
    }`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <div className={`w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center shrink-0 ${
            isSyncing ? "bg-blue-500 animate-pulse" : isConnected ? "bg-emerald-500" : "bg-slate-400"
          }`}>
            {isSyncing ? <Loader2 className="w-3.5 h-3.5 md:w-4 md:h-4 text-white animate-spin" /> : isConnected ? <Wifi className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" /> : <WifiOff className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />}
          </div>
          <div className="min-w-0">
            <p className={`text-xs md:text-sm font-semibold ${
              isSyncing ? "text-blue-800 dark:text-blue-300" : isConnected ? "text-emerald-800 dark:text-emerald-300" : "text-slate-600 dark:text-slate-300"
            }`}>
              {isSyncing ? "Sincronizando..." : isConnected ? "Conectado ao Maxiprod" : "Aguardando sincronizacao"}
            </p>
            <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 truncate">
              {isSyncing ? (
                "Buscando dados via API GraphQL..."
              ) : status?.lastSyncAt ? (
                <>
                  {timeAgo(status.lastSyncAt)}
                  {status?.lastSyncStatus && status.lastSyncStatus !== "error" && (
                    <span className="ml-1 text-slate-400">({status.lastSyncStatus})</span>
                  )}
                </>
              ) : (
                "Clique em Sincronizar"
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
          {syncResult && (
            <span className={`text-[10px] md:text-xs flex items-center gap-1 ${
              syncResult.success ? "text-emerald-600" : "text-red-600"
            }`}>
              {syncResult.success ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
              <span className="hidden md:inline">{syncResult.success ? "Sincronizado!" : "Erro"}</span>
            </span>
          )}
          <Button
            variant={isConnected ? "outline" : "default"}
            size="sm"
            onClick={handleSync}
            disabled={isSyncing}
            className={`text-[10px] md:text-xs px-2 md:px-3 h-7 md:h-8 ${!isConnected ? "bg-teal-600 hover:bg-teal-700 text-white" : ""}`}
          >
            {isSyncing ? (
              <><Loader2 className="w-3 h-3 animate-spin mr-0.5 md:mr-1" /> <span className="hidden md:inline">Sincronizando...</span><span className="md:hidden">Sync...</span></>
            ) : (
              <><RefreshCw className="w-3 h-3 mr-0.5 md:mr-1" /> Sincronizar</>
            )}
          </Button>
        </div>
      </div>
      {syncResult && !syncResult.success && (
        <p className="text-[10px] md:text-xs text-red-500 mt-2 pl-9 md:pl-11">{syncResult.message}</p>
      )}
    </div>
  );
}
