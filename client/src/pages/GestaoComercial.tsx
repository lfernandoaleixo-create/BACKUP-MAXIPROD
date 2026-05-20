/**
 * Gestão Comercial - Cadastro de Vendedores e gestão comercial
 * Conteúdo migrado da aba Vendas
 */

import TopNav from "@/components/TopNav";
import CadastroVendedoresTab from "@/components/CadastroVendedoresTab";

export default function GestaoComercial() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
      <TopNav />

      <main className="container py-4 md:py-6 space-y-4 md:space-y-5 pb-20 md:pb-6">
        <CadastroVendedoresTab />
      </main>
    </div>
  );
}
