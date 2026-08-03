/**
 * Maxiprod Scraper Service (Puppeteer-based)
 * 
 * Uses a headless browser to authenticate via the Maxiprod React SPA,
 * then makes API calls using the browser session cookies.
 * SOMENTE LEITURA - jamais altera dados no Maxiprod.
 */
import puppeteer, { Browser, Page } from "puppeteer";
import { getDb } from "./db";
import { stockItems, orderItems, scraperStatus, dashboardData } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { processStockData } from "./stockProcessor";

const APP_URL = "https://app.maxiprod.com.br";
const SYSTEM_URL = "https://sistema.maxiprod.com.br";

// Company IDs in Maxiprod
const COMPANY_IDS = {
  ESPETOS: "409300001630645",
  MESA: "409300001704502",
  PALITOS: "409300001619248",
  VARETAS: "409300001624530",
};

// Credentials from env
import { ENV } from "./_core/env";
const MAXIPROD_EMAIL = ENV.maxiprodEmail;
const MAXIPROD_PASSWORD = ENV.maxiprodPassword;

let browser: Browser | null = null;
let page: Page | null = null;
let syncInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;
let isLoggedIn = false;

/**
 * Launch or get the Puppeteer browser instance
 */
async function getBrowser(): Promise<Browser> {
  if (browser && browser.connected) return browser;
  
  console.log("[Scraper] Launching Puppeteer browser...");
  browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--single-process",
    ],
  });
  return browser;
}

/**
 * Get or create a page in the browser
 */
async function getPage(): Promise<Page> {
  const b = await getBrowser();
  if (page && !page.isClosed()) return page;
  
  page = await b.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );
  await page.setViewport({ width: 1280, height: 800 });
  return page;
}

/**
 * Login to Maxiprod via the React SPA
 */
