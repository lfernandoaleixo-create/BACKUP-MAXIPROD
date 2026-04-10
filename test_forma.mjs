// Test the GraphQL query for formaDeCobranca via the server's internal API
// We'll use the server's own endpoint to proxy the request

const GRAPHQL_URL = "https://api.maxiprod.com.br/graphql";

// Read the token from the environment
const token = process.env.MAXIPROD_GRAPHQL_TOKEN;
if (!token) {
  console.log("No token in env, trying to read from .env file...");
}

// Read .env file
import { readFileSync } from 'fs';
let envToken = token;
try {
  const envContent = readFileSync('.env', 'utf-8');
  const match = envContent.match(/MAXIPROD_GRAPHQL_TOKEN=(.+)/);
  if (match) envToken = match[1].trim();
} catch {}

const query = `{
  contaAReceber(take: 3, skip: 0, where: { estado: { eq: EMITIDO } }) {
    items {
      id
      formaDeCobranca {
        id
        meioDePagamento
        banco { descricao }
        contaNumero
        agenciaCodigo
        pixChave
        carteira
      }
    }
    totalCount
  }
}`;

async function test() {
  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Basic ${envToken}`,
    },
    body: JSON.stringify({ query }),
  });
  const data = await res.json();
  console.log("Status:", res.status);
  console.log(JSON.stringify(data, null, 2));
}

test().catch(console.error);
