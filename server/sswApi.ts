/**
 * SSW API Integration - Camilo dos Santos
 * Cotação de frete via SOAP/XML
 * 
 * Endpoint: https://ssw.inf.br/ws/sswCotacaoCliente/index.php
 * Namespace: urn:sswinfbr.sswCotacaoCliente
 * Method: cotar
 * SOAPAction: urn:sswinfbr.sswCotacaoCliente#cotar
 * 
 * WSDL Parameters (camelCase, in order):
 *   dominio, login, senha, cnpjPagador, senhaPagador, cepOrigem, cepDestino,
 *   valorNF, quantidade, peso, volume, mercadoria, cnpjDestinatario,
 *   coletar, entDificil, destContribuinte, cnpjRemetente
 * 
 * Notes:
 *   - "volume" in WSDL = cubagem em m³ (NOT number of volumes)
 *   - "quantidade" = number of volumes/packages
 *   - "mercadoria" = commodity code (9 = CAIXAS for Fox)
 *   - CEP must be 8 digits without dash
 */

interface SSWQuoteParams {
  cnpjPagador: string;
  cepOrigem: string | number;
  cepDestino: string | number;
  valorNF: number;
  quantidade: number; // number of volumes/packages
  peso: number; // kg
  cubagem: number; // m³ (maps to "volume" in WSDL)
  mercadoria?: number; // commodity code, default 9 (CAIXAS)
  cnpjDestinatario?: string;
  cnpjRemetente?: string;
  coletar?: "S" | "N";
  entDificil?: "S" | "N";
  destContribuinte?: "S" | "N";
}

interface SSWQuoteResult {
  erro: number;
  mensagem: string;
  pesoCalculo: number;
  prazo: number;
  totalFrete: number;
  fretePeso: number;
  freteValor: number;
  despacho: number;
  cat: number;
  itr: number;
  gris: number;
  pedagio: number;
  tas: number;
  impostos: number;
  adicFrete: number;
  tde: number;
  coleta: number;
  entrega: number;
  tabCalculo: string;
  numeroCotacao: string;
}

function buildSoapEnvelope(params: SSWQuoteParams): string {
  const domain = process.env.SSW_DOMAIN || "RCS";
  const login = process.env.SSW_USER || "foxapi";
  const senha = process.env.SSW_PASSWORD || "14lt27ca";
  const senhaPagador = process.env.SSW_SENHA_PAGADOR || "251038";

  // Normalize CEP to 8 digits (no dash)
  const cepOrigem = String(params.cepOrigem).replace(/\D/g, "");
  const cepDestino = String(params.cepDestino).replace(/\D/g, "");

  // Parameters in WSDL-specified order for sswCotacaoCliente#cotar
  return `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="urn:sswinfbr.sswCotacaoCliente">
  <SOAP-ENV:Body>
    <ns1:cotar>
      <dominio>${domain}</dominio>
      <login>${login}</login>
      <senha>${senha}</senha>
      <cnpjPagador>${params.cnpjPagador}</cnpjPagador>
      <senhaPagador>${senhaPagador}</senhaPagador>
      <cepOrigem>${cepOrigem}</cepOrigem>
      <cepDestino>${cepDestino}</cepDestino>
      <valorNF>${params.valorNF.toFixed(2)}</valorNF>
      <quantidade>${params.quantidade}</quantidade>
      <peso>${params.peso.toFixed(3)}</peso>
      <volume>${params.cubagem.toFixed(4)}</volume>
      <mercadoria>${params.mercadoria ?? 9}</mercadoria>
      <cnpjDestinatario>${params.cnpjDestinatario || ""}</cnpjDestinatario>
      <coletar>${params.coletar || "S"}</coletar>
      <entDificil>${params.entDificil || "N"}</entDificil>
      <destContribuinte>${params.destContribuinte || "S"}</destContribuinte>
      <cnpjRemetente>${params.cnpjRemetente || ""}</cnpjRemetente>
    </ns1:cotar>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;
}

function parseXmlValue(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`);
  const match = xml.match(regex);
  return match ? match[1] : "";
}

/**
 * Decode HTML entities that SSW sometimes returns in error/info messages
 */
