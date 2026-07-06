# Custos de Venda - Implementation Notes

## Server-side: Already exists
- `salesOrders.calculateMargin` (salesOrderRouter.ts line 1219) takes orderId, tipoProduto, comissaoPercentual, freteValor
- Returns: impostos breakdown, custoMercadoria (total + items with fonte), comissao, margem, faturamentoTrimestral
- Need a NEW procedure that works WITHOUT orderId (for inline form, before order is saved)
- Use same logic: takes items array, ufDestino, tipoContribuinte, tipoProduto, comissaoPercentual, freteValor

## Server-side: New procedure needed
- `salesOrders.calculateSalesCosts` - takes items (codigoItem + quantidade), ufDestino, tipoContribuinte, tipoProduto, comissaoPercentual, freteValor
- Returns same structure as calculateMargin but without needing an orderId

## Client-side: New CustosDeVendaStep component
Replace FreightStep with CustosDeVendaStep that has 5 sections:
1. Custo da Mercadoria - calls new procedure, shows per-item cost with fonte badge
2. Impostos - table with ICMS, PIS, COFINS, IRPJ, CSLL, DIFAL (%, R$)
3. Comissão do Vendedor - input % field
4. Transportadora (Frete) - existing freight simulation with 3 APIs
5. Gastos Adicionais - manual input field

## Tax rates (from taxCalculation.ts):
- ICMS: Importado MG=14%, Inter=1.5% | Industrializado MG=18%, Inter=12%
- PIS: MG=0.533%, Inter=0.572%
- COFINS: MG=2.46%, Inter=2.64%
- IRPJ: fixo 1.32%
- CSLL: fixo 1.19%
- DIFAL: varies by state (only for Não Contribuinte interestadual)

## Props needed from VendedorDetalhe:
- cep, cnpjCpf, tipoContribuinte, uf, items (with codigoItem, quantidade, precoUnitario)
- condicaoPagamento, valorFrete, tipoFrete, observacoes (existing)
- NEW: comissaoPercentual, gastosAdicionais

## Button rename: "Cálculo de Frete" → "Custos de Venda"
