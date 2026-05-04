/**
 * Fornecedores Brasileiros Tab
 * CRM de prospecção: Segmento → Estado → Possíveis Clientes
 * Com registro de contato, status, ranking de vendedores
 */

import React, { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  Truck, Building2, MapPin, Phone, Mail, Globe, FileText,
  ChevronRight, ArrowLeft, Users, Trophy, TrendingUp,
  MessageSquare, CheckCircle2, XCircle, UserCheck, HelpCircle,
  Send, Loader2, History
} from "lucide-react";
import { toast } from "sonner";

const VENDEDORES = ["Paula", "Gilson", "Jordão", "Juvenal", "Pedro"];
const STATUS_OPTIONS = [
  { value: "ja_cliente" as const, label: "Já é cliente", icon: UserCheck, color: "text-blue-600 bg-blue-50 border-blue-200" },
  { value: "possivel_cliente" as const, label: "Possível cliente", icon: HelpCircle, color: "text-amber-600 bg-amber-50 border-amber-200" },
  { value: "novo_cliente" as const, label: "Novo cliente", icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  { value: "sem_interesse" as const, label: "Sem interesse", icon: XCircle, color: "text-red-600 bg-red-50 border-red-200" },
  { value: "nao_possivel_contato" as const, label: "Não foi possível estabelecer contato", icon: Phone, color: "text-purple-600 bg-purple-50 border-purple-200" },
];
const FORMA_CONTATO_OPTIONS = [
  { value: "ligacao" as const, label: "Ligação", icon: Phone },
  { value: "email" as const, label: "Email", icon: Mail },
  { value: "whatsapp" as const, label: "WhatsApp", icon: MessageSquare },
  { value: "outra" as const, label: "Outra", icon: FileText },
];

type ViewMode = "segments" | "states" | "suppliers" | "ranking" | "vendedorDetail" | "statusCards" | "history";

export default function FornecedoresBrasileirosTab() {

  const [view, setView] = useState<ViewMode>("segments");
  const [selectedSegment, setSelectedSegment] = useState<string>("");
  const [selectedState, setSelectedState] = useState<string>("");
  const [selectedVendedor, setSelectedVendedor] = useState<string>("");
  const [expandedSupplier, setExpandedSupplier] = useState<number | null>(null);

  // Contact form state
  const [contactForm, setContactForm] = useState<{
    supplierId: number;
    vendedor: string;
    formaContato: "ligacao" | "email" | "whatsapp" | "outra";
    formaContatoOutra: string;
    observacao: string;
    status: "ja_cliente" | "possivel_cliente" | "novo_cliente" | "sem_interesse" | "nao_possivel_contato";
  } | null>(null);

  // Queries
  const segments = trpc.suppliers.getSegments.useQuery();
  const states = trpc.suppliers.getStates.useQuery(
    { segmento: selectedSegment },
    { enabled: !!selectedSegment }
  );
  const suppliersList = trpc.suppliers.getSuppliers.useQuery(
    { segmento: selectedSegment, estado: selectedState },
    { enabled: !!selectedSegment && !!selectedState }
  );
  const stats = trpc.suppliers.getStats.useQuery();
  const ranking = trpc.suppliers.getVendedorRanking.useQuery(undefined, { enabled: view === "ranking" });
  const vendedorContacts = trpc.suppliers.getVendedorContacts.useQuery(
    { vendedor: selectedVendedor },
    { enabled: view === "vendedorDetail" && !!selectedVendedor }
  );
  const contactsByStatus = trpc.suppliers.getContactsByStatus.useQuery(undefined, { enabled: view === "statusCards" });

  // Mutation
  const addContact = trpc.suppliers.addContact.useMutation({
    onSuccess: () => {
      toast.success("Contato registrado! O registro foi salvo com sucesso.");
      setContactForm(null);
      setExpandedSupplier(null);
      suppliersList.refetch();
      stats.refetch();
      ranking.refetch();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleSubmitContact = () => {
    if (!contactForm) return;
    if (!contactForm.vendedor) {
      toast.error("Selecione o vendedor");
      return;
    }
    if (contactForm.formaContato === "outra" && !contactForm.formaContatoOutra.trim()) {
      toast.error("Descreva a forma de contato");
      return;
    }
    if (!contactForm.observacao.trim()) {
      toast.error("Preencha a observação antes de salvar");
      return;
    }
    addContact.mutate(contactForm);
  };

  const goBack = () => {
    if (view === "states") { setView("segments"); setSelectedSegment(""); }
    else if (view === "suppliers") { setView("states"); setSelectedState(""); }
    else if (view === "vendedorDetail") { setView("ranking"); setSelectedVendedor(""); }
    else { setView("segments"); }
  };

  return (
    <div className="space-y-4">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-white rounded-lg border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-slate-800">{stats.data?.totalSuppliers || 0}</p>
          <p className="text-xs text-slate-500 mt-1">Cadastros</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-teal-600">{stats.data?.totalContacts || 0}</p>
          <p className="text-xs text-slate-500 mt-1">Contatos Feitos</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{stats.data?.novoCliente || 0}</p>
          <p className="text-xs text-slate-500 mt-1">Novos Clientes</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{stats.data?.possivelCliente || 0}</p>
          <p className="text-xs text-slate-500 mt-1">Possíveis Clientes</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{stats.data?.jaCliente || 0}</p>
          <p className="text-xs text-slate-500 mt-1">Já é Cliente</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{stats.data?.semInteresse || 0}</p>
          <p className="text-xs text-slate-500 mt-1">Sem Interesse</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-purple-600">{stats.data?.naoPossivelContato || 0}</p>
          <p className="text-xs text-slate-500 mt-1">S/ Contato</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 p-1">
        <button
          onClick={() => { setView("segments"); setSelectedSegment(""); setSelectedState(""); }}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors cursor-pointer ${
            ["segments", "states", "suppliers"].includes(view) ? "bg-teal-600 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Building2 className="w-4 h-4 inline mr-1" />
          Prospecção
        </button>
        <button
          onClick={() => setView("ranking")}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors cursor-pointer ${
            ["ranking", "vendedorDetail"].includes(view) ? "bg-teal-600 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Trophy className="w-4 h-4 inline mr-1" />
          Ranking
        </button>
        <button
          onClick={() => setView("statusCards")}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors cursor-pointer ${
            view === "statusCards" ? "bg-teal-600 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Users className="w-4 h-4 inline mr-1" />
          Por Status
        </button>
        <button
          onClick={() => setView("history")}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors cursor-pointer ${
            view === "history" ? "bg-teal-600 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <History className="w-4 h-4 inline mr-1" />
          Histórico
        </button>
      </div>

      {/* Breadcrumb */}
      {(view === "states" || view === "suppliers" || view === "vendedorDetail") && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <button onClick={goBack} className="flex items-center gap-1 text-teal-600 hover:text-teal-700 cursor-pointer">
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
          {view === "states" && <span>/ {selectedSegment}</span>}
          {view === "suppliers" && <span>/ {selectedSegment} / {selectedState}</span>}
          {view === "vendedorDetail" && <span>/ Ranking / {selectedVendedor}</span>}
        </div>
      )}

      {/* SEGMENTS VIEW */}
      {view === "segments" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {segments.isLoading ? (
            <div className="col-span-full text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-teal-500 mx-auto" />
            </div>
          ) : segments.data?.map((seg) => (
            <button
              key={seg}
              onClick={() => { setSelectedSegment(seg); setView("states"); }}
              className="bg-white rounded-xl border border-slate-200 p-5 text-left hover:border-teal-300 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center group-hover:bg-teal-100 transition-colors">
                    <Truck className="w-5 h-5 text-teal-600" />
                  </div>
                  <span className="font-medium text-slate-800">{seg}</span>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-teal-500" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* STATES VIEW */}
      {view === "states" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {states.isLoading ? (
            <div className="col-span-full text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-teal-500 mx-auto" />
            </div>
          ) : states.data?.map((estado) => (
            <button
              key={estado}
              onClick={() => { setSelectedState(estado); setView("suppliers"); }}
              className="bg-white rounded-xl border border-slate-200 p-5 text-left hover:border-teal-300 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                    <MapPin className="w-5 h-5 text-blue-600" />
                  </div>
                  <span className="font-medium text-slate-800">{estado}</span>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-teal-500" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* SUPPLIERS VIEW */}
      {view === "suppliers" && (
        <div className="space-y-3">
          {suppliersList.isLoading ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-teal-500 mx-auto" />
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-500">{suppliersList.data?.length || 0} possíveis clientes encontrados</p>
              {suppliersList.data?.map((supplier) => (
                <div key={supplier.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  {/* Supplier Header */}
                  <button
                    onClick={() => setExpandedSupplier(expandedSupplier === supplier.id ? null : supplier.id)}
                    className="w-full p-4 text-left hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-slate-800">{supplier.nome}</h4>
                        <p className="text-sm text-slate-500 mt-0.5">
                          {supplier.cidade && <span>{supplier.cidade}</span>}
                          {supplier.confianca && (
                            <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${
                              supplier.confianca === "high" ? "bg-emerald-100 text-emerald-700" :
                              supplier.confianca === "medium" ? "bg-amber-100 text-amber-700" :
                              "bg-red-100 text-red-700"
                            }`}>
                              {supplier.confianca}
                            </span>
                          )}
                        </p>
                      </div>
                      <ChevronRight className={`w-5 h-5 text-slate-400 transition-transform ${expandedSupplier === supplier.id ? "rotate-90" : ""}`} />
                    </div>
                  </button>

                  {/* Expanded Details */}
                  {expandedSupplier === supplier.id && (
                    <div className="border-t border-slate-100 p-4 space-y-4">
                      {/* Contact Info */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        {supplier.endereco && (
                          <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                            <span className="text-slate-600">{supplier.endereco}</span>
                          </div>
                        )}
                        {supplier.telefone && (
                          <div className="flex items-start gap-2">
                            <Phone className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                            <span className="text-slate-600">{supplier.telefone}</span>
                          </div>
                        )}
                        {supplier.email && (
                          <div className="flex items-start gap-2">
                            <Mail className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                            <span className="text-slate-600">{supplier.email}</span>
                          </div>
                        )}
                        {supplier.website && (
                          <div className="flex items-start gap-2">
                            <Globe className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                            <a href={supplier.website} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">{supplier.website}</a>
                          </div>
                        )}
                        {supplier.cnpj && (
                          <div className="flex items-start gap-2">
                            <FileText className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                            <span className="text-slate-600">CNPJ: {supplier.cnpj}</span>
                          </div>
                        )}
                      </div>
                      {supplier.notas && (
                        <p className="text-sm text-slate-500 italic bg-slate-50 p-3 rounded-lg">{supplier.notas}</p>
                      )}

                      {/* Contact Form */}
                      {contactForm?.supplierId === supplier.id ? (
                        <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 space-y-3">
                          <h5 className="font-semibold text-teal-800 text-sm">Registrar Contato</h5>

                          {/* Vendedor */}
                          <div>
                            <label className="text-xs font-medium text-slate-600 mb-1 block">Vendedor</label>
                            <div className="flex flex-wrap gap-2">
                              {VENDEDORES.map((v) => (
                                <button
                                  key={v}
                                  onClick={() => setContactForm({ ...contactForm, vendedor: v })}
                                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${
                                    contactForm.vendedor === v
                                      ? "bg-teal-600 text-white border-teal-600"
                                      : "bg-white text-slate-600 border-slate-200 hover:border-teal-300"
                                  }`}
                                >
                                  {v}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Forma de Contato */}
                          <div>
                            <label className="text-xs font-medium text-slate-600 mb-1 block">Forma de Contato</label>
                            <div className="flex flex-wrap gap-2">
                              {FORMA_CONTATO_OPTIONS.map((fc) => (
                                <button
                                  key={fc.value}
                                  onClick={() => setContactForm({ ...contactForm, formaContato: fc.value, formaContatoOutra: "" })}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${
                                    contactForm.formaContato === fc.value
                                      ? "bg-teal-600 text-white border-teal-600"
                                      : "bg-white text-slate-600 border-slate-200 hover:border-teal-300"
                                  }`}
                                >
                                  <fc.icon className="w-3.5 h-3.5" />
                                  {fc.label}
                                </button>
                              ))}
                            </div>
                            {contactForm.formaContato === "outra" && (
                              <input
                                type="text"
                                placeholder="Descreva a forma de contato..."
                                value={contactForm.formaContatoOutra}
                                onChange={(e) => setContactForm({ ...contactForm, formaContatoOutra: e.target.value })}
                                className="mt-2 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                              />
                            )}
                          </div>

                          {/* Status */}
                          <div>
                            <label className="text-xs font-medium text-slate-600 mb-1 block">Status</label>
                            <div className="flex flex-wrap gap-2">
                              {STATUS_OPTIONS.map((st) => (
                                <button
                                  key={st.value}
                                  onClick={() => setContactForm({ ...contactForm, status: st.value })}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${
                                    contactForm.status === st.value
                                      ? st.color + " border-current font-bold"
                                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                                  }`}
                                >
                                  <st.icon className="w-3.5 h-3.5" />
                                  {st.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Observação */}
                          <div>
                            <label className="text-xs font-medium text-slate-600 mb-1 block">
                              Observação <span className="text-red-500">* (obrigatório)</span>
                            </label>
                            <textarea
                              placeholder="Descreva o que aconteceu no contato..."
                              value={contactForm.observacao}
                              onChange={(e) => setContactForm({ ...contactForm, observacao: e.target.value })}
                              rows={3}
                              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none ${!contactForm.observacao.trim() ? "border-red-300 bg-red-50/30" : "border-slate-200"}`}
                            />
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={handleSubmitContact}
                              disabled={addContact.isPending}
                              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {addContact.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                              Salvar
                            </button>
                            <button
                              onClick={() => setContactForm(null)}
                              className="px-4 py-2 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setContactForm({
                            supplierId: supplier.id,
                            vendedor: "",
                            formaContato: "ligacao",
                            formaContatoOutra: "",
                            observacao: "",
                            status: "possivel_cliente",
                          })}
                          className="flex items-center gap-2 px-4 py-2 bg-teal-50 text-teal-700 rounded-lg text-sm font-medium hover:bg-teal-100 transition-colors cursor-pointer border border-teal-200"
                        >
                          <Phone className="w-4 h-4" />
                          Registrar Contato
                        </button>
                      )}

                      {/* Previous Contacts */}
                      <SupplierContactHistory supplierId={supplier.id} />
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* RANKING VIEW */}
      {view === "ranking" && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center gap-3">
            <Trophy className="w-5 h-5 text-amber-500" />
            <h3 className="font-semibold text-slate-800">Ranking de Vendedores</h3>
          </div>
          {ranking.isLoading ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-teal-500 mx-auto" />
            </div>
          ) : !ranking.data?.length ? (
            <div className="text-center py-8 text-slate-500">Nenhum contato registrado ainda</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {ranking.data.map((v, idx) => {
                const conversoes = Number((v as any).conversoes || 0);
                const efficiency = v.totalContatos > 0 ? ((conversoes / v.totalContatos) * 100).toFixed(1) : "0.0";
                return (
                  <button
                    key={v.vendedor}
                    onClick={() => { setSelectedVendedor(v.vendedor); setView("vendedorDetail"); }}
                    className="w-full p-4 text-left hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          idx === 0 ? "bg-amber-100 text-amber-700" :
                          idx === 1 ? "bg-slate-200 text-slate-700" :
                          idx === 2 ? "bg-orange-100 text-orange-700" :
                          "bg-slate-100 text-slate-600"
                        }`}>
                          {idx + 1}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{v.vendedor}</p>
                          <p className="text-xs text-slate-500">{v.totalContatos} contatos</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-emerald-600">
                          <TrendingUp className="w-4 h-4" />
                          <span className="text-sm font-semibold">{conversoes} conversões</span>
                        </div>
                        <p className="text-xs text-slate-500">Eficiência: {efficiency}%</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VENDEDOR DETAIL VIEW */}
      {view === "vendedorDetail" && (
        <div className="space-y-3">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-800 text-lg">{selectedVendedor}</h3>
            <p className="text-sm text-slate-500">{vendedorContacts.data?.length || 0} contatos realizados</p>
          </div>
          {vendedorContacts.isLoading ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-teal-500 mx-auto" />
            </div>
          ) : vendedorContacts.data?.map((c) => (
            <ContactCard key={c.id} contact={c} />
          ))}
        </div>
      )}

      {/* STATUS CARDS VIEW */}
      {view === "statusCards" && (
        <div className="space-y-4">
          {STATUS_OPTIONS.map((statusOpt) => {
            const filtered = contactsByStatus.data?.filter(c => c.status === statusOpt.value) || [];
            return (
              <div key={statusOpt.value} className={`bg-white rounded-xl border overflow-hidden ${statusOpt.color.split(" ")[2] || "border-slate-200"}`}>
                <div className={`p-4 border-b flex items-center gap-3 ${statusOpt.color.split(" ")[1]}`}>
                  <statusOpt.icon className={`w-5 h-5 ${statusOpt.color.split(" ")[0]}`} />
                  <h3 className={`font-semibold ${statusOpt.color.split(" ")[0]}`}>{statusOpt.label}</h3>
                  <span className="ml-auto text-sm font-medium text-slate-600">{filtered.length}</span>
                </div>
                {filtered.length === 0 ? (
                  <div className="p-4 text-center text-sm text-slate-400">Nenhum registro</div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                    {filtered.map((c) => (
                      <div key={c.id} className="p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-slate-800">{c.supplierNome}</span>
                          <span className="text-xs text-slate-400">{c.vendedor}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{c.supplierCidade} - {c.supplierEstado}</p>
                        {c.observacao && <p className="text-xs text-slate-600 mt-1 italic">{c.observacao}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* HISTORY VIEW - Migrações de Status */}
      {view === "history" && <MigrationHistory />}
    </div>
  );
}

/* Sub-component: Contact History for a supplier */
function SupplierContactHistory({ supplierId }: { supplierId: number }) {
  const contacts = trpc.suppliers.getSupplierContacts.useQuery({ supplierId });

  if (contacts.isLoading) return null;
  if (!contacts.data?.length) return null;

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <h5 className="text-xs font-semibold text-slate-500 uppercase mb-2">Histórico de Contatos</h5>
      <div className="space-y-2">
        {contacts.data.map((c) => (
          <div key={c.id} className="bg-slate-50 rounded-lg p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-700">{c.vendedor}</span>
              <span className="text-xs text-slate-400">
                {new Date(c.createdAt).toLocaleDateString("pt-BR")}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                c.status === "novo_cliente" ? "bg-emerald-100 text-emerald-700" :
                c.status === "possivel_cliente" ? "bg-amber-100 text-amber-700" :
                c.status === "ja_cliente" ? "bg-blue-100 text-blue-700" :
                c.status === "nao_possivel_contato" ? "bg-purple-100 text-purple-700" :
                "bg-red-100 text-red-700"
              }`}>
                {c.status === "ja_cliente" ? "Já é cliente" :
                 c.status === "possivel_cliente" ? "Possível cliente" :
                 c.status === "novo_cliente" ? "Novo cliente" :
                 c.status === "nao_possivel_contato" ? "S/ Contato" : "Sem interesse"}
              </span>
              <span className="text-xs text-slate-500">
                via {c.formaContato === "ligacao" ? "Ligação" :
                     c.formaContato === "email" ? "Email" :
                     c.formaContato === "whatsapp" ? "WhatsApp" :
                     c.formaContatoOutra || "Outra"}
              </span>
            </div>
            {c.observacao && <p className="text-xs text-slate-600 mt-1 italic">{c.observacao}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* Sub-component: Migration History */
function MigrationHistory() {
  const history = trpc.suppliers.getMigrationHistory.useQuery();

  const statusLabel = (s: string) => {
    switch (s) {
      case "ja_cliente": return "Já é cliente";
      case "possivel_cliente": return "Possível cliente";
      case "novo_cliente": return "Novo cliente";
      case "sem_interesse": return "Sem interesse";
      case "nao_possivel_contato": return "S/ Contato";
      default: return s;
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "ja_cliente": return "bg-blue-100 text-blue-700";
      case "possivel_cliente": return "bg-amber-100 text-amber-700";
      case "novo_cliente": return "bg-emerald-100 text-emerald-700";
      case "sem_interesse": return "bg-red-100 text-red-700";
      case "nao_possivel_contato": return "bg-purple-100 text-purple-700";
      default: return "bg-slate-100 text-slate-700";
    }
  };

  if (history.isLoading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500 mx-auto" />
      </div>
    );
  }

  if (!history.data?.length) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
        Nenhum registro de contato ainda. O histórico aparecerá aqui quando os vendedores registrarem contatos.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center gap-3">
        <History className="w-5 h-5 text-teal-600" />
        <h3 className="font-semibold text-slate-800">Histórico de Migrações</h3>
        <span className="ml-auto text-sm text-slate-500">{history.data.length} registros</span>
      </div>
      <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
        {history.data.map((m) => (
          <div key={m.id} className="p-4 hover:bg-slate-50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-800">{m.supplierNome}</span>
                <span className="text-xs text-slate-400">({m.supplierEstado})</span>
              </div>
              <span className="text-xs text-slate-400">
                {new Date(m.createdAt).toLocaleDateString("pt-BR")} {new Date(m.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              {m.statusAnterior ? (
                <>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor(m.statusAnterior)}`}>
                    {statusLabel(m.statusAnterior)}
                  </span>
                  <span className="text-slate-400">→</span>
                </>
              ) : (
                <>
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500">Primeiro contato</span>
                  <span className="text-slate-400">→</span>
                </>
              )}
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor(m.statusNovo)}`}>
                {statusLabel(m.statusNovo)}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
              <span>Vendedor: <strong className="text-slate-700">{m.vendedor}</strong></span>
              <span>•</span>
              <span>
                via {m.formaContato === "ligacao" ? "Ligação" :
                     m.formaContato === "email" ? "Email" :
                     m.formaContato === "whatsapp" ? "WhatsApp" :
                     m.formaContatoOutra || "Outra"}
              </span>
            </div>
            {m.observacao && (
              <p className="text-xs text-slate-600 mt-2 italic bg-slate-50 p-2 rounded">{m.observacao}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* Sub-component: Contact Card for ranking detail */
function ContactCard({ contact }: { contact: any }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-slate-800">{contact.supplierNome}</h4>
        <span className="text-xs text-slate-400">
          {new Date(contact.createdAt).toLocaleDateString("pt-BR")}
        </span>
      </div>
      <p className="text-xs text-slate-500 mt-0.5">{contact.supplierCidade} - {contact.supplierEstado} | {contact.supplierSegmento}</p>
      <div className="flex items-center gap-2 mt-2">
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
          contact.status === "novo_cliente" ? "bg-emerald-100 text-emerald-700" :
          contact.status === "possivel_cliente" ? "bg-amber-100 text-amber-700" :
          contact.status === "ja_cliente" ? "bg-blue-100 text-blue-700" :
          "bg-red-100 text-red-700"
        }`}>
          {contact.status === "ja_cliente" ? "Já é cliente" :
           contact.status === "possivel_cliente" ? "Possível cliente" :
           contact.status === "novo_cliente" ? "Novo cliente" : "Sem interesse"}
        </span>
        <span className="text-xs text-slate-500">
          via {contact.formaContato === "ligacao" ? "Ligação" :
               contact.formaContato === "email" ? "Email" :
               contact.formaContato === "whatsapp" ? "WhatsApp" :
               contact.formaContatoOutra || "Outra"}
        </span>
      </div>
      {contact.observacao && <p className="text-sm text-slate-600 mt-2 italic bg-slate-50 p-2 rounded">{contact.observacao}</p>}
    </div>
  );
}
