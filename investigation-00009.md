# Investigação Produto 00009 - Custo Real LIFO

## Problema reportado pelo Fernando
- Produto 00009 (Espeto Bambu 4,0 x 250mm) mostra custo real R$93,51
- Fernando diz que as 35 CX no estoque deveriam ser da PO65 (março/2026, R$79)
- PO52 é de dezembro/2025 (mais antiga) e suas caixas já foram vendidas
- O LIFO deveria pegar a PO mais recente por DATA DE CHEGADA

## Análise do Código (importRouter.ts)
- Linha 2004-2009: `sortByArrival` ordena por `previsaoEntrega` (oldest first)
- Linha 2036: `arrivedByProduct[code].sort(sortByArrival)` - ordena oldest first
- Linha 2112-2130: LIFO percorre de trás pra frente (`arrivedHistory.length - 1` até 0)
- Isso significa: pega a ÚLTIMA da lista (que é a mais recente por data) primeiro

## Possível Bug
- O sort usa `previsaoEntrega` que é a data de PREVISÃO de entrega
- Se PO52 tem previsaoEntrega=dez/2025 e PO65 tem previsaoEntrega=mar/2026
- Então PO65 deveria estar DEPOIS de PO52 na lista (mais recente)
- E o LIFO deveria pegar PO65 primeiro

## Hipóteses
1. A PO65 pode NÃO estar marcada como 'concluida' (pode estar como 'chegou_patio')
2. A data previsaoEntrega pode estar errada/nula para PO65
3. O produto 00009 pode não estar na PO65 como 'concluida'

## Próximo passo
- Verificar no banco quais POs concluídas existem para produto 00009
- Verificar a data de cada uma
- Verificar se PO65 está como concluída ou como pátio
