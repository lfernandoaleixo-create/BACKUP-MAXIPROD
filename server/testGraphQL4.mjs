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

// Test 1: Original query without grupo { codigo }
console.log("=== Test 1: Without grupo { codigo } ===");
const r1 = await query(`{
  estoquesAgrupados {
    items {
      item {
        codigo
        descricao
        grupoId
        grupoDescricao
      }
    }
  }
}`);
if (r1.data) {
  console.log("Items:", r1.data.estoquesAgrupados.items.length);
  // Show unique grupoId values
  const groups = new Map();
  for (const i of r1.data.estoquesAgrupados.items) {
    const gid = i.item.grupoId;
    if (!groups.has(gid)) groups.set(gid, { desc: i.item.grupoDescricao, count: 0 });
    groups.get(gid).count++;
  }
  for (const [gid, g] of groups) {
    console.log(`  grupoId=${gid} desc=${g.desc} count=${g.count}`);
  }
}

// Test 2: With grupo { codigo } only
console.log("\n=== Test 2: With grupo { codigo } ===");
const r2 = await query(`{
  estoquesAgrupados {
    items {
      item {
        codigo
        grupoId
        grupo { codigo }
      }
    }
  }
}`);
if (r2.data) {
  console.log("Items:", r2.data.estoquesAgrupados.items.length);
  const groups = new Map();
  for (const i of r2.data.estoquesAgrupados.items) {
    const gc = i.item.grupo?.codigo;
    if (!groups.has(gc)) groups.set(gc, 0);
    groups.set(gc, groups.get(gc) + 1);
  }
  for (const [gc, cnt] of groups) {
    console.log(`  grupo.codigo=${gc} count=${cnt}`);
  }
} else {
  console.log("Error:", r2.errors?.[0]?.message);
}

// Test 3: With grupo { dentroDoGrupoId } (already used)
console.log("\n=== Test 3: With grupo { dentroDoGrupoId } ===");
const r3 = await query(`{
  estoquesAgrupados {
    items {
      item {
        codigo
        grupoId
        grupo { dentroDoGrupoId }
      }
    }
  }
}`);
if (r3.data) {
  console.log("Items:", r3.data.estoquesAgrupados.items.length);
}

// Test 4: Check if estoquesAgrupados has a filter for grupo
console.log("\n=== Test 4: Check estoquesAgrupados arguments ===");
const r4 = await query(`{
  __type(name: "GraphQLQuery") {
    fields(includeDeprecated: true) {
      name
      args {
        name
        type { name kind ofType { name } }
      }
    }
  }
}`);
if (r4.data) {
  const field = r4.data.__type.fields.find(f => f.name === "estoquesAgrupados");
  if (field) {
    console.log("estoquesAgrupados args:");
    for (const a of field.args) {
      console.log(`  ${a.name}: ${a.type.name || a.type.ofType?.name || a.type.kind}`);
    }
  }
}
