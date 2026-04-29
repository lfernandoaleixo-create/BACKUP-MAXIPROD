/**
 * TopNav - Navegação global unificada do Grupo Fox
 * Componente reutilizável para todas as páginas
 * Inclui controle de acesso por operador
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
} from "lucide-react";
import { useOperator } from "@/contexts/OperatorContext";
import { toast } from "sonner";
import NotificationBell from "@/components/NotificationBell";
import { useDiscountAlerts } from "@/contexts/DiscountAlertContext";

const navItems = [
  { href: "/", label: "Estoque", icon: Package, section: "estoque" },
  { href: "/vendas", label: "Vendas", icon: BarChart3, section: "vendas" },
  { href: "/faturamento", label: "Faturamento", icon: FileCheck, section: "faturamento" },
  { href: "/financeiro", label: "Financeiro", icon: DollarSign, section: "financeiro" },
  { href: "/producao", label: "Produção", icon: Factory, section: "producao" },
  { href: "/configuracoes", label: "Configurações", icon: Settings, section: "configuracoes" },
];

interface TopNavProps {
  /** Conteúdo extra à direita do nav (ex: data de atualização, filtros) */
  rightContent?: React.ReactNode;
}

export default function TopNav({ rightContent }: TopNavProps) {
  const [location, setLocation] = useLocation();
  const { operator, hasAccess, logout } = useOperator();
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

  return (
    <header className="bg-white border-b border-slate-200/80 sticky top-0 z-50">
      <div className="container py-0">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Brand */}
          <Link href="/">
            <div className="flex items-center cursor-pointer group">
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/310519663411930072/4HdUM8rZGtZWDcoLipqmEj/grupo_fox_logo_bw_39ba6f54.png"
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

          {/* Right content: notification bell + operator info + logout */}
          <div className="flex items-center gap-3">
            {rightContent}
            {operator && ["Erica", "Maria", "Marcos", "Guilherme"].includes(operator.name) && (
              <NotificationBell />
            )}
            {operator && (
              <div className="flex items-center gap-2 ml-2">
                <span className="text-xs text-slate-500 font-medium hidden sm:inline">
                  {operator.name}
                </span>
                <button
                  onClick={logout}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
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
