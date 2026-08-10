import { ConsultaMetrics } from "@/components/ConsultaMetrics";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function MetricasConsultas() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-teal-50/30 dark:from-slate-900 dark:to-slate-800 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/gestao-comercial">
            <button className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
              <ArrowLeft className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            </button>
          </Link>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Métricas de Consultas</h1>
        </div>
        <ConsultaMetrics />
      </div>
    </div>
  );
}
