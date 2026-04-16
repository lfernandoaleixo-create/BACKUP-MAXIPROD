import 'dotenv/config';

const token = process.env.MAXIPROD_GRAPHQL_TOKEN;
const baseUrl = 'https://api.maxiprod.com.br/graphql';

async function gql(query) {
  const res = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

// 1. Buscar clientes inadimplentes do banco
const mysql = (await import('mysql2/promise')).default;
const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Buscar nomes de clientes inadimplentes
const [rows] = await conn.execute(`
  SELECT DISTINCT cliente FROM accounts_receivable 
  WHERE estado = 'EMITIDO' AND vencimentoData < NOW()
  LIMIT 20
`);
console.log(`\n=== ${rows.length} clientes inadimplentes (amostra) ===`);
for (const r of rows) {
  console.log(`  - "${r.cliente}"`);
}

// 2. Buscar empresas do Maxiprod com campos adicionais
console.log('\n=== Empresas do Maxiprod com campos adicionais ===');
const data = await gql(`{
  empresas(skip: 0, take: 50, where: { cliente: { eq: true } }) {
    totalCount
    items {
      razaoSocial
      nomeFantasia
      apelido
      campoAdicionalEspecifico {
        descricao
        valor
      }
    }
  }
}`);

console.log(`Total empresas clientes: ${data.empresas.totalCount}`);

// Mostrar campos adicionais de cada empresa
let withSituacao = 0;
let withoutSituacao = 0;
const allFieldNames = new Set();

for (const emp of data.empresas.items) {
  const campos = emp.campoAdicionalEspecifico || [];
  for (const c of campos) {
    allFieldNames.add(c.descricao);
  }
  
  const situacao = campos.find(c => 
    c.descricao === 'SITUAÇÃO' || c.descricao?.toUpperCase() === 'SITUACAO' || c.descricao?.toUpperCase() === 'SITUAÇÃO'
  );
  
  if (situacao?.valor) {
    withSituacao++;
  } else {
    withoutSituacao++;
  }
}

console.log(`\nCom SITUAÇÃO preenchida: ${withSituacao}`);
console.log(`Sem SITUAÇÃO: ${withoutSituacao}`);
console.log(`\nTodos os campos adicionais encontrados:`);
for (const name of allFieldNames) {
  console.log(`  - "${name}"`);
}

// 3. Verificar matching: pegar os clientes inadimplentes e ver se encontram no mapa
console.log('\n=== Verificando matching de nomes ===');
const cobrancaMap = {};
const data2 = await gql(`{
  empresas(skip: 0, take: 500, where: { cliente: { eq: true } }) {
    totalCount
    items {
      razaoSocial
      nomeFantasia
      apelido
      campoAdicionalEspecifico {
        descricao
        valor
      }
    }
  }
}`);

for (const emp of data2.empresas.items) {
  const situacao = (emp.campoAdicionalEspecifico || []).find(c => 
    c.descricao === 'SITUAÇÃO' || c.descricao?.toUpperCase() === 'SITUACAO' || c.descricao?.toUpperCase() === 'SITUAÇÃO'
  );
  if (situacao?.valor) {
    const names = [emp.razaoSocial, emp.nomeFantasia, emp.apelido].filter(Boolean);
    for (const name of names) {
      cobrancaMap[name] = situacao.valor;
      cobrancaMap[name.toUpperCase().trim()] = situacao.valor;
    }
  }
}

console.log(`Mapa de cobrança: ${Object.keys(cobrancaMap).length} entradas`);

for (const r of rows) {
  const clienteName = (r.cliente || '').trim();
  const match = cobrancaMap[clienteName] || cobrancaMap[clienteName.toUpperCase()] || null;
  if (!match) {
    console.log(`  ❌ NÃO ENCONTRADO: "${clienteName}"`);
  } else {
    console.log(`  ✅ ENCONTRADO: "${clienteName}" → "${match}"`);
  }
}

await conn.end();
