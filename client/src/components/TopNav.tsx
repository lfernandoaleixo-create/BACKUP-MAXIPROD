/**
 * TopNav - Navegação global unificada do Grupo Fox
 * Componente reutilizável para todas as páginas
 */

import { Link, useLocation } from "wouter";
import {
  Package,
  BarChart3,
  DollarSign,
  Settings,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Estoque", icon: Package },
  { href: "/vendas", label: "Vendas", icon: BarChart3 },
  { href: "/financeiro", label: "Financeiro", icon: DollarSign },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

interface TopNavProps {
  /** Conteúdo extra à direita do nav (ex: data de atualização, filtros) */
  rightContent?: React.ReactNode;
}

export default function TopNav({ rightContent }: TopNavProps) {
  const [location] = useLocation();

  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    return location.startsWith(href);
  };

  return (
    <header className="bg-white border-b border-slate-200/80 sticky top-0 z-50">
      <div className="container py-0">
        <div className="flex items-center justify-between h-14">
          {/* Logo / Brand */}
          <Link href="/">
            <div className="flex items-center gap-2.5 cursor-pointer group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                <span className="text-white font-bold text-sm" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>F</span>
              </div>
              <span className="text-lg font-bold text-slate-800 tracking-tight hidden sm:block" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                Grupo Fox
              </span>
            </div>
          </Link>

          {/* Navigation Tabs */}
          <nav className="flex items-center h-full">
            {navItems.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}>
                  <button
                    className={`
                      relative flex items-center gap-2 px-4 h-14 text-sm font-medium transition-colors
                      ${active
                        ? "text-teal-700"
                        : "text-slate-500 hover:text-slate-800"
                      }
                    `}
                  >
                    <Icon className={`w-4 h-4 ${active ? "text-teal-600" : ""}`} />
                    <span className="hidden sm:inline">{item.label}</span>
                    {/* Active indicator bar */}
                    {active && (
                      <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-teal-600 rounded-full" />
                    )}
                  </button>
                </Link>
              );
            })}
          </nav>

          {/* Right content slot */}
          <div className="flex items-center">
            {rightContent}
          </div>
        </div>
      </div>
    </header>
  );
}
