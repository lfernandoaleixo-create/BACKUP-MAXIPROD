/**
 * Gestão Comercial - Página placeholder
 * Conteúdo será definido posteriormente pelo usuário
 */

import TopNav from "@/components/TopNav";
import { Briefcase } from "lucide-react";

export default function GestaoComercial() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
      <TopNav />

      <main className="container py-8 md:py-12 pb-20 md:pb-12">
        <div className="flex flex-col items-center justify-center text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center mb-6">
            <Briefcase className="w-8 h-8 text-teal-600 dark:text-teal-400" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100 mb-3">
            Gestão Comercial
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm md:text-base max-w-md">
            Esta seção está em construção. Em breve, novas funcionalidades estarão disponíveis aqui.
          </p>
        </div>
      </main>
    </div>
  );
}