async function login(): Promise<boolean> {
  try {
    const p = await getPage();
    isLoggedIn = false;
    
    console.log("[Scraper] Navigating to Maxiprod login...");
    await p.goto(`${APP_URL}/`, { waitUntil: "networkidle2", timeout: 30000 });
    
    // Wait for the React app to render
    await p.waitForSelector('input[type="email"], input[name="Email"], input[placeholder*="mail"], input[type="text"]', { timeout: 15000 }).catch(() => null);
    
    // Check if already logged in (redirected to dashboard)
    const initialUrl = p.url();
    if (initialUrl.includes("sistema.maxiprod") || !initialUrl.includes("Account")) {
      // Check if we're on the main app page
      const hasMenu = await p.$('[id^="MenuPrincipal"]').catch(() => null);
      if (hasMenu) {
        console.log("[Scraper] Already logged in!");
        isLoggedIn = true;
        await updateStatus({ isConnected: true, needsMfa: false, lastError: null });
        return true;
      }
    }
    
    // Fill in email
    const emailInput = await p.$('input[type="email"], input[name="Email"], input[placeholder*="mail"]');
    if (!emailInput) {
      // Try to find any text input that could be the email field
      const inputs = await p.$$('input[type="text"]');
      if (inputs.length > 0) {
        await inputs[0].click({ clickCount: 3 });
        await inputs[0].type(MAXIPROD_EMAIL, { delay: 50 });
      } else {
        console.error("[Scraper] Could not find email input");
        await updateStatus({ isConnected: false, lastError: "Login form not found" });
        return false;
      }
    } else {
      await emailInput.click({ clickCount: 3 });
      await emailInput.type(MAXIPROD_EMAIL, { delay: 50 });
    }
    
    // Fill in password
    const passwordInput = await p.$('input[type="password"]');
    if (!passwordInput) {
      console.error("[Scraper] Could not find password input");
      await updateStatus({ isConnected: false, lastError: "Password field not found" });
      return false;
    }
    await passwordInput.click({ clickCount: 3 });
    await passwordInput.type(MAXIPROD_PASSWORD, { delay: 50 });
    
    // Click submit button
    const submitBtn = await p.$('button[type="submit"], input[type="submit"]');
    if (submitBtn) {
      await submitBtn.click();
    } else {
      // Try finding a button with login text
      const buttons = await p.$$('button');
      let clicked = false;
      for (const btn of buttons) {
        const text = await btn.evaluate(el => el.textContent || '');
        if (text.toLowerCase().includes('entrar') || text.toLowerCase().includes('login')) {
          await btn.click();
          clicked = true;
          break;
        }
      }
      if (!clicked) {
        // Try pressing Enter
        await passwordInput.press("Enter");
      }
    }
    
    // Wait for navigation
    await p.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }).catch(() => null);
    
    // Check result
    const afterUrl = p.url();
    console.log(`[Scraper] After login, URL: ${afterUrl}`);
    
    // Check for MFA
    if (afterUrl.includes("VerifyCode") || afterUrl.includes("TwoFactor") || afterUrl.includes("verify")) {
      console.log("[Scraper] MFA required");
      await updateStatus({ isConnected: false, needsMfa: true, lastError: "Código MFA necessário" });
      return false;
    }
    
    // Check if login failed (still on login page)
    if (afterUrl.includes("Account/Login") || afterUrl.includes("login")) {
      const errorText = await p.$eval('.validation-summary-errors, .error-message, .alert-danger', el => el.textContent).catch(() => "");
      console.error("[Scraper] Login failed:", errorText || "Unknown error");
      await updateStatus({ isConnected: false, lastError: errorText || "Credenciais inválidas" });
      return false;
    }
    
    // Navigate to sistema.maxiprod.com.br
    // The flow: sistema -> 302 to app.maxiprod.com.br/oauth?payload=... -> JS redirect (window.location.href) -> sistema with cookies
    // The /oauth page is a React SPA that reads the payload and does a JS redirect
    console.log("[Scraper] Navigating to sistema.maxiprod.com.br...");
    
    // Use page.goto which follows HTTP redirects, then wait for JS redirects
    await p.goto(`${SYSTEM_URL}/`, { waitUntil: "domcontentloaded", timeout: 30000 });
    
    // Wait for the page to settle - the /oauth page does a JS redirect
    // We need to wait for the URL to change to sistema.maxiprod.com.br
    const waitForSystem = async (): Promise<boolean> => {
      for (let i = 0; i < 20; i++) {
        const url = p.url();
        console.log(`[Scraper] Waiting for system (${i + 1}/20): ${url}`);
        
        if (url.includes('sistema.maxiprod.com.br') && !url.includes('oauth')) {
          // We're on the system page!
          await p.waitForNetworkIdle({ timeout: 10000 }).catch(() => null);
          return true;
        }
        
        // If on the OAuth page, the JS should redirect us
        // Wait for navigation to happen
        try {
          await p.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 5000 });
        } catch {
          // No navigation happened, wait a bit and check again
          await new Promise(r => setTimeout(r, 2000));
        }
      }
      return false;
    };
    
    const systemReached = await waitForSystem();
    
    if (systemReached) {
      const finalUrl = p.url();
      console.log(`[Scraper] Reached sistema: ${finalUrl}`);
      isLoggedIn = true;
      await updateStatus({ isConnected: true, needsMfa: false, lastError: null });
      console.log("[Scraper] Login successful, system session established");
      return true;
    }
    
    // If we're still stuck on the OAuth page, try a different approach:
    // Execute the redirect manually
    const oauthUrl = p.url();
    if (oauthUrl.includes('oauth?payload=')) {
      console.log("[Scraper] Trying to execute OAuth redirect manually...");
      const redirectUrl = await p.evaluate(() => {
        // The OAuth page sets window.location.href via a script
        const scripts = Array.from(document.querySelectorAll('script'));
        for (let i = 0; i < scripts.length; i++) {
          const match = scripts[i].textContent?.match(/window\.location\.href\s*=\s*'([^']+)'/);
          if (match) return match[1];
        }
        return null;
      });
      
      if (redirectUrl) {
        console.log(`[Scraper] Found redirect URL: ${redirectUrl}`);
        await p.goto(redirectUrl, { waitUntil: "networkidle2", timeout: 30000 });
        const afterUrl = p.url();
        console.log(`[Scraper] After manual redirect: ${afterUrl}`);
        
        if (afterUrl.includes('sistema.maxiprod.com.br')) {
          isLoggedIn = true;
          await updateStatus({ isConnected: true, needsMfa: false, lastError: null });
          console.log("[Scraper] Login successful via manual redirect");
          return true;
        }
      }
    }
    
    console.error("[Scraper] Could not establish system session");
    await updateStatus({ isConnected: false, lastError: "Falha ao conectar ao sistema" });
    return false;
  } catch (error: any) {
    console.error("[Scraper] Login error:", error.message);
    await updateStatus({ isConnected: false, lastError: error.message });
    return false;
  }
}

