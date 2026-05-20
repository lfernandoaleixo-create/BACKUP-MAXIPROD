import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { OperatorProvider, useOperator } from "./contexts/OperatorContext";
import { DiscountAlertProvider } from "./contexts/DiscountAlertContext";
import { useSessionRefresh } from "./hooks/useSessionRefresh";
import LoginScreen from "./components/LoginScreen";
import Home from "./pages/Home";
import Sales from "./pages/Sales";
import Billing from "./pages/Billing";
import Financial from "./pages/Financial";
import Production from "./pages/Production";
import SettingsPage from "./pages/SettingsPage";
import SellerApp from "./pages/SellerApp";
import GestaoComercial from "./pages/GestaoComercial";
import VendedorDetalhe from "./pages/VendedorDetalhe";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/vendas"} component={Sales} />
      <Route path={"/gestao-comercial"} component={GestaoComercial} />
      <Route path={"/gestao-comercial/vendedor/:sellerId"} component={VendedorDetalhe} />
      <Route path={"/faturamento"} component={Billing} />
      <Route path={"/financeiro"} component={Financial} />
      <Route path={"/producao"} component={Production} />
      <Route path={"/configuracoes"} component={SettingsPage} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
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

  // Rota do app de vendedor para gestores (Guilherme/Fernando) - acesso completo sem senha de vendedor
  if (typeof window !== "undefined" && window.location.pathname === "/vendedor-gestor") {
    if (isLoggedIn) {
      return <SellerApp gestorMode={true} />;
    }
    return <LoginScreen />;
  }

  if (!isLoggedIn) {
    return <LoginScreen />;
  }

  return (
    <DiscountAlertProvider>
      <Router />
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
