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

  const result = parseSSWResponse(innerXml);

  if (result.erro === -2) {
    throw new Error(`SSW Login inválido: ${result.mensagem}`);
  }
  if (result.erro < 0) {
    throw new Error(`SSW: ${result.mensagem}`);
  }

  // erro >= 1 means success (may include informational messages like "área de risco")
  return result;
}

/**
 * Quote freight from Camilo dos Santos for all 3 CNPJs
 */
export async function quoteAllSswCnpjs(params: Omit<SSWQuoteParams, "cnpjPagador">): Promise<Array<{
  cnpj: string;
  totalFrete: number;
  prazo: number;
  error?: string;
  details?: SSWQuoteResult;
}>> {
  const cnpjs = ["36562762000129", "45558059000138", "50128808000127"];

  const results = await Promise.allSettled(
    cnpjs.map(cnpj =>
      quoteSswFreight({ ...params, cnpjPagador: cnpj })
    )
  );

  return results.map((result, idx) => {
    if (result.status === "fulfilled") {
      return {
        cnpj: cnpjs[idx],
        totalFrete: result.value.totalFrete,
        prazo: result.value.prazo,
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
}
