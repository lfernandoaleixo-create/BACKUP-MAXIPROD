/**
 * Maxiprod Sync Service
 * 
 * Authenticates with Maxiprod via HTTP requests (email/password),
 * then fetches stock, orders, POs and sales data via the internal APIs.
 * SOMENTE LEITURA - jamais altera dados no Maxiprod.
 */
import { ENV } from "./_core/env";
import { getDb } from "./db";
import { stockItems, orderItems, scraperStatus, salesOrders } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { processStockData } from "./stockProcessor";

const APP_URL = "https://app.maxiprod.com.br";
const SYSTEM_URL = "https://sistema.maxiprod.com.br";

// Sync state
let isSyncing = false;
let syncProgress: SyncProgress = {
  status: "idle",
  step: "",
  percent: 0,
  details: "",
  error: null,
};

export type SyncProgress = {
  status: "idle" | "running" | "success" | "error";
  step: string;
  percent: number;
  details: string;
  error: string | null;
};

function updateProgress(updates: Partial<SyncProgress>) {
  syncProgress = { ...syncProgress, ...updates };
  console.log(`[Sync] ${syncProgress.step} (${syncProgress.percent}%) - ${syncProgress.details}`);
}

export function getSyncProgress(): SyncProgress {
  return { ...syncProgress };
}

/**
 * Cookie jar for maintaining session across requests
 */
class CookieJar {
  private cookies: Map<string, string> = new Map();

  addFromHeaders(headers: Headers) {
    const setCookies = headers.getSetCookie?.() || [];
    for (const sc of setCookies) {
      const parts = sc.split(";")[0].split("=");
      if (parts.length >= 2) {
        const name = parts[0].trim();
        const value = parts.slice(1).join("=").trim();
        this.cookies.set(name, value);
      }
    }
  }

  toString(): string {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

  clear() {
    this.cookies.clear();
  }

  has(name: string): boolean {
    return this.cookies.has(name);
  }
}

/**
 * Authenticate with Maxiprod and get session cookies for sistema.maxiprod.com.br
 */
async function authenticate(): Promise<CookieJar> {
  const jar = new CookieJar();

  updateProgress({ step: "Autenticando no Maxiprod...", percent: 5, details: "Obtendo página de login" });

  // Step 1: Get the login page to obtain anti-forgery token
  const loginPageResp = await fetch(`${APP_URL}/Account/Login`, {
    redirect: "manual",
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
  });
  jar.addFromHeaders(loginPageResp.headers);

  const loginPageHtml = await loginPageResp.text();
  
  // Extract anti-forgery token
  const tokenMatch = loginPageHtml.match(/name="__RequestVerificationToken"[^>]*value="([^"]+)"/);
  const antiForgeryToken = tokenMatch ? tokenMatch[1] : "";

  updateProgress({ percent: 10, details: "Enviando credenciais" });

  // Step 2: Submit login form
  const loginBody = new URLSearchParams({
    Email: ENV.maxiprodEmail,
    Password: ENV.maxiprodPassword,
    __RequestVerificationToken: antiForgeryToken,
    RememberMe: "true",
  });

