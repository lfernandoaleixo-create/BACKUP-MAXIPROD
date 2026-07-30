async function main() {
  const domain = process.env.SSW_DOMAIN || "RCS";
  const login = process.env.SSW_USER || "foxapi";
  const senha = process.env.SSW_PASSWORD || "14lt27ca";
  const senhaPagador = process.env.SSW_SENHA_PAGADOR || "251038";

  const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="urn:sswinfbr.sswCotacaoCliente">
  <SOAP-ENV:Body>
    <ns1:cotar>
      <dominio>${domain}</dominio>
      <login>${login}</login>
      <senha>${senha}</senha>
      <senhaPagador>${senhaPagador}</senhaPagador>
      <cepOrigem>37260000</cepOrigem>
      <cepDestino>37566000</cepDestino>
      <valorNF>21400.00</valorNF>
      <peso>40.000</peso>
      <volume>0.5000</volume>
      <volumes>10</volumes>
      <cnpjPagador>36562762000129</cnpjPagador>
      <destContribuinte>S</destContribuinte>
      <cnpjRemetente></cnpjRemetente>
    </ns1:cotar>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;

  const response = await fetch("https://ssw.inf.br/ws/sswCotacaoCliente/index.php", {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "SOAPAction": "urn:sswinfbr.sswCotacaoCliente#cotar",
    },
    body: soapBody,
    signal: AbortSignal.timeout(15000),
  });
  const rawXml = await response.text();
  const returnMatch = rawXml.match(/<return[^>]*>([\s\S]*?)<\/return>/);
  let innerXml = rawXml;
  if (returnMatch) {
    innerXml = returnMatch[1]
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
  }
  console.log("=== FULL DECODED XML ===");
  console.log(innerXml);
  console.log("\n=== ALL FIELDS ===");
  const fields = innerXml.match(/<([a-zA-Z_]+)>([^<]*)<\/\1>/g);
  if (fields) fields.forEach(f => console.log(f));
}
main().catch(e => console.error(e.message));
