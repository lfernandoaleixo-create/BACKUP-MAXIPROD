/**
 * SSW API Integration - Camilo dos Santos
 * Cotação de frete via SOAP/XML
 */

interface SSWQuoteParams {
  cnpjPagador: string;
  cepOrigem: number;
  cepDestino: number;
  valorNF: number;
  quantidade: number;
  peso: number;
  volume: number; // m³
  cnpjDestinatario?: string;
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
}

function buildSoapEnvelope(params: SSWQuoteParams): string {
  const domain = process.env.SSW_DOMAIN || "RCS";
  const login = process.env.SSW_USER || "foxapi";
  const senha = process.env.SSW_PASSWORD || "14lt27ca";
  const senhaPagador = process.env.SSW_SENHA_PAGADOR || "251038";

  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="urn:sswinfaboraboraaliaborabora">
  <soap:Body>
    <tns:cotar>
      <dominio>${domain}</dominio>
      <login>${login}</login>
      <senha>${senha}</senha>
      <senhaPagador>${senhaPagador}</senhaPagador>
      <cnpjPagador>${params.cnpjPagador}</cnpjPagador>
      <cepOrigem>${params.cepOrigem}</cepOrigem>
      <cepDestino>${params.cepDestino}</cepDestino>
      <valorNF>${params.valorNF.toFixed(2)}</valorNF>
      <quantidade>${params.quantidade}</quantidade>
      <peso>${params.peso.toFixed(3)}</peso>
      <volume>${params.volume.toFixed(4)}</volume>
      <mercadoria>1</mercadoria>
      ${params.cnpjDestinatario ? `<cnpjDestinatario>${params.cnpjDestinatario}</cnpjDestinatario>` : ""}
      ${params.destContribuinte ? `<destContribuinte>${params.destContribuinte}</destContribuinte>` : ""}
      <coletar>N</coletar>
      <entDificil>N</entDificil>
    </tns:cotar>
  </soap:Body>
</soap:Envelope>`;
}

function parseXmlValue(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`);
  const match = xml.match(regex);
  return match ? match[1] : "";
}

function parseSSWResponse(xml: string): SSWQuoteResult {
  return {
    erro: parseInt(parseXmlValue(xml, "erro") || "0"),
    mensagem: parseXmlValue(xml, "mensagem"),
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
  };
}

export async function quoteSswFreight(params: SSWQuoteParams): Promise<SSWQuoteResult> {
  const soapBody = buildSoapEnvelope(params);

  const response = await fetch("https://ssw.inf.br/ws/sswCotacaoCliente/index.php", {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "SOAPAction": "urn:sswinfaboraboraaliaborabora#cotar",
    },
    body: soapBody,
  });

  if (!response.ok) {
    throw new Error(`SSW API error: ${response.status} ${response.statusText}`);
  }

  const xml = await response.text();
  const result = parseSSWResponse(xml);

  if (result.erro === -2) {
    throw new Error(`SSW Login error: ${result.mensagem}`);
  }
  if (result.erro === -1) {
    throw new Error(`SSW error: ${result.mensagem}`);
  }

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
