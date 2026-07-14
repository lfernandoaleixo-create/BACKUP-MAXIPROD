import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { OperatorProvider, useOperator } from "./contexts/OperatorContext";
import { DiscountAlertProvider } from "./contexts/DiscountAlertContext";
import { useSessionRefresh } from "./hooks/useSessionRefresh";
import { useTheme } from "./contexts/ThemeContext";
import { Sun, Moon } from "lucide-react";
import LoginScreen from "./components/LoginScreen";
import Home from "./pages/Home";
import Sales from "./pages/Sales";
import Billing from "./pages/Billing";
import Financial from "./pages/Financial";
import Production from "./pages/Production";
import SettingsPage from "./pages/SettingsPage";
import SellerApp from "./pages/SellerApp";
import GestaoComercial, { GestaoComercialFull } from "./pages/GestaoComercial";
import VendedorDetalhe from "./pages/VendedorDetalhe";
import Importacao from "./pages/Importacao";
import GestorAprovacoes from "./pages/GestorAprovacoes";
import VitoriaOrders from "./pages/VitoriaOrders";
import CadastroClientes from "./pages/CadastroClientes";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/vendedor-gestor"}>{() => <SellerApp gestorMode={true} />}</Route>
      <Route path={"/vendas"} component={Sales} />
      <Route path={"/gestao-comercial"} component={GestaoComercial} />
      <Route path={"/gestao-comercial/painel-gestores"} component={GestaoComercialFull} />
      <Route path={"/gestao-comercial/vendedor/:sellerId"} component={VendedorDetalhe} />
      <Route path={"/gestao-comercial/aprovacoes"} component={GestorAprovacoes} />
      <Route path={"/gestao-comercial/pedidos-operador"} component={VitoriaOrders} />
      <Route path={"/gestao-comercial/cadastro-clientes"} component={CadastroClientes} />
      <Route path={"/faturamento"} component={Billing} />
      <Route path={"/financeiro"} component={Financial} />
      <Route path={"/importacao"} component={Importacao} />
      <Route path={"/producao"} component={Production} />
      <Route path={"/configuracoes"} component={SettingsPage} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function FloatingThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-[60] flex items-center gap-2 px-3 py-2 rounded-full bg-white dark:bg-slate-800 border border-teal-200 dark:border-amber-600/40 shadow-lg hover:shadow-xl text-slate-600 dark:text-amber-400 hover:text-teal-600 dark:hover:text-amber-300 transition-all text-xs font-medium"
      title={theme === "dark" ? "Ativar modo claro" : "Ativar modo noturno"}
    >
      {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      <span className="hidden md:inline">{theme === "dark" ? "Modo claro" : "Modo noturno"}</span>
    </button>
  );
}

function AppContent() {
  const { isLoggedIn } = useOperator();

  // Refresh automático da sessão OAuth (renova token a cada 30min e ao voltar de inatividade)
  useSessionRefresh();

  // Rota pública do app de vendedor (não precisa de login de operador)
  if (typeof window !== "undefined" && window.location.pathname === "/vendedor") {
    return <SellerApp />;
  }

  if (!isLoggedIn) {
    return <LoginScreen />;
  }

  return (
    <DiscountAlertProvider>
      <Router />
      <FloatingThemeToggle />
    </DiscountAlertProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <OperatorProvider>
          <TooltipProvider>
            <Toaster />
            <AppContent />
          </TooltipProvider>
        </OperatorProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
