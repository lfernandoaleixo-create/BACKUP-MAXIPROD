const GRAPHQL_URL = "https://api.maxiprod.com.br/graphql/";

async function query(gql) {
  const token = process.env.MAXIPROD_GRAPHQL_TOKEN;
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

// 1. Check Grupo type fields
console.log("=== Grupo type fields ===");
const typeResult = await query(`{ __type(name: "Grupo") { fields { name type { name kind ofType { name } } } } }`);
if (typeResult.data?.__type?.fields) {
  for (const f of typeResult.data.__type.fields) {
    console.log(`  ${f.name}: ${f.type.name || f.type.ofType?.name || f.type.kind}`);
  }
} else {
  console.log("  Grupo type not found");
}

// 2. Get stock items with grupo fields
console.log("\n=== Stock items with grupo.id and grupo.dentroDoGrupoId ===");
const result = await query(`{
  estoquesAgrupados(first: 5) {
    items {
      item {
        codigo
        grupoId
        grupoDescricao
        grupo {
          id
          dentroDoGrupoId
        }
      }
    }
  }
}`);
if (result.errors) {
  console.log("Error:", result.errors[0].message);
} else {
  for (const i of result.data.estoquesAgrupados.items) {
    console.log(`  code=${i.item.codigo} grupoId=${i.item.grupoId} grupoDesc=${i.item.grupoDescricao} grupo.id=${i.item.grupo?.id} grupo.dentroDoGrupoId=${i.item.grupo?.dentroDoGrupoId}`);
  }
}

// 3. Get ALL unique grupoId values with their descriptions
console.log("\n=== All unique groups from stock ===");
const allResult = await query(`{
  estoquesAgrupados(first: 200) {
    items {
      item {
        codigo
        grupoId
        grupoDescricao
        grupo {
          id
          dentroDoGrupoId
        }
      }
    }
  }
}`);
if (allResult.data) {
  const groups = new Map();
  for (const i of allResult.data.estoquesAgrupados.items) {
    const gid = i.item.grupoId;
    if (!groups.has(gid)) {
      groups.set(gid, {
        grupoId: gid,
        grupoDescricao: i.item.grupoDescricao,
        grupoInternalId: i.item.grupo?.id,
        superGrupoId: i.item.grupo?.dentroDoGrupoId,
        sampleCode: i.item.codigo,
        count: 0
      });
    }
    groups.get(gid).count++;
  }
  for (const [, g] of groups) {
    console.log(`  grupoId=${g.grupoId} desc=${g.grupoDescricao} superGrupo=${g.superGrupoId} sample=${g.sampleCode} count=${g.count}`);
  }
}

// 4. Try to find the "codigo" field on Grupo or a way to get short codes
console.log("\n=== Try grupo with codigo field ===");
const grupoCodigoResult = await query(`{
  estoquesAgrupados(first: 1) {
    items {
      item {
        grupo {
          id
          dentroDoGrupoId
          codigo
        }
      }
    }
  }
}`);
if (grupoCodigoResult.errors) {
  console.log("No 'codigo' field on Grupo:", grupoCodigoResult.errors[0].message);
} else {
  console.log(JSON.stringify(grupoCodigoResult.data, null, 2));
}

// 5. Try to get grupo with nome field
console.log("\n=== Try grupo with nome field ===");
const grupoNomeResult = await query(`{
  estoquesAgrupados(first: 1) {
    items {
      item {
        grupo {
          id
          dentroDoGrupoId
          nome
        }
      }
    }
  }
}`);
if (grupoNomeResult.errors) {
  console.log("No 'nome' field on Grupo:", grupoNomeResult.errors[0].message);
} else {
  console.log(JSON.stringify(grupoNomeResult.data, null, 2));
}
