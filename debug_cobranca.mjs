import 'dotenv/config';

const GRAPHQL_URL = 'https://api.maxiprod.com.br/graphql';
const GRAPHQL_TOKEN = process.env.MAXIPROD_GRAPHQL_TOKEN;

console.log("Token:", GRAPHQL_TOKEN ? GRAPHQL_TOKEN.substring(0, 20) + "..." : "MISSING");

async function gql(query) {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GRAPHQL_TOKEN}`,
    },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  if (json.errors) {
    console.error("GraphQL errors:", JSON.stringify(json.errors, null, 2));
  }
  return json.data;
}

async function main() {
  // Test basic query first
  console.log("=== Testing basic query ===");
  const test = await gql(`{ empresas(skip: 0, take: 2, where: { cliente: { eq: true } }) { totalCount items { razaoSocial campoAdicionalEspecifico { descricao valor } } } }`);
  console.log("Test result:", JSON.stringify(test, null, 2));
  
  if (!test?.empresas) {
    console.log("Basic query failed. Trying without campoAdicionalEspecifico...");
    const test2 = await gql(`{ empresas(skip: 0, take: 2, where: { cliente: { eq: true } }) { totalCount items { razaoSocial nomeFantasia } } }`);
    console.log("Test2 result:", JSON.stringify(test2, null, 2));
    
    // Try with different field name
    console.log("\nTrying camposAdicionais...");
    const test3 = await gql(`{ empresas(skip: 0, take: 2, where: { cliente: { eq: true } }) { totalCount items { razaoSocial camposAdicionais { descricao valor } } } }`);
    console.log("Test3 result:", JSON.stringify(test3, null, 2));
    
    // Try empresaGruposCamposAdicionais
    console.log("\nTrying empresaGruposCamposAdicionais...");
    const test4 = await gql(`{ empresas(skip: 0, take: 2, where: { cliente: { eq: true } }) { totalCount items { razaoSocial empresaGruposCamposAdicionais { grupo campos { descricao valor } } } } }`);
    console.log("Test4 result:", JSON.stringify(test4, null, 2));
  }
}

main().catch(console.error);