/**
 * Submit MFA code
 */
export async function submitMfaCode(code: string): Promise<boolean> {
  try {
    const p = await getPage();
    
    // Check if we're on the MFA page
    const currentUrl = p.url();
    if (!currentUrl.includes("VerifyCode") && !currentUrl.includes("TwoFactor") && !currentUrl.includes("verify")) {
      // Need to re-login first
      await login();
      const afterUrl = p.url();
      if (!afterUrl.includes("VerifyCode") && !afterUrl.includes("TwoFactor")) {
        return false;
      }
    }
    
    // Find the MFA code input
    const codeInput = await p.$('input[name="Code"], input[type="text"], input[type="number"]');
    if (!codeInput) {
      console.error("[Scraper] Could not find MFA code input");
      return false;
    }
    
    await codeInput.click({ clickCount: 3 });
    await codeInput.type(code, { delay: 50 });
    
    // Submit
    const submitBtn = await p.$('button[type="submit"], input[type="submit"]');
    if (submitBtn) {
      await submitBtn.click();
    } else {
      await codeInput.press("Enter");
    }
    
    await p.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }).catch(() => null);
    
    // Navigate to system
    await p.goto(`${SYSTEM_URL}/`, { waitUntil: "networkidle2", timeout: 30000 });
    
    const hasMenu = await p.$('[id^="MenuPrincipal"]').catch(() => null);
    if (hasMenu) {
      isLoggedIn = true;
      await updateStatus({ isConnected: true, needsMfa: false, mfaCode: null, lastError: null });
      console.log("[Scraper] MFA verified, login successful");
      return true;
    }
    
    await updateStatus({ lastError: "MFA code invalid or expired" });
    return false;
  } catch (error: any) {
    console.error("[Scraper] MFA error:", error.message);
    await updateStatus({ lastError: `MFA error: ${error.message}` });
    return false;
  }
}

/**
 * Select a company in the Maxiprod session
 */
async function selectCompany(companyId: string): Promise<void> {
  const p = await getPage();
  
  try {
    // Use the company selector dropdown
    const result = await p.evaluate(async (cId: string) => {
      const resp = await fetch("/Login/TrocarPropriaEmpresa", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: `PropriaEmpresa=${cId}`,
        credentials: "include",
      });
      const data = await resp.json();
      if (data?.Data?.Url) {
        await fetch(data.Data.Url, { credentials: "include" });
      }
      return { ok: true, status: resp.status };
    }, companyId);
    
    console.log(`[Scraper] Company selected: ${companyId}`);
  } catch (error: any) {
    console.warn(`[Scraper] Company selection warning: ${error.message}`);
  }
}

/**
 * Fetch stock data via browser's fetch API (uses session cookies automatically)
 */
