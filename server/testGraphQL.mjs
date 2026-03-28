// Temporary script to query GraphQL via the server's fetch mechanism
// This will use the server's token from the environment

import { createRequire } from 'module';

const GRAPHQL_URL = "https://api.maxiprod.com.br/graphql/";

async function query(gql) {
  const token = process.env.MAXIPROD_GRAPHQL_TOKEN;
  if (!token) {
    console.error("No MAXIPROD_GRAPHQL_TOKEN found");
    process.exit(1);
  }
  
  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Basic ${token}`,
    },
    body: JSON.stringify({ query: gql }),
  });
  return res.json();
}

// 1. Check GrupoDeItem type fields
console.log("=== GrupoDeItem type fields ===");
const typeResult = await query(`{ __type(name: "GrupoDeItem") { fields { name type { name kind ofType { name } } } } }`);
if (typeResult.data?.__type?.fields) {
  for (const f of typeResult.data.__type.fields) {
    console.log(`  ${f.name}: ${f.type.name || f.type.ofType?.name || f.type.kind}`);
  }
} else {
  console.log("  Type not found, trying alternatives...");
  // Try other type names
  for (const typeName of ["Grupo", "GrupoItem", "ItemGrupo", "GrupoProduto"]) {
    const r = await query(`{ __type(name: "${typeName}") { fields { name } } }`);
    if (r.data?.__type) {
      console.log(`  Found type: ${typeName}`);
      console.log(JSON.stringify(r.data.__type.fields, null, 2));
    }
  }
}

// 2. Get a sample stock item with ALL grupo fields
console.log("\n=== Sample stock item with grupo details ===");
const stockResult = await query(`{
  estoquesAgrupados(first: 3) {
    items {
      item {
        codigo
        descricao
        grupoId
        grupoDescricao
        grupo {
          id
          dentroDoGrupoId
          codigo
          descricao
          nome
        }
      }
    }
  }
}`);
if (stockResult.errors) {
  console.log("Errors:", JSON.stringify(stockResult.errors[0].message));
  
  // Try without some fields
  const stockResult2 = await query(`{
    estoquesAgrupados(first: 3) {
      items {
        item {
          codigo
          descricao
          grupoId
          grupoDescricao
          grupo {
            dentroDoGrupoId
          }
        }
      }
    }
  }`);
  if (stockResult2.data) {
    console.log(JSON.stringify(stockResult2.data.estoquesAgrupados.items.slice(0,3), null, 2));
  }
} else {
  console.log(JSON.stringify(stockResult.data.estoquesAgrupados.items.slice(0,3), null, 2));
}

// 3. Query gruposDeItens to see all groups with their codes
console.log("\n=== All groups (gruposDeItens) ===");
const groupsResult = await query(`{
  gruposDeItens(first: 50) {
    items {
      id
      dentroDoGrupoId
      codigo
      descricao
      nome
    }
  }
}`);
if (groupsResult.errors) {
  console.log("Error:", groupsResult.errors[0].message);
  
  // Try without some fields
  const groupsResult2 = await query(`{
    gruposDeItens(first: 50) {
      items {
        id
        dentroDoGrupoId
      }
    }
  }`);
  if (groupsResult2.errors) {
    console.log("Error2:", groupsResult2.errors[0].message);
  } else {
    console.log(JSON.stringify(groupsResult2.data, null, 2));
  }
} else {
  console.log(JSON.stringify(groupsResult.data, null, 2));
}
