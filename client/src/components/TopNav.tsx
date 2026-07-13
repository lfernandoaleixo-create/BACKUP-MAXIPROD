/**
 * TopNav - Navegação global unificada do Grupo Fox
 * Componente reutilizável para todas as páginas
 * Inclui controle de acesso por operador
 * Responsivo: desktop = top bar, mobile = bottom tab bar
 */

import { Link, useLocation } from "wouter";
import {
  Package,
  BarChart3,
  Briefcase,
  FileCheck,
  DollarSign,
  Factory,
  Settings,
  LogOut,
  ShieldAlert,
  Sun,
  Moon,
  RefreshCw,
  Ship,
} from "lucide-react";
import { useOperator } from "@/contexts/OperatorContext";
import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "sonner";
import NotificationBell from "@/components/NotificationBell";
import { useDiscountAlerts } from "@/contexts/DiscountAlertContext";
import { useIsMobile } from "@/hooks/useMobile";
import { trpc } from "@/lib/trpc";

const navItems = [
  { href: "/", label: "Estoque", icon: Package, section: "estoque" },
  { href: "/vendas", label: "Vendas", icon: BarChart3, section: "vendas" },
  { href: "/gestao-comercial", label: "Gestão", desktopLabel: "Gestão Comercial", icon: Briefcase, section: "gestao-comercial" },
  { href: "/faturamento", label: "Faturamento", icon: FileCheck, section: "faturamento" },
  { href: "/financeiro", label: "Financeiro", icon: DollarSign, section: "financeiro" },
  { href: "/importacao", label: "Import.", desktopLabel: "Importação", icon: Ship, section: "importacao" },
  { href: "/producao", label: "Produção", icon: Factory, section: "producao" },
  { href: "/configuracoes", label: "Config", desktopLabel: "Configuração", icon: Settings, section: "configuracoes" },
];

interface TopNavProps {
  /** Conteúdo extra à direita do nav (ex: data de atualização, filtros) */
  rightContent?: React.ReactNode;
}