async function fetchStockData(): Promise<any[]> {
  const p = await getPage();
  
  // First navigate to the stock page to establish the grid context
  await p.goto(`${SYSTEM_URL}/ItemEstoque?visualizarEstoqueOutrasEmpresas=True`, {
    waitUntil: "networkidle2",
    timeout: 30000,
  });
  
  // Extract the GridId from the page
  const gridId = await p.evaluate(() => {
    const el = document.querySelector('[id^="GridItensEstoque"]');
    return el ? el.id : null;
  });
  
  if (!gridId) {
    console.error("[Scraper] Could not find stock grid ID");
    throw new Error("Stock grid not found - session may have expired");
  }
  
  // Make the API call from within the browser
  const data = await p.evaluate(async (gId: string) => {
    const url = `/ItemEstoque/GridQuery?idAtividade=0&quantidade=0&idItemNF=0&selecaoParaInventario=False&isSeparacao=False&visualizarEstoqueOutrasEmpresas=True&${gId}-size=500&GridQuery=true`;
    
    const body = 'page=1&size=500&orderBy=DescricaoItem-asc~LoteFabricanteNumeroSerie-asc&aggregates=Selected-count~Quantidade-sum~Custo1-sum' +
      '&~~Filtros~ItemVendavel~0=1&~~Filtros~ItemVendavel~1=1' +
      '&~~Filtros~TipoEstoque~0=1&~~Filtros~TipoEstoque~1=1&~~Filtros~TipoEstoque~2=1&~~Filtros~TipoEstoque~3=1' +
      '&~~Filtros~QualidadeDisponivel~0=1&~~Filtros~QualidadeDisponivel~1=1' +
      '&~~Filtros~EstoquesVencidos~0=1&~~Filtros~EstoquesVencidos~1=1' +
      '&~~Filtros~ApenasVencidosOuQualidadeIndisponivel~0=0' +
      '&~~Filtros~DentroDeVolume~0=1&~~Filtros~DentroDeVolume~1=1' +
      '&~~Filtros~VisualizarEstoqueEmpresas~0=0&~~Filtros~VisualizarEstoqueEmpresas~1=1&~~Filtros~VisualizarEstoqueEmpresas~2=0&~~Filtros~VisualizarEstoqueEmpresas~3=0' +
      '&~~Filtros~LocalizacaoEstoque~0=Todos&~~Filtros~SomenteContasBaixaPorExplosao~0=nao&~~Filtros~ProprioCliente~0=Qualquer';
    
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: body,
      credentials: 'include',
    });
    
    if (!resp.ok) throw new Error(`Stock API returned ${resp.status}`);
    const result = await resp.json();
    return { data: result.data || [], total: result.total || 0 };
  }, gridId);
  
  console.log(`[Scraper] Stock API: ${data.data.length} items, total=${data.total}`);
  return data.data;
}

/**
 * Fetch order items from Maxiprod (READ ONLY)
 * Only fetches "A aprovar" and "Aprovado" orders (not "Digitação")
 */
async function fetchOrderData(): Promise<any[]> {
  const p = await getPage();
  
  // Navigate to the orders page to get the grid context
  await p.goto(`${SYSTEM_URL}/ItemNotaFiscal/ItemPedidoVenda`, {
    waitUntil: "networkidle2",
    timeout: 30000,
  });
  
  // Extract the GridId
  const gridId = await p.evaluate(() => {
    const el = document.querySelector('[id^="GridItemNotaFiscal"]');
    return el ? el.id : null;
  });
  
  if (!gridId) {
    console.error("[Scraper] Could not find order grid ID");
    throw new Error("Order grid not found - session may have expired");
  }
  
  // Make the API call from within the browser
  const data = await p.evaluate(async (gId: string) => {
    const url = `/ItemNotaFiscal/GridQuery?tipo=P&entradaSaida=S&gridComImpostos=False&${gId}-size=500&GridQuery=true`;
    
    const body = 'page=1&size=500&orderBy=&aggregates=Selected-count~Quantidade-sum~ValorTotalComDesconto-sum~ValorTotalFaturar-sum' +
      '&~~Filtros~EstadoNota~0=0&~~Filtros~EstadoNota~1=1&~~Filtros~EstadoNota~2=1&~~Filtros~EstadoNota~3=0&~~Filtros~EstadoNota~4=0&~~Filtros~EstadoNota~5=0' +
      '&~~Filtros~Estado~0=1&~~Filtros~Estado~1=1&~~Filtros~Estado~2=1&~~Filtros~Estado~3=1&~~Filtros~Estado~4=0&~~Filtros~Estado~5=0' +
      '&~~Filtros~TipoNotaFiscal~0=P&~~Filtros~EntradaSaida~0=S&~~Filtros~Orfa~0=Não';
    
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: body,
      credentials: 'include',
    });
    
    if (!resp.ok) throw new Error(`Orders API returned ${resp.status}`);
    const result = await resp.json();
    return { data: result.data || [], total: result.total || 0 };
  }, gridId);
  
  console.log(`[Scraper] Orders API: ${data.data.length} items, total=${data.total}`);
  return data.data;
}

