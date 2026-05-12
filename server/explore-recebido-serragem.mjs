import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const dotenv = require('dotenv');
dotenv.config();

const GRAPHQL_URL = 'https://api.maxiprod.com.br/graphql/';
const TOKEN = process.env.MAXIPROD_GRAPHQL_TOKEN;

async function gql(query) {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${TOKEN}`,
    },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  if (json.errors) {
    console.error('GraphQL errors:', JSON.stringify(json.errors, null, 2));
    return null;
  }
  return json.data;
}

async function main() {
  const today = '2026-05-12';
  const endISO = `${today}T23:59:59.999-03:00`;

  // Get all NF numbers from Serragem
  let nfNumbers = new Set();
  let skip = 0;
  while (true) {
    const nfData = await gql(`{
      notasFiscais(
        skip: ${skip}, take: 1000,
        where: {
          estado: { eq: EMITIDA }
          entradaOuSaida: { eq: SAIDA }
          estadoConfiguravel: { descricao: { eq: "SERRAGEM" } }
        }
      ) {
        totalCount
        items { numero }
      }
    }`);
    if (!nfData?.notasFiscais) break;
    nfData.notasFiscais.items.forEach(i => nfNumbers.add(String(i.numero)));
    skip += 1000;
    if (skip >= nfData.notasFiscais.totalCount) break;
  }
  console.log(`NFs de Serragem: ${nfNumbers.size}`);

  // Get ALL recebidos
  let allRecebidos = [];
  skip = 0;
  while (true) {
    const page = await gql(`{
      contaAReceber(
        skip: ${skip}, take: 1000,
        where: {
          estado: { eq: RECEBIDO },
          liquidacaoData: { lte: "${endISO}" }
        }
      ) {
        totalCount
        items {
          valorRecebidoLiquido
          liquidacaoData
          vencimentoData
          documentoVinculadoNumero
          minhaEmpresaId
          cliente { nomeFantasia }
        }
      }
    }`);
    if (!page?.contaAReceber) break;
    allRecebidos.push(...page.contaAReceber.items);
    skip += 1000;
    if (skip >= page.contaAReceber.totalCount) break;
  }
  console.log(`Total recebidos: ${allRecebidos.length}`);

  // Filter by NF numbers
  const matched = allRecebidos.filter(r => nfNumbers.has(r.documentoVinculadoNumero));
  console.log(`Matched por NF: ${matched.length} itens, R$ ${matched.reduce((s,i) => s + (i.valorRecebidoLiquido || 0), 0).toFixed(2)}`);

  // Now try different date filters to find which gives 23 items / R$ 48.250,67
  const startDates = ['2026-01-01', '2026-01-15', '2026-02-01', '2026-02-04', '2026-03-01', '2026-04-01'];
  
  console.log('\n=== Testando diferentes datas de início para liquidação ===');
  for (const startDate of startDates) {
    const filtered = matched.filter(r => r.liquidacaoData >= `${startDate}T00:00:00`);
    const total = filtered.reduce((s, i) => s + (i.valorRecebidoLiquido || 0), 0);
    console.log(`  Desde ${startDate}: ${filtered.length} itens, R$ ${total.toFixed(2)}`);
  }

  // Also try by vencimento date
  console.log('\n=== Testando por data de VENCIMENTO ===');
  for (const startDate of startDates) {
    const filtered = matched.filter(r => r.vencimentoData >= `${startDate}T00:00:00`);
    const total = filtered.reduce((s, i) => s + (i.valorRecebidoLiquido || 0), 0);
    console.log(`  Vencimento desde ${startDate}: ${filtered.length} itens, R$ ${total.toFixed(2)}`);
  }

  // The screenshot shows the first item is 04/02/26 (vencimento)
  // Let's try: liquidação from 2026-02-04 (first item date in screenshot)
  console.log('\n=== Filtrando liquidação >= 2026-02-04 ===');
  const from0204 = matched.filter(r => r.liquidacaoData >= '2026-02-04T00:00:00');
  const total0204 = from0204.reduce((s, i) => s + (i.valorRecebidoLiquido || 0), 0);
  console.log(`  ${from0204.length} itens, R$ ${total0204.toFixed(2)}`);

  // Try: only take the LAST parcela received for each NF (most recent liquidacao)
  console.log('\n=== Apenas última parcela por NF ===');
  const lastByNF = {};
  for (const item of matched) {
    const nf = item.documentoVinculadoNumero;
    if (!lastByNF[nf] || item.liquidacaoData > lastByNF[nf].liquidacaoData) {
      lastByNF[nf] = item;
    }
  }
  const lastItems = Object.values(lastByNF);
  const totalLast = lastItems.reduce((s, i) => s + (i.valorRecebidoLiquido || 0), 0);
  console.log(`  ${lastItems.length} itens, R$ ${totalLast.toFixed(2)}`);

  // The screenshot shows 23 items. Let me look at the screenshot dates more carefully:
  // 04/02, 06/02, 24/02, 24/02, 03/03, 03/03, 05/03, 05/03, 17/03, 18/03, 26/03, 27/03
  // 07/04, 08/04, 10/04, 15/04, 20/04, 23/04, 24/04, 24/04, 28/04, 05/05, 07/05
  // These are VENCIMENTO dates. Let me check if filtering by vencimento >= 2026-02-01 gives 23 items
  
  console.log('\n=== Filtrando vencimento >= 2026-02-01 ===');
  const fromFeb = matched.filter(r => r.vencimentoData >= '2026-02-01T00:00:00');
  const totalFeb = fromFeb.reduce((s, i) => s + (i.valorRecebidoLiquido || 0), 0);
  console.log(`  ${fromFeb.length} itens, R$ ${totalFeb.toFixed(2)}`);

  // Show the 23 items sorted by vencimento that match the screenshot
  console.log('\n=== Detalhamento (vencimento >= 2026-02-01) ===');
  fromFeb.sort((a, b) => (a.vencimentoData || '').localeCompare(b.vencimentoData || ''));
  fromFeb.forEach(i => {
    console.log(`  Venc: ${i.vencimentoData?.slice(0,10)} | Liq: ${i.liquidacaoData?.slice(0,10)} | NF ${i.documentoVinculadoNumero} | R$ ${i.valorRecebidoLiquido?.toFixed(2)} | ${i.cliente?.nomeFantasia || 'N/A'}`);
  });
}

main().catch(console.error);
