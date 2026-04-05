import { bigint, int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, decimal, json } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Estoque items from Maxiprod - raw data collected via scraping
 */
export const stockItems = mysqlTable("stock_items", {
  id: int("id").autoincrement().primaryKey(),
  codigoItem: varchar("codigoItem", { length: 20 }).notNull(),
  descricaoItem: text("descricaoItem").notNull(),
  quantidade: decimal("quantidade", { precision: 18, scale: 5 }).notNull(),
  unidadeMedida: varchar("unidadeMedida", { length: 10 }),
  custoUnitario: decimal("custoUnitario", { precision: 18, scale: 5 }),
  custoTotal: decimal("custoTotal", { precision: 18, scale: 2 }),
  codigoGrupo: varchar("codigoGrupo", { length: 50 }),
  descricaoGrupo: varchar("descricaoGrupo", { length: 100 }),
  codigoSuperGrupo: varchar("codigoSuperGrupo", { length: 50 }),
  descricaoSuperGrupo: varchar("descricaoSuperGrupo", { length: 100 }),
  grupoCodigo: varchar("grupoCodigo", { length: 20 }),
  superGrupoCodigo: varchar("superGrupoCodigo", { length: 20 }),
  empresaDona: varchar("empresaDona", { length: 100 }),
  estoqueLocal: varchar("estoqueLocal", { length: 100 }),
  tipoDecodificado: varchar("tipoDecodificado", { length: 50 }),
  maxiprodId: bigint("maxiprodId", { mode: "number" }),
  unidadeDeVendaFator: decimal("unidadeDeVendaFator", { precision: 18, scale: 5 }),
  collectedAt: timestamp("collectedAt").defaultNow().notNull(),
});

export type StockItem = typeof stockItems.$inferSelect;
export type InsertStockItem = typeof stockItems.$inferInsert;

/**
 * Pedidos de venda items from Maxiprod - raw data collected via scraping
 */
export const orderItems = mysqlTable("order_items", {
  id: int("id").autoincrement().primaryKey(),
  codigoItem: varchar("codigoItem", { length: 20 }).notNull(),
  descricao: text("descricao").notNull(),
  quantidade: decimal("quantidade", { precision: 18, scale: 5 }).notNull(),
  unidadeMedida: varchar("unidadeMedida", { length: 10 }),
  estadoNota: varchar("estadoNota", { length: 50 }),
  estadoItem: varchar("estadoItem", { length: 50 }),
  numeroPedido: varchar("numeroPedido", { length: 20 }),
  cliente: varchar("cliente", { length: 200 }),
  dataEmissao: varchar("dataEmissao", { length: 30 }),
  valorUnitario: decimal("valorUnitario", { precision: 18, scale: 5 }),
  valorTotal: decimal("valorTotal", { precision: 18, scale: 2 }),
  codigoGrupo: varchar("codigoGrupo", { length: 50 }),
  empresaDona: varchar("empresaDona", { length: 100 }),
  fatorConversao: decimal("fatorConversao", { precision: 18, scale: 5 }),
  quantidadeUnEstoque: decimal("quantidadeUnEstoque", { precision: 18, scale: 5 }),
  maxiprodId: bigint("maxiprodId", { mode: "number" }),
  // Novos campos (entrega, NCM)
  dataEntregaItem: varchar("dataEntregaItem", { length: 50 }), // Data de entrega do item
  ncm: varchar("ncm", { length: 20 }), // NCM do produto
  // Estado configurável e segmento CRM
  estadoConfiguravel: varchar("estadoConfiguravel", { length: 100 }), // Estado configurável do pedido (BAMBU, FIBRA, MADEIRA, etc.)
  crmSegmento: varchar("crmSegmento", { length: 100 }), // Segmento CRM do cliente (DISTRIBUIDORA, INDÚST RIA, LOJA, etc.)
  collectedAt: timestamp("collectedAt").defaultNow().notNull(),
});

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = typeof orderItems.$inferInsert;

/**
 * Scraper connection status - tracks login state and last sync
 */