/**
 * Save stock data to database
 */
async function saveStockData(data: any[]): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.delete(stockItems);
  
  if (data.length > 0) {
    const rows = data.map((item: any) => ({
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
}

/**
 * Save order data to database
 */
async function saveOrderData(data: any[]): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.delete(orderItems);
  
  if (data.length > 0) {
    const rows = data.map((item: any) => ({
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
      empresaDona: "", // Orders are per company session
      maxiprodId: item.Id || null,
      fatorConversao: item.FatorConversao ? String(item.FatorConversao) : null,
      quantidadeUnEstoque: item.QuantidadeUnidadeEstoque ? String(item.QuantidadeUnidadeEstoque) : null,
    }));
    
    for (let i = 0; i < rows.length; i += 50) {
      await db.insert(orderItems).values(rows.slice(i, i + 50));
    }
  }
}

/**
 * Update scraper status in database
 */
async function updateStatus(updates: Partial<{
  isConnected: boolean;
  lastSyncAt: Date;
  lastSyncStatus: string;
  lastError: string | null;
  needsMfa: boolean;
  mfaCode: string | null;
  sessionCookies: string | null;
}>): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    
    const existing = await db.select().from(scraperStatus).limit(1);
    
    if (existing.length === 0) {
      await db.insert(scraperStatus).values({
        isConnected: updates.isConnected ?? false,
        lastSyncStatus: updates.lastSyncStatus || "initializing",
        lastError: updates.lastError || null,
        needsMfa: updates.needsMfa ?? false,
        mfaCode: updates.mfaCode || null,
        sessionCookies: updates.sessionCookies || null,
        lastSyncAt: updates.lastSyncAt || null,
      });
    } else {
      const setObj: any = {};
      if (updates.isConnected !== undefined) setObj.isConnected = updates.isConnected;
      if (updates.lastSyncAt !== undefined) setObj.lastSyncAt = updates.lastSyncAt;
      if (updates.lastSyncStatus !== undefined) setObj.lastSyncStatus = updates.lastSyncStatus;
      if (updates.lastError !== undefined) setObj.lastError = updates.lastError;
      if (updates.needsMfa !== undefined) setObj.needsMfa = updates.needsMfa;
      if (updates.mfaCode !== undefined) setObj.mfaCode = updates.mfaCode;
      if (updates.sessionCookies !== undefined) setObj.sessionCookies = updates.sessionCookies;
      
      await db.update(scraperStatus).set(setObj).where(eq(scraperStatus.id, existing[0].id));
    }
  } catch (error) {
    console.error("[Scraper] Failed to update status:", error);
  }
}

/**
 * Get current scraper status
 */
export async function getScraperStatus(): Promise<ScraperStatus | null> {
  try {
    const db = await getDb();
    if (!db) return null;
    const result = await db.select().from(scraperStatus).limit(1);
    return result[0] || null;
  } catch {
    return null;
  }
}

type ScraperStatus = {
  id: number;
  isConnected: boolean;
  lastSyncAt: Date | null;
  lastSyncStatus: string | null;
  lastError: string | null;
  needsMfa: boolean;
  mfaCode: string | null;
  updatedAt: Date;
};