  const loginResp = await fetch(`${APP_URL}/Account/Login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Cookie: jar.toString(),
    },
    body: loginBody.toString(),
    redirect: "manual",
  });
  jar.addFromHeaders(loginResp.headers);

  // Follow redirects manually to collect all cookies
  let redirectUrl = loginResp.headers.get("location");
  if (redirectUrl) {
    if (!redirectUrl.startsWith("http")) {
      redirectUrl = `${APP_URL}${redirectUrl}`;
    }
    
    updateProgress({ percent: 15, details: "Seguindo redirecionamento de login" });
    
    const redirectResp = await fetch(redirectUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Cookie: jar.toString(),
      },
      redirect: "manual",
    });
    jar.addFromHeaders(redirectResp.headers);
  }

  updateProgress({ percent: 20, details: "Conectando ao sistema Maxiprod" });

  // Step 3: Navigate to sistema.maxiprod.com.br to get system cookies
  // This triggers the OAuth flow: sistema -> app/oauth -> sistema with session
  const systemResp = await fetch(`${SYSTEM_URL}/`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Cookie: jar.toString(),
    },
    redirect: "manual",
  });
  jar.addFromHeaders(systemResp.headers);

  // Follow the OAuth redirect chain
  let nextUrl = systemResp.headers.get("location");
  let maxRedirects = 10;
  
  while (nextUrl && maxRedirects > 0) {
    if (!nextUrl.startsWith("http")) {
      // Relative URL - determine base
      if (nextUrl.startsWith("/")) {
        const base = nextUrl.includes("oauth") ? APP_URL : SYSTEM_URL;
        nextUrl = `${base}${nextUrl}`;
      }
    }
    
    const resp = await fetch(nextUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Cookie: jar.toString(),
      },
      redirect: "manual",
    });
    jar.addFromHeaders(resp.headers);
    
    nextUrl = resp.headers.get("location");
    maxRedirects--;
    
    // If we get a 200 response, check if it's the OAuth page with JS redirect
    if (resp.status === 200 && !nextUrl) {
      const html = await resp.text();
      const jsRedirectMatch = html.match(/window\.location\.href\s*=\s*['"]([^'"]+)['"]/);
      if (jsRedirectMatch) {
        nextUrl = jsRedirectMatch[1];
      }
    }
  }

  updateProgress({ percent: 25, details: "Sessão estabelecida" });

  return jar;
}

/**
 * Fetch paginated data from a Maxiprod grid API
 */
async function fetchGridData(
  jar: CookieJar,
  pageUrl: string,
  gridQueryUrl: string,
  postBody: string,
  pageSize: number = 500
): Promise<any[]> {
  // First navigate to the page to establish grid context
  const pageResp = await fetch(`${SYSTEM_URL}${pageUrl}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Cookie: jar.toString(),
    },
    redirect: "follow",
  });
  jar.addFromHeaders(pageResp.headers);

  // Extract GridId from the HTML
  const html = await pageResp.text();
  const gridIdMatch = html.match(/id="(Grid[^"]+)"/);
  const gridId = gridIdMatch ? gridIdMatch[1] : "";

  // Build the full query URL
  const fullQueryUrl = `${SYSTEM_URL}${gridQueryUrl}&${gridId}-size=${pageSize}&GridQuery=true`;

  // Fetch all pages
  let allData: any[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const body = `page=${page}&size=${pageSize}&${postBody}`;
    
    const resp = await fetch(fullQueryUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Requested-With": "XMLHttpRequest",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Cookie: jar.toString(),
      },
      body,
    });
    jar.addFromHeaders(resp.headers);

    if (!resp.ok) {
      throw new Error(`API returned ${resp.status}: ${await resp.text()}`);
    }

    const result = await resp.json();
    const data = result.data || [];
    allData = allData.concat(data);

    const total = result.total || 0;
    if (allData.length >= total || data.length < pageSize) {
      hasMore = false;
    } else {
      page++;
    }
  }

  return allData;
}

/**
 * Fetch stock data from Maxiprod
 */
async function fetchStock(jar: CookieJar): Promise<any[]> {
  updateProgress({ step: "Coletando estoque...", percent: 30, details: "Acessando página de estoque" });

  const body = 'orderBy=DescricaoItem-asc~LoteFabricanteNumeroSerie-asc&aggregates=Selected-count~Quantidade-sum~Custo1-sum' +
    '&~~Filtros~ItemVendavel~0=1&~~Filtros~ItemVendavel~1=1' +
    '&~~Filtros~TipoEstoque~0=1&~~Filtros~TipoEstoque~1=1&~~Filtros~TipoEstoque~2=1&~~Filtros~TipoEstoque~3=1' +
    '&~~Filtros~QualidadeDisponivel~0=1&~~Filtros~QualidadeDisponivel~1=1' +
    '&~~Filtros~EstoquesVencidos~0=1&~~Filtros~EstoquesVencidos~1=1' +
    '&~~Filtros~ApenasVencidosOuQualidadeIndisponivel~0=0' +
    '&~~Filtros~DentroDeVolume~0=1&~~Filtros~DentroDeVolume~1=1' +
    '&~~Filtros~VisualizarEstoqueEmpresas~0=0&~~Filtros~VisualizarEstoqueEmpresas~1=1&~~Filtros~VisualizarEstoqueEmpresas~2=0&~~Filtros~VisualizarEstoqueEmpresas~3=0' +
    '&~~Filtros~LocalizacaoEstoque~0=Todos&~~Filtros~SomenteContasBaixaPorExplosao~0=nao&~~Filtros~ProprioCliente~0=Qualquer';

  const data = await fetchGridData(
    jar,
    "/ItemEstoque?visualizarEstoqueOutrasEmpresas=True",
    "/ItemEstoque/GridQuery?idAtividade=0&quantidade=0&idItemNF=0&selecaoParaInventario=False&isSeparacao=False&visualizarEstoqueOutrasEmpresas=True",
    body
  );

  updateProgress({ percent: 40, details: `${data.length} itens de estoque coletados` });
  return data;
}

