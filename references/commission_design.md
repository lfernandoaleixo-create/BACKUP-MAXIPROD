# Comissão dos Vendedores - Design

## Regras de Negócio
- Cada vendedor tem uma META mensal em R$ (preenchida manualmente pelo gestor)
- A comissão cruza duas variáveis:
  1. Faixa de preço em que vendeu (Mostrado/Alto, Médio-Alto, Médio, Baixo)
  2. % da meta atingida (80%, 90%, 100%, 110%, 120%)

## Tabela de Comissão (valores default)
| Meta Atingida | Mostrado/Alto | Médio-Alto | Médio | Baixo |
|---|---|---|---|---|
| 80% | 5,0% | 4,0% | 3,0% | 2,0% |
| 90% | 5,5% | 4,5% | 3,5% | 2,5% |
| 100% | 6,0% | 5,0% | 4,0% | 3,0% |
| 110% | 6,5% | 5,5% | 4,5% | 3,5% |
| 120% | 7,0% | 6,0% | 5,0% | 4,0% |

## Layout
- Formato planilha: lista de vendedores com meta editável
- Tabela de comissão editável pelo gestor
- Mostrado e Alto compartilham a mesma coluna de comissão (vendeu sem desconto ou com até 20%)

## Schema Necessário
- seller_goals: sellerId, month (YYYY-MM), goalAmount (R$)
- commission_matrix: gestorName, metaPercent, priceTier, commissionPercent
  - Ou usar app_settings com JSON

## Existente
- seller_permissions já tem commissionPercent (fixo por vendedor) - será substituído pelo novo modelo
- O campo commissionPercent no seller_permissions pode ser mantido como fallback