export const scraperStatus = mysqlTable("scraper_status", {
  id: int("id").autoincrement().primaryKey(),
  isConnected: boolean("isConnected").default(false).notNull(),
  lastSyncAt: timestamp("lastSyncAt"),
  lastSyncStatus: varchar("lastSyncStatus", { length: 50 }),
  lastError: text("lastError"),
  needsMfa: boolean("needsMfa").default(false).notNull(),
  mfaCode: varchar("mfaCode", { length: 10 }),
  sessionCookies: text("sessionCookies"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ScraperStatus = typeof scraperStatus.$inferSelect;

/**
 * Processed dashboard data - the final computed view for the frontend
 */
export const dashboardData = mysqlTable("dashboard_data", {
  id: int("id").autoincrement().primaryKey(),
  empresa: varchar("empresa", { length: 100 }).notNull(),
  dataJson: json("dataJson").notNull(),
  computedAt: timestamp("computedAt").defaultNow().notNull(),
});

export type DashboardData = typeof dashboardData.$inferSelect;

/**
 * Pedidos de compra (Purchase Orders) items from Maxiprod
 * Tracks incoming goods that are expected to arrive
 */
export const purchaseOrderItems = mysqlTable("purchase_order_items", {
  id: int("id").autoincrement().primaryKey(),
  codigoItem: varchar("codigoItem", { length: 20 }),
  descricaoItem: text("descricaoItem"), // Descrição do item (item.descricao) - pode diferir da descricao do pedido
  descricao: text("descricao").notNull(),
  quantidade: decimal("quantidade", { precision: 18, scale: 5 }).notNull(),
  quantidadeUnEstoque: decimal("quantidadeUnEstoque", { precision: 18, scale: 5 }),
  fatorConversao: decimal("fatorConversao", { precision: 18, scale: 5 }),
  unidadeMedida: varchar("unidadeMedida", { length: 10 }),
  unidadeMedidaEstoque: varchar("unidadeMedidaEstoque", { length: 10 }),
  dataEntrega: varchar("dataEntrega", { length: 30 }),
  dataEmissao: varchar("dataEmissao", { length: 30 }),
  estadoPedido: varchar("estadoPedido", { length: 50 }),
  estadoItem: varchar("estadoItem", { length: 50 }),
  fornecedor: varchar("fornecedor", { length: 200 }),
  valorTotal: decimal("valorTotal", { precision: 18, scale: 2 }),
  valorUnitario: decimal("valorUnitario", { precision: 18, scale: 5 }),
  numeroPedido: varchar("numeroPedido", { length: 20 }),
  referencia: varchar("referencia", { length: 100 }),
  numeroItem: int("numeroItem"),
  codigoGrupo: varchar("codigoGrupo", { length: 50 }),
  codigoCFOP: varchar("codigoCFOP", { length: 10 }),
  empresaDona: varchar("empresaDona", { length: 100 }),
  maxiprodId: bigint("maxiprodId", { mode: "number" }),
  collectedAt: timestamp("collectedAt").defaultNow().notNull(),
});

export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;
export type InsertPurchaseOrderItem = typeof purchaseOrderItems.$inferInsert;

/**
 * Itens de notas fiscais de saída (vendas) - para cálculo de preço médio
 */
export const salesInvoiceItems = mysqlTable("sales_invoice_items", {
  id: int("id").autoincrement().primaryKey(),
  codigoItem: varchar("codigoItem", { length: 20 }).notNull(),
  descricao: text("descricao").notNull(),
  quantidade: decimal("quantidade", { precision: 18, scale: 5 }).notNull(),
  quantidadeUnEstoque: decimal("quantidadeUnEstoque", { precision: 18, scale: 5 }),
  fatorConversao: decimal("fatorConversao", { precision: 18, scale: 5 }),
  unidadeMedida: varchar("unidadeMedida", { length: 10 }),
  unidadeMedidaEstoque: varchar("unidadeMedidaEstoque", { length: 10 }),
  valorUnitario: decimal("valorUnitario", { precision: 18, scale: 5 }),
  valorTotal: decimal("valorTotal", { precision: 18, scale: 2 }),
  valorTotalComDesconto: decimal("valorTotalComDesconto", { precision: 18, scale: 2 }),
  dataEmissao: varchar("dataEmissao", { length: 30 }),
  codigoGrupo: varchar("codigoGrupo", { length: 50 }),
  codigoCFOP: varchar("codigoCFOP", { length: 10 }),
  empresaDona: varchar("empresaDona", { length: 100 }),
  collectedAt: timestamp("collectedAt").defaultNow().notNull(),
});

export type SalesInvoiceItem = typeof salesInvoiceItems.$inferSelect;
export type InsertSalesInvoiceItem = typeof salesInvoiceItems.$inferInsert;

/**
 * Pedidos de venda completos (todos os status) - para analytics de vendas
 * Coletados da tela "Itens dos pedidos de venda" do Maxiprod
 */
export const salesOrders = mysqlTable("sales_orders", {
  id: int("id").autoincrement().primaryKey(),
  dataEmissao: varchar("dataEmissao", { length: 50 }),
  dataEntrega: varchar("dataEntrega", { length: 50 }),
  dataAprovacao: varchar("dataAprovacao", { length: 50 }),
  pedido: varchar("pedido", { length: 20 }),
  cliente: varchar("cliente", { length: 300 }),
  clienteApelido: varchar("clienteApelido", { length: 200 }),
  uf: varchar("uf", { length: 5 }),
  descricao: text("descricao"),
  estadoItem: varchar("estadoItem", { length: 50 }),
  quantidade: decimal("quantidade", { precision: 18, scale: 5 }),
  valorUnitario: decimal("valorUnitario", { precision: 18, scale: 5 }),
  valorTotal: decimal("valorTotal", { precision: 18, scale: 2 }),
  valorContabil: decimal("valorContabil", { precision: 18, scale: 2 }),
  valorFaturar: decimal("valorFaturar", { precision: 18, scale: 2 }),
  fatorConversao: decimal("fatorConversao", { precision: 18, scale: 5 }),
  codigoGrupo: varchar("codigoGrupo", { length: 50 }),
  idGrupoItem: bigint("idGrupoItem", { mode: "number" }),
  empresa: varchar("empresa", { length: 100 }),
  representante: varchar("representante", { length: 200 }),
  segmento: varchar("segmento", { length: 100 }),
  regiao: varchar("regiao", { length: 100 }),
  // Novos campos (detalhes do pedido)
  condicaoPagamento: varchar("condicaoPagamento", { length: 100 }), // Ex: "30 45 60"
  transportadora: varchar("transportadora", { length: 300 }), // Nome da transportadora
  razaoSocial: varchar("razaoSocial", { length: 300 }), // Razão social do cliente
  inscricaoEstadual: varchar("inscricaoEstadual", { length: 30 }), // IE do cliente
  enderecoLogradouro: varchar("enderecoLogradouro", { length: 300 }),
  enderecoNumero: varchar("enderecoNumero", { length: 20 }),
  enderecoComplemento: varchar("enderecoComplemento", { length: 200 }),
  enderecoBairro: varchar("enderecoBairro", { length: 200 }),
  enderecoCep: varchar("enderecoCep", { length: 15 }),
  enderecoCidade: varchar("enderecoCidade", { length: 200 }), // municipio.descricao
  valorTotalPedido: decimal("valorTotalPedido", { precision: 18, scale: 2 }), // Valor total do pedido (não do item)
  estadoNota: varchar("estadoNotaPedido", { length: 50 }), // Estado do pedido (Digitação, A aprovar, Aprovado, etc.)
  estadoConfiguravel: varchar("estadoConfiguravel", { length: 100 }), // Estado configurável do pedido (BAMBU, FIBRA, MADEIRA, etc.)
  crmSegmento: varchar("crmSegmento", { length: 100 }), // Segmento CRM do cliente (DISTRIBUIDORA, INDÚSTRIA, LOJA, etc.)
  codigoItem: varchar("codigoItem", { length: 50 }), // Código do item/produto no Maxiprod (item.codigo)
  descricaoItem: text("descricaoItem"), // Descrição do item (item.descricao) - pode diferir da descricao do pedido
  // Campos adicionais para detalhes completos (produção)
  unidadeMedidaCodigo: varchar("unidadeMedidaCodigo", { length: 10 }), // Código da unidade de medida (CX, KG, UN, etc.)
  unidadeMedidaDescricao: varchar("unidadeMedidaDescricao", { length: 50 }), // Descrição da unidade (caixa, quilograma, etc.)
  quantidadeUnidadeItem: decimal("quantidadeUnidadeItem", { precision: 18, scale: 5 }), // Quantidade na unidade do item
  ncm: varchar("ncm", { length: 20 }), // NCM do produto
  clienteTelefone: varchar("clienteTelefone", { length: 50 }), // Telefone do cliente (endereco.telefone1)
  clienteEmail: varchar("clienteEmail", { length: 200 }), // Email do cliente (endereco.email)
  transportadoraRazaoSocial: varchar("transportadoraRazaoSocial", { length: 300 }), // Razão social da transportadora
  grupoDescricao: varchar("grupoDescricao", { length: 100 }), // Descrição do grupo do item (VARETA, ESPETO, etc.)
  observacoes: text("observacoes"), // Observações do pedido de venda (campo livre do comercial para a produção)
  quantidadeFaturada: decimal("quantidadeFaturada", { precision: 18, scale: 5 }), // Quantidade já faturada (entregaFuturaQuantidadeEntregue do Maxiprod)
  collectedAt: timestamp("collectedAt").defaultNow().notNull(),
});

export type SalesOrder = typeof salesOrders.$inferSelect;
export type InsertSalesOrder = typeof salesOrders.$inferInsert;

/**
 * Configurações do aplicativo - armazena settings gerais e metas
 */
export const appSettings = mysqlTable("app_settings", {
  id: int("id").autoincrement().primaryKey(),
  settingKey: varchar("setting_key", { length: 100 }).notNull().unique(),
  settingValue: json("setting_value"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AppSetting = typeof appSettings.$inferSelect;
export type InsertAppSetting = typeof appSettings.$inferInsert;

/**
 * Metas de vendas mensais por segmento
 */
export const salesTargets = mysqlTable("sales_targets", {
  id: int("id").autoincrement().primaryKey(),
  yearMonth: varchar("year_month", { length: 7 }).notNull(), // e.g. "2026-03"
  segment: varchar("segment", { length: 50 }).notNull(), // "all", "industrializacao", "importacao"
  targetValue: decimal("target_value", { precision: 18, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SalesTarget = typeof salesTargets.$inferSelect;
export type InsertSalesTarget = typeof salesTargets.$inferInsert;

/**
 * Overrides de segmento por produto - permite reclassificar produtos entre segmentos
 * Quando um produto tem override, o segmento definido aqui tem prioridade sobre o codigoGrupo
 */
export const productSegmentOverrides = mysqlTable("product_segment_overrides", {
  id: int("id").autoincrement().primaryKey(),
  descricao: text("descricao").notNull(), // Descrição do produto (chave de match)
  codigoGrupo: varchar("codigoGrupo", { length: 10 }), // Código do grupo original
  segment: varchar("segment", { length: 50 }).notNull(), // "industrializacao" ou "importacao"
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProductSegmentOverride = typeof productSegmentOverrides.$inferSelect;
export type InsertProductSegmentOverride = typeof productSegmentOverrides.$inferInsert;

/**
 * Visibilidade de produtos no dashboard de estoque
 * Permite ocultar/mostrar produtos individualmente
 * Por padrão, todos os produtos são visíveis (se não houver registro, é visível)
 */
export const productVisibility = mysqlTable("product_visibility", {
  id: int("id").autoincrement().primaryKey(),
  descricao: text("descricao").notNull(), // Descrição do produto (chave de match)
  codigoItem: varchar("codigoItem", { length: 20 }), // Código do item no Maxiprod
  visible: boolean("visible").default(true).notNull(), // Se aparece no dashboard
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProductVisibility = typeof productVisibility.$inferSelect;
export type InsertProductVisibility = typeof productVisibility.$inferInsert;

/**
 * Contas a Pagar - dados financeiros do Maxiprod (SOMENTE LEITURA)
 * Sincronizado via GraphQL API
 */
export const accountsPayable = mysqlTable("accounts_payable", {
  id: int("id").autoincrement().primaryKey(),
  maxiprodId: bigint("maxiprodId", { mode: "number" }).notNull(),
  estado: varchar("estado", { length: 30 }).notNull(), // EMITIDO, PAGO, CANCELADO, DIGITACAO, etc.
  tipo: varchar("tipo", { length: 50 }), // TITULO, DESPESA, ADIANTAMENTO, etc.
  valorOriginal: decimal("valorOriginal", { precision: 18, scale: 2 }),
  valorLiquido: decimal("valorLiquido", { precision: 18, scale: 2 }),
  valorRetido: decimal("valorRetido", { precision: 18, scale: 2 }),
  valorDeDesconto: decimal("valorDeDesconto", { precision: 18, scale: 2 }),
  valorDeAcrescimo: decimal("valorDeAcrescimo", { precision: 18, scale: 2 }),
  valorPagoLiquido: decimal("valorPagoLiquido", { precision: 18, scale: 2 }),
  emissaoData: varchar("emissaoData", { length: 50 }),
  vencimentoData: varchar("vencimentoData", { length: 50 }),
  vencimentoOriginalData: varchar("vencimentoOriginalData", { length: 50 }),
  liquidacaoData: varchar("liquidacaoData", { length: 50 }),
  referenteA: text("referenteA"),
  parcela: int("parcela"),
  parcelasQuantidadeTotal: int("parcelasQuantidadeTotal"),
  observacoes: text("observacoes"),
  documentoVinculadoNumero: varchar("documentoVinculadoNumero", { length: 100 }),
  bloqueado: boolean("bloqueado").default(false),
  fornecedor: varchar("fornecedor", { length: 300 }),
  fornecedorApelido: varchar("fornecedorApelido", { length: 300 }),
  centroDeCustosId: bigint("centroDeCustosId", { mode: "number" }),
  contaId: bigint("contaId", { mode: "number" }),
  empresaId: bigint("empresaId", { mode: "number" }),
  empresaNome: varchar("empresaNome", { length: 100 }),
  collectedAt: timestamp("collectedAt").defaultNow().notNull(),
});

export type AccountPayable = typeof accountsPayable.$inferSelect;
export type InsertAccountPayable = typeof accountsPayable.$inferInsert;

/**
 * Contas a Receber - dados financeiros do Maxiprod (SOMENTE LEITURA)
 * Sincronizado via GraphQL API
 */
export const accountsReceivable = mysqlTable("accounts_receivable", {
  id: int("id").autoincrement().primaryKey(),
  maxiprodId: bigint("maxiprodId", { mode: "number" }).notNull(),
  estado: varchar("estado", { length: 30 }).notNull(), // EMITIDO, RECEBIDO, CANCELADO, DIGITACAO, etc.
  tipo: varchar("tipo", { length: 50 }), // TITULO, RECEITA, ADIANTAMENTO, etc.
  valorOriginal: decimal("valorOriginal", { precision: 18, scale: 2 }),
  valorLiquido: decimal("valorLiquido", { precision: 18, scale: 2 }),
  valorRetido: decimal("valorRetido", { precision: 18, scale: 2 }),
  valorDeDesconto: decimal("valorDeDesconto", { precision: 18, scale: 2 }),
  valorDeAcrescimo: decimal("valorDeAcrescimo", { precision: 18, scale: 2 }),
  valorRecebidoLiquido: decimal("valorRecebidoLiquido", { precision: 18, scale: 2 }),
  emissaoData: varchar("emissaoData", { length: 50 }),
  vencimentoData: varchar("vencimentoData", { length: 50 }),
  vencimentoOriginalData: varchar("vencimentoOriginalData", { length: 50 }),
  liquidacaoData: varchar("liquidacaoData", { length: 50 }),
  referenteA: text("referenteA"),
  parcela: int("parcela"),
  parcelasQuantidadeTotal: int("parcelasQuantidadeTotal"),
  observacoes: text("observacoes"),
  documentoVinculadoNumero: varchar("documentoVinculadoNumero", { length: 100 }),
  bloqueado: boolean("bloqueado").default(false),
  cliente: varchar("cliente", { length: 300 }),
  centroDeCustosId: bigint("centroDeCustosId", { mode: "number" }),
  contaId: bigint("contaId", { mode: "number" }),
  bancoNome: varchar("bancoNome", { length: 200 }),
  contaNumero: varchar("contaNumero", { length: 30 }),
  agencia: varchar("agencia", { length: 20 }),
  empresaId: bigint("empresaId", { mode: "number" }),
  empresaNome: varchar("empresaNome", { length: 100 }),
  collectedAt: timestamp("collectedAt").defaultNow().notNull(),
});

export type AccountReceivable = typeof accountsReceivable.$inferSelect;
export type InsertAccountReceivable = typeof accountsReceivable.$inferInsert;

/**
 * Contas bancárias do Maxiprod (FormaDeCobranca)
 * Sincronizado automaticamente via GraphQL API
 * O saldo inicial é inserido manualmente pelo usuário na tela de Config
 */
export const bankAccounts = mysqlTable("bank_accounts", {
  id: int("id").autoincrement().primaryKey(),
  maxiprodId: bigint("maxiprodId", { mode: "number" }).notNull().unique(),
  bancoNome: varchar("bancoNome", { length: 200 }),
  agencia: varchar("agencia", { length: 20 }),
  contaNumero: varchar("contaNumero", { length: 30 }),
  empresaId: bigint("empresaId", { mode: "number" }),
  empresaNome: varchar("empresaNome", { length: 100 }),
  ativo: boolean("ativo").default(true),
  // Saldo inicial inserido manualmente pelo usuário
  saldoInicial: decimal("saldoInicial", { precision: 18, scale: 2 }).default("0"),
  saldoInicialData: varchar("saldoInicialData", { length: 30 }), // Data de referência do saldo inicial (YYYY-MM-DD)
  // Saldo contábil do balancete (calculado automaticamente via GraphQL)
  codigoEstruturado: varchar("codigoEstruturado", { length: 30 }), // Ex: 1.01.01.02.01
  contaContabilId: bigint("contaContabilId", { mode: "number" }), // ID da conta contábil no Maxiprod
  saldoContabil: decimal("saldoContabil", { precision: 18, scale: 2 }).default("0"), // Saldo do balancete (débitos - créditos)
  totalDebitos: decimal("totalDebitos", { precision: 18, scale: 2 }).default("0"),
  totalCreditos: decimal("totalCreditos", { precision: 18, scale: 2 }).default("0"),
  saldoContabilAtualizadoEm: timestamp("saldoContabilAtualizadoEm"),
  collectedAt: timestamp("collectedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BankAccount = typeof bankAccounts.$inferSelect;
export type InsertBankAccount = typeof bankAccounts.$inferInsert;

/**
 * Movimentações bancárias OFX do Maxiprod
 * Sincronizado automaticamente via GraphQL API (SOMENTE LEITURA)
 */
export const bankTransactions = mysqlTable("bank_transactions", {
  id: int("id").autoincrement().primaryKey(),
  maxiprodId: bigint("maxiprodId", { mode: "number" }).notNull().unique(),
  data: varchar("data", { length: 30 }).notNull(), // YYYY-MM-DD
  descricao: text("descricao"),
  valor: decimal("valor", { precision: 18, scale: 2 }).notNull(),
  contaBancariaId: bigint("contaBancariaId", { mode: "number" }).notNull(), // FK para bankAccounts.maxiprodId
  collectedAt: timestamp("collectedAt").defaultNow().notNull(),
});

export type BankTransaction = typeof bankTransactions.$inferSelect;
export type InsertBankTransaction = typeof bankTransactions.$inferInsert;

/**
 * Classificação de produtos - define a estratégia de estoque para cada produto
 * Opções mutuamente exclusivas: estoque (manter em estoque), encomenda (sob encomenda), outros
 * Se não houver registro, o produto não está classificado
 */
export const productClassification = mysqlTable("product_classification", {
  id: int("id").autoincrement().primaryKey(),
  codigoItem: varchar("codigoItem", { length: 20 }).notNull().unique(),
  descricao: text("descricao"),
  classification: mysqlEnum("classification", ["estoque", "encomenda", "outros"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProductClassification = typeof productClassification.$inferSelect;
export type InsertProductClassification = typeof productClassification.$inferInsert;

/**
 * Product pricing - manual price override for stock valuation
 */
export const productPricing = mysqlTable("product_pricing", {
  id: int("id").autoincrement().primaryKey(),
  codigoItem: varchar("codigoItem", { length: 20 }).notNull().unique(),
  mode: mysqlEnum("mode", ["auto", "manual"]).notNull().default("auto"),
  manualPrice: decimal("manualPrice", { precision: 18, scale: 2 }),
  vendaMensal: int("venda_mensal"), // Venda mensal em caixas (preenchido manualmente)
  fatorMultiplicacao: decimal("fator_multiplicacao", { precision: 5, scale: 2 }), // Fator de multiplicação (padrão 2.3)
  prazoCompraDias: int("prazo_compra_dias"), // Prazo em dias para acionar compra (preenchido manualmente)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProductPricing = typeof productPricing.$inferSelect;
export type InsertProductPricing = typeof productPricing.$inferInsert;

/**
 * Autorizações de faturamento - controla quais pedidos foram autorizados pela produção
 * Fluxo: Em Aberto → Autorizado a Faturar → Faturado
 * A autorização é feita manualmente pela produção via dashboard (protegida por senha)
 * Quando o pedido é faturado no Maxiprod, ele sai automaticamente deste card
 */
export const billingAuthorizations = mysqlTable("billing_authorizations", {
  id: int("id").autoincrement().primaryKey(),
  pedido: varchar("pedido", { length: 20 }).notNull().unique(), // Número do pedido de venda
  authorizedBy: varchar("authorizedBy", { length: 200 }), // Quem autorizou (futuro)
  authorizedAt: timestamp("authorizedAt").defaultNow().notNull(),
});

export type BillingAuthorization = typeof billingAuthorizations.$inferSelect;
export type InsertBillingAuthorization = typeof billingAuthorizations.$inferInsert;

/**
 * Conciliação diária - registra a conciliação financeira de cada dia da semana
 * Cada registro representa um dia (seg-sex) da semana corrente
 * O usuário marca como conciliado e pode adicionar observações
 */
export const dailyReconciliation = mysqlTable("daily_reconciliation", {
  id: int("id").autoincrement().primaryKey(),
  date: varchar("date", { length: 10 }).notNull().unique(), // YYYY-MM-DD
  reconciled: boolean("reconciled").default(false).notNull(),
  notes: text("notes"), // Observações do dia
  totalRecebido: decimal("totalRecebido", { precision: 18, scale: 2 }), // Valor recebido no dia
  totalPago: decimal("totalPago", { precision: 18, scale: 2 }), // Valor pago no dia
  saldo: decimal("saldo", { precision: 18, scale: 2 }), // Saldo do dia (recebido - pago)
  reconciledBy: varchar("reconciledBy", { length: 200 }), // Quem conciliou
  reconciledAt: timestamp("reconciledAt"), // Quando foi conciliado
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DailyReconciliation = typeof dailyReconciliation.$inferSelect;
export type InsertDailyReconciliation = typeof dailyReconciliation.$inferInsert;

/**
 * Autorizações de pagamento - controla quais contas a pagar foram autorizadas pelo Fernando
 * Fluxo: Conta aparece no card semanal → Fernando seleciona status → Financeiro executa
 * Cada registro vincula um maxiprodId de accounts_payable a um status de autorização
 * Status: autorizado, nao_autorizado, autorizado_ressalva, prorrogar, outros
 */
export const paymentAuthorizations = mysqlTable("payment_authorizations", {
  id: int("id").autoincrement().primaryKey(),
  accountPayableId: bigint("accountPayableId", { mode: "number" }).notNull(), // maxiprodId da conta a pagar
  status: mysqlEnum("status", ["autorizado", "nao_autorizado", "autorizado_ressalva", "prorrogar", "outros"]).notNull().default("autorizado"),
  notes: text("notes"), // Comentário/observação opcional
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PaymentAuthorization = typeof paymentAuthorizations.$inferSelect;
export type InsertPaymentAuthorization = typeof paymentAuthorizations.$inferInsert;

/**
 * Relacionamento Produto Pai / Variação
 * Quando uma variação é vendida, o estoque do produto pai é consumido proporcionalmente.
 * O fator de conversão é calculado como: unidades_variacao / unidades_pai
 * Ex: Pai 10.000 un/cx, Variação 5.000 un/cx → fator = 0.5 (1 cx variação = 0.5 cx pai)
 */
export const productVariants = mysqlTable("product_variants", {
  id: int("id").autoincrement().primaryKey(),
  parentCode: varchar("parentCode", { length: 20 }).notNull(), // codigoItem do produto pai
  childCode: varchar("childCode", { length: 20 }).notNull(), // codigoItem da variação
  conversionFactor: decimal("conversionFactor", { precision: 10, scale: 5 }).notNull(), // fator: un_child / un_parent
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProductVariant = typeof productVariants.$inferSelect;
export type InsertProductVariant = typeof productVariants.$inferInsert;

/**
 * Aceite da Produção - controla quais pedidos foram aceitos pela produção
 * Fluxo: Pedido Aprovado → Aceite da Produção (por grupo) → Pedidos em Aberto (A faturar)
 * Pedidos aprovados aparecem no card de aceite até a produção confirmar.
 * Após aceite, o pedido passa para o card "Em Aberto".
 */
export const productionAcceptance = mysqlTable("production_acceptance", {
  id: int("id").autoincrement().primaryKey(),
  pedido: varchar("pedido", { length: 20 }).notNull().unique(), // Número do pedido de venda
  acceptedBy: varchar("acceptedBy", { length: 200 }), // Quem aceitou
  acceptedAt: timestamp("acceptedAt").defaultNow().notNull(),
  orderHash: varchar("orderHash", { length: 64 }), // Hash dos dados do pedido no momento do aceite (para detectar alterações)
  wasModified: boolean("wasModified").default(false).notNull(), // Flag: pedido foi modificado no Maxiprod após aceite
  modifiedAt: timestamp("modifiedAt"), // Quando a modificação foi detectada
});

export type ProductionAcceptance = typeof productionAcceptance.$inferSelect;
export type InsertProductionAcceptance = typeof productionAcceptance.$inferInsert;

/**
 * Observações da Produção - notas sobre o status do pedido na produção
 * Visível pelo comercial, editável apenas com senha da produção
 * Permite a produção informar ao comercial como está o andamento do pedido
 */
export const productionNotes = mysqlTable("production_notes", {
  id: int("id").autoincrement().primaryKey(),
  pedido: varchar("pedido", { length: 20 }).notNull().unique(), // Número do pedido de venda
  note: text("note").notNull(), // Observação da produção
  updatedBy: varchar("updatedBy", { length: 200 }), // Quem editou por último
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProductionNote = typeof productionNotes.$inferSelect;
export type InsertProductionNote = typeof productionNotes.$inferInsert;

/**
 * Status da produção para pedidos em aberto.
 * Permite a produção informar em que etapa está o pedido dentro da indústria.
 * Só existe para pedidos em aberto; ao autorizar faturamento, o status some.
 */
export const productionStatus = mysqlTable("production_status", {
  id: int("id").autoincrement().primaryKey(),
  pedido: varchar("pedido", { length: 20 }).notNull().unique(),
  status: varchar("status", { length: 50 }).notNull(),
  updatedBy: varchar("updatedBy", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProductionStatus = typeof productionStatus.$inferSelect;
export type InsertProductionStatus = typeof productionStatus.$inferInsert;

/**
 * Status de coleta para pedidos faturados.
 * Dois checkboxes: pedidoColeta (coleta solicitada) e coletado (mercadoria coletada).
 * Protegidos por senha. Aparecem apenas no card Faturados.
 */
export const collectionStatus = mysqlTable("collection_status", {
  id: int("id").autoincrement().primaryKey(),
  pedido: varchar("pedido", { length: 20 }).notNull().unique(),
  pedidoColeta: boolean("pedidoColeta").default(false).notNull(),
  coletado: boolean("coletado").default(false).notNull(),
  updatedBy: varchar("updatedBy", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CollectionStatus = typeof collectionStatus.$inferSelect;
export type InsertCollectionStatus = typeof collectionStatus.$inferInsert;

/**
 * Seleção de transportadora para pedidos faturados.
 * Protegido por senha. Aparece apenas no card Faturados.
 */
export const transportSelection = mysqlTable("transport_selection", {
  id: int("id").autoincrement().primaryKey(),
  pedido: varchar("pedido", { length: 20 }).notNull().unique(),
  transportadora: varchar("transportadora", { length: 100 }).notNull(),
  updatedBy: varchar("updatedBy", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TransportSelection = typeof transportSelection.$inferSelect;
export type InsertTransportSelection = typeof transportSelection.$inferInsert;

/**
 * Agendamento de coleta para pedidos faturados.
 * Seletor de data e horário (hora em hora). Aparece entre Coletado e Itens no card Faturados.
 * Protegido por senha.
 */
export const pickupSchedule = mysqlTable("pickup_schedule", {
  id: int("id").autoincrement().primaryKey(),
  pedido: varchar("pedido", { length: 20 }).notNull().unique(),
  pickupDate: varchar("pickupDate", { length: 10 }).notNull(), // DD/MM/YYYY
  pickupHour: int("pickupHour").notNull(), // 0-23
  updatedBy: varchar("updatedBy", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PickupSchedule = typeof pickupSchedule.$inferSelect;
export type InsertPickupSchedule = typeof pickupSchedule.$inferInsert;

/**
 * Link de rastreio de transporte para pedidos faturados.
 * Permite inserir manualmente o link de rastreio ao lado da transportadora.
 * Protegido por permissão granular fat.rastreio.
 */
export const trackingLinks = mysqlTable("tracking_links", {
  id: int("id").autoincrement().primaryKey(),
  pedido: varchar("pedido", { length: 20 }).notNull().unique(),
  trackingUrl: text("trackingUrl").notNull(),
  updatedBy: varchar("updatedBy", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type TrackingLink = typeof trackingLinks.$inferSelect;
export type InsertTrackingLink = typeof trackingLinks.$inferInsert;

/**
 * Snapshot mensal de contas pagas do Maxiprod.
 * O Maxiprod purga dados de contas pagas (estado=PAGO) após ~2 meses,
 * então armazenamos localmente para manter histórico completo.
 * 
 * Atualizado automaticamente durante o sync periódico.
 * Chave única: yearMonth (formato "YYYY-MM")
 */
export const paidAccountsMonthly = mysqlTable("paid_accounts_monthly", {
  id: int("id").autoincrement().primaryKey(),
  yearMonth: varchar("yearMonth", { length: 7 }).notNull().unique(), // "2026-03"
  totalPago: decimal("totalPago", { precision: 18, scale: 2 }).notNull(), // R$ total pago
  count: int("count").notNull(), // número de contas
  source: varchar("source", { length: 20 }).notNull().default("liquidacaoData"), // campo usado na query
  isComplete: boolean("isComplete").notNull().default(true), // se o mês tem dados completos
  lastUpdated: timestamp("lastUpdated").defaultNow().onUpdateNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PaidAccountsMonthly = typeof paidAccountsMonthly.$inferSelect;
export type InsertPaidAccountsMonthly = typeof paidAccountsMonthly.$inferInsert;

/**
 * Operadores do sistema com senhas e permissões por seção.
 * Cada operador tem uma senha e checkboxes de acesso a cada área do dashboard.
 */
export const operators = mysqlTable("operators", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  password: varchar("password", { length: 255 }).notNull().default(""),
  accessEstoque: boolean("accessEstoque").notNull().default(false),
  accessVendas: boolean("accessVendas").notNull().default(false),
  accessFaturamento: boolean("accessFaturamento").notNull().default(false),
  accessFinanceiro: boolean("accessFinanceiro").notNull().default(false),
  accessConfiguracoes: boolean("accessConfiguracoes").notNull().default(false),
  accessValorizacao: boolean("accessValorizacao").notNull().default(false),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Operator = typeof operators.$inferSelect;
export type InsertOperator = typeof operators.$inferInsert;

/**
 * Permissões granulares por operador.
 * Cada registro mapeia operadorId + permissionKey -> enabled.
 * Permite controle fino de botões/ações individuais dentro de cada aba.
 */
export const operatorGranularPermissions = mysqlTable("operator_granular_permissions", {
  id: int("id").autoincrement().primaryKey(),
  operatorId: int("operatorId").notNull(),
  permissionKey: varchar("permissionKey", { length: 80 }).notNull(),
  enabled: boolean("enabled").notNull().default(false),
});
export type OperatorGranularPermission = typeof operatorGranularPermissions.$inferSelect;
export type InsertOperatorGranularPermission = typeof operatorGranularPermissions.$inferInsert;

/**
 * Observações de faturamento - notas sobre pedidos "Autorizado a Faturar"
 * Permite explicar por que um pedido não foi faturado ainda.
 * Protegido por permissão granular fat.observacaoFaturar.
 */
export const billingObservations = mysqlTable("billing_observations", {
  id: int("id").autoincrement().primaryKey(),
  pedido: varchar("pedido", { length: 20 }).notNull().unique(),
  observation: text("observation").notNull(),
  updatedBy: varchar("updatedBy", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type BillingObservation = typeof billingObservations.$inferSelect;
export type InsertBillingObservation = typeof billingObservations.$inferInsert;

/**
 * Notificações do sistema - histórico de alertas gerados automaticamente.
 * Tipos: novo_pedido, pedido_modificado, campo_obrigatorio, senha_invalida, sync_erro, etc.
 * Cada notificação tem um tipo, título, mensagem, e metadados (JSON).
 * Notificações são geradas automaticamente durante sincronização e ações do sistema.
 */
export const systemNotifications = mysqlTable("system_notifications", {
  id: int("id").autoincrement().primaryKey(),
  type: varchar("type", { length: 50 }).notNull(), // novo_pedido, pedido_modificado, campo_obrigatorio, senha_invalida, sync_erro, alerta_estoque
  title: varchar("title", { length: 300 }).notNull(),
  message: text("message").notNull(),
  severity: mysqlEnum("severity", ["info", "warning", "error", "success"]).notNull().default("info"),
  metadata: json("metadata"), // JSON com dados extras (pedido, operador, campos faltantes, etc.)
  readAt: timestamp("readAt"), // null = não lida
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SystemNotification = typeof systemNotifications.$inferSelect;
export type InsertSystemNotification = typeof systemNotifications.$inferInsert;

/**
 * Leituras de notificações por operador.
 * Cada operador tem seu próprio registro de leitura independente.
 * Se não existe registro para (notificationId, operatorId), a notificação é "não lida" para aquele operador.
 */
export const notificationReads = mysqlTable("notification_reads", {
  id: int("id").autoincrement().primaryKey(),
  notificationId: int("notification_id").notNull(),
  operatorId: int("operator_id").notNull(),
  readAt: timestamp("readAt").defaultNow().notNull(),
});
export type NotificationRead = typeof notificationReads.$inferSelect;
export type InsertNotificationRead = typeof notificationReads.$inferInsert;

/**
 * Conciliação bancária diária.
 * Registra quando a conciliação foi feita em um determinado dia.
 * Reseta automaticamente no dia seguinte (verificado por data).
 * Apenas operador "Thiago" pode marcar.
 */
export const bankReconciliation = mysqlTable("bank_reconciliation", {
  id: int("id").autoincrement().primaryKey(),
  date: varchar("date", { length: 10 }).notNull().unique(), // YYYY-MM-DD
  checkedBy: varchar("checkedBy", { length: 200 }).notNull(),
  checkedAt: timestamp("checkedAt").defaultNow().notNull(),
});
export type BankReconciliation = typeof bankReconciliation.$inferSelect;
export type InsertBankReconciliation = typeof bankReconciliation.$inferInsert;

/**
 * Estoque manual de produtos semi prontos (madeira).
 * Puramente informativo - sem relação com outros dados do sistema.
 * Operadores preenchem manualmente a quantidade em estoque.
 */
export const semiProntoStock = mysqlTable("semi_pronto_stock", {
  id: int("id").autoincrement().primaryKey(),
  codigoItem: varchar("codigoItem", { length: 20 }).notNull().unique(),
  quantidade: decimal("quantidade", { precision: 18, scale: 5 }).notNull().default("0"),
  updatedBy: varchar("updatedBy", { length: 200 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type SemiProntoStock = typeof semiProntoStock.$inferSelect;
export type InsertSemiProntoStock = typeof semiProntoStock.$inferInsert;

/**
 * Estoque manual de produtos aguardando escolha (madeira).
 * Puramente informativo - sem relação com outros dados do sistema.
 * Operadores preenchem manualmente a quantidade em estoque.
 */
export const aguardandoEscolhaStock = mysqlTable("aguardando_escolha_stock", {
  id: int("id").autoincrement().primaryKey(),
  codigoItem: varchar("codigoItem", { length: 20 }).notNull().unique(),
  quantidade: decimal("quantidade", { precision: 18, scale: 5 }).notNull().default("0"),
  updatedBy: varchar("updatedBy", { length: 200 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AguardandoEscolhaStock = typeof aguardandoEscolhaStock.$inferSelect;
export type InsertAguardandoEscolhaStock = typeof aguardandoEscolhaStock.$inferInsert;

/**
 * Visibilidade dos itens de madeira nos 3 cards (Madeira, Semi Pronto, Aguardando Escolha).
 * Controla quais itens aparecem em cada card.
 * Por padrão, todos os itens são visíveis (se não houver registro, é visível).
 */
export const madeiraVisibility = mysqlTable("madeira_visibility", {
  id: int("id").autoincrement().primaryKey(),
  codigoItem: varchar("codigoItem", { length: 20 }).notNull(),
  card: varchar("card", { length: 30 }).notNull(), // "madeira" | "semiPronto" | "aguardandoEscolha"
  visible: boolean("visible").notNull().default(true),
  updatedBy: varchar("updatedBy", { length: 200 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type MadeiraVisibility = typeof madeiraVisibility.$inferSelect;
export type InsertMadeiraVisibility = typeof madeiraVisibility.$inferInsert;


/**
 * Ações de cobrança por título de contas a receber.
 * Cada registro vincula a um título (accountsReceivable.id) e armazena:
 * - Status de cobrança (pendente, contatado, em_negociacao, promessa, protestado, juridico)
 * - Histórico de contatos (JSON array)
 * - Data de promessa de pagamento
 * - Observações livres
 * - Lembrete (data para cobrar novamente)
 */
export const collectionActions = mysqlTable("collection_actions", {
  id: int("id").autoincrement().primaryKey(),
  receivableId: int("receivableId").notNull(), // FK para accounts_receivable.id
  status: varchar("status", { length: 30 }).notNull().default("pendente"),
  // pendente | contatado | em_negociacao | promessa | protestado | juridico
  promessaData: varchar("promessaData", { length: 30 }), // YYYY-MM-DD
  promessaValor: decimal("promessaValor", { precision: 18, scale: 2 }),
  lembreteData: varchar("lembreteData", { length: 30 }), // YYYY-MM-DD
  observacoes: text("observacoes"),
  contatoHistorico: json("contatoHistorico").$type<Array<{
    data: string;
    tipo: string; // ligacao | whatsapp | email | presencial | outro
    resumo: string;
    usuario?: string;
  }>>().default([]),
  updatedBy: varchar("updatedBy", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CollectionAction = typeof collectionActions.$inferSelect;
export type InsertCollectionAction = typeof collectionActions.$inferInsert;
