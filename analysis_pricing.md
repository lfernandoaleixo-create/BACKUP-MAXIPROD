# Análise da Lógica de Preço Médio - Madeira PA

## Problema
A maioria dos produtos de Madeira PA não tem preço médio preenchido (R$/CX = "—").

## Lógica Atual (routers.ts getAvgSalesPrices)
1. Busca vendas na tabela `salesOrders` (excluindo Digitação)
2. Para cada produto do estoque (`stockItems`):
   a. Tenta match exato por descrição (salesOrders.descricao === stockItems.descricaoItem)
   b. Se não achar, tenta match por tipo+medida (ex: VARETA_AROMA|4,0x120)

## Problema Identificado
- Os produtos de Madeira PA estão na tabela `madeiraVisibility` (63 produtos), NÃO na tabela `stockItems`
- A lógica só busca preços para produtos que estão em `stockItems` (estoque Bambu/Importação)
- Os produtos de Madeira PA são de empresas diferentes (Espetos, Mesa, Varetas) e podem ter descrições diferentes nas NFs

## Solução Necessária
1. Buscar preços também para produtos de `madeiraVisibility` (não apenas `stockItems`)
2. Usar `salesInvoiceItems` (NFs) além de `salesOrders` (pedidos) para encontrar preços
3. Fazer match por código do item (`codigoItem`) em vez de apenas por descrição