function decodeSSWMessage(msg: string): string {
  return msg
    .replace(/&amp;/g, "&")
    .replace(/ampamp/g, "&")
    .replace(/&atilde;/g, "ã")
    .replace(/&ccedil;/g, "ç")
    .replace(/&aacute;/g, "á")
    .replace(/&eacute;/g, "é")
    .replace(/&iacute;/g, "í")
    .replace(/&oacute;/g, "ó")
    .replace(/&uacute;/g, "ú")
    .replace(/&nbsp;/g, " ")
    .replace(/<br>/g, " ")
    .replace(/&lt;br&gt;/g, " ")
    .trim();
}

function parseSSWResponse(xml: string): SSWQuoteResult {
  return {
    erro: parseInt(parseXmlValue(xml, "erro") || "0"),
    mensagem: decodeSSWMessage(parseXmlValue(xml, "mensagem")),
    pesoCalculo: parseFloat(parseXmlValue(xml, "pesoCalculo") || "0"),
    prazo: parseInt(parseXmlValue(xml, "prazo") || "0"),
    totalFrete: parseFloat(parseXmlValue(xml, "totalFrete") || "0"),
    fretePeso: parseFloat(parseXmlValue(xml, "fretePeso") || "0"),
    freteValor: parseFloat(parseXmlValue(xml, "freteValor") || "0"),
    despacho: parseFloat(parseXmlValue(xml, "despacho") || "0"),
    cat: parseFloat(parseXmlValue(xml, "cat") || "0"),
    itr: parseFloat(parseXmlValue(xml, "itr") || "0"),
    gris: parseFloat(parseXmlValue(xml, "gris") || "0"),
    pedagio: parseFloat(parseXmlValue(xml, "pedagio") || "0"),
    tas: parseFloat(parseXmlValue(xml, "tas") || "0"),
    impostos: parseFloat(parseXmlValue(xml, "impostos") || "0"),
    adicFrete: parseFloat(parseXmlValue(xml, "adicFrete") || "0"),
    tde: parseFloat(parseXmlValue(xml, "entGeral") || "0"), // TDE = entrega geral
    coleta: parseFloat(parseXmlValue(xml, "coleta") || "0"),
    entrega: parseFloat(parseXmlValue(xml, "entrega") || "0"),
    tabCalculo: parseXmlValue(xml, "tabCalculo") || "",
    numeroCotacao: parseXmlValue(xml, "numeroCotacao") || parseXmlValue(xml, "numero_cotacao") || parseXmlValue(xml, "cotacao") || "",
  };
}

export async function quoteSswFreight(params: SSWQuoteParams): Promise<SSWQuoteResult> {
  const soapBody = buildSoapEnvelope(params);

  const response = await fetch("https://ssw.inf.br/ws/sswCotacaoCliente/index.php", {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "SOAPAction": "urn:sswinfbr.sswCotacaoCliente#cotar",
    },
    body: soapBody,
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`SSW API error: ${response.status} ${response.statusText}`);
  }

  const rawXml = await response.text();
  
  // Extract the inner XML from the SOAP response (it's HTML-encoded inside <return>)
  const returnMatch = rawXml.match(/<return[^>]*>([\s\S]*?)<\/return>/);
  let innerXml = rawXml;
  if (returnMatch) {
    // Decode HTML entities
    innerXml = returnMatch[1]
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
  }

  // Log XML fields to capture cotacao number if present
  const allFields = innerXml.match(/<([a-zA-Z_]+)>/g)?.map(f => f.replace(/[<>]/g, '')) || [];
  const cotacaoFields = allFields.filter(f => /cotacao|numero|protocolo|id/i.test(f));
  if (cotacaoFields.length) console.log(`[SSW] Cotacao-related fields found: ${cotacaoFields.join(', ')}`);

  const result = parseSSWResponse(innerXml);

  if (result.erro === -2) {
    throw new Error(`SSW Login inválido: ${result.mensagem}`);
  }
  if (result.erro < 0) {
    throw new Error(`SSW: ${result.mensagem}`);
  }

  // CRITICAL: The SSW API returns a calculated freight value even when the carrier
  // does NOT serve the destination. It uses a "Generica" (generic) pricing table
  // for routes it doesn't actually cover. The real table for valid routes is "Combinada".
  // We must reject quotes calculated with the generic table.
  //
  // Evidence from testing:
  //   - BH/MG: tabCalculo=Combinada (valid, Camilo serves)
  //   - SP: tabCalculo=Combinada (valid, Camilo serves)
  //   - RJ: tabCalculo=Combinada, erro=1 msg="área de risco" (valid, just a warning)
  //   - Goiânia/GO: tabCalculo=Generica, erro=1 msg="não atende" (INVALID)
  //   - Salvador/BA: tabCalculo=Generica, erro=1 msg="não atende" (INVALID)
  //   - Curitiba/PR: erro=-1 (already handled above)
  if (result.tabCalculo === "Generica" && result.totalFrete > 0) {
    throw new Error(`SSW: Transportadora não atende esta rota (tabela genérica utilizada)`);
  }

  // erro >= 1 means success (may include informational messages like "área de risco")
  return result;
}