/**
 * Fetch order items (pedidos de venda em aberto) from Maxiprod
 */
async function fetchOrders(jar: CookieJar): Promise<any[]> {
  updateProgress({ step: "Coletando pedidos de venda...", percent: 45, details: "Acessando página de pedidos" });

  const body = 'orderBy=&aggregates=Selected-count~Quantidade-sum~ValorTotalComDesconto-sum~ValorTotalFaturar-sum' +
    '&~~Filtros~EstadoNota~0=0&~~Filtros~EstadoNota~1=1&~~Filtros~EstadoNota~2=1&~~Filtros~EstadoNota~3=0&~~Filtros~EstadoNota~4=0&~~Filtros~EstadoNota~5=0' +
    '&~~Filtros~Estado~0=1&~~Filtros~Estado~1=1&~~Filtros~Estado~2=1&~~Filtros~Estado~3=1&~~Filtros~Estado~4=0&~~Filtros~Estado~5=0' +
    '&~~Filtros~TipoNotaFiscal~0=P&~~Filtros~EntradaSaida~0=S&~~Filtros~Orfa~0=Não';

  const data = await fetchGridData(
    jar,
    "/ItemNotaFiscal/ItemPedidoVenda",
    "/ItemNotaFiscal/GridQuery?tipo=P&entradaSaida=S&gridComImpostos=False",
    body
  );

  updateProgress({ percent: 55, details: `${data.length} pedidos coletados` });
  return data;
}

/**
 * Fetch purchase orders (POs) from Maxiprod
 */
async function fetchPurchaseOrders(jar: CookieJar): Promise<any[]> {
  updateProgress({ step: "Coletando pedidos de compra...", percent: 60, details: "Acessando página de POs" });

  const body = 'orderBy=&aggregates=Selected-count~Quantidade-sum~ValorTotalComDesconto-sum~ValorTotalFaturar-sum' +
    '&~~Filtros~EstadoNota~0=0&~~Filtros~EstadoNota~1=1&~~Filtros~EstadoNota~2=1&~~Filtros~EstadoNota~3=0&~~Filtros~EstadoNota~4=0&~~Filtros~EstadoNota~5=0' +
    '&~~Filtros~Estado~0=1&~~Filtros~Estado~1=1&~~Filtros~Estado~2=1&~~Filtros~Estado~3=1&~~Filtros~Estado~4=0&~~Filtros~Estado~5=0' +
    '&~~Filtros~TipoNotaFiscal~0=P&~~Filtros~EntradaSaida~0=E&~~Filtros~Orfa~0=Não';

  const data = await fetchGridData(
    jar,
    "/ItemNotaFiscal/ItemPedidoCompra",
    "/ItemNotaFiscal/GridQuery?tipo=P&entradaSaida=E&gridComImpostos=False",
    body
  );

  updateProgress({ percent: 70, details: `${data.length} POs coletados` });
  return data;
}

/**
 * Fetch sales order items (all statuses including Faturado) for sales analytics
 */
