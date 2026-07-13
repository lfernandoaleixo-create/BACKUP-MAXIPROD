/**
 * NotificationBell - Sininho de notificações no canto superior direito
 * Mostra badge com contador de não-lidas, dropdown com histórico completo
 * Pisca quando há notificações não lidas para o operador logado.
 * Leitura independente por operador.
 */

import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useOperator } from "@/contexts/OperatorContext";
import {
  Bell,
  CheckCheck,
  AlertTriangle,
  Info,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
  Package,
  FileWarning,
  KeyRound,
  RefreshCw,
  ShoppingCart,
  MessageSquare,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const SEVERITY_CONFIG = {
  info: {
    icon: Info,
    bg: "bg-blue-50",
    border: "border-blue-200",
    iconColor: "text-blue-500",
    dot: "bg-blue-500",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-amber-50",
    border: "border-amber-200",
    iconColor: "text-amber-500",
    dot: "bg-amber-500",
  },
  error: {
    icon: AlertCircle,
    bg: "bg-red-50",
    border: "border-red-200",
    iconColor: "text-red-500",
    dot: "bg-red-500",
  },
  success: {
    icon: CheckCircle2,
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    iconColor: "text-emerald-500",
    dot: "bg-emerald-500",
  },
};

const TYPE_ICONS: Record<string, typeof Bell> = {
  novo_pedido: ShoppingCart,
  pedido_modificado: Package,
  observacao_alterada: MessageSquare,
  campo_obrigatorio: FileWarning,
  senha_invalida: KeyRound,
  sync_erro: RefreshCw,
  alerta_estoque: Package,
  cobranca_documento: FileText,
};

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}min`;
  if (diffHour < 24) return `${diffHour}h`;
  if (diffDay < 7) return `${diffDay}d`;
  return new Date(date).toLocaleDateString("pt-BR");
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { operator } = useOperator();
  const operatorId = operator?.id;

  // Sininho visível para todos os operadores logados
  if (!operator) {
    return null;
  }

  const operatorName = operator?.name;

  // Poll unread count every 15 seconds - per operator (with name-based type filtering)
  const { data: countData } = trpc.notifications.unreadCount.useQuery(
    operatorId ? { operatorId, operatorName } : undefined,
    { refetchInterval: 15000 }
  );

  // Fetch full list when dropdown opens - per operator (with name-based type filtering)
  const { data: listData, isLoading, refetch } = trpc.notifications.list.useQuery(
    { limit: 100, operatorId, operatorName },
    { enabled: open }
  );

  const utils = trpc.useUtils();

  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => {
      refetch();
      utils.notifications.unreadCount.invalidate();
    },
  });

  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      refetch();
      utils.notifications.unreadCount.invalidate();
    },
  });

  const unreadCount = countData?.count ?? 0;
  const notifications = listData?.notifications ?? [];

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button - pisca quando tem notificações não lidas */}
      <button
        onClick={() => setOpen(!open)}
        className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
          open
            ? "bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300"
            : unreadCount > 0
              ? "text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30"
              : "text-slate-400 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-200"
        }`}
        title={unreadCount > 0 ? `${unreadCount} notificações não lidas` : "Notificações"}
      >
        <Bell className={`w-5 h-5 ${unreadCount > 0 ? "animate-bell-ring" : ""}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 shadow-sm animate-pulse">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <>
        {/* Mobile backdrop */}
        <div className="fixed inset-0 bg-black/20 z-[99] md:hidden" onClick={() => setOpen(false)} />
        <div className="fixed inset-x-0 top-[60px] bottom-0 md:absolute md:inset-auto md:right-0 md:top-full md:mt-2 md:w-96 md:max-h-[70vh] md:rounded-xl md:bottom-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl shadow-slate-200/60 dark:shadow-slate-900/60 z-[100] overflow-hidden flex flex-col rounded-t-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/80">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Notificações</span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">
                  {unreadCount} nova{unreadCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => markAllRead.mutate(operatorId ? { operatorId } : undefined)}
                  disabled={markAllRead.isPending}
                  className="h-7 px-2 text-[11px] text-teal-600 hover:text-teal-800 hover:bg-teal-50"
                >
                  <CheckCheck className="w-3.5 h-3.5 mr-1" />
                  Marcar todas
                </Button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 dark:text-slate-300 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <Bell className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">Nenhuma notificação</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {notifications.map((notif) => {
                  const severity = SEVERITY_CONFIG[notif.severity as keyof typeof SEVERITY_CONFIG] || SEVERITY_CONFIG.info;
                  const TypeIcon = TYPE_ICONS[notif.type] || severity.icon;
                  const isUnread = !notif.readAt;

                  return (
                    <div
                      key={notif.id}
                      onClick={() => {
                        if (isUnread) markRead.mutate({ id: notif.id, operatorId });
                      }}
                      className={`px-4 py-3 transition-colors cursor-pointer ${
                        isUnread
                          ? `${severity.bg} hover:brightness-95`
                          : "bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className={`flex-shrink-0 mt-0.5 w-7 h-7 rounded-full flex items-center justify-center ${
                          isUnread ? `${severity.bg} border ${severity.border}` : "bg-slate-100"
                        }`}>
                          <TypeIcon className={`w-3.5 h-3.5 ${isUnread ? severity.iconColor : "text-slate-400"}`} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-semibold truncate ${isUnread ? "text-slate-800" : "text-slate-500"}`}>
                              {notif.title}
                            </span>
                            {isUnread && (
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${severity.dot}`} />
                            )}
                          </div>
                          <p className={`text-[11px] mt-0.5 leading-relaxed whitespace-pre-line ${isUnread ? "text-slate-600" : "text-slate-400"}`}>
                            {notif.message}
                          </p>
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            {formatTimeAgo(notif.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        </>
      )}
    </div>
  );
}
