# Análise: Vendas com Variações - Exemplo 00046

## Produto Mãe: 00046 (PALITO MANICURE PONTA/CHANFRO 4,0 X 125 MM C/ 10.000 UNID.)
## Variações:
- 00047 (C/ 100 X 100 UNID. EMB. TRANSPARENTE) → fator 1.0
- 00050 (C/ 200 X100 UNID.) → fator 2.0

## Vendas em Março/2026:
- 00046 (mãe): 18 cx em 3 pedidos
- 00047 (variação fator 1.0): 178 cx em 6 pedidos → 178 × 1.0 = 178 cx do mãe
- 00050 (variação fator 2.0): 35 cx em 2 pedidos → 35 × 2.0 = 70 cx do mãe

## Total correto para o mãe 00046 em Mar/26:
18 + 178 + 70 = 266 cx

## Atualmente mostra apenas: 18 cx (só o mãe)

## Lógica de implementação:
1. Buscar todas as variações da tabela product_variants
2. Para cada venda de uma variação (childCode), converter pela conversionFactor e somar ao parentCode
3. Para a MÉDIA: somar tudo no parentCode
4. Para o ESTOQUE DISPONÍVEL: 
   - Se variação tem estoque próprio no stock_items → abate da variação, NÃO duplica no mãe
   - Se variação NÃO tem estoque → converte e abate do mãe com fator
