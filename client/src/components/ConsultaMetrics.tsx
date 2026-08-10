import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { ChevronDown, ChevronUp, Shield, FileText } from "lucide-react";

export function ConsultaMetrics() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const { data, isLoading } = trpc.salesOrder.getConsultaMetrics.useQuery({ month, year });
  const months = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

  const serasaByOp: Record<string, any[]> = {};
  const sintegraByOp: Record<string, any[]> = {};
  if (data?.serasa) for (const r of data.serasa) { const n = r.operadorName || "Desconhecido"; (serasaByOp[n] ??= []).push(r); }
  if (data?.sintegra) for (const r of data.sintegra) { const n = r.operadorName || "Desconhecido"; (sintegraByOp[n] ??= []).push(r); }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Métricas de Consultas</h2>
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="px-2 py-1 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200">
          {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="px-2 py-1 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200">
          {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      {isLoading && <p className="text-sm text-slate-400">Carregando métricas...</p>}

      {/* SERASA */}
      <Section title="Consultas ao Serasa" icon={<Shield className="w-4 h-4 text-red-500" />} color="red" byOp={serasaByOp} total={data?.serasa?.length || 0} renderRow={(r: any) => (
        <div className="flex items-center justify-between text-[11px] py-1.5 border-b border-slate-100 dark:border-slate-700 last:border-0">
          <div className="flex-1 min-w-0">
            <span className="font-medium text-slate-700 dark:text-slate-200 truncate">{r.clienteNome || "—"}</span>
            <span className="ml-2 text-slate-400">{fmtDoc(r.clienteDocumento)}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {r.aprovado !== null && <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${r.aprovado ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{r.aprovado ? "OK" : "PEND."}</span>}
            <span className="text-slate-400 text-[10px]">{fmtDt(r.createdAt)}</span>
          </div>
        </div>
      )} />

      {/* SINTEGRA */}
      <Section title="Consultas ao Sintegra" icon={<FileText className="w-4 h-4 text-blue-500" />} color="blue" byOp={sintegraByOp} total={data?.sintegra?.length || 0} renderRow={(r: any) => (
        <div className="flex items-center justify-between text-[11px] py-1.5 border-b border-slate-100 dark:border-slate-700 last:border-0">
          <div className="flex-1 min-w-0">
            <span className="font-medium text-slate-700 dark:text-slate-200 truncate">{r.clienteNome || "—"}</span>
            <span className="ml-2 text-slate-400">{fmtDoc(r.clienteDocumento)}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {r.uf && <span className="text-slate-500 text-[10px]">{r.uf}</span>}
            {r.inscricaoEstadual && <span className="text-slate-400 text-[10px]">IE: {r.inscricaoEstadual}</span>}
            <span className="text-slate-400 text-[10px]">{fmtDt(r.createdAt)}</span>
          </div>
        </div>
      )} />
    </div>
  );
}

function Section({ title, icon, color, byOp, total, renderRow }: { title: string; icon: React.ReactNode; color: string; byOp: Record<string, any[]>; total: number; renderRow: (r: any) => React.ReactNode }) {
  const ops = Object.keys(byOp).sort();
  const bg = color === "red" ? "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10" : "border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10";
  return (
    <div className={`rounded-xl border p-4 ${bg}`}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">{title}</h3>
        <span className="ml-auto text-xs text-slate-400 font-medium">{total} consulta(s) no período</span>
      </div>
      {ops.length === 0 && <p className="text-xs text-slate-400 italic">Nenhuma consulta neste período.</p>}
      <div className="space-y-2">
        {ops.map(op => <OpCard key={op} name={op} rows={byOp[op]} renderRow={renderRow} />)}
      </div>
    </div>
  );
}

function OpCard({ name, rows, renderRow }: { name: string; rows: any[]; renderRow: (r: any) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
            <span className="text-[10px] font-bold text-teal-700 dark:text-teal-300">{name.charAt(0).toUpperCase()}</span>
          </div>
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">{rows.length} consulta{rows.length !== 1 ? "s" : ""}</span>
          {open ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
        </div>
      </button>
      {open && (
        <div className="px-3 pb-2 border-t border-slate-100 dark:border-slate-700">
          {rows.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((r: any, i: number) => <div key={i}>{renderRow(r)}</div>)}
        </div>
      )}
    </div>
  );
}

function fmtDoc(doc: string): string {
  if (!doc) return "";
  const d = doc.replace(/\D/g, "");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return doc;
}

function fmtDt(dt: string | Date): string {
  const d = new Date(dt);
  return `${d.getDate().toString().padStart(2,"0")}/${(d.getMonth()+1).toString().padStart(2,"0")}/${d.getFullYear()} ${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}`;
}