async function fetchSalesItems(jar: CookieJar): Promise<any[]> {
  updateProgress({ step: "Coletando itens de vendas...", percent: 75, details: "Acessando itens dos pedidos" });

  // Include all statuses: A aprovar, Aprovado, Faturado
  const body = 'orderBy=&aggregates=Selected-count~Quantidade-sum~ValorTotalComDesconto-sum~ValorTotalFaturar-sum' +
    '&~~Filtros~EstadoNota~0=1&~~Filtros~EstadoNota~1=1&~~Filtros~EstadoNota~2=1&~~Filtros~EstadoNota~3=1&~~Filtros~EstadoNota~4=0&~~Filtros~EstadoNota~5=0' +
    '&~~Filtros~Estado~0=1&~~Filtros~Estado~1=1&~~Filtros~Estado~2=1&~~Filtros~Estado~3=1&~~Filtros~Estado~4=1&~~Filtros~Estado~5=0' +
    '&~~Filtros~TipoNotaFiscal~0=P&~~Filtros~EntradaSaida~0=S&~~Filtros~Orfa~0=Não';

  const data = await fetchGridData(
    jar,
    "/ItemNotaFiscal/ItemPedidoVenda",
    "/ItemNotaFiscal/GridQuery?tipo=P&entradaSaida=S&gridComImpostos=False",
    body
  );

  updateProgress({ percent: 85, details: `${data.length} itens de vendas coletados` });
  return data;
}

/**
 * Save all collected data to the database
 */
async function saveAllData(
  stockData: any[],
  orderData: any[],
  salesData: any[]
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  updateProgress({ step: "Salvando dados...", percent: 88, details: "Atualizando estoque" });

  // Save stock items
  await db.delete(stockItems);
  if (stockData.length > 0) {
    const rows = stockData.map((item: any) => ({
      codigoItem: item.CodigoItem || "",
      descricaoItem: item.DescricaoItem || "",
      quantidade: String(item.Quantidade || 0),
      unidadeMedida: item.UnidadeMedida || "",
      custoUnitario: String(item.CustoUnitario || 0),
      custoTotal: String(item.Custo1 || 0),
      codigoGrupo: item.CodigoGrupo || "",
      descricaoGrupo: item.DescricaoGrupo || "",
      codigoSuperGrupo: item.CodigoSuperGrupo || "",
      descricaoSuperGrupo: item.DescricaoSuperGrupo || "",
      empresaDona: item.EmpresaDonaApelido || "",
      estoqueLocal: item.EstoqueGrid || "",
      tipoDecodificado: item.TipoDecodificado || "",
      maxiprodId: item.Id || null,
    }));
    for (let i = 0; i < rows.length; i += 50) {
      await db.insert(stockItems).values(rows.slice(i, i + 50));
    }
  }

  updateProgress({ percent: 90, details: "Atualizando pedidos" });

  // Save order items
  await db.delete(orderItems);
  if (orderData.length > 0) {
    const rows = orderData.map((item: any) => ({
      codigoItem: item.CodItem || item.CodigoItem || "",
      descricao: item.Descricao || "",
      quantidade: String(item.Quantidade || 0),
      unidadeMedida: item.CodigoUnidadeMedida || item.UnidadeMedida || "",
      estadoNota: item.EstadoNotaFiscalDecodificado || "",
      estadoItem: item.EstadoDecodificado || "",
      numeroPedido: item.NumeroNota || "",
      cliente: item.ApelidoRemetenteDest || "",
      dataEmissao: item.DataEmissao || "",
      valorUnitario: String(item.ValorUnitarioMoedaOriginal || 0),
      valorTotal: String(item.ValorTotalMoedaOriginal || 0),
      codigoGrupo: item.CodigoGrupo || "",
      empresaDona: "",
      fatorConversao: item.FatorConversao ? String(item.FatorConversao) : null,
      quantidadeUnEstoque: item.QuantidadeUnidadeEstoque ? String(item.QuantidadeUnidadeEstoque) : null,
      maxiprodId: item.Id || null,
    }));
    for (let i = 0; i < rows.length; i += 50) {
      await db.insert(orderItems).values(rows.slice(i, i + 50));
    }
  }

  updateProgress({ percent: 92, details: "Atualizando vendas" });

  // Save sales order items
  await db.delete(salesOrders);
  if (salesData.length > 0) {
    const rows = salesData.map((item: any) => ({
      numeroPedido: String(item.NumeroNota || ""),
      dataEmissao: item.DataEmissao || null,
      cliente: item.ApelidoRemetenteDest || "",
      ufCliente: item.UfRemetenteDest || "",
      segmentoCliente: item.SegmentoRemetenteDest || "",
      codigoItem: item.CodItem || item.CodigoItem || "",
      descricaoItem: item.Descricao || "",
      quantidade: String(item.Quantidade || 0),
      unidadeMedida: item.CodigoUnidadeMedida || item.UnidadeMedida || "",
      valorUnitario: String(item.ValorUnitarioMoedaOriginal || 0),
      valorTotal: String(item.ValorTotalMoedaOriginal || 0),
      estadoPedido: item.EstadoNotaFiscalDecodificado || "",
      estadoItem: item.EstadoDecodificado || "",
      codigoGrupo: item.CodigoGrupo || "",
      idGrupoItem: item.IdGrupoItem ? Number(item.IdGrupoItem) : null,
      empresa: "PALITOS INDUSTRIA",
    }));
    for (let i = 0; i < rows.length; i += 50) {
      await db.insert(salesOrders).values(rows.slice(i, i + 50));
    }
  }

  updateProgress({ percent: 95, details: "Processando dashboard" });

  // Reprocess stock data for dashboard
  await processStockData();

  // Update scraper status
  const existing = await db.select().from(scraperStatus).limit(1);
  const statusUpdate = {
    isConnected: true,
    lastSyncAt: new Date(),
    lastSyncStatus: `OK - ${stockData.length} estoque, ${orderData.length} pedidos, ${salesData.length} vendas`,
    lastError: null,
    needsMfa: false,
  };

  if (existing.length === 0) {
    await db.insert(scraperStatus).values(statusUpdate);
  } else {
    await db.update(scraperStatus).set(statusUpdate).where(eq(scraperStatus.id, existing[0].id));
  }
}

