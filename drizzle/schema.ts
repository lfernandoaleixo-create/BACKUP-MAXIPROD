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
  vendedorReal: varchar("vendedorReal", { length: 200 }), // Vendedor real do Maxiprod (antes do override Grupo Fox)
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
  // Campos financeiros do pedido (desconto, frete, seguro, outras despesas)
  descontoValor: decimal("descontoValor", { precision: 18, scale: 2 }), // Desconto em valor do pedido
  descontoPercentual: decimal("descontoPercentual", { precision: 18, scale: 5 }), // Desconto percentual do pedido
  freteValor: decimal("freteValor", { precision: 18, scale: 2 }), // Frete do pedido
  seguroValor: decimal("seguroValor", { precision: 18, scale: 2 }), // Seguro do pedido
  outrasDespesasValor: decimal("outrasDespesasValor", { precision: 18, scale: 2 }), // Outras despesas do pedido
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
  anotacoes: text("anotacoes"), // Anotações do Maxiprod (tarefasEAnotacoes.descricao concatenadas)
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
  maxiprodId: bigint("maxiprodId", { mode: "number" }).notNull().unique(),
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
  formaCobranca: varchar("formaCobranca", { length: 500 }), // Descrição completa da forma de cobrança (ex: "PIX Banco Cooperativo Sicredi...")
  formaCobrancaId: bigint("formaCobrancaId", { mode: "number" }), // ID da FormaDeCobranca no Maxiprod
  anotacoes: text("anotacoes"), // Anotações do Maxiprod (tarefasEAnotacoes.descricao concatenadas)
  decisaoCobranca: varchar("decisaoCobranca", { length: 200 }), // Decisão de cobrança do cliente (COM PROTESTO / SEM PROTESTO) - campo adicional "SITUAÇÃO" do Maxiprod
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
  accessProducao: boolean("accessProducao").notNull().default(false),
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
 * Autorização de pagamentos concluída - checkbox diário
 * Fernando marca quando termina de autorizar todos os pagamentos do dia.
 * Requer senha "Fernando" para marcar.
 */
