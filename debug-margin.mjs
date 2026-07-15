import 'dotenv/config';
import mysql from 'mysql2/promise';

const url = new URL(process.env.DATABASE_URL);
const conn = await mysql.createConnection({
  host: url.hostname,
  port: parseInt(url.port),
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  ssl: { rejectUnauthorized: false },
});

// Get Rafael's orders
  const [orders] = await conn.execute(`
  SELECT sor.id, sor.razao_social, sor.uf, sor.tipo_contribuinte
  FROM sales_order_requests sor
  WHERE sor.seller_name LIKE '%RAFAEL%'
    AND sor.created_at >= '2026-07-01'
    AND sor.status != 'rejeitado'
  ORDER BY sor.id
`);

console.log("=== PEDIDOS DO RAFAEL (JULHO 2026) ===\n");

let grandSumValueXMargin = 0;
let grandSumValue = 0;

for (const order of orders) {
  const [items] = await conn.execute(`
    SELECT codigo_item, descricao_item,
      CAST(preco_unitario AS DECIMAL(10,4)) as preco_unitario,
      CAST(quantidade AS DECIMAL(10,4)) as quantidade
    FROM sales_order_request_items
    WHERE order_id = ?
  `, [order.id]);

  const valorVenda = items.reduce((s, i) => s + Number(i.preco_unitario) * Number(i.quantidade), 0);

  // Get costs for items
  let custoMercadoria = 0;
  let tipoProdutoCount = { importado: 0, industrializado: 0 };
  
  for (const item of items) {
    // Check stock_items for product type
    const [stockRow] = await conn.execute(`
      SELECT superGrupoCodigo, grupoCodigo FROM stock_items WHERE codigoItem = ? LIMIT 1
    `, [item.codigo_item]);
    
    let tipoProduto = "importado";
    if (stockRow.length > 0) {
      const sgc = stockRow[0].superGrupoCodigo || "";
      const gc = stockRow[0].grupoCodigo || "";
      if (sgc === "12") tipoProduto = "importado";
      else if (sgc === "05") tipoProduto = "industrializado";
      else if (sgc === "16" && (gc === "18" || gc === "19")) tipoProduto = "industrializado";
      else tipoProduto = "importado";
    }
    tipoProdutoCount[tipoProduto]++;

    // Get cost from product_costs
    const [costRow] = await conn.execute(`
      SELECT 
        CAST(custoProjetado AS DECIMAL(10,4)) as custoProjetado,
        CAST(custoReal AS DECIMAL(10,4)) as custoReal,
        CAST(custoEstimativa AS DECIMAL(10,4)) as custoEstimativa,
        temPatio, temNavegando
      FROM product_costs WHERE codigoItem = ? LIMIT 1
    `, [item.codigo_item]);

    let cost = 0;
    if (costRow.length > 0) {
      const cr = costRow[0];
      if (Number(cr.custoProjetado) > 0 && cr.temPatio) cost = Number(cr.custoProjetado);
      else if (Number(cr.custoReal) > 0) cost = Number(cr.custoReal);
      else if (Number(cr.custoEstimativa) > 0 && cr.temNavegando) cost = Number(cr.custoEstimativa);
    }

    const itemCusto = cost * Number(item.quantidade);
    custoMercadoria += itemCusto;

    console.log(`  Item: ${item.codigo_item} | PV: ${Number(item.preco_unitario).toFixed(2)} x ${Number(item.quantidade)} = ${(Number(item.preco_unitario) * Number(item.quantidade)).toFixed(2)} | Custo unit: ${cost.toFixed(4)} | Custo total: ${itemCusto.toFixed(2)} | Tipo: ${tipoProduto}`);
  }

  // Determine predominant type
  const tipoPredominante = tipoProdutoCount.importado >= tipoProdutoCount.industrializado ? "importado" : "industrializado";

  // Simplified tax calculation (same as backend)
  const fretePerc = 13;
  const comissaoPerc = 5.85;
  const freteValor = valorVenda * (fretePerc / 100);
  const comissaoValor = valorVenda * (comissaoPerc / 100);

  // For taxes, we need to approximate - let's just show the components
  // The backend uses calcularImpostos function
  const custoPerc = (custoMercadoria / valorVenda) * 100;
  
  // Approximate taxes (we'll show the formula)
  // For PR destination with importado: ICMS ST + PIS + COFINS + IRPJ + CSLL
  // Typical total for importado/PR: ~15-18%
  // Let's calculate what margin would be with different tax rates
  
  const totalSemImpostos = custoMercadoria + freteValor + comissaoValor;
  const margemSemImpostos = ((valorVenda - totalSemImpostos) / valorVenda) * 100;

  console.log(`\n  PEDIDO #${order.id} - ${order.razao_social}`);
  console.log(`  UF: ${order.uf} | Contribuinte: ${order.tipo_contribuinte} | Tipo predominante: ${tipoPredominante}`);
  console.log(`  Valor Venda: R$ ${valorVenda.toFixed(2)}`);
  console.log(`  Custo Mercadoria: R$ ${custoMercadoria.toFixed(2)} (${custoPerc.toFixed(2)}%)`);
  console.log(`  Frete 13%: R$ ${freteValor.toFixed(2)}`);
  console.log(`  Comissão 5.85%: R$ ${comissaoValor.toFixed(2)}`);
  console.log(`  Margem (sem impostos): ${margemSemImpostos.toFixed(2)}%`);
  console.log(`  Para chegar em 27.5% → impostos seriam: ${(margemSemImpostos - 27.5).toFixed(2)}%`);
  console.log(`  Para chegar em 27.05% → impostos seriam: ${(margemSemImpostos - 27.05).toFixed(2)}%`);
  console.log(`  ---`);

  // Use approximate tax to get the margin the backend would calculate
  // We'll use the backend's actual result from the API later
  grandSumValue += valorVenda;
}

console.log(`\n=== TOTAIS ===`);
console.log(`Soma valores: R$ ${grandSumValue.toFixed(2)}`);

await conn.end();