/**
 * Main sync function - runs every 2 minutes
 */
async function syncData(): Promise<void> {
  if (isRunning) {
    console.log("[Scraper] Sync already in progress, skipping");
    return;
  }
  
  isRunning = true;
  console.log("[Scraper] Starting sync at", new Date().toISOString());
  
  try {
    // Check if we need to login
    if (!isLoggedIn) {
      const loggedIn = await login();
      if (!loggedIn) {
        isRunning = false;
        return;
      }
    }
    
    // Select Palitos Industria
    await selectCompany(COMPANY_IDS.PALITOS);
    
    // Fetch stock data
    let stockData: any[];
    try {
      stockData = await fetchStockData();
    } catch (error: any) {
      console.log("[Scraper] Stock fetch failed, re-logging in...", error.message);
      isLoggedIn = false;
      const loggedIn = await login();
      if (!loggedIn) {
        isRunning = false;
        return;
      }
      await selectCompany(COMPANY_IDS.PALITOS);
      stockData = await fetchStockData();
    }
    
    // Fetch order data
    let orderData: any[];
    try {
      orderData = await fetchOrderData();
    } catch (error: any) {
      console.log("[Scraper] Order fetch failed:", error.message);
      orderData = [];
    }
    
    // Save raw data
    await saveStockData(stockData);
    await saveOrderData(orderData);
    
    // Process and compute dashboard data
    await processStockData();
    
    await updateStatus({
      isConnected: true,
      lastSyncAt: new Date(),
      lastSyncStatus: `OK - ${stockData.length} estoque, ${orderData.length} pedidos`,
      lastError: null,
    });
    
    console.log(`[Scraper] Sync completed: ${stockData.length} stock, ${orderData.length} orders`);
  } catch (error: any) {
    console.error("[Scraper] Sync error:", error.message);
    await updateStatus({
      isConnected: false,
      lastSyncStatus: "error",
      lastError: error.message,
    });
    
    // Reset login state on errors
    isLoggedIn = false;
  } finally {
    isRunning = false;
  }
}

/**
 * Start the scraper service
 */
export function startScraper(): void {
  // Automatic scraping is disabled because Maxiprod uses a complex OAuth flow
  // between app.maxiprod.com.br and sistema.maxiprod.com.br that doesn't work
  // in headless browser mode (the /oauth page is a React SPA that does JS redirects).
  // 
  // Data can be updated via:
  // 1. The dashboard.ingestData tRPC endpoint (accepts raw Maxiprod API data)
  // 2. The dashboard.forceSync endpoint (triggers manual sync attempt)
  // 3. Running the browser collection script in a logged-in Maxiprod session
  console.log("[Scraper] Scraper service initialized (auto-sync disabled, use manual sync or data ingestion API)");
  
  // Don't start automatic sync - it just produces errors
  // To enable: uncomment the lines below
  // setTimeout(() => syncData(), 5000);
  // syncInterval = setInterval(() => syncData(), 2 * 60 * 1000);
}

/**
 * Stop the scraper service
 */
export function stopScraper(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  if (browser) {
    browser.close().catch(() => {});
    browser = null;
    page = null;
  }
  console.log("[Scraper] Scraper service stopped");
}

/**
 * Force an immediate sync
 */
export async function forceSyncNow(): Promise<void> {
  await syncData();
}

/**
 * Scrape reservation status for Digitação orders.
 * Navigates to the PedidoVenda grid filtered for Digitação only,
 * then checks each order's items for "(reservado)" vs "(reservar)" in the Estoque column.
 * Updates the estoqueReservado field in order_items table.
 * 
 * This function is called after the GraphQL sync to enrich Digitação orders
 * with reservation status that is NOT available via the GraphQL API.
 */
