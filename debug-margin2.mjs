// Call the local API to get the monthly margin data for Rafael
const BASE = 'http://localhost:3000';

// First, find Rafael's sellerId
const sellersRes = await fetch(`${BASE}/api/trpc/salesOrders.getGestorOrders?input=${encodeURIComponent(JSON.stringify({ gestorName: "GUILHERME FERREIRA ROCHA" }))}`);
const sellersData = await sellersRes.json();
const orders = sellersData?.result?.data;

if (!orders) {
  console.log("Could not fetch orders. Response:", JSON.stringify(sellersData).slice(0, 500));
  process.exit(1);
}

console.log(`Found ${orders.length} orders\n`);

// Find Rafael's sellerId from the first order
const rafaelOrder = orders.find(o => o.sellerName?.includes('RAFAEL'));
if (!rafaelOrder) {
  console.log("No Rafael orders found");
  process.exit(1);
}

const sellerId = rafaelOrder.sellerId;
console.log(`Rafael sellerId: ${sellerId}\n`);

// Now call getSellerMonthlyMargin
const monthlyRes = await fetch(`${BASE}/api/trpc/salesOrders.getSellerMonthlyMargin?input=${encodeURIComponent(JSON.stringify({ sellerId }))}`);
const monthlyData = await monthlyRes.json();
const md = monthlyData?.result?.data;

if (!md) {
  console.log("Could not fetch monthly margin. Response:", JSON.stringify(monthlyData).slice(0, 500));
  process.exit(1);
}

console.log("=== REPUTAÇÃO MENSAL DO RAFAEL ===\n");
console.log(`Mês: ${md.month}`);
console.log(`Total de pedidos: ${md.totalOrders}`);
console.log(`Valor total: R$ ${md.totalValue?.toFixed(2)}`);
console.log(`Margem mensal atual: ${md.currentMonthlyMargin?.toFixed(4)}%`);
console.log(`Comissão: ${md.monthlyComissaoPercentual}%`);
console.log();

if (md.orderBreakdown?.length > 0) {
  console.log("=== DETALHAMENTO POR PEDIDO ===\n");
  let sumVxM = 0;
  let sumV = 0;
  for (const ob of md.orderBreakdown) {
    console.log(`Pedido #${ob.orderId} - ${ob.cliente}`);
    console.log(`  Valor: R$ ${ob.valor?.toFixed(2)}`);
    console.log(`  Margem: ${ob.margem?.toFixed(4)}%`);
    console.log(`  Valor × Margem = ${(ob.valor * ob.margem).toFixed(4)}`);
    sumVxM += ob.valor * ob.margem;
    sumV += ob.valor;
    console.log();
  }
  console.log("=== CÁLCULO DA MÉDIA PONDERADA ===\n");
  console.log(`Soma(valor × margem) = ${sumVxM.toFixed(4)}`);
  console.log(`Soma(valor) = ${sumV.toFixed(2)}`);
  console.log(`Média ponderada = ${sumVxM.toFixed(4)} / ${sumV.toFixed(2)} = ${(sumVxM / sumV).toFixed(4)}%`);
}
