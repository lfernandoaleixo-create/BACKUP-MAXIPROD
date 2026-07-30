// Test script to dump raw SSW XML response - using exact same envelope as sswApi.ts
const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="urn:sswinfbr.sswCotacaoCliente">
  <SOAP-ENV:Body>
    <ns1:cotar>
      <dominio>RCS</dominio>
      <login>foxapi</login>
      <senha>14lt27ca</senha>
      <cnpjPagador>36562762000129</cnpjPagador>
      <senhaPagador>251038</senhaPagador>
      <cepOrigem>36506182</cepOrigem>
      <cepDestino>37566000</cepDestino>
      <valorNF>21400.00</valorNF>
      <quantidade>5</quantidade>
      <peso>40.000</peso>
      <volume>0.6000</volume>
      <mercadoria>9</mercadoria>
      <cnpjDestinatario>66259821000155</cnpjDestinatario>
      <coletar>S</coletar>
      <entDificil>N</entDificil>
      <destContribuinte>S</destContribuinte>
      <cnpjRemetente></cnpjRemetente>
    </ns1:cotar>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;

async function main() {
  const res = await fetch("https://ssw.inf.br/ws/sswCotacaoCliente/index.php", {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "SOAPAction": "urn:sswinfbr.sswCotacaoCliente#cotar",
    },
    body: soapBody,
  });
  
  const text = await res.text();
  console.log("=== RAW SOAP RESPONSE ===");
  console.log(text);
  
  const returnMatch = text.match(/<return[^>]*>([\s\S]*?)<\/return>/);
  let innerXml = text;
  if (returnMatch) {
    innerXml = returnMatch[1]
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
  }
  
  console.log("\n=== ALL XML TAGS FOUND ===");
  const tags = innerXml.match(/<([a-zA-Z_]+)>/g)?.map(f => f.replace(/[<>]/g, '')) || [];
  console.log(tags.join(', '));
  
  console.log("\n=== FULL DECODED INNER XML ===");
  console.log(innerXml);
}

main().catch(console.error);
