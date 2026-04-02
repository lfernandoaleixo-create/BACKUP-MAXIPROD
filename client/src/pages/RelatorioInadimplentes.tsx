/**
 * Relatório de Inadimplentes - Visão consolidada para diretoria
 * 7 colunas: Descrição, Venc., Venc. orig, Valor, Boleto/PIX, Minha empresa, Estado configurável
 * Dados buscados diretamente da API GraphQL do Maxiprod (3 anos até ontem)
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import TopNav from "@/components/TopNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  AlertTriangle,
  TrendingDown,
  Users,
  Building2,
  Search,
  Download,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  FileWarning,
  Loader2,
} from "lucide-react";
import { useLocation } from "wouter";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

type SortField = "descricao" | "vencimento" | "vencimentoOriginal" | "valor" | "boletoPix" | "minhaEmpresa" | "estadoConfiguravel";
type SortDir = "asc" | "desc";

export default function RelatorioInadimplentes() {
  const [, setLocation] = useLocation();
  const { data, isLoading, error } = trpc.financial.getRelatorioInadimplentes.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // Cache 5 min
  });

  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("valor");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showResumo, setShowResumo] = useState(true);
  const [empresaFilter, setEmpresaFilter] = useState<string>("todas");
  const [segmentoFilter, setSegmentoFilter] = useState<string>("todos");

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "valor" ? "desc" : "asc");
    }
  };

  const filteredTitulos = useMemo(() => {
    if (!data?.titulos) return [];
    let items = [...data.titulos];

    // Filtro de busca
    if (search) {
      const s = search.toLowerCase();
      items = items.filter(t =>
        t.descricao.toLowerCase().includes(s) ||
        t.boletoPix.toLowerCase().includes(s) ||
        t.referenteA.toLowerCase().includes(s) ||
        t.minhaEmpresa.toLowerCase().includes(s) ||
        t.estadoConfiguravel.toLowerCase().includes(s)
      );
    }

    // Filtro de empresa
    if (empresaFilter !== "todas") {
      items = items.filter(t => t.minhaEmpresa.includes(empresaFilter));
    }

    // Filtro de segmento
    if (segmentoFilter !== "todos") {
      if (segmentoFilter === "sem") {
        items = items.filter(t => !t.estadoConfiguravel);
      } else {
        items = items.filter(t => t.estadoConfiguravel === segmentoFilter);
      }
    }

    // Ordenação
    items.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "descricao": cmp = a.descricao.localeCompare(b.descricao); break;
        case "vencimento": cmp = a.vencimentoISO.localeCompare(b.vencimentoISO); break;
        case "vencimentoOriginal": cmp = (a.vencimentoOriginal || "").localeCompare(b.vencimentoOriginal || ""); break;
        case "valor": cmp = a.valor - b.valor; break;
        case "boletoPix": cmp = a.boletoPix.localeCompare(b.boletoPix); break;
        case "minhaEmpresa": cmp = a.minhaEmpresa.localeCompare(b.minhaEmpresa); break;
        case "estadoConfiguravel": cmp = a.estadoConfiguravel.localeCompare(b.estadoConfiguravel); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return items;
  }, [data, search, sortField, sortDir, empresaFilter, segmentoFilter]);

  const filteredTotal = useMemo(() => filteredTitulos.reduce((s, t) => s + t.valor, 0), [filteredTitulos]);

  // Export CSV
  const exportCSV = () => {
    if (!filteredTitulos.length) return;
    const headers = ["Descrição", "Venc.", "Venc. Orig.", "Valor", "Boleto/PIX", "Referente a", "Minha Empresa", "Estado Configurável"];
    const rows = filteredTitulos.map(t => [
      `"${t.descricao}"`,
      t.vencimento,
      t.vencimentoOriginal,
      t.valor.toFixed(2).replace(".", ","),
      t.boletoPix,
      `"${t.referenteA}"`,
      t.minhaEmpresa,
      t.estadoConfiguravel,
    ]);
    const csv = [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inadimplentes_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const SortHeader = ({ field, label, className }: { field: SortField; label: string; className?: string }) => (
    <th
      className={`px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 select-none whitespace-nowrap ${className || ""}`}
      onClick={() => toggleSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown className={`w-3 h-3 ${sortField === field ? "text-teal-600" : "text-slate-300"}`} />
        {sortField === field && (sortDir === "asc" ? <ChevronUp className="w-3 h-3 text-teal-600" /> : <ChevronDown className="w-3 h-3 text-teal-600" />)}
      </div>
    </th>
  );

  // Segmento badge color
  const segmentoColor = (seg: string) => {
    const map: Record<string, string> = {
      MADEIRA: "bg-amber-100 text-amber-800",
      BAMBU: "bg-green-100 text-green-800",
      "ROJÃO": "bg-red-100 text-red-800",
      SERRAGEM: "bg-orange-100 text-orange-800",
      PALITO: "bg-yellow-100 text-yellow-800",
      VARETA: "bg-blue-100 text-blue-800",
      ESPETO: "bg-purple-100 text-purple-800",
    };
    return map[seg] || "bg-slate-100 text-slate-600";
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <TopNav />

      <div className="container py-6 max-w-[1600px]">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => setLocation("/financeiro")} className="text-slate-500 hover:text-slate-700">
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <FileWarning className="w-6 h-6 text-red-500" />
                Relatório de Inadimplentes
              </h1>
              {data?.periodo && (
                <p className="text-sm text-slate-500 mt-1">
                  Período: {data.periodo.inicio} a {data.periodo.fim}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowResumo(!showResumo)}>
              {showResumo ? "Ocultar" : "Mostrar"} Resumo
            </Button>
            <Button variant="outline" size="sm" onClick={exportCSV} disabled={!filteredTitulos.length}>
              <Download className="w-4 h-4 mr-1" /> Exportar CSV
            </Button>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
            <span className="ml-3 text-slate-500">Buscando dados do Maxiprod...</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-6 text-center text-red-700">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
              <p>Erro ao carregar relatório: {error.message}</p>
            </CardContent>
          </Card>
        )}

        {data && (
          <>
            {/* Resumo Executivo */}
            {showResumo && (
              <div className="mb-6 space-y-4">
                {/* Cards de resumo */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="border-red-200 bg-gradient-to-br from-red-50 to-white">
                    <CardContent className="py-4 px-5">
                      <div className="flex items-center gap-2 text-red-600 mb-1">
                        <TrendingDown className="w-4 h-4" />
                        <span className="text-xs font-medium uppercase">Total Inadimplente</span>
                      </div>
                      <p className="text-2xl font-bold text-red-700">{formatCurrency(data.resumo.totalDevido)}</p>
                      <p className="text-xs text-red-500 mt-1">{data.resumo.totalTitulos} títulos vencidos</p>
                    </CardContent>
                  </Card>

                  <Card className="border-slate-200">
                    <CardContent className="py-4 px-5">
                      <div className="flex items-center gap-2 text-slate-600 mb-1">
                        <Users className="w-4 h-4" />
                        <span className="text-xs font-medium uppercase">Clientes</span>
                      </div>
                      <p className="text-2xl font-bold text-slate-800">{data.resumo.totalClientes}</p>
                      <p className="text-xs text-slate-500 mt-1">clientes inadimplentes</p>
                    </CardContent>
                  </Card>

                  <Card className="border-slate-200">
                    <CardContent className="py-4 px-5">
                      <div className="flex items-center gap-2 text-slate-600 mb-1">
                        <Building2 className="w-4 h-4" />
                        <span className="text-xs font-medium uppercase">Valor Original</span>
                      </div>
                      <p className="text-2xl font-bold text-slate-800">{formatCurrency(data.resumo.totalOriginal)}</p>
                      <p className="text-xs text-green-600 mt-1">Pago: {formatCurrency(data.resumo.totalPago)}</p>
                    </CardContent>
                  </Card>

                  <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-white">
                    <CardContent className="py-4 px-5">
                      <div className="flex items-center gap-2 text-amber-600 mb-1">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-xs font-medium uppercase">Maior Devedor</span>
                      </div>
                      {data.resumo.topClientes[0] && (
                        <>
                          <p className="text-sm font-bold text-amber-800 truncate">{data.resumo.topClientes[0].cliente}</p>
                          <p className="text-lg font-bold text-amber-700">{formatCurrency(data.resumo.topClientes[0].total)}</p>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Faixas de atraso + Top clientes + Segmentos */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Faixas de atraso */}
                  <Card>
                    <CardHeader className="py-3 px-5">
                      <CardTitle className="text-sm font-semibold text-slate-700">Aging (Faixas de Atraso)</CardTitle>
                    </CardHeader>
                    <CardContent className="px-5 pb-4">
                      <div className="space-y-2">
                        {data.resumo.faixasAtraso.map((f) => (
                          <div key={f.faixa} className="flex items-center justify-between text-sm">
                            <span className="text-slate-600">{f.faixa}</span>
                            <div className="text-right">
                              <span className="font-semibold text-slate-800">{formatCurrency(f.valor)}</span>
                              <span className="text-slate-400 ml-2 text-xs">({f.count})</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Top 10 clientes */}
                  <Card>
                    <CardHeader className="py-3 px-5">
                      <CardTitle className="text-sm font-semibold text-slate-700">Top 10 Devedores</CardTitle>
                    </CardHeader>
                    <CardContent className="px-5 pb-4">
                      <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                        {data.resumo.topClientes.map((c, i) => (
                          <div key={c.cliente} className="flex items-center justify-between text-sm">
                            <span className="text-slate-600 truncate flex-1 mr-2">
                              <span className="text-slate-400 mr-1">{i + 1}.</span>
                              {c.cliente}
                            </span>
                            <span className="font-semibold text-red-700 whitespace-nowrap">{formatCurrency(c.total)}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Por segmento + empresa */}
                  <Card>
                    <CardHeader className="py-3 px-5">
                      <CardTitle className="text-sm font-semibold text-slate-700">Por Segmento / Empresa</CardTitle>
                    </CardHeader>
                    <CardContent className="px-5 pb-4">
                      <p className="text-xs font-medium text-slate-500 uppercase mb-1">Segmentos</p>
                      <div className="space-y-1 mb-3">
                        {data.resumo.porSegmento.map((s) => (
                          <div key={s.segmento} className="flex items-center justify-between text-sm">
                            <Badge variant="secondary" className={`text-xs ${segmentoColor(s.segmento)}`}>{s.segmento}</Badge>
                            <span className="font-semibold text-slate-800">{formatCurrency(s.total)} <span className="text-slate-400 text-xs">({s.count})</span></span>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs font-medium text-slate-500 uppercase mb-1">Empresas</p>
                      <div className="space-y-1">
                        {data.resumo.porEmpresa.map((e) => (
                          <div key={e.empresa} className="flex items-center justify-between text-sm">
                            <span className="text-slate-600 truncate">{e.empresa}</span>
                            <span className="font-semibold text-slate-800">{formatCurrency(e.total)}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* Filtros */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Buscar por cliente, NF, boleto..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              <select
                value={empresaFilter}
                onChange={(e) => setEmpresaFilter(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="todas">Todas as empresas</option>
                {data.resumo.porEmpresa.map((e) => (
                  <option key={e.empresa} value={e.empresa}>{e.empresa}</option>
                ))}
              </select>

              <select
                value={segmentoFilter}
                onChange={(e) => setSegmentoFilter(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="todos">Todos os segmentos</option>
                {data.resumo.porSegmento.map((s) => (
                  <option key={s.segmento} value={s.segmento}>{s.segmento}</option>
                ))}
                <option value="sem">Sem segmento</option>
              </select>

              <div className="text-sm text-slate-500">
                {filteredTitulos.length} títulos | <span className="font-semibold text-red-600">{formatCurrency(filteredTotal)}</span>
              </div>
            </div>

            {/* Tabela com 7 colunas */}
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <SortHeader field="descricao" label="Descrição" className="min-w-[300px]" />
                      <SortHeader field="vencimento" label="Venc." />
                      <SortHeader field="vencimentoOriginal" label="Venc. Orig." />
                      <SortHeader field="valor" label="Valor" />
                      <SortHeader field="boletoPix" label="Boleto/PIX" />
                      <SortHeader field="minhaEmpresa" label="Minha Empresa" />
                      <SortHeader field="estadoConfiguravel" label="Estado Configurável" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTitulos.map((t) => {
                      // Calcular dias de atraso
                      const venc = new Date(t.vencimentoISO);
                      const dias = Math.floor((Date.now() - venc.getTime()) / (1000 * 60 * 60 * 24));
                      const isGrave = dias > 90;
                      const isModerado = dias > 30 && dias <= 90;

                      return (
                        <tr key={t.id} className={`hover:bg-slate-50 ${isGrave ? "bg-red-50/30" : ""}`}>
                          <td className="px-3 py-2.5 text-sm text-slate-800">
                            <div>{t.descricao}</div>
                            {t.referenteA && (
                              <div className="text-xs text-slate-400 mt-0.5">{t.referenteA}</div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-sm whitespace-nowrap">
                            <span className={isGrave ? "text-red-600 font-semibold" : isModerado ? "text-amber-600" : "text-slate-700"}>
                              {t.vencimento}
                            </span>
                            {dias > 0 && (
                              <div className="text-xs text-slate-400">{dias}d atraso</div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-sm text-slate-600 whitespace-nowrap">{t.vencimentoOriginal}</td>
                          <td className="px-3 py-2.5 text-sm font-semibold text-red-700 whitespace-nowrap text-right">
                            {formatCurrency(t.valor)}
                            {t.valorPago > 0 && (
                              <div className="text-xs text-green-600 font-normal">Pago: {formatCurrency(t.valorPago)}</div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-sm text-slate-600 whitespace-nowrap">{t.boletoPix || "—"}</td>
                          <td className="px-3 py-2.5 text-sm text-slate-600 whitespace-nowrap">
                            {t.minhaEmpresa.replace(" E COMERCIO LTDA", "").replace(" LTDA", "")}
                          </td>
                          <td className="px-3 py-2.5">
                            {t.estadoConfiguravel ? (
                              <Badge variant="secondary" className={`text-xs ${segmentoColor(t.estadoConfiguravel)}`}>
                                {t.estadoConfiguravel}
                              </Badge>
                            ) : (
                              <span className="text-xs text-slate-300">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                    <tr>
                      <td className="px-3 py-3 text-sm font-bold text-slate-800" colSpan={3}>
                        Total ({filteredTitulos.length} títulos)
                      </td>
                      <td className="px-3 py-3 text-sm font-bold text-red-700 text-right whitespace-nowrap">
                        {formatCurrency(filteredTotal)}
                      </td>
                      <td colSpan={3}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
