/**
 * Cadastro de Vendedores - Aba em Vendas
 * Exibe gestores e vendedores de rua puxados diretamente do Maxiprod.
 * Cada vendedor tem: checkbox de autorização, senha, e configuração de produtos visíveis.
 * Produtos separados por categoria (Madeira / Bambu) com referência completa.
 */

import React, { useState, useEffect, useRef } from "react";
import { Users, ChevronDown, ChevronRight, RefreshCw, AlertCircle, Shield, ShieldCheck, Lock, Package, Check, Layers, FileText, Upload, Trash2, X, FolderOpen } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface SellerPermission {
  id: number;
  sellerName: string;
  gestorName: string;
  password: string;
  authorized: boolean;
}

interface GestorGroup {
  gestor: string;
  vendedores: string[];
}

interface StockItem {
  codigoItem: string;
  descricaoItem: string;
  grupo: string;
  subgrupo: string;
}

export default function CadastroVendedoresTab() {
  const [expandedGestores, setExpandedGestores] = useState<Set<string>>(new Set());
  const [expandedSeller, setExpandedSeller] = useState<string | null>(null);
  const [expandedPdfSeller, setExpandedPdfSeller] = useState<string | null>(null);

  const representantesQuery = trpc.sales.listRepresentantesMaxiprod.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  const permissionsQuery = trpc.sales.listSellerPermissions.useQuery(undefined, {
    staleTime: 30 * 1000,
  });
  const syncMutation = trpc.sales.syncSellerPermissions.useMutation();
  const toggleAuthMutation = trpc.sales.toggleSellerAuthorization.useMutation();
  const utils = trpc.useUtils();

  // Sincronizar permissões quando dados do Maxiprod carregam
  useEffect(() => {
    if (representantesQuery.data && !syncMutation.isPending) {
      syncMutation.mutate(undefined, {
        onSuccess: () => {
          utils.sales.listSellerPermissions.invalidate();
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [representantesQuery.data]);

  const toggleExpanded = (gestor: string) => {
    setExpandedGestores(prev => {
      const next = new Set(prev);
      if (next.has(gestor)) {
        next.delete(gestor);
      } else {
        next.add(gestor);
      }
      return next;
    });
  };

  const expandAll = () => {
    if (representantesQuery.data) {
      setExpandedGestores(new Set(representantesQuery.data.gestores.map((g: GestorGroup) => g.gestor)));
    }
  };

  const collapseAll = () => {
    setExpandedGestores(new Set());
  };

  const handleToggleAuth = (sellerId: number, currentAuth: boolean) => {
    toggleAuthMutation.mutate(
      { sellerId, authorized: !currentAuth },
      {
        onSuccess: () => {
          utils.sales.listSellerPermissions.invalidate();
        },
      }
    );
  };

  const getPermission = (sellerName: string, gestorName: string): SellerPermission | undefined => {
    if (!permissionsQuery.data) return undefined;
    return permissionsQuery.data.find(
      (p: SellerPermission) =>
        p.sellerName.toUpperCase() === sellerName.toUpperCase() &&
        p.gestorName.toUpperCase() === gestorName.toUpperCase()
    );
  };

  const data = representantesQuery.data;
  const totalVendedores = data?.gestores.reduce((acc: number, g: GestorGroup) => acc + g.vendedores.length, 0) || 0;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-lg bg-teal-100 flex items-center justify-center">
              <Users className="w-4 h-4 md:w-5 md:h-5 text-teal-600" />
            </div>
            <div>
              <h2 className="text-base md:text-lg font-bold text-slate-800">Cadastro de Vendedores</h2>
              <p className="text-xs md:text-sm text-slate-500">
                Gestores e vendedores de rua — dados do Maxiprod
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {data && (
              <span className="text-xs text-slate-400 hidden sm:inline">
                {data.gestores.length} gestor{data.gestores.length !== 1 ? "es" : ""} · {totalVendedores} vendedor{totalVendedores !== 1 ? "es" : ""}
              </span>
            )}
            <button
              onClick={() => {
                utils.sales.listRepresentantesMaxiprod.invalidate();
                utils.sales.listSellerPermissions.invalidate();
              }}
              disabled={representantesQuery.isFetching}
              className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              title="Atualizar do Maxiprod"
            >
              <RefreshCw className={`w-4 h-4 ${representantesQuery.isFetching ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Controles */}
      {data && data.gestores.length > 0 && (
        <div className="flex items-center gap-2 px-1">
          <button
            onClick={expandAll}
            className="text-xs text-teal-600 hover:text-teal-800 font-medium cursor-pointer"
          >
            Expandir todos
          </button>
          <span className="text-xs text-slate-300">|</span>
          <button
            onClick={collapseAll}
            className="text-xs text-teal-600 hover:text-teal-800 font-medium cursor-pointer"
          >
            Recolher todos
          </button>
        </div>
      )}

      {/* Loading */}
      {representantesQuery.isLoading && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
          <RefreshCw className="w-6 h-6 text-teal-500 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Buscando representantes do Maxiprod...</p>
        </div>
      )}

      {/* Error */}
      {representantesQuery.isError && (
        <div className="bg-white rounded-xl border border-red-200 shadow-sm p-6">
          <div className="flex items-center gap-3 text-red-600">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium">Erro ao buscar representantes</p>
              <p className="text-xs text-red-500 mt-1">{representantesQuery.error?.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Gestores com vendedores */}
      {data && data.gestores.map((grupo: GestorGroup) => {
        const isExpanded = expandedGestores.has(grupo.gestor);

        return (
          <div key={grupo.gestor} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Gestor header - clicável */}
            <button
              onClick={() => toggleExpanded(grupo.gestor)}
              className="w-full flex items-center justify-between p-4 md:px-6 md:py-4 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="text-slate-400">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </div>
                <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white font-bold text-sm">
                  {grupo.gestor.charAt(0).toUpperCase()}
                </div>
                <div className="text-left">
                  <p className="text-sm md:text-base font-semibold text-slate-800">{grupo.gestor}</p>
                  <p className="text-[10px] md:text-xs text-slate-400">
                    {grupo.vendedores.length} vendedor{grupo.vendedores.length !== 1 ? "es" : ""}
                  </p>
                </div>
              </div>
              <span className="text-xs bg-teal-100 text-teal-700 px-2.5 py-1 rounded-full font-medium">
                {grupo.vendedores.length}
              </span>
            </button>

            {/* Vendedores expandidos */}
            {isExpanded && (
              <div className="border-t border-slate-100 bg-slate-50">
                <div className="divide-y divide-slate-100">
                  {grupo.vendedores.map((vendedor: string) => {
                    const perm = getPermission(vendedor, grupo.gestor);
                    const isSellerExpanded = expandedSeller === `${grupo.gestor}|${vendedor}`;

                    return (
                      <div key={vendedor}>
                        <div className="flex items-center gap-3 px-6 md:px-10 py-3 hover:bg-slate-100 transition-colors">
                          {/* Avatar */}
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-300 to-orange-500 flex items-center justify-center text-white font-bold text-[10px]">
                            {vendedor.charAt(0).toUpperCase()}
                          </div>

                          {/* Nome e senha */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700">{vendedor}</p>
                            {perm && (
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <Lock className="w-3 h-3 text-slate-400" />
                                <span className="text-[10px] text-slate-400">Senha: {perm.password}</span>
                              </div>
                            )}
                          </div>

                          {/* Checkbox de autorização */}
                          {perm && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleAuth(perm.id, perm.authorized);
                              }}
                              disabled={toggleAuthMutation.isPending}
                              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                                perm.authorized
                                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                  : "bg-red-50 text-red-600 hover:bg-red-100"
                              }`}
                              title={perm.authorized ? "Clique para bloquear acesso" : "Clique para autorizar acesso"}
                            >
                              {perm.authorized ? (
                                <>
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">Autorizado</span>
                                </>
                              ) : (
                                <>
                                  <Shield className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">Bloqueado</span>
                                </>
                              )}
                            </button>
                          )}

                          {/* Botão de configurar produtos */}
                          {perm && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedSeller(isSellerExpanded ? null : `${grupo.gestor}|${vendedor}`);
                                setExpandedPdfSeller(null);
                              }}
                              className="flex flex-col items-center gap-0.5 p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                              title="Configurar produtos visíveis"
                            >
                              <span className="text-[8px] font-semibold uppercase leading-none">Estoque</span>
                              <Package className="w-4 h-4" />
                            </button>
                          )}

                          {/* Botão de configurar PDFs/Catálogos */}
                          {perm && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const key = `${grupo.gestor}|${vendedor}`;
                                setExpandedPdfSeller(expandedPdfSeller === key ? null : key);
                                setExpandedSeller(null);
                              }}
                              className="flex flex-col items-center gap-0.5 p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Configurar catálogos/PDFs visíveis"
                            >
                              <span className="text-[8px] font-semibold uppercase leading-none">PDF</span>
                              <FileText className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {/* Painel de produtos (expandido) */}
                        {isSellerExpanded && perm && (
                          <SellerProductsPanel sellerId={perm.id} sellerName={vendedor} />
                        )}

                        {/* Painel de PDFs/Catálogos (expandido) */}
                        {expandedPdfSeller === `${grupo.gestor}|${vendedor}` && perm && (
                          <SellerCatalogsPanel sellerId={perm.id} sellerName={vendedor} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Painel de configuração de produtos visíveis para um vendedor.
 * Separado por categorias: Estoque > Madeira / Bambu
 */
function SellerProductsPanel({ sellerId, sellerName }: { sellerId: number; sellerName: string }) {
  const productsQuery = trpc.sales.getSellerProducts.useQuery({ sellerId });
  const setProductsMutation = trpc.sales.setSellerProducts.useMutation();
  const utils = trpc.useUtils();

  // Buscar lista de produtos do estoque para mostrar checkboxes
  const stockQuery = trpc.dashboard.getData.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(["madeira", "bambu"]));

  // Inicializar seleção com produtos já configurados
  useEffect(() => {
    if (productsQuery.data && !initialized) {
      setSelectedProducts(new Set(productsQuery.data.map((p: { productCode: string }) => p.productCode)));
      setInitialized(true);
    }
  }, [productsQuery.data, initialized]);

  const toggleProduct = (code: string) => {
    setSelectedProducts(prev => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  const stockItems: StockItem[] = (stockQuery.data?.items || []) as StockItem[];

  // Separar por categoria
  const madeiraItems = stockItems.filter((item: StockItem) =>
    item.grupo === "industrializacao" && item.subgrupo === "madeira"
  );
  const bambuItems = stockItems.filter((item: StockItem) =>
    item.grupo === "importacao_revenda" && item.subgrupo === "bambu"
  );

  const selectAllCategory = (items: StockItem[]) => {
    setSelectedProducts(prev => {
      const next = new Set(prev);
      items.forEach(item => next.add(item.codigoItem));
      return next;
    });
  };

  const deselectAllCategory = (items: StockItem[]) => {
    setSelectedProducts(prev => {
      const next = new Set(prev);
      items.forEach(item => next.delete(item.codigoItem));
      return next;
    });
  };

  const saveProducts = () => {
    setProductsMutation.mutate(
      { sellerId, productCodes: Array.from(selectedProducts) },
      {
        onSuccess: () => {
          utils.sales.getSellerProducts.invalidate({ sellerId });
        },
      }
    );
  };

  const hasChanges = (() => {
    if (!productsQuery.data) return false;
    const current = new Set(productsQuery.data.map((p: { productCode: string }) => p.productCode));
    if (current.size !== selectedProducts.size) return true;
    const arr = Array.from(selectedProducts);
    for (let i = 0; i < arr.length; i++) {
      if (!current.has(arr[i])) return true;
    }
    return false;
  })();

  const countSelected = (items: StockItem[]) => items.filter(i => selectedProducts.has(i.codigoItem)).length;

  return (
    <div className="mx-6 md:mx-10 mb-3 p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
      {/* Título da seção */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-teal-600" />
          <h4 className="text-sm font-bold text-slate-800">Estoque</h4>
          <span className="text-[10px] text-slate-400 ml-1">
            Produtos visíveis para {sellerName}
          </span>
        </div>
        {hasChanges && (
          <button
            onClick={saveProducts}
            disabled={setProductsMutation.isPending}
            className="flex items-center gap-1 px-3 py-1.5 bg-teal-600 text-white text-xs font-medium rounded-md hover:bg-teal-700 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Check className="w-3 h-3" />
            Salvar
          </button>
        )}
      </div>

      {stockQuery.isLoading ? (
        <p className="text-xs text-slate-400">Carregando produtos...</p>
      ) : (
        <div className="space-y-3">
          {/* Categoria: Madeira */}
          <CategorySection
            title="Madeira"
            items={madeiraItems}
            selectedProducts={selectedProducts}
            isExpanded={expandedCategories.has("madeira")}
            onToggleExpand={() => toggleCategory("madeira")}
            onToggleProduct={toggleProduct}
            onSelectAll={() => selectAllCategory(madeiraItems)}
            onDeselectAll={() => deselectAllCategory(madeiraItems)}
            countSelected={countSelected(madeiraItems)}
            color="amber"
          />

          {/* Categoria: Bambu */}
          <CategorySection
            title="Bambu"
            items={bambuItems}
            selectedProducts={selectedProducts}
            isExpanded={expandedCategories.has("bambu")}
            onToggleExpand={() => toggleCategory("bambu")}
            onToggleProduct={toggleProduct}
            onSelectAll={() => selectAllCategory(bambuItems)}
            onDeselectAll={() => deselectAllCategory(bambuItems)}
            countSelected={countSelected(bambuItems)}
            color="green"
          />
        </div>
      )}

      {setProductsMutation.isSuccess && (
        <p className="text-[10px] text-emerald-600 mt-3">
          Produtos salvos com sucesso! ({selectedProducts.size} selecionados no total)
        </p>
      )}
    </div>
  );
}

/**
 * Seção de categoria com lista de produtos e checkboxes
 */
function CategorySection({
  title,
  items,
  selectedProducts,
  isExpanded,
  onToggleExpand,
  onToggleProduct,
  onSelectAll,
  onDeselectAll,
  countSelected,
  color,
}: {
  title: string;
  items: StockItem[];
  selectedProducts: Set<string>;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggleProduct: (code: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  countSelected: number;
  color: "amber" | "green";
}) {
  const colorClasses = {
    amber: {
      bg: "bg-amber-50",
      border: "border-amber-200",
      badge: "bg-amber-100 text-amber-700",
      icon: "text-amber-600",
    },
    green: {
      bg: "bg-green-50",
      border: "border-green-200",
      badge: "bg-green-100 text-green-700",
      icon: "text-green-600",
    },
  };

  const colors = colorClasses[color];

  return (
    <div className={`rounded-lg border ${colors.border} overflow-hidden`}>
      {/* Header da categoria */}
      <button
        onClick={onToggleExpand}
        className={`w-full flex items-center justify-between px-3 py-2.5 ${colors.bg} hover:opacity-90 transition-opacity cursor-pointer`}
      >
        <div className="flex items-center gap-2">
          <div className={colors.icon}>
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </div>
          <span className="text-xs font-semibold text-slate-700">{title}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${colors.badge}`}>
            {countSelected}/{items.length}
          </span>
        </div>
      </button>

      {/* Lista de produtos */}
      {isExpanded && (
        <div className="bg-white">
          {/* Controles Todos/Nenhum */}
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-slate-100">
            <button
              onClick={(e) => { e.stopPropagation(); onSelectAll(); }}
              className="text-[10px] text-teal-600 hover:text-teal-800 font-medium cursor-pointer"
            >
              Todos
            </button>
            <span className="text-[10px] text-slate-300">|</span>
            <button
              onClick={(e) => { e.stopPropagation(); onDeselectAll(); }}
              className="text-[10px] text-teal-600 hover:text-teal-800 font-medium cursor-pointer"
            >
              Nenhum
            </button>
          </div>

          {items.length > 0 ? (
            <div className="max-h-60 overflow-y-auto">
              {items.map((item: StockItem) => (
                <label
                  key={item.codigoItem}
                  className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-b-0"
                >
                  <input
                    type="checkbox"
                    checked={selectedProducts.has(item.codigoItem)}
                    onChange={() => onToggleProduct(item.codigoItem)}
                    className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer flex-shrink-0"
                  />
                  <span className="text-xs text-slate-700 leading-tight">
                    <span className="font-mono font-semibold text-slate-500">{item.codigoItem}</span>
                    <span className="text-slate-400 mx-1">—</span>
                    <span className="font-medium">{item.descricaoItem}</span>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 px-3 py-3">Nenhum produto nesta categoria.</p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Painel de gestão de Catálogos/PDFs visíveis para um vendedor.
 * O gestor pode: ver todos os PDFs, fazer upload de novos, excluir, e ticar quais o vendedor pode ver.
 */
function SellerCatalogsPanel({ sellerId, sellerName }: { sellerId: number; sellerName: string }) {
  const catalogsQuery = trpc.sales.listCatalogs.useQuery();
  const sellerCatalogsQuery = trpc.sales.getSellerCatalogs.useQuery({ sellerId });
  const setCatalogsMutation = trpc.sales.setSellerCatalogs.useMutation();
  const uploadMutation = trpc.sales.uploadCatalog.useMutation();
  const deleteMutation = trpc.sales.deleteCatalog.useMutation();
  const utils = trpc.useUtils();

  const [selectedCatalogs, setSelectedCatalogs] = useState<Set<number>>(new Set());
  const [initialized, setInitialized] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadFolder, setUploadFolder] = useState("Catálogos");
  const [showUploadForm, setShowUploadForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Inicializar seleção com catálogos já configurados
  useEffect(() => {
    if (sellerCatalogsQuery.data && !initialized) {
      setSelectedCatalogs(new Set(sellerCatalogsQuery.data));
      setInitialized(true);
    }
  }, [sellerCatalogsQuery.data, initialized]);

  const toggleCatalog = (id: number) => {
    setSelectedCatalogs(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const saveCatalogs = () => {
    setCatalogsMutation.mutate(
      { sellerId, catalogIds: Array.from(selectedCatalogs) },
      {
        onSuccess: () => {
          utils.sales.getSellerCatalogs.invalidate({ sellerId });
        },
      }
    );
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setSelectedFile(file);
      if (!uploadName) {
        setUploadName(file.name.replace(/\.pdf$/i, ""));
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !uploadName) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        await uploadMutation.mutateAsync({
          name: uploadName,
          folder: uploadFolder,
          fileBase64: base64,
          fileName: selectedFile.name,
        });
        utils.sales.listCatalogs.invalidate();
        setSelectedFile(null);
        setUploadName("");
        setShowUploadForm(false);
        setUploading(false);
      };
      reader.readAsDataURL(selectedFile);
    } catch {
      setUploading(false);
    }
  };

  const handleDelete = (id: number) => {
    if (!confirm("Excluir este PDF?")) return;
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        utils.sales.listCatalogs.invalidate();
        setSelectedCatalogs(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      },
    });
  };

  const hasChanges = (() => {
    if (!sellerCatalogsQuery.data) return false;
    const current = new Set(sellerCatalogsQuery.data);
    if (current.size !== selectedCatalogs.size) return true;
    const arr = Array.from(selectedCatalogs);
    for (let i = 0; i < arr.length; i++) {
      if (!current.has(arr[i])) return true;
    }
    return false;
  })();

  const allCatalogs = catalogsQuery.data || [];
  // Group by folder
  const folders = Array.from(new Set(allCatalogs.map(c => c.folder)));

  return (
    <div className="mx-6 md:mx-10 mb-3 p-4 bg-white rounded-lg border border-rose-200 shadow-sm">
      {/* Título */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-rose-600" />
          <h4 className="text-sm font-bold text-slate-800">Catálogos / PDFs</h4>
          <span className="text-[10px] text-slate-400 ml-1">
            Visíveis para {sellerName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <button
              onClick={saveCatalogs}
              disabled={setCatalogsMutation.isPending}
              className="flex items-center gap-1 px-3 py-1.5 bg-rose-600 text-white text-xs font-medium rounded-md hover:bg-rose-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Check className="w-3 h-3" />
              Salvar
            </button>
          )}
          <button
            onClick={() => setShowUploadForm(!showUploadForm)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-md hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <Upload className="w-3 h-3" />
            Upload PDF
          </button>
        </div>
      </div>

      {/* Upload Form */}
      {showUploadForm && (
        <div className="mb-4 p-3 bg-rose-50 rounded-lg border border-rose-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-700">Novo PDF</span>
            <button onClick={() => setShowUploadForm(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Nome do catálogo"
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-rose-400"
            />
            <input
              type="text"
              placeholder="Pasta (ex: Catálogos)"
              value={uploadFolder}
              onChange={(e) => setUploadFolder(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-rose-400"
            />
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 text-xs text-slate-600 rounded-md hover:bg-slate-50 cursor-pointer"
              >
                <FileText className="w-3 h-3" />
                {selectedFile ? selectedFile.name : "Escolher arquivo"}
              </button>
              {selectedFile && uploadName && (
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="flex items-center gap-1 px-3 py-1.5 bg-rose-600 text-white text-xs font-medium rounded-md hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
                >
                  {uploading ? "Enviando..." : "Enviar"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lista de catálogos por pasta */}
      {catalogsQuery.isLoading ? (
        <p className="text-xs text-slate-400">Carregando catálogos...</p>
      ) : allCatalogs.length === 0 ? (
        <p className="text-xs text-slate-400">Nenhum catálogo cadastrado. Use o botão "Upload PDF" para adicionar.</p>
      ) : (
        <div className="space-y-3">
          {folders.map(folder => (
            <div key={folder} className="rounded-lg border border-slate-200 overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50">
                <FolderOpen className="w-3.5 h-3.5 text-rose-500" />
                <span className="text-xs font-semibold text-slate-700">{folder}</span>
                <span className="text-[10px] text-slate-400">
                  ({allCatalogs.filter(c => c.folder === folder).length} arquivos)
                </span>
              </div>
              <div className="bg-white divide-y divide-slate-50">
                {allCatalogs.filter(c => c.folder === folder).map(catalog => (
                  <label
                    key={catalog.id}
                    className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCatalogs.has(catalog.id)}
                      onChange={() => toggleCatalog(catalog.id)}
                      className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer flex-shrink-0"
                    />
                    <FileText className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                    <span className="text-xs text-slate-700 font-medium flex-1">{catalog.name}</span>
                    <a
                      href={catalog.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[10px] text-blue-500 hover:text-blue-700 underline"
                    >
                      Ver
                    </a>
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(catalog.id); }}
                      className="text-slate-300 hover:text-red-500 transition-colors cursor-pointer"
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {setCatalogsMutation.isSuccess && (
        <p className="text-[10px] text-emerald-600 mt-3">
          Catálogos salvos com sucesso! ({selectedCatalogs.size} selecionados)
        </p>
      )}
    </div>
  );
}
