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
  FileCheck,
  DollarSign,
  Factory,
  Settings,
  LogOut,
  ShieldAlert,
  Sun,
  Moon,
} from "lucide-react";
import { useOperator } from "@/contexts/OperatorContext";
import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "sonner";
import NotificationBell from "@/components/NotificationBell";
import { useDiscountAlerts } from "@/contexts/DiscountAlertContext";
import { useIsMobile } from "@/hooks/useMobile";

const navItems = [
  { href: "/", label: "Estoque", icon: Package, section: "estoque" },
  { href: "/vendas", label: "Vendas", icon: BarChart3, section: "vendas" },
  { href: "/faturamento", label: "Faturamento", icon: FileCheck, section: "faturamento" },
  { href: "/financeiro", label: "Financeiro", icon: DollarSign, section: "financeiro" },
  { href: "/producao", label: "Produção", icon: Factory, section: "producao" },
  { href: "/configuracoes", label: "Config", icon: Settings, section: "configuracoes" },
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
                    src={theme === "dark" ? "https://d2xsxph8kpxj0f.cloudfront.net/310519663487476806/TMh5HqmzfeBw9KakgJtjjo/grupo-fox-gold-header_b639cb4a.jpg" : "https://d2xsxph8kpxj0f.cloudfront.net/310519663411930072/4HdUM8rZGtZWDcoLipqmEj/grupo_fox_logo_bw_39ba6f54.png"}
                    alt="Grupo Fox"
                    className="h-9 w-auto object-contain"
                  />
                </div>
              </Link>

              {/* Right: theme toggle + notification + operator + logout */}
              <div className="flex items-center gap-2">
                {rightContent}
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
                {operator && ["Erica", "Maria", "Marcos", "Guilherme"].includes(operator.name) && (
                  <NotificationBell />
                )}
                {operator && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      {operator.name}
                    </span>
                    <button
                      onClick={logout}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 dark:text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                      title="Sair"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Fixed bottom navigation bar */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-around h-14 px-1">
            {navItems.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              const allowed = hasAccess(item.section);

              const shouldBlink = item.section === "financeiro" 
                && discountAlerts?.isAlertOperator 
                && discountAlerts.blinkLevel === "financeiro-tab" 
                && discountAlerts.unreadCount > 0;

              return (
                <button
                  key={item.href}
                  onClick={(e) => {
                    if (shouldBlink && discountAlerts) {
                      discountAlerts.advanceBlink("financeiro-tab");
                    }
                    handleNavClick(e, item.href, item.section, item.label);
                  }}
                  className={`
                    relative flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-lg transition-colors min-w-[48px]
                    ${active
                      ? "text-teal-700"
                      : allowed
                        ? "text-slate-400"
                        : "text-slate-200"
                    }
                    ${shouldBlink ? "animate-discount-blink" : ""}
                  `}
                >
                  <Icon className={`w-5 h-5 ${active ? "text-teal-600" : !allowed ? "text-slate-200" : ""}`} />
                  <span className={`text-[9px] font-medium leading-none ${active ? "text-teal-700 font-semibold" : ""}`}>{item.label}</span>
                  {shouldBlink && (
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
        <div className="flex items-center justify-between h-16">
          {/* Logo / Brand */}
          <Link href="/">
            <div className="flex items-center cursor-pointer group">
              <img
                src={theme === "dark" ? "https://d2xsxph8kpxj0f.cloudfront.net/310519663487476806/TMh5HqmzfeBw9KakgJtjjo/grupo-fox-gold-header_b639cb4a.jpg" : "https://d2xsxph8kpxj0f.cloudfront.net/310519663411930072/4HdUM8rZGtZWDcoLipqmEj/grupo_fox_logo_bw_39ba6f54.png"}
                alt="Grupo Fox"
                className="h-12 w-auto object-contain group-hover:opacity-80 transition-opacity"
              />
            </div>
          </Link>

          {/* Navigation Tabs */}
          <nav className="flex items-center h-full">
            {navItems.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              const allowed = hasAccess(item.section);

              // Check if this tab should blink for discount alerts
              const shouldBlink = item.section === "financeiro" 
                && discountAlerts?.isAlertOperator 
                && discountAlerts.blinkLevel === "financeiro-tab" 
                && discountAlerts.unreadCount > 0;

              return (
                <button
                  key={item.href}
                  onClick={(e) => {
                    // Advance blink cascading when clicking the blinking Financeiro tab
                    if (shouldBlink && discountAlerts) {
                      discountAlerts.advanceBlink("financeiro-tab");
                    }
                    handleNavClick(e, item.href, item.section, item.label);
                  }}
                  className={`
                    relative flex items-center gap-2 px-4 h-16 text-sm font-medium transition-colors
                    ${active
                      ? "text-teal-700"
                      : allowed
                        ? "text-slate-500 hover:text-slate-800"
                        : "text-slate-300 hover:text-slate-400"
                    }
                    ${shouldBlink ? "animate-discount-blink" : ""}
                  `}
                >
                  <Icon className={`w-4 h-4 ${active ? "text-teal-600" : !allowed ? "text-slate-300" : ""}`} />
                  <span className="hidden sm:inline">{item.label}</span>
                  {/* Discount alert indicator dot */}
                  {shouldBlink && (
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

          {/* Right content: theme toggle + notification bell + operator info + logout */}
          <div className="flex items-center gap-3">
            {rightContent}
            {toggleTheme && (
              <button
                onClick={toggleTheme}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-slate-500 dark:text-amber-400 hover:text-teal-600 dark:hover:text-amber-300 transition-colors text-[11px] font-medium whitespace-nowrap"
                title={theme === "dark" ? "Ativar modo claro" : "Ativar modo noturno"}
              >
                {theme === "dark" ? <Sun className="w-3.5 h-3.5 shrink-0" /> : <Moon className="w-3.5 h-3.5 shrink-0" />}
                <span>{theme === "dark" ? "Modo claro" : "Modo noturno"}</span>
              </button>
            )}
            {operator && ["Erica", "Maria", "Marcos", "Guilherme"].includes(operator.name) && (
              <NotificationBell />
            )}
            {operator && (
              <div className="flex items-center gap-2 ml-2">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium hidden sm:inline">
                  {operator.name}
                </span>
                <button
                  onClick={logout}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 dark:text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                  title="Sair"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
