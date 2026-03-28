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
      <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm animate-pulse">
        <div className="h-6 bg-slate-100 rounded w-48" />
      </div>
    );
  }

  const isConnected = status?.isConnected ?? false;
  const isSyncing = forceSync.isPending;

  return (
    <div className={`rounded-lg border p-3 shadow-sm ${
      isConnected ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            isSyncing ? "bg-blue-500 animate-pulse" : isConnected ? "bg-emerald-500" : "bg-slate-400"
          }`}>
            {isSyncing ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : isConnected ? <Wifi className="w-4 h-4 text-white" /> : <WifiOff className="w-4 h-4 text-white" />}
          </div>
          <div>
            <p className={`text-sm font-semibold ${
              isSyncing ? "text-blue-800" : isConnected ? "text-emerald-800" : "text-slate-600"
            }`}>
              {isSyncing ? "Sincronizando com Maxiprod..." : isConnected ? "Conectado ao Maxiprod" : "Aguardando sincronizacao"}
            </p>
            <p className="text-xs text-slate-500">
              {isSyncing ? (
                "Buscando dados via API GraphQL..."
              ) : status?.lastSyncAt ? (
                <>
                  Ultima atualizacao: {timeAgo(status.lastSyncAt)}
                  {status?.lastSyncStatus && status.lastSyncStatus !== "error" && (
                    <span className="ml-2 text-slate-400">({status.lastSyncStatus})</span>
                  )}
                </>
              ) : (
                "Nenhuma sincronizacao realizada — clique em Sincronizar"
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {syncResult && (
            <span className={`text-xs flex items-center gap-1 ${
              syncResult.success ? "text-emerald-600" : "text-red-600"
            }`}>
              {syncResult.success ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
              {syncResult.success ? "Sincronizado!" : "Erro"}
            </span>
          )}
          <Button
            variant={isConnected ? "outline" : "default"}
            size="sm"
            onClick={handleSync}
            disabled={isSyncing}
            className={`text-xs ${!isConnected ? "bg-teal-600 hover:bg-teal-700 text-white" : ""}`}
          >
            {isSyncing ? (
              <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Sincronizando...</>
            ) : (
              <><RefreshCw className="w-3 h-3 mr-1" /> Sincronizar</>
            )}
          </Button>
        </div>
      </div>
      {syncResult && !syncResult.success && (
        <p className="text-xs text-red-500 mt-2 pl-11">{syncResult.message}</p>
      )}
    </div>
  );
}
