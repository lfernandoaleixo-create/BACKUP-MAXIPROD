import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { OperatorProvider, useOperator } from "./contexts/OperatorContext";
import LoginScreen from "./components/LoginScreen";
import Home from "./pages/Home";
import Sales from "./pages/Sales";
import Billing from "./pages/Billing";
import Financial from "./pages/Financial";
import RelatorioInadimplentes from "./pages/RelatorioInadimplentes";
import SettingsPage from "./pages/SettingsPage";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/vendas"} component={Sales} />
      <Route path={"/faturamento"} component={Billing} />
      <Route path={"/financeiro"} component={Financial} />
      <Route path={"/relatorio-inadimplentes"} component={RelatorioInadimplentes} />
      <Route path={"/configuracoes"} component={SettingsPage} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { isLoggedIn } = useOperator();

  if (!isLoggedIn) {
    return <LoginScreen />;
  }

  return <Router />;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
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