/**
 * Quote freight from Camilo dos Santos for all 3 CNPJs.
 * 
 * BUSINESS RULE: If at least one CNPJ returns a valid quote, ALL CNPJs should
 * return a quote (they share the same freight table). If one fails, retry it once.
 * If it still fails, use the successful quote's value as reference for the failed ones
 * (same table = same price), marking it as "estimado".
 */
export async function quoteAllSswCnpjs(params: Omit<SSWQuoteParams, "cnpjPagador">): Promise<Array<{
  cnpj: string;
  totalFrete: number;
  prazo: number;
  protocolo?: string;
  error?: string;
  estimado?: boolean;
  details?: SSWQuoteResult;
}>> {
  const cnpjs = ["36562762000129", "45558059000138", "50128808000127"];

  // First attempt for all 3 CNPJs
  const results = await Promise.allSettled(
    cnpjs.map(cnpj =>
      quoteSswFreight({ ...params, cnpjPagador: cnpj })
    )
  );

  const mapped: Array<{
    cnpj: string;
    totalFrete: number;
    prazo: number;
    protocolo?: string;
    error?: string;
    estimado?: boolean;
    details?: SSWQuoteResult;
  }> = results.map((result, idx) => {
    if (result.status === "fulfilled") {
      return {
        cnpj: cnpjs[idx],
        totalFrete: result.value.totalFrete,
        prazo: result.value.prazo,
        protocolo: result.value.numeroCotacao || undefined,
        details: result.value,
      };
    } else {
      return {
        cnpj: cnpjs[idx],
        totalFrete: 0,
        prazo: 0,
        error: result.reason?.message || "Erro desconhecido",
      };
    }
  });

  // Check if we have mixed results (some success, some failure)
  const successes = mapped.filter(r => !r.error && r.totalFrete > 0);
  const failures = mapped.filter(r => r.error || r.totalFrete <= 0);

  if (successes.length > 0 && failures.length > 0) {
    console.log(`[SSW] Mixed results: ${successes.length} success, ${failures.length} failed. Retrying failed CNPJs...`);
    
    // Retry failed CNPJs once
    for (const failed of failures) {
      const idx = mapped.findIndex(r => r.cnpj === failed.cnpj);
      try {
        await new Promise(r => setTimeout(r, 300)); // Small delay before retry
        const retryResult = await quoteSswFreight({ ...params, cnpjPagador: failed.cnpj });
        mapped[idx] = {
          cnpj: failed.cnpj,
          totalFrete: retryResult.totalFrete,
          prazo: retryResult.prazo,
          protocolo: retryResult.numeroCotacao || undefined,
          details: retryResult,
        };
        console.log(`[SSW] Retry succeeded for ${failed.cnpj}: R$${retryResult.totalFrete}`);
      } catch (retryErr: any) {
        // Retry also failed - use the successful quote as estimate
        // (all 3 CNPJs share the same freight table per business rule)
        const reference = successes[0];
        const isRouteError = (retryErr?.message || '').includes('não atende') || (retryErr?.message || '').includes('Generica');
        
        if (isRouteError) {
          // Route genuinely not served - keep error
          console.log(`[SSW] CNPJ ${failed.cnpj} route not served (confirmed on retry)`);
        } else {
          // Transient error - use reference value
          mapped[idx] = {
            cnpj: failed.cnpj,
            totalFrete: reference.totalFrete,
            prazo: reference.prazo,
            estimado: true,
            protocolo: undefined,
          };
          console.log(`[SSW] Using estimated value for ${failed.cnpj} based on ${reference.cnpj}: R$${reference.totalFrete}`);
        }
      }
    }
  }

  return mapped;
}