export async function scrapeReservationStatus(): Promise<{ updated: number; errors: string[] }> {
  const db = await getDb();
  if (!db) return { updated: 0, errors: ["No database connection"] };
  
  const errors: string[] = [];
  let updated = 0;
  
  try {
    // Get all unique Digitação order numbers from order_items
    const digitacaoItems = await db.select({
      numeroPedido: orderItems.numeroPedido,
      maxiprodId: orderItems.maxiprodId,
    }).from(orderItems).where(
      eq(orderItems.estadoNota, "Digitação")
    );
    
    if (digitacaoItems.length === 0) {
      console.log("[Scraper Reserva] No Digitação orders to check");
      return { updated: 0, errors: [] };
    }
    
    // Get unique order numbers
    const uniqueOrders = Array.from(new Set(digitacaoItems.map(i => i.numeroPedido).filter(Boolean))) as string[];
    console.log(`[Scraper Reserva] Checking reservation status for ${uniqueOrders.length} Digitação orders`);
    
    // Try to get the page (requires active browser session)
    let p: Page;
    try {
      p = await getPage();
    } catch (e: any) {
      errors.push(`Browser not available: ${e.message}`);
      return { updated: 0, errors };
    }
    
    // Navigate to the PedidoVenda list page filtered for Digitação
    // Use the NotaFiscal/ItemPedidoVenda grid with Digitação filter ON
    try {
      await p.goto(`${SYSTEM_URL}/ItemNotaFiscal/ItemPedidoVenda`, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });
    } catch (e: any) {
      errors.push(`Navigation failed: ${e.message}`);
      return { updated: 0, errors };
    }
    
    // Extract the GridId
    const gridId = await p.evaluate(() => {
      const el = document.querySelector('[id^="GridItemNotaFiscal"]');
      return el ? el.id : null;
    });
    
    if (!gridId) {
      errors.push("Could not find order grid ID");
      return { updated: 0, errors };
    }
    
    // Fetch Digitação orders from the grid API
    // EstadoNota~0=1 means Digitação ON, all others OFF
    const data = await p.evaluate(async (gId: string) => {
      const url = `/ItemNotaFiscal/GridQuery?tipo=P&entradaSaida=S&gridComImpostos=False&${gId}-size=500&GridQuery=true`;
      
      const body = 'page=1&size=500&orderBy=&aggregates=Selected-count~Quantidade-sum~ValorTotalComDesconto-sum~ValorTotalFaturar-sum' +
        '&~~Filtros~EstadoNota~0=1&~~Filtros~EstadoNota~1=0&~~Filtros~EstadoNota~2=0&~~Filtros~EstadoNota~3=0&~~Filtros~EstadoNota~4=0&~~Filtros~EstadoNota~5=0' +
        '&~~Filtros~Estado~0=1&~~Filtros~Estado~1=1&~~Filtros~Estado~2=1&~~Filtros~Estado~3=1&~~Filtros~Estado~4=0&~~Filtros~Estado~5=0' +
        '&~~Filtros~TipoNotaFiscal~0=P&~~Filtros~EntradaSaida~0=S&~~Filtros~Orfa~0=Não';
      
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: body,
        credentials: 'include',
      });
      
      if (!resp.ok) throw new Error(`Grid API returned ${resp.status}`);
      const result = await resp.json();
      return { data: result.data || [], total: result.total || 0 };
    }, gridId);
    
    console.log(`[Scraper Reserva] Grid API returned ${data.data.length} Digitação items`);
    
    // Log the first item's fields to understand what's available
    if (data.data.length > 0) {
      const sampleItem = data.data[0];
      const fieldNames = Object.keys(sampleItem);
      console.log(`[Scraper Reserva] Available fields: ${fieldNames.join(', ')}`);
      
      // Look for reservation-related fields
      const reservaFields = fieldNames.filter(f => 
        f.toLowerCase().includes('estoque') || 
        f.toLowerCase().includes('reserv') ||
        f.toLowerCase().includes('separar') ||
        f.toLowerCase().includes('situacao')
      );
      console.log(`[Scraper Reserva] Reservation-related fields: ${reservaFields.join(', ')}`);
      
      if (reservaFields.length > 0) {
        console.log(`[Scraper Reserva] Sample values:`, 
          reservaFields.reduce((acc: any, f: string) => { acc[f] = sampleItem[f]; return acc; }, {})
        );
      }
    }
    
    // Try to determine reservation status from the grid data
    // The grid might have a field like 'Estoque', 'EstoqueReservado', 'SituacaoEstoque', etc.
    for (const item of data.data) {
      const numeroPedido = item.NumeroNota || item.NumeroPedido || "";
      const codigoItem = item.CodItem || item.CodigoItem || "";
      
      // Check various possible field names for reservation status
      const estoqueField = item.Estoque || item.EstoqueReservado || item.SituacaoEstoque || 
                          item.EstoqueStatus || item.ReservaEstoque || "";
      const estoqueStr = String(estoqueField).toLowerCase();
      
      // "(reservado)" means reserved, "(reservar)" or empty means not reserved
      const isReserved = estoqueStr.includes('reservado') && !estoqueStr.includes('reservar');
      
      // Also check SepararParaExpedicao field which might indicate reservation
      const separarField = item.SepararParaExpedicao || item.Separar || "";
      const isSeparado = String(separarField).toLowerCase() === 'true' || separarField === true;
      
      const finalReserved = isReserved || isSeparado;
      
      if (numeroPedido && codigoItem) {
        try {
          await db.update(orderItems)
            .set({ estoqueReservado: finalReserved })
            .where(
              eq(orderItems.numeroPedido, numeroPedido)
            );
          updated++;
        } catch (e: any) {
          // Silently continue - some items might not match
        }
      }
    }
    
    // If no grid field was found for reservation, try navigating to individual order pages
    if (data.data.length > 0 && updated === 0) {
      console.log("[Scraper Reserva] Grid API didn't have reservation field, trying individual order pages...");
      
      for (const orderNum of uniqueOrders.slice(0, 20)) { // Limit to 20 orders to avoid timeout
        try {
          // Navigate to the order's edit page
          // The URL pattern is: /NotaFiscal/Edit?numero={orderNum}&tipo=P&entradaSaida=S
          await p.goto(`${SYSTEM_URL}/NotaFiscal/Edit?numero=${orderNum}&tipo=P&entradaSaida=S`, {
            waitUntil: "networkidle2",
            timeout: 15000,
          });
          
          // Wait for the items grid to load
          await p.waitForSelector('table, .k-grid', { timeout: 5000 }).catch(() => {});
          
          // Read reservation status from the DOM
          const reservationData = await p.evaluate(() => {
            const results: Array<{ codigo: string; reservado: boolean }> = [];
            
            // Look for the items table rows
            const rows = Array.from(document.querySelectorAll('tr[role="row"], .k-grid tr'));
            for (const row of rows) {
              const cells = row.querySelectorAll('td');
              if (cells.length < 6) continue;
              
              // The "Código" is typically in the 2nd column, "Estoque" in the 6th
              const codigoCell = cells[1]?.textContent?.trim() || "";
              const estoqueCell = cells[5]?.textContent?.trim() || "";
              
              if (codigoCell && estoqueCell) {
                const isReserved = estoqueCell.toLowerCase().includes('reservado') && 
                                  !estoqueCell.toLowerCase().includes('reservar');
                results.push({ codigo: codigoCell, reservado: isReserved });
              }
            }
            return results;
          });
          
          // Update the database
          for (const item of reservationData) {
            if (item.codigo) {
              await db.update(orderItems)
                .set({ estoqueReservado: item.reservado })
                .where(
                  eq(orderItems.numeroPedido, orderNum)
                );
              updated++;
            }
          }
        } catch (e: any) {
          errors.push(`Order ${orderNum}: ${e.message}`);
        }
      }
    }
    
    console.log(`[Scraper Reserva] Updated ${updated} items, ${errors.length} errors`);
    return { updated, errors };
    
  } catch (error: any) {
    console.error("[Scraper Reserva] Error:", error.message);
    errors.push(error.message);
    return { updated: 0, errors };
  }
}
