import { quoteSswFreight } from './server/sswApi';

async function main() {
  try {
    const r = await quoteSswFreight({
      cepOrigem: '37260000',
      cepDestino: '37566000',
      valorNF: 21400,
      peso: 40,
      cubagem: 0.5,
      volumes: 10,
      cnpjPagador: '36562762000129',
      destContribuinte: 'S'
    });
    console.log("RESULT:", JSON.stringify(r, null, 2));
    console.log("numeroCotacao:", r.numeroCotacao);
  } catch(e: any) {
    console.error('ERROR:', e.message);
  }
}
main();