/**
 * SSW Web System Protocol Number
 * 
 * The SOAP API does NOT return a protocol/cotação number.
 * To get the protocol, we must use the SSW web system (ssw1608):
 * 1. Login at /bin/ssw0422 with web credentials
 * 2. Load the form at /bin/ssw1608
 * 3. POST act=ENV with all quotation fields
 * 4. Parse the XML response to extract nro_cotacao
 * 
 * Web credentials: Domain=RCS, User=foxp, Password=2010
 */

interface SSWWebSession {
  cookies: string;
  lastLogin: number;
}

let cachedWebSession: SSWWebSession | null = null;

async function getSSWWebSession(): Promise<string> {
  // Reuse session if less than 10 minutes old
  if (cachedWebSession && Date.now() - cachedWebSession.lastLogin < 10 * 60 * 1000) {
    return cachedWebSession.cookies;
  }

  const webDomain = process.env.SSW_DOMAIN || "RCS";
  const webUser = "foxp";
  const webPassword = "2010";

  // Step 1: GET login page to get initial cookies
  const initResp = await fetch("https://sistema.ssw.inf.br/bin/ssw0422", {
    signal: AbortSignal.timeout(10000),
  });
  const initCookies = initResp.headers.getSetCookie?.() || [];
  
  // Step 2: POST login
  const loginResp = await fetch("https://sistema.ssw.inf.br/bin/ssw0422", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Requested-With": "XMLHttpRequest",
      "Referer": "https://sistema.ssw.inf.br/bin/ssw0422",
      "Cookie": initCookies.map(c => c.split(";")[0]).join("; "),
    },
    body: `act=L&f1=${webDomain}&f2=&f3=${webUser}&f4=${webPassword}`,
    signal: AbortSignal.timeout(10000),
  });

  // Collect all cookies from login response
  const loginCookies = loginResp.headers.getSetCookie?.() || [];
  const allCookies = [...initCookies, ...loginCookies]
    .map(c => c.split(";")[0])
    .filter(c => c.includes("="));
  
  // Deduplicate cookies (keep last value for each name)
  const cookieMap = new Map<string, string>();
  for (const c of allCookies) {
    const [name] = c.split("=");
    cookieMap.set(name, c);
  }
  const cookieStr = Array.from(cookieMap.values()).join("; ");

  cachedWebSession = { cookies: cookieStr, lastLogin: Date.now() };
  return cookieStr;
}

/**
 * Get the SSW protocol/cotação number via the web system.
 * This should be called AFTER a successful SOAP quotation to get the protocol number.
 */
