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