/**
 * Main sync function - called when user clicks Sync button
 */
export async function runFullSync(): Promise<{ success: boolean; error?: string; counts?: { stock: number; orders: number; sales: number } }> {
  if (isSyncing) {
    return { success: false, error: "Sincronização já em andamento" };
  }

  isSyncing = true;
  updateProgress({ status: "running", step: "Iniciando sincronização...", percent: 0, details: "", error: null });

  try {
    // Step 1: Authenticate
    const jar = await authenticate();

    // Step 2: Select company (Palitos Industria)
    updateProgress({ step: "Selecionando empresa...", percent: 28, details: "PALITOS INDUSTRIA" });
    
    // Select company via API
    await fetch(`${SYSTEM_URL}/Login/TrocarPropriaEmpresa`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Requested-With": "XMLHttpRequest",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Cookie: jar.toString(),
      },
      body: "PropriaEmpresa=409300001619248",
    });

    // Step 3: Fetch all data
    const stockData = await fetchStock(jar);
    const orderData = await fetchOrders(jar);
    // POs are fetched as part of orders with entradaSaida=E
    const salesData = await fetchSalesItems(jar);

    // Step 4: Save everything
    await saveAllData(stockData, orderData, salesData);

    updateProgress({
      status: "success",
      step: "Sincronização concluída!",
      percent: 100,
      details: `${stockData.length} estoque, ${orderData.length} pedidos, ${salesData.length} vendas`,
      error: null,
    });

    isSyncing = false;
    return {
      success: true,
      counts: {
        stock: stockData.length,
        orders: orderData.length,
        sales: salesData.length,
      },
    };
  } catch (error: any) {
    console.error("[Sync] Error:", error.message);
    updateProgress({
      status: "error",
      step: "Erro na sincronização",
      percent: 0,
      details: "",
      error: error.message,
    });

    // Update scraper status with error
    try {
      const db = await getDb();
      if (db) {
        const existing = await db.select().from(scraperStatus).limit(1);
        const statusUpdate = {
          isConnected: false,
          lastSyncStatus: "error",
          lastError: error.message,
        };
        if (existing.length > 0) {
          await db.update(scraperStatus).set(statusUpdate).where(eq(scraperStatus.id, existing[0].id));
        }
      }
    } catch {}

    isSyncing = false;
    return { success: false, error: error.message };
  }
}