export async function getSSWWebProtocol(params: {
  cnpjPagador: string;
  cepOrigem: string | number;
  cepDestino: string | number;
  valorNF: number;
  quantidade: number;
  peso: number;
  cubagem: number;
  cnpjDestinatario?: string;
  cnpjRemetente?: string;
  coletar?: "S" | "N";
  contribuinte?: "S" | "N";
  entDificil?: "S" | "N";
}): Promise<{ protocolo: string; totalFrete: number; prazo: string; rota: string; tabela: string } | null> {
  try {
    const cookies = await getSSWWebSession();

    // Step 3: Load the form page (establishes server-side session state)
    await fetch("https://sistema.ssw.inf.br/bin/ssw1608", {
      headers: {
        "Cookie": cookies,
        "Referer": "https://sistema.ssw.inf.br/bin/menu01",
      },
      signal: AbortSignal.timeout(10000),
    });

    // Step 4: Submit quotation via act=ENV (mimics the sim() JavaScript function)
    const cepOrigem = String(params.cepOrigem).replace(/\D/g, "");
    const cepDestino = String(params.cepDestino).replace(/\D/g, "");
    
    const formData = new URLSearchParams({
      act: "ENV",
      f2: params.cnpjPagador,
      f3: "",
      f4: "",                          // Mercadoria (empty = default)
      f5: "",
      f6: cepOrigem,                   // CEP origem
      f7: "",
      f8: cepDestino,                  // CEP destino
      f9: "1",                         // Tipo frete: 1=CIF
      f10: params.coletar || "S",      // Coletar
      f11: "",
      f12: "",                         // CNPJ destinatário (optional, leave empty to avoid "não cadastrado")
      f13: params.contribuinte || "S", // Contribuinte
      f14: params.entDificil || "N",   // Entrega difícil
      f15: String(Math.round(params.valorNF)),  // Valor da NF
      f16: String(params.quantidade),  // Quantidade volumes
      f17: "0",                        // Quantidade pares
      f18: String(params.peso),        // Peso (Kg)
      f19: "",
      f20: String(params.cubagem),     // Cubagem (m³)
      f21: "",                         // cub_alt_1
      f22: "",                         // cub_larg_1
      f23: "",                         // cub_comp_1
      f24: "",                         // cub_nro_vezes_1
      f25: params.cnpjRemetente || params.cnpjPagador,  // cgc_rem
    });

    const resp = await fetch("https://sistema.ssw.inf.br/bin/ssw1608", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Requested-With": "XMLHttpRequest",
        "Cookie": cookies,
        "Referer": "https://sistema.ssw.inf.br/bin/ssw1608",
      },
      body: formData.toString(),
      signal: AbortSignal.timeout(15000),
    });

    const xml = await resp.text();
    
    // Parse the XML response
    const nroCotacao = xml.match(/<nro_cotacao>([^<]+)<\/nro_cotacao>/)?.[1] || "";
    const totalFrete = xml.match(/<totalFrete>([^<]+)<\/totalFrete>/)?.[1] || "0";
    const prazo = xml.match(/<prazo>([^<]+)<\/prazo>/)?.[1] || "";
    const rota = xml.match(/<rota>([^<]+)<\/rota>/)?.[1] || "";
    const tabela = xml.match(/<tabela>([^<]+)<\/tabela>/)?.[1] || "";
    const erro = xml.match(/<erro>([^<]+)<\/erro>/)?.[1] || xml.match(/<flag>([^<]+)<\/flag>/)?.[1] || "";

    if (nroCotacao) {
      console.log(`[SSW Web] Protocol obtained: ${nroCotacao} (frete: ${totalFrete}, rota: ${rota})`);
      return {
        protocolo: nroCotacao,
        totalFrete: parseFloat(totalFrete.replace(",", ".")),
        prazo,
        rota,
        tabela,
      };
    }

    // If there's an error but still got a protocol
    if (erro && !nroCotacao) {
      const mensagem = xml.match(/<mensagem>([^<]+)<\/mensagem>/)?.[1] || "";
      console.log(`[SSW Web] Quotation returned with warning: ${erro} - ${mensagem}`);
      // Even with ERRO2 (informational), the protocol might still be valid
      if (nroCotacao) {
        return { protocolo: nroCotacao, totalFrete: parseFloat(totalFrete.replace(",", ".")), prazo, rota, tabela };
      }
    }

    console.log(`[SSW Web] No protocol in response. Error: ${erro}`);
    return null;
  } catch (error: any) {
    console.error(`[SSW Web] Error getting protocol: ${error.message}`);
    // Invalidate session on error
    cachedWebSession = null;
    return null;
  }
}

/**
 * Enhanced version of quoteAllSswCnpjs that also fetches the protocol number
 * via the web system for the best (cheapest) result.
 */
export async function quoteAllSswCnpjsWithProtocol(params: Omit<SSWQuoteParams, "cnpjPagador">): Promise<Array<{
  cnpj: string;
  totalFrete: number;
  prazo: number;
  protocolo?: string;
  error?: string;
  details?: SSWQuoteResult;
}>> {
  // First, get SOAP quotes for all CNPJs
  const results = await quoteAllSswCnpjs(params);

  // For each successful result without a protocol, try to get it via web
  const enhancedResults = await Promise.all(
    results.map(async (result) => {
      if (result.error || result.protocolo) return result;

      try {
        const webResult = await getSSWWebProtocol({
          cnpjPagador: result.cnpj,
          cepOrigem: params.cepOrigem,
          cepDestino: params.cepDestino,
          valorNF: params.valorNF,
          quantidade: params.quantidade,
          peso: params.peso,
          cubagem: params.cubagem,
          cnpjDestinatario: params.cnpjDestinatario,
          cnpjRemetente: params.cnpjRemetente,
          coletar: params.coletar,
          contribuinte: params.destContribuinte,
          entDificil: params.entDificil,
        });

        if (webResult?.protocolo) {
          return { ...result, protocolo: webResult.protocolo };
        }
      } catch (e: any) {
        console.error(`[SSW Web] Failed to get protocol for ${result.cnpj}: ${e.message}`);
      }

      return result;
    })
  );

  return enhancedResults;
}