export default function TopNav({ rightContent }: TopNavProps) {
  const [location, setLocation] = useLocation();
  const { operator, hasAccess, logout } = useOperator();
  const { theme, toggleTheme } = useTheme();
  const isMobile = useIsMobile();
  let discountAlerts: ReturnType<typeof useDiscountAlerts> | null = null;
  try { discountAlerts = useDiscountAlerts(); } catch { /* not in provider */ }

  // Blink produção tab for Larissa when there are pending stock withdrawal requests
  // Blink logic ready for Larissa - temporarily disabled until she's trained on the workflow
  // To re-enable: change `false &&` to just the condition
  const isLarissa = operator?.name === "Larissa";
  const { data: pendingStockData } = trpc.stockWithdrawal.countPending.useQuery(undefined, {
    enabled: false && isLarissa, // disabled temporarily
    refetchInterval: 15000,
  });
  const hasPendingStock = false && isLarissa && (pendingStockData?.pending ?? 0) > 0;

  // Blink Gestão Comercial tab for gestores (pending approval) and Vitória (pending processing)
  const isGestor = operator?.name === "Juvenal" || operator?.name === "Fernando" || operator?.name === "Guilherme";
  const isVitoria = operator?.name === "Vitoria" || operator?.name === "Vit\u00f3ria";
  const { data: pendingGestorData } = trpc.salesOrders.countPendingGestor.useQuery(undefined, {
    enabled: isGestor,
    refetchInterval: 20000,
  });
  const { data: pendingVitoriaData } = trpc.salesOrders.countPendingVitoria.useQuery(undefined, {
    enabled: isVitoria,
    refetchInterval: 20000,
  });
  const hasGestaoAlert = (isGestor && (pendingGestorData?.pending ?? 0) > 0) || (isVitoria && (pendingVitoriaData?.pending ?? 0) > 0);

  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    return location.startsWith(href);
  };

  const handleNavClick = (e: React.MouseEvent, href: string, section: string, label: string) => {
    if (!hasAccess(section)) {
      e.preventDefault();
      e.stopPropagation();
      toast.error(
        `Acesso negado. ${operator?.name || "Você"} não tem permissão para acessar ${label}.`,
        {
          icon: <ShieldAlert className="w-5 h-5 text-red-500" />,
          duration: 3000,
        }
      );
      return;
    }
    setLocation(href);
  };

  // Mobile: compact top header + fixed bottom nav
  if (isMobile) {
    return (
      <>
        {/* Compact mobile top header */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-700/80 sticky top-0 z-50">
          <div className="px-3 py-0">
            <div className="flex items-center justify-between h-12">
              {/* Logo */}
              <Link href="/">
                <div className="flex items-center cursor-pointer">
                  <img
                    src={theme === "dark" ? "https://d2xsxph8kpxj0f.cloudfront.net/310519663487476806/TMh5HqmzfeBw9KakgJtjjo/grupo-fox-gold-dark-dashbg_cde22bd2.png" : "https://d2xsxph8kpxj0f.cloudfront.net/310519663411930072/4HdUM8rZGtZWDcoLipqmEj/grupo_fox_logo_bw_39ba6f54.png"}
                    alt="Grupo Fox"
                    className="h-9 w-auto object-contain"
                  />
                </div>
              </Link>

              {/* Right: refresh + theme toggle + notification + operator + logout */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if ('serviceWorker' in navigator) {
                      navigator.serviceWorker.getRegistrations().then(regs => {
                        regs.forEach(r => r.unregister());
                      });
                      caches.keys().then(names => names.forEach(n => caches.delete(n)));
                    }
                    setTimeout(() => { window.location.reload(); }, 300);
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if ('serviceWorker' in navigator) {
                      navigator.serviceWorker.getRegistrations().then(regs => {
                        regs.forEach(r => r.unregister());
                      });
                      caches.keys().then(names => names.forEach(n => caches.delete(n)));
                    }
                    setTimeout(() => { window.location.reload(); }, 300);
                  }}
                  className="relative z-10 min-h-[36px] px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 text-teal-600 dark:text-amber-400 bg-teal-50 dark:bg-amber-900/30 border border-teal-200 dark:border-amber-600/40 touch-manipulation transition-all duration-150 active:scale-75 active:bg-teal-200 dark:active:bg-amber-700/50 active:shadow-inner shadow-sm"
                  title="Atualizar última versão"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span className="text-[9px] font-bold leading-tight">Atualizar</span>
                </button>
                {toggleTheme && (
                  <button
                    onClick={toggleTheme}
                    className="flex items-center gap-1 px-1.5 py-1 rounded-md text-slate-500 dark:text-amber-400 hover:text-teal-600 dark:hover:text-amber-300 transition-colors text-[10px] font-medium whitespace-nowrap"
                    title={theme === "dark" ? "Ativar modo claro" : "Ativar modo noturno"}
                  >
                    {theme === "dark" ? <Sun className="w-3 h-3 shrink-0" /> : <Moon className="w-3 h-3 shrink-0" />}
                    <span className="hidden sm:inline">{theme === "dark" ? "Claro" : "Noturno"}</span>
                  </button>
                )}
                {operator && ["Erica", "Maria", "Danubia", "Guilherme"].includes(operator.name) && (
                  <NotificationBell />
                )}
                {operator && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      {operator.name}
                    </span>
                    <button
                      onClick={logout}
                      className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-500 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors shadow-sm"
                      title="Sair do aplicativo"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span className="text-[9px] font-bold leading-tight">Sair</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Fixed bottom navigation bar */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-around h-14 px-0.5">
            {navItems.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              const allowed = hasAccess(item.section);

              const shouldBlinkFinanceiro = item.section === "financeiro" 
                && discountAlerts?.isAlertOperator 
                && discountAlerts.blinkLevel === "financeiro-tab" 
                && discountAlerts.unreadCount > 0;

              const shouldBlinkProducao = item.section === "producao" && hasPendingStock;
              const shouldBlinkGestao = item.section === "gestao-comercial" && hasGestaoAlert;

              const shouldBlink = shouldBlinkFinanceiro || shouldBlinkProducao || shouldBlinkGestao;

              return (
                <button
                  key={item.href}
                  onClick={(e) => {
                    if (shouldBlinkFinanceiro && discountAlerts) {
                      discountAlerts.advanceBlink("financeiro-tab");
                    }
                    handleNavClick(e, item.href, item.section, item.label);
                  }}
                  className={`
                    relative flex flex-col items-center justify-center gap-0.5 px-1 py-1 rounded-lg transition-colors min-w-0 flex-1
                    ${active
                      ? "text-teal-700"
                      : allowed
                        ? "text-slate-400"
                        : "text-slate-200"
                    }
                    ${shouldBlink ? "animate-discount-blink" : ""}
                  `}
                >
                  <Icon className={`w-4.5 h-4.5 shrink-0 ${active ? "text-teal-600" : !allowed ? "text-slate-200" : ""}`} />
                  <span className={`text-[8px] font-medium leading-none whitespace-nowrap ${active ? "text-teal-700 font-semibold" : ""}`}>{item.label}</span>
                  {shouldBlinkProducao && (
                    <span className="absolute top-0 right-0.5 w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                  )}
                  {shouldBlinkGestao && (
                    <span className="absolute top-0 right-0.5 w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                  )}
                  {shouldBlinkFinanceiro && (
                    <span className="absolute top-0 right-0.5 w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  )}
                  {!allowed && (
                    <ShieldAlert className="w-2.5 h-2.5 text-slate-200 absolute top-0 right-0" />
                  )}
                  {active && (
                    <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-teal-600 rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
          {/* Safe area for iPhones with home indicator */}
          <div className="h-[env(safe-area-inset-bottom,0px)] bg-white dark:bg-slate-900" />
        </nav>
      </>
    );
  }

  // Desktop: original top navigation
  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-700/80 sticky top-0 z-50">
      <div className="container py-0">
        <div className="flex items-center justify-between h-12">
          {/* Navigation Tabs */}
          <nav className="flex items-center h-full">
            {navItems.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              const allowed = hasAccess(item.section);

              // Check if this tab should blink for discount alerts or stock withdrawal
              const shouldBlinkFinanceiro = item.section === "financeiro" 
                && discountAlerts?.isAlertOperator 
                && discountAlerts.blinkLevel === "financeiro-tab" 
                && discountAlerts.unreadCount > 0;

              const shouldBlinkProducao = item.section === "producao" && hasPendingStock;
              const shouldBlinkGestao = item.section === "gestao-comercial" && hasGestaoAlert;

              const shouldBlink = shouldBlinkFinanceiro || shouldBlinkProducao || shouldBlinkGestao;

              return (
                <button
                  key={item.href}
                  onClick={(e) => {
                    // Advance blink cascading when clicking the blinking Financeiro tab
                    if (shouldBlinkFinanceiro && discountAlerts) {
                      discountAlerts.advanceBlink("financeiro-tab");
                    }
                    handleNavClick(e, item.href, item.section, item.label);
                  }}
                  className={`
                    relative flex items-center gap-1.5 px-2.5 h-12 text-xs font-medium transition-colors whitespace-nowrap
                    ${active
                      ? "text-teal-700"
                      : allowed
                        ? "text-slate-500 hover:text-slate-800"
                        : "text-slate-300 hover:text-slate-400"
                    }
                    ${shouldBlink ? "animate-discount-blink" : ""}
                  `}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${active ? "text-teal-600" : !allowed ? "text-slate-300" : ""}`} />
                  <span className="hidden sm:inline">{'desktopLabel' in item && item.desktopLabel ? item.desktopLabel : item.label}</span>
                  {/* Stock withdrawal pending indicator dot (violet for Larissa) */}
                  {shouldBlinkProducao && (
                    <span className="absolute -top-0.5 right-1 w-2.5 h-2.5 rounded-full bg-violet-500 animate-pulse shadow-[0_0_6px_rgba(139,92,246,0.6)]" />
                  )}
                  {/* Gestão Comercial alert indicator dot (teal for gestores/Vitória) */}
                  {shouldBlinkGestao && (
                    <span className="absolute -top-0.5 right-1 w-2.5 h-2.5 rounded-full bg-teal-500 animate-pulse shadow-[0_0_6px_rgba(20,184,166,0.6)]" />
                  )}
                  {/* Discount alert indicator dot */}
                  {shouldBlinkFinanceiro && (
                    <span className="absolute -top-0.5 right-1 w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_6px_rgba(245,158,11,0.6)]" />
                  )}
                  {/* Lock indicator for no-access tabs */}
                  {!allowed && (
                    <ShieldAlert className="w-3 h-3 text-slate-300 absolute top-3 right-1" />
                  )}
                  {/* Active indicator bar */}
                  {active && (
                    <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-teal-600 rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right: refresh + notification bell + operator info + logout */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if ('serviceWorker' in navigator) {
                  navigator.serviceWorker.getRegistrations().then(regs => {
                    regs.forEach(r => r.unregister());
                  });
                  caches.keys().then(names => names.forEach(n => caches.delete(n)));
                }
                setTimeout(() => { window.location.reload(); }, 300);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-teal-600 dark:text-amber-400 bg-teal-50 dark:bg-amber-900/30 border border-teal-200 dark:border-amber-600/40 hover:bg-teal-100 dark:hover:bg-amber-800/40 transition-all duration-150 active:scale-75 active:shadow-inner shadow-sm"
              title="Atualizar última versão"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="text-[10px] font-bold">Atualizar</span>
            </button>
            {operator && ["Erica", "Maria", "Danubia", "Guilherme"].includes(operator.name) && (
              <NotificationBell />
            )}
            {operator && (
              <div className="flex items-center gap-2 ml-2">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium hidden sm:inline">
                  {operator.name}
                </span>
                <button
                  onClick={logout}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-500 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors shadow-sm"
                  title="Sair do aplicativo"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="text-[10px] font-bold">Sair</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
