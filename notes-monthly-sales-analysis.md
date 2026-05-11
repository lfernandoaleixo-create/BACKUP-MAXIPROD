# Análise: getMonthlySalesByProduct e Variações

## Query atual (linha 2108-2110 de salesRouter.ts):
```sql
SELECT codigoItem, DATE_FORMAT(SUBSTRING(dataEmissao, 1, 10), '%Y-%m') as yearMonth, 
       COALESCE(SUM(quantidade), 0) as totalQty 
FROM sales_orders 
WHERE codigoItem IS NOT NULL AND codigoItem != '' 
  AND estadoItem IN ('Faturado', 'Faturado parcial', 'Faturado c/ entrega futura') 
  AND SUBSTRING(dataEmissao, 1, 10) >= startDate 
  AND SUBSTRING(dataEmissao, 1, 10) < endDate 
GROUP BY codigoItem, DATE_FORMAT(SUBSTRING(dataEmissao, 1, 10), '%Y-%m')
```

## Problema:
- A query agrupa por `codigoItem` individual
- Cada variação tem seu próprio `codigoItem` (ex: produto mãe 00033, variação 00213)
- As vendas da variação NÃO são somadas ao produto mãe
- No frontend (Home.tsx linha 1198): `salesByMonth = monthlySalesData.data[item.codigoItem]`
- Isso pega apenas as vendas do codigoItem exato, sem considerar variações

## Solução necessária:
- Preciso verificar se existe uma relação pai-filho na tabela stock_items ou sales_orders
- Somar as vendas das variações ao produto mãe
