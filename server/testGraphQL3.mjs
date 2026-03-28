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

// Get stock items with grupo.codigo (short code like "20", "21")
console.log("=== Stock items with grupo.codigo ===");
const result = await query(`{
  estoquesAgrupados {
    items {
      item {
        codigo
        descricao
        grupoId
        grupoDescricao
        grupo {
          codigo
          dentroDoGrupoId
          dentroDoGrupo {
            codigo
          }
        }
      }
    }
  }
}`);

if (result.errors) {
  console.log("Error:", result.errors[0].message);
} else {
  // Collect unique groups
  const groups = new Map();
  for (const i of result.data.estoquesAgrupados.items) {
    const grupoCodigo = i.item.grupo?.codigo || "N/A";
    const superGrupoCodigo = i.item.grupo?.dentroDoGrupo?.codigo || "N/A";
    const key = `${grupoCodigo}|${superGrupoCodigo}`;
    if (!groups.has(key)) {
      groups.set(key, {
        grupoCodigo,
        superGrupoCodigo,
        grupoId: i.item.grupoId,
        grupoDescricao: i.item.grupoDescricao,
        sampleCode: i.item.codigo,
        sampleDesc: i.item.descricao?.substring(0, 50),
        count: 0
      });
    }
    groups.get(key).count++;
  }
  
  console.log("\nUnique groups:");
  for (const [, g] of groups) {
    console.log(`  grupo=${g.grupoCodigo} superGrupo=${g.superGrupoCodigo} grupoId=${g.grupoId} desc=${g.grupoDescricao} sample=${g.sampleCode} count=${g.count}`);
  }
  
  console.log("\nTotal items:", result.data.estoquesAgrupados.items.length);
  
  // Show items that are in grupo 20 or 21
  const target = result.data.estoquesAgrupados.items.filter(i => {
    const gc = i.item.grupo?.codigo;
    return gc === "20" || gc === "21";
  });
  console.log("\nItems in grupo 20 or 21:", target.length);
  
  // Show items NOT in grupo 20 or 21
  const nonTarget = result.data.estoquesAgrupados.items.filter(i => {
    const gc = i.item.grupo?.codigo;
    return gc !== "20" && gc !== "21";
  });
  console.log("Items NOT in grupo 20 or 21:", nonTarget.length);
  for (const i of nonTarget.slice(0, 5)) {
    console.log(`  ${i.item.codigo}: ${i.item.descricao?.substring(0,60)} | grupo=${i.item.grupo?.codigo}`);
  }
}