export const authCompletion = mysqlTable("auth_completion", {
  id: int("id").autoincrement().primaryKey(),
  date: varchar("date", { length: 10 }).notNull().unique(), // YYYY-MM-DD
  completed: boolean("completed").default(false).notNull(),
  completedBy: varchar("completedBy", { length: 200 }),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AuthCompletion = typeof authCompletion.$inferSelect;
export type InsertAuthCompletion = typeof authCompletion.$inferInsert;

/**
 * Estoque de produtos semi prontos (madeira).
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
 * Estoque de produtos aguardando escolha (madeira).
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
  precoCaixa: decimal("preco_caixa", { precision: 10, scale: 2 }), // R$/CX - preço manual ou média das últimas 5 vendas
  alertaReposicao: int("alerta_reposicao"), // Alerta de reposição (quantidade mínima)
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
    // pendente | contatado | em_negociacao | promessa | nao_retornou | nao_atendeu | protestado | juridico | especial_sem_cobranca | cheque_compensacao
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
  /**
   * Data em que a cobrança foi "startada" para este título.
   * Registrada automaticamente quando o título entra com 1 dia de atraso.
   * Títulos que já tinham >2 dias antes de 2026-04-16 NÃO têm este campo preenchido
   * e portanto NÃO vibram no padrão 1,3,5.
   * Formato: YYYY-MM-DD
   */
  cobrancaStartedAt: varchar("cobrancaStartedAt", { length: 10 }),
  /**
   * Se preenchido, a vibração do telefone está manualmente desativada para este título.
   * Guilherme pode ativar/desativar a qualquer momento.
   * Formato: nome do operador que silenciou, ou null se não silenciado.
   */
  phoneMutedBy: varchar("phoneMutedBy", { length: 200 }),
  phoneMutedAt: bigint("phoneMutedAt", { mode: "number" }),
  updatedBy: varchar("updatedBy", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CollectionAction = typeof collectionActions.$inferSelect;
export type InsertCollectionAction = typeof collectionActions.$inferInsert;

/**
 * Ações diárias de cobrança preventiva.
 * Cada registro = 1 ação de 1 vendedor em 1 dia para 1 título.
 * O telefone pisca do dia 1 ao dia 6 após vencimento se não houver ação no dia.
 * Quando o vendedor registra ação, o telefone para de piscar naquele dia.
 * No dia seguinte, volta a piscar até nova ação.
 */
export const collectionDailyActions = mysqlTable("collection_daily_actions", {
  id: int("id").autoincrement().primaryKey(),
  receivableId: int("receivableId").notNull(), // FK para accounts_receivable.id
  actionDate: varchar("actionDate", { length: 10 }).notNull(), // YYYY-MM-DD
  actionType: varchar("actionType", { length: 30 }).notNull(), // ligacao | whatsapp | email | visita | sem_contato
  operatorName: varchar("operatorName", { length: 200 }).notNull(), // Vendedor que registrou
  notes: text("notes"), // Observações do vendedor
  isAutomatic: boolean("isAutomatic").default(false).notNull(), // true = registrado automaticamente como "sem_contato"
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CollectionDailyAction = typeof collectionDailyActions.$inferSelect;
export type InsertCollectionDailyAction = typeof collectionDailyActions.$inferInsert;

/**
 * Configuração de protesto por título.
 * Define se o título vai para protesto automático no dia 7 ou se é cliente especial (não protestar).
 * Para clientes "não protestar", o vendedor é obrigado a preencher um plano de ação no dia 7+.
 * Campo provisório até integração com campo do Maxiprod.
 */
export const receivableProtestConfig = mysqlTable("receivable_protest_config", {
  id: int("id").autoincrement().primaryKey(),
  receivableId: int("receivableId").notNull().unique(), // FK para accounts_receivable.id
  protestType: mysqlEnum("protestType", ["automatico", "nao_protestar"]).notNull().default("automatico"),
  // Plano de ação obrigatório para "nao_protestar" no dia 7+
  actionPlan: text("actionPlan"), // O que será feito
  deadlineDate: varchar("deadlineDate", { length: 10 }), // YYYY-MM-DD - até quando o vendedor deu prazo
  actionPlanBy: varchar("actionPlanBy", { length: 200 }), // Vendedor que preencheu o plano
  actionPlanAt: timestamp("actionPlanAt"), // Quando o plano foi preenchido
  updatedBy: varchar("updatedBy", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ReceivableProtestConfig = typeof receivableProtestConfig.$inferSelect;
export type InsertReceivableProtestConfig = typeof receivableProtestConfig.$inferInsert;

/**
 * Títulos resolvidos (pagos) que tinham registro de cobrança.
 * Quando um título vencido com collectionActions é marcado como RECEBIDO (pago),
 * um registro é criado aqui para manter o histórico visível no card "Pagos/Resolvidos".
 * REGRA: Títulos com cobrança registrada NUNCA desaparecem da lista de inadimplência
 * até serem pagos. Quando pagos, aparecem no card de resolvidos.
 */
export const resolvedReceivables = mysqlTable("resolved_receivables", {
  id: int("id").autoincrement().primaryKey(),
  receivableId: int("receivableId").notNull(), // FK para accounts_receivable.id
  maxiprodId: bigint("maxiprodId", { mode: "number" }).notNull(),
  cliente: varchar("cliente", { length: 300 }).notNull(),
  valorOriginal: decimal("valorOriginal", { precision: 18, scale: 2 }).notNull(),
  valorAReceber: decimal("valorAReceber", { precision: 18, scale: 2 }).notNull(), // valor que estava pendente
  vencimentoData: varchar("vencimentoData", { length: 50 }),
  documento: varchar("documento", { length: 100 }),
  empresa: varchar("empresa", { length: 100 }),
  vendedor: varchar("vendedor", { length: 200 }),
  diasAtrasoNaResolucao: int("diasAtrasoNaResolucao").notNull().default(0),
  // Dados de cobrança que foram registrados
  statusCobranca: varchar("statusCobranca", { length: 30 }),
  totalContatos: int("totalContatos").notNull().default(0),
  resolvedAt: timestamp("resolvedAt").defaultNow().notNull(), // data que saiu da inadimplência
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ResolvedReceivable = typeof resolvedReceivables.$inferSelect;
export type InsertResolvedReceivable = typeof resolvedReceivables.$inferInsert;

/**
 * Estoque de Madeira - Produto Acabado.
 * Operadores preenchem. Só pode AUMENTAR (redução apenas por venda/sync automático).
 */
export const madeiraStock = mysqlTable("madeira_stock", {
  id: int("id").autoincrement().primaryKey(),
  codigoItem: varchar("codigoItem", { length: 20 }).notNull().unique(),
  quantidade: decimal("quantidade", { precision: 18, scale: 5 }).notNull().default("0"),
  updatedBy: varchar("updatedBy", { length: 200 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type MadeiraStock = typeof madeiraStock.$inferSelect;
export type InsertMadeiraStock = typeof madeiraStock.$inferInsert;

/**
 * Histórico de edições manuais de estoque (Madeira PA, Semi Pronto, Aguardando Escolha).
 * REGRA: NUNCA apagar registros. Histórico permanente e imutável.
 */
export const stockEditHistory = mysqlTable("stock_edit_history", {
  id: int("id").autoincrement().primaryKey(),
  card: varchar("card", { length: 30 }).notNull(), // "madeira" | "semiPronto" | "aguardandoEscolha"
  codigoItem: varchar("codigoItem", { length: 20 }).notNull(),
  descricaoItem: text("descricaoItem"),
  valorAnterior: decimal("valorAnterior", { precision: 18, scale: 5 }).notNull(),
  valorNovo: decimal("valorNovo", { precision: 18, scale: 5 }).notNull(),
  operador: varchar("operador", { length: 200 }).notNull(),
  tipo: varchar("tipo", { length: 20 }).notNull().default("alteracao"), // "alteracao" | "tentativa_reducao"
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type StockEditHistory = typeof stockEditHistory.$inferSelect;
export type InsertStockEditHistory = typeof stockEditHistory.$inferInsert;


/**
 * Documentos de cobrança gerados automaticamente no dia 7+.
 * Para clientes com "não protestar", gera documento profissional
 * notificando o vendedor responsável que todas as medidas foram tomadas
 * e a responsabilidade agora é dele.
 * O documento fica visível no card de inadimplência para todos.
 */
export const collectionDocuments = mysqlTable("collection_documents", {
  id: int("id").autoincrement().primaryKey(),
  receivableId: int("receivableId").notNull(), // FK para accounts_receivable.id
  cliente: varchar("cliente", { length: 300 }).notNull(),
  vendedor: varchar("vendedor", { length: 200 }).notNull(),
  valorTitulo: decimal("valorTitulo", { precision: 18, scale: 2 }).notNull(),
  vencimentoData: varchar("vencimentoData", { length: 10 }).notNull(), // YYYY-MM-DD
  diasAtraso: int("diasAtraso").notNull(),
  documento: varchar("documento", { length: 100 }), // NF/referência
  // Resumo das ações de cobrança realizadas (JSON array)
  acoesCobanca: json("acoesCobanca").$type<Array<{
    dia: number; // dia após vencimento (1, 3, 5)
    data: string; // YYYY-MM-DD
    tipo: string; // ligacao | whatsapp | email | visita | sem_contato
    realizada: boolean; // true = ação feita, false = não feita
    notas?: string;
  }>>().default([]),
  // Texto completo do documento gerado
  documentoTexto: text("documentoTexto").notNull(),
  // PDF
  pdfUrl: text("pdfUrl"), // URL do PDF no S3
  // Controle
  geradoPor: varchar("geradoPor", { length: 200 }).notNull().default("Sistema"),
  visualizadoPorVendedor: boolean("visualizadoPorVendedor").default(false).notNull(),
  visualizadoEm: timestamp("visualizadoEm"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CollectionDocument = typeof collectionDocuments.$inferSelect;
export type InsertCollectionDocument = typeof collectionDocuments.$inferInsert;

/**
 * Snapshots diários dos títulos financeiros (a pagar e a receber).
 * Cada registro = 1 título em 1 dia, com valor e vencimento.
 * Usado para detectar mudanças dia a dia (novos títulos, removidos, alterações).
 * Rastreia todas as 8 semanas do calendário financeiro.
 */
export const financialSnapshots = mysqlTable("financial_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  snapshotDate: varchar("snapshotDate", { length: 10 }).notNull(), // YYYY-MM-DD (dia do snapshot)
  tipo: varchar("tipo", { length: 10 }).notNull(), // "pagar" | "receber"
  maxiprodId: bigint("maxiprodId", { mode: "number" }).notNull(),
  nome: varchar("nome", { length: 300 }).notNull(), // fornecedor (pagar) ou cliente (receber)
  valor: decimal("valor", { precision: 18, scale: 2 }).notNull(), // valor líquido - valor pago
  vencimentoData: varchar("vencimentoData", { length: 50 }), // data de vencimento
  referenteA: text("referenteA"), // descrição/referência
  observacoes: text("observacoes"),
  parcela: varchar("parcela", { length: 20 }), // "1/3", "2/3", etc.
  empresaNome: varchar("empresaNome", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type FinancialSnapshot = typeof financialSnapshots.$inferSelect;
export type InsertFinancialSnapshot = typeof financialSnapshots.$inferInsert;

/**
 * Registro de mudanças financeiras detectadas entre snapshots.
 * Cada registro = 1 alteração (novo título, título removido, valor alterado).
 * Usado para exibir no "Histórico de Mudanças" dos cards financeiros.
 */
export const financialChanges = mysqlTable("financial_changes", {
  id: int("id").autoincrement().primaryKey(),
  changeDate: varchar("changeDate", { length: 10 }).notNull(), // YYYY-MM-DD (dia que a mudança foi detectada)
  tipo: varchar("tipo", { length: 10 }).notNull(), // "pagar" | "receber"
  changeType: varchar("changeType", { length: 20 }).notNull(), // "adicionado" | "removido" | "alterado"
  maxiprodId: bigint("maxiprodId", { mode: "number" }).notNull(),
  nome: varchar("nome", { length: 300 }).notNull(), // fornecedor ou cliente
  valor: decimal("valor", { precision: 18, scale: 2 }).notNull(), // valor atual (ou valor no momento da remoção)
  valorAnterior: decimal("valorAnterior", { precision: 18, scale: 2 }), // valor anterior (para alterações)
  vencimentoData: varchar("vencimentoData", { length: 50 }),
  referenteA: text("referenteA"),
  observacoes: text("observacoes"),
  parcela: varchar("parcela", { length: 20 }),
  empresaNome: varchar("empresaNome", { length: 100 }),
  semanaLabel: varchar("semanaLabel", { length: 30 }), // "Vencidas" | "07/04 - 13/04" etc.
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type FinancialChange = typeof financialChanges.$inferSelect;
export type InsertFinancialChange = typeof financialChanges.$inferInsert;

/**
 * Setores de produção da indústria.
 * Cada setor representa uma etapa do processo produtivo.
 */
export const productionSectors = mysqlTable("production_sectors", {
  id: int("id").autoincrement().primaryKey(),
  ordem: int("ordem").notNull(), // Ordem do setor na linha de produção (1-9)
  nome: varchar("nome", { length: 100 }).notNull(), // Ex: "Multilamina", "Vareteira"
  unidadeMedida: varchar("unidadeMedida", { length: 50 }).notNull(), // Ex: "m³", "saco", "forma", "caixa"
  unidadeLabel: varchar("unidadeLabel", { length: 50 }).notNull(), // Ex: "metro cúbico", "sacos", "formas", "caixas"
  tipoEquipamento: varchar("tipoEquipamento", { length: 20 }).notNull(), // "maquina" | "mesa" | "nenhum"
  quantidadeEquipamentos: int("quantidadeEquipamentos").notNull().default(0),
  isSequencial: boolean("isSequencial").default(false).notNull(), // Setores 1,2,3 são sequenciais
  cor: varchar("cor", { length: 20 }), // Cor do card do setor
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ProductionSector = typeof productionSectors.$inferSelect;
export type InsertProductionSector = typeof productionSectors.$inferInsert;

/**
 * Máquinas/mesas de cada setor de produção.
 */
export const productionMachines = mysqlTable("production_machines", {
  id: int("id").autoincrement().primaryKey(),
  sectorId: int("sectorId").notNull(), // FK para production_sectors
  nome: varchar("nome", { length: 100 }).notNull(), // Ex: "Máquina 1", "Mesa 3"
  ordem: int("ordem").notNull(), // Ordem dentro do setor
  ativa: boolean("ativa").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ProductionMachine = typeof productionMachines.$inferSelect;
export type InsertProductionMachine = typeof productionMachines.$inferInsert;

/**
 * Lançamentos diários de produção por setor e máquina.
 * Cada registro = produção de 1 máquina/mesa em 1 dia.
 * REGRA: NUNCA apagar registros. Soft-delete: setar quantidade para 0 e observacoes para "[REMOVIDO]".
 */
export const productionEntries = mysqlTable("production_entries", {
  id: int("id").autoincrement().primaryKey(),
  sectorId: int("sectorId").notNull(), // FK para production_sectors
  machineId: int("machineId"), // FK para production_machines (null para setor sem máquina)
  data: varchar("data", { length: 10 }).notNull(), // YYYY-MM-DD (dia do lançamento)
  quantidade: decimal("quantidade", { precision: 18, scale: 5 }).notNull(), // Quantidade produzida
  status: varchar("status", { length: 50 }).default("producao_normal"), // Status da máquina: producao_normal, falta_madeira, producao_nao_necessaria, manutencao, manutencao_pontual
  tipoMadeira: varchar("tipoMadeira", { length: 100 }), // Tipo de madeira: benazzi, madeira_dura (pode ter ambos separados por vírgula)
  observacoes: text("observacoes"),
  lancadoPor: varchar("lancadoPor", { length: 200 }), // Nome do usuário que lançou
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ProductionEntry = typeof productionEntries.$inferSelect;
export type InsertProductionEntry = typeof productionEntries.$inferInsert;


/**
 * Histórico de ticagens de desconto (antecipação) de títulos a receber
 */
export const discountSelectionHistory = mysqlTable("discount_selection_history", {
  id: int("id").autoincrement().primaryKey(),
  operatorName: varchar("operatorName", { length: 200 }).notNull(),
  empresa: varchar("empresa", { length: 200 }).notNull(),
  contaLabel: varchar("contaLabel", { length: 300 }).notNull(),
  mesKey: varchar("mesKey", { length: 10 }).notNull(),
  totalTitulos: int("totalTitulos").notNull(),
  valorTotal: decimal("valorTotal", { precision: 18, scale: 2 }).notNull(),
  titulosJson: text("titulosJson").notNull(), // JSON array of {id, cliente, documento, valor, vencimento}
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type DiscountSelectionHistory = typeof discountSelectionHistory.$inferSelect;
export type InsertDiscountSelectionHistory = typeof discountSelectionHistory.$inferInsert;


/**
 * Registros de pirografia (Máquina Pirografar - setor 9).
 * Cada registro = 1 produto pirografado com nome do cliente em 1 máquina em 1 dia.
 * Armazena produto (Bambu ou Madeira), nome pirografado, quantidade, para histórico futuro.
 * REGRA: NUNCA apagar registros. Soft-delete: setar quantidade para 0 e observacoes para "[REMOVIDO]".
 */
export const pirografiaEntries = mysqlTable("pirografia_entries", {
  id: int("id").autoincrement().primaryKey(),
  sectorId: int("sectorId").notNull(), // FK para production_sectors (setor 9)
  machineId: int("machineId").notNull(), // FK para production_machines (Máquina 1, 2, 3)
  data: varchar("data", { length: 10 }).notNull(), // YYYY-MM-DD (dia do lançamento)
  codigoItem: varchar("codigoItem", { length: 20 }).notNull(), // Código do produto pirografado (do estoque Bambu ou Madeira)
  descricaoItem: text("descricaoItem"), // Descrição do produto (snapshot no momento do registro)
  materialOrigem: varchar("materialOrigem", { length: 20 }).notNull(), // "bambu" ou "madeira"
  nomePirografado: varchar("nomePirografado", { length: 300 }).notNull(), // Nome do cliente gravado no palito
  quantidade: decimal("quantidade", { precision: 18, scale: 5 }).notNull(), // Quantidade pirografada (caixas)
  observacoes: text("observacoes"), // Observações adicionais
  lancadoPor: varchar("lancadoPor", { length: 200 }), // Nome do operador que lançou
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PirografiaEntry = typeof pirografiaEntries.$inferSelect;
export type InsertPirografiaEntry = typeof pirografiaEntries.$inferInsert;

/**
 * Auditoria de edições em ações de cobrança diárias.
 * Toda vez que o vendedor editar uma ação (tipo ou notas), o registro original é preservado aqui.
 * Campos: o que era antes, o que mudou, quem editou e quando.
 */
export const collectionActionEdits = mysqlTable("collection_action_edits", {
  id: int("id").autoincrement().primaryKey(),
  dailyActionId: int("dailyActionId").notNull(), // FK para collection_daily_actions.id
  receivableId: int("receivableId").notNull(), // FK para accounts_receivable.id (para facilitar queries)
  fieldChanged: varchar("fieldChanged", { length: 30 }).notNull(), // "actionType" | "notes"
  oldValue: text("oldValue"), // Valor anterior
  newValue: text("newValue"), // Valor novo
  editedBy: varchar("editedBy", { length: 200 }).notNull(), // Nome do operador que editou
  editedAt: timestamp("editedAt").defaultNow().notNull(), // Quando editou
});
export type CollectionActionEdit = typeof collectionActionEdits.$inferSelect;
export type InsertCollectionActionEdit = typeof collectionActionEdits.$inferInsert;

/**
 * Ticagem manual de cobrança — 7 bolinhas por título
 * Usada por Thiago/Guilherme/Flavio para controle manual do progresso de cobrança.
 * Cada tick representa um passo: Ação 1, Intervalo, Ação 2, Intervalo, Ação 3, Intervalo, Decisão.
 */
export const collectionManualTicks = mysqlTable("collection_manual_ticks", {
  id: int("id").autoincrement().primaryKey(),
  receivableId: int("receivable_id").notNull(),
  step: int("step").notNull(), // 1-7
  ticked: boolean("ticked").notNull().default(false),
  tickedBy: varchar("ticked_by", { length: 100 }),
  tickedAt: bigint("ticked_at", { mode: "number" }),
  tickStatus: varchar("tick_status", { length: 20 }).default("green"), // "green" = manual ok, "red" = falha (dia passou sem ticar)
  createdAt: bigint("created_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
});
export type CollectionManualTick = typeof collectionManualTicks.$inferSelect;
export type InsertCollectionManualTick = typeof collectionManualTicks.$inferInsert;

/**
 * Histórico de ticagem manual — registra cada mudança (tick/untick)
 */
export const collectionManualTickHistory = mysqlTable("collection_manual_tick_history", {
  id: int("id").autoincrement().primaryKey(),
  receivableId: int("receivable_id").notNull(),
  step: int("step").notNull(), // 1-7
  action: varchar("action", { length: 20 }).notNull(), // "tick", "untick", "auto_red" (falha automática)
  operatorName: varchar("operator_name", { length: 100 }).notNull(),
  reason: varchar("reason", { length: 200 }), // motivo da ação (ex: "Dia passou sem ticagem")
  createdAt: bigint("created_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
});
export type CollectionManualTickHistoryRow = typeof collectionManualTickHistory.$inferSelect;

/**
 * Mensagens de chat dentro dos cards Sicoob Palitos (Desconto Semanal e Limite de Títulos)
 * Permite que Flávio e operadores com acesso troquem mensagens
 */
export const sicoobCardMessages = mysqlTable("sicoob_card_messages", {
  id: int("id").autoincrement().primaryKey(),
  cardKey: varchar("card_key", { length: 50 }).notNull(), // "sicoob_desconto_semanal" ou "sicoob_limite_titulos"
  operatorName: varchar("operator_name", { length: 100 }).notNull(),
  message: text("message").notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
});
export type SicoobCardMessage = typeof sicoobCardMessages.$inferSelect;
export type InsertSicoobCardMessage = typeof sicoobCardMessages.$inferInsert;

/**
 * Snapshot de estoque E-commerce - salva o estado dos itens E-commerce a cada sync
 * para detectar quando o estoque baixou (transferência efetivada)
 */
export const ecommerceStockSnapshots = mysqlTable("ecommerce_stock_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  codigoItem: varchar("codigoItem", { length: 20 }).notNull(),
  descricaoItem: text("descricaoItem").notNull(),
  quantidadeCx: decimal("quantidadeCx", { precision: 18, scale: 5 }).notNull(), // estoque em caixas
  quantidadeUn: decimal("quantidadeUn", { precision: 18, scale: 5 }).notNull(), // estoque em unidades
  snapshotDate: varchar("snapshotDate", { length: 10 }).notNull(), // YYYY-MM-DD
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type EcommerceStockSnapshot = typeof ecommerceStockSnapshots.$inferSelect;

/**
 * Histórico de transferências E-commerce - registra cada movimentação de saída
 * Detectado automaticamente quando o estoque de um item E-commerce diminui entre syncs
 */
export const ecommerceTransferHistory = mysqlTable("ecommerce_transfer_history", {
  id: int("id").autoincrement().primaryKey(),
  codigoItem: varchar("codigoItem", { length: 20 }).notNull(),
  descricaoItem: text("descricaoItem").notNull(),
  quantidadeCxAnterior: decimal("quantidadeCxAnterior", { precision: 18, scale: 5 }).notNull(),
  quantidadeCxAtual: decimal("quantidadeCxAtual", { precision: 18, scale: 5 }).notNull(),
  quantidadeTransferidaCx: decimal("quantidadeTransferidaCx", { precision: 18, scale: 5 }).notNull(),
  quantidadeTransferidaUn: decimal("quantidadeTransferidaUn", { precision: 18, scale: 5 }).notNull(),
  numeroPedido: varchar("numeroPedido", { length: 20 }), // pedido E-commerce relacionado
  cliente: varchar("cliente", { length: 200 }), // cliente/filial destino
  dataTransferencia: varchar("dataTransferencia", { length: 10 }).notNull(), // YYYY-MM-DD
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type EcommerceTransferHistory = typeof ecommerceTransferHistory.$inferSelect;


/**
 * Snapshot dos pedidos industrializados faturados — usado para detectar NOVOS faturamentos.
 * A cada sync, salva o set de (pedido + codigoItem) faturados.
 * Comparando com o snapshot anterior, detecta itens que acabaram de ser faturados.
 * 
 * REGRA: A partir de 22/04/2026 — não retroativo. Estoque atual já está correto.
 */
export const billedIndustrializedSnapshot = mysqlTable("billed_industrialized_snapshot", {
  id: int("id").autoincrement().primaryKey(),
  pedido: varchar("pedido", { length: 20 }).notNull(),
  codigoItem: varchar("codigoItem", { length: 50 }).notNull(),
  quantidade: decimal("quantidade", { precision: 18, scale: 5 }).notNull(),
  unidadeMedida: varchar("unidadeMedida", { length: 10 }),
  snapshotDate: varchar("snapshotDate", { length: 10 }).notNull(), // YYYY-MM-DD
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type BilledIndustrializedSnapshot = typeof billedIndustrializedSnapshot.$inferSelect;

/**
 * Histórico de baixas automáticas no estoque de madeira por faturamento de industrializados.
 * Cada registro = uma baixa que foi aplicada ao madeira_stock.
 * 
 * REGRA: Fator 1:1 — faturou 10 CX → abate 10 CX do madeira_stock.
 * Unidade segue o item faturado (CX, DZ, KG, m3, etc.)
 */
export const industrializedBillingHistory = mysqlTable("industrialized_billing_history", {
  id: int("id").autoincrement().primaryKey(),
  pedido: varchar("pedido", { length: 20 }).notNull(),
  codigoItem: varchar("codigoItem", { length: 50 }).notNull(),
  descricaoItem: text("descricaoItem"),
  cliente: varchar("cliente", { length: 300 }),
  quantidade: decimal("quantidade", { precision: 18, scale: 5 }).notNull(), // quantidade abatida
  unidadeMedida: varchar("unidadeMedida", { length: 10 }),
  estoqueAnterior: decimal("estoqueAnterior", { precision: 18, scale: 5 }).notNull(),
  estoqueNovo: decimal("estoqueNovo", { precision: 18, scale: 5 }).notNull(),
  dataFaturamento: varchar("dataFaturamento", { length: 30 }), // data de emissão do pedido
  dataBaixa: varchar("dataBaixa", { length: 10 }).notNull(), // YYYY-MM-DD quando a baixa foi aplicada
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type IndustrializedBillingHistory = typeof industrializedBillingHistory.$inferSelect;


/**
 * Despesas do E-commerce (contas a pagar da filial e-commerce)
 * Pedro registra os gastos, Flavio e Guilherme visualizam.
 */
export const ecommerceExpenses = mysqlTable("ecommerce_expenses", {
  id: int("id").autoincrement().primaryKey(),
  descricao: varchar("descricao", { length: 500 }).notNull(),
  dataCompra: varchar("dataCompra", { length: 10 }).notNull(), // YYYY-MM-DD
  formaPagamento: mysqlEnum("formaPagamento", ["pix", "boleto", "cartao_credito"]).notNull(),
  parcelas: int("parcelas").notNull().default(1), // 1 = à vista
  valorTotal: decimal("valorTotal", { precision: 12, scale: 2 }).notNull(),
  observacao: text("observacao"),
  registradoPor: varchar("registradoPor", { length: 100 }).notNull(), // nome do operador
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type EcommerceExpense = typeof ecommerceExpenses.$inferSelect;
export type InsertEcommerceExpense = typeof ecommerceExpenses.$inferInsert;


/**
 * Override de textos do roteiro de cobrança por título.
 * Permite que operadores editem a descrição e o motivo de cada step individualmente.
 * Chave única: (receivableId, step) — no máximo 1 override por step por título.
 */
export const collectionStepOverrides = mysqlTable("collection_step_overrides", {
  id: int("id").autoincrement().primaryKey(),
  receivableId: int("receivable_id").notNull(),
  step: int("step").notNull(), // 1-7
  descricao: text("descricao"), // override da descrição do step (null = usar padrão)
  motivo: text("motivo"), // override do motivo/status text (null = usar padrão)
  dataOverride: varchar("data_override", { length: 20 }), // override da data do step (YYYY-MM-DD, null = usar padrão)
  updatedBy: varchar("updated_by", { length: 100 }),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
});
export type CollectionStepOverride = typeof collectionStepOverrides.$inferSelect;
export type InsertCollectionStepOverride = typeof collectionStepOverrides.$inferInsert;


/**
 * Histórico de planilhas enviadas na aba Inadimplência.
 * Armazena apenas o arquivo no S3 — NÃO altera dados de inadimplência.
 */
export const spreadsheetUploads = mysqlTable("spreadsheet_uploads", {
  id: int("id").autoincrement().primaryKey(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileKey: varchar("file_key", { length: 500 }).notNull(), // S3 key
  fileUrl: varchar("file_url", { length: 1000 }).notNull(), // S3 public URL
  fileSize: int("file_size"), // bytes
  mimeType: varchar("mime_type", { length: 100 }),
  uploadedBy: varchar("uploaded_by", { length: 100 }).notNull(),
  uploadedAt: bigint("uploaded_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
});
export type SpreadsheetUpload = typeof spreadsheetUploads.$inferSelect;
export type InsertSpreadsheetUpload = typeof spreadsheetUploads.$inferInsert;


/**
 * Histórico de PDFs de decisão de cobrança gerados.
 * Armazena metadados e o PDF no S3.
 */
export const decisionPdfHistory = mysqlTable("decision_pdf_history", {
  id: int("id").autoincrement().primaryKey(),
  receivableId: int("receivable_id").notNull(),
  cliente: varchar("cliente", { length: 500 }).notNull(),
  vendedor: varchar("vendedor", { length: 255 }),
  valorAberto: varchar("valor_aberto", { length: 50 }),
  diasAtraso: int("dias_atraso"),
  decisao: varchar("decisao", { length: 100 }), // "SEM PROTESTO", "COM PROTESTO", etc.
  protocolo: varchar("protocolo", { length: 100 }).notNull(),
  fileKey: varchar("file_key", { length: 500 }).notNull(),
  fileUrl: varchar("file_url", { length: 1000 }).notNull(),
  generatedBy: varchar("generated_by", { length: 100 }).notNull(),
  generatedAt: bigint("generated_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
});
export type DecisionPdfHistory = typeof decisionPdfHistory.$inferSelect;
export type InsertDecisionPdfHistory = typeof decisionPdfHistory.$inferInsert;


/**
 * Marcações de prioridade/urgência nos pagamentos.
 * Flávio marca fornecedores como prioritários (bolinha vermelha).
 * Fernando e Guilherme veem as bolinhas vermelhas marcadas.
 * Marcações são diárias — resetam junto com as autorizações de pagamento.
 */
export const paymentPriorityMarks = mysqlTable("payment_priority_marks", {
  id: int("id").autoincrement().primaryKey(),
  fornecedor: varchar("fornecedor", { length: 500 }).notNull(), // Nome do fornecedor
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD — dia da marcação
  maxiprodId: bigint("maxiprod_id", { mode: "number" }), // ID da conta individual (nova abordagem por conta)
  markedBy: varchar("marked_by", { length: 100 }).notNull(), // Quem marcou (Flavio)
  markedAt: bigint("marked_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
});
export type PaymentPriorityMark = typeof paymentPriorityMarks.$inferSelect;
export type InsertPaymentPriorityMark = typeof paymentPriorityMarks.$inferInsert;


/**
 * Alertas de troca/desconto de títulos.
 * Quando Fernando finaliza uma seleção de títulos para desconto no Sicoob,
 * um alerta é criado para Guilherme, Flávio e Thiago.
 * O alerta gera blink cascading: aba Financeiro → aba Recebíveis → card empresa → mês.
 */
export const discountAlerts = mysqlTable("discount_alerts", {
  id: int("id").autoincrement().primaryKey(),
  /** Quem gerou o desconto (Fernando/Bruno) */
  createdBy: varchar("created_by", { length: 100 }).notNull(),
  /** Empresa: PALITOS INDUSTRIA, VARETAS INDUSTRIA, ESPETOS INDUSTRIA */
  empresa: varchar("empresa", { length: 200 }).notNull(),
  /** Label da conta bancária (ex: Sicoob PALITOS · Ag 3140 · Cc 80.247) */
  contaLabel: varchar("conta_label", { length: 300 }).notNull(),
  /** Chave do mês (ex: 2026-06) */
  mesKey: varchar("mes_key", { length: 10 }).notNull(),
  /** Quantidade de títulos selecionados */
  totalTitulos: int("total_titulos").notNull(),
  /** Valor total dos títulos selecionados */
  valorTotal: decimal("valor_total", { precision: 18, scale: 2 }).notNull(),
  /** Timestamp de criação */
  createdAt: bigint("created_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
});
export type DiscountAlert = typeof discountAlerts.$inferSelect;
export type InsertDiscountAlert = typeof discountAlerts.$inferInsert;

/**
 * Registro de quem já "leu" (visualizou) cada alerta de desconto.
 * Cada operador tem seu próprio registro de leitura.
 */
export const discountAlertReads = mysqlTable("discount_alert_reads", {
  id: int("id").autoincrement().primaryKey(),
  alertId: int("alert_id").notNull(),
  /** Nome do operador que leu o alerta */
  readBy: varchar("read_by", { length: 100 }).notNull(),
  /** Timestamp de leitura */
  readAt: bigint("read_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
});
export type DiscountAlertRead = typeof discountAlertReads.$inferSelect;


/**
 * Anotações avulsas de produção (Queijo Coalho, Alídio, etc.)
 * NÃO contabilizam no total do setor — são apenas registros de acompanhamento.
 */
export const annotationEntries = mysqlTable("annotation_entries", {
  id: int("id").autoincrement().primaryKey(),
  /** Tipo da anotação: 'queijo_coalho' | 'alidio' */
  tipo: varchar("tipo", { length: 50 }).notNull(),
  /** Data do lançamento YYYY-MM-DD */
  data: varchar("data", { length: 10 }).notNull(),
  /** Setor de referência (Seleção Automática = setor 4) */
  sectorId: int("sector_id"),
  /** Quantidade em caixas */
  quantidade: decimal("quantidade", { precision: 18, scale: 5 }).notNull().default("0"),
  /** Observação opcional */
  observacoes: text("observacoes"),
  /** Quem lançou */
  lancadoPor: varchar("lancado_por", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type AnnotationEntry = typeof annotationEntries.$inferSelect;
export type InsertAnnotationEntry = typeof annotationEntries.$inferInsert;


/**
 * Estornos do E-commerce.
 * Pedro registra estornos de compras feitas no cartão da filial,
 * para que Flávio tenha visibilidade sobre valores que retornam à matriz.
 */
export const ecommerceRefunds = mysqlTable("ecommerce_refunds", {
  id: int("id").autoincrement().primaryKey(),
  /** Descrição do item/compra estornado */
  descricao: varchar("descricao", { length: 500 }).notNull(),
  /** Fornecedor/loja onde a compra foi feita */
  fornecedor: varchar("fornecedor", { length: 300 }),
  /** Data da compra original YYYY-MM-DD */
  dataCompraOriginal: varchar("data_compra_original", { length: 10 }).notNull(),
  /** Data do estorno YYYY-MM-DD */
  dataEstorno: varchar("data_estorno", { length: 10 }).notNull(),
  /** Valor do estorno (positivo) */
  valorEstorno: decimal("valor_estorno", { precision: 12, scale: 2 }).notNull(),
  /** Motivo do estorno */
  motivo: mysqlEnum("motivo", [
    "produto_defeituoso",
    "produto_errado",
    "cancelamento",
    "duplicidade",
    "acordo_comercial",
    "outro",
  ]).notNull(),
  /** Descrição detalhada do motivo (quando "outro" ou para complementar) */
  motivoDetalhe: text("motivo_detalhe"),
  /** Status do estorno */
  status: mysqlEnum("status", [
    "pendente",
    "creditado",
  ]).default("pendente").notNull(),
  /** Data em que o crédito foi efetivado na conta YYYY-MM-DD (null se pendente) */
  dataCreditado: varchar("data_creditado", { length: 10 }),
  /** Observações adicionais */
  observacao: text("observacao"),
  /** Quem registrou o estorno */
  registradoPor: varchar("registrado_por", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type EcommerceRefund = typeof ecommerceRefunds.$inferSelect;
export type InsertEcommerceRefund = typeof ecommerceRefunds.$inferInsert;


// ==================== ORDER CANCELLATIONS ====================
// Tracks when orders were cancelled (dataCancelamento) separately from emission date
// Used for commission calculation: cancelled orders appear in the month they were cancelled
export const orderCancellations = mysqlTable("order_cancellations", {
  id: int("id").autoincrement().primaryKey(),
  pedido: varchar("pedido", { length: 20 }).notNull(),
  cliente: varchar("cliente", { length: 300 }),
  clienteApelido: varchar("clienteApelido", { length: 200 }),
  valorTotalPedido: decimal("valorTotalPedido", { precision: 18, scale: 2 }),
  dataEmissao: varchar("dataEmissao", { length: 50 }),
  dataCancelamento: varchar("dataCancelamento", { length: 50 }).notNull(),
  representante: varchar("representante", { length: 200 }),
  empresa: varchar("empresa", { length: 100 }),
  estadoConfiguravel: varchar("estadoConfiguravel", { length: 100 }),
  crmSegmento: varchar("crmSegmento", { length: 100 }),
  observacoes: text("observacoes"),
  createdAt: timestamp("createdAt").defaultNow(),
});
export type OrderCancellation = typeof orderCancellations.$inferSelect;
export type InsertOrderCancellation = typeof orderCancellations.$inferInsert;


/**
 * Cheque custodians - registra quem está com o cheque fisicamente
 * Aplicável apenas a cheques com estado "DISPONIVEL" (em nossas mãos)
 */
export const chequeCustodians = mysqlTable("cheque_custodians", {
  id: int("id").autoincrement().primaryKey(),
  chequeId: int("chequeId").notNull(), // accounts_receivable.id
  responsavel: varchar("responsavel", { length: 100 }).notNull(), // nome da pessoa
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ChequeCustodian = typeof chequeCustodians.$inferSelect;
export type InsertChequeCustodian = typeof chequeCustodians.$inferInsert;

/**
 * Cheque exchanges - histórico de trocas de cheques
 * Cada registro representa uma operação de troca com PDF gerado
 */
export const chequeExchanges = mysqlTable("cheque_exchanges", {
  id: int("id").autoincrement().primaryKey(),
  empresaNome: varchar("empresaNome", { length: 100 }).notNull(),
  operador: varchar("operador", { length: 100 }).notNull(), // quem autorizou (Fernando)
  chequesJson: text("chequesJson").notNull(), // JSON com dados dos cheques selecionados
  totalValor: decimal("totalValor", { precision: 18, scale: 2 }).notNull(),
  totalCheques: int("totalCheques").notNull(),
  pdfUrl: text("pdfUrl"), // URL do PDF gerado no S3
  pdfKey: text("pdfKey"), // Key do PDF no S3
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ChequeExchange = typeof chequeExchanges.$inferSelect;
export type InsertChequeExchange = typeof chequeExchanges.$inferInsert;

/**
 * Fornecedores Brasileiros - possíveis clientes para prospecção
 * Dados extraídos do diretório de fornecedores
 */
export const suppliers = mysqlTable("suppliers", {
  id: int("id").autoincrement().primaryKey(),
  nome: text("nome").notNull(),
  segmento: varchar("segmento", { length: 100 }).notNull(),
  estado: varchar("estado", { length: 50 }).notNull(),
  cidade: varchar("cidade", { length: 100 }),
  endereco: text("endereco"),
  telefone: text("telefone"),
  email: varchar("email", { length: 320 }),
  website: text("website"),
  cnpj: varchar("cnpj", { length: 20 }),
  notas: text("notas"),
  confianca: varchar("confianca", { length: 10 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = typeof suppliers.$inferInsert;

/**
 * Registros de contato com fornecedores (prospecção)
 * Cada registro = um contato feito por um vendedor
 */
export const supplierContacts = mysqlTable("supplier_contacts", {
  id: int("id").autoincrement().primaryKey(),
  supplierId: int("supplierId").notNull(),
  vendedor: varchar("vendedor", { length: 50 }).notNull(),
  formaContato: mysqlEnum("formaContato", ["ligacao", "email", "whatsapp", "outra"]).notNull(),
  formaContatoOutra: text("formaContatoOutra"), // obrigatório se formaContato = "outra"
  observacao: text("observacao"),
  status: mysqlEnum("status", ["ja_cliente", "possivel_cliente", "novo_cliente", "sem_interesse", "nao_possivel_contato"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type SupplierContact = typeof supplierContacts.$inferSelect;
export type InsertSupplierContact = typeof supplierContacts.$inferInsert;
