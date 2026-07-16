# Regra de Comissão - Grupo Fox

## Fonte: Esquema enviado pelo Fernando (RELATÓRIOSEMANAL.pdf - 16/07/2026)

---

## ETAPA 1: Na hora de selecionar o produto (ANTES do fechamento do pedido)

- **1ª Comissão**: 5,85% (fixa)
- **Frete**: 13% (fixo/travado)

Esses são os valores padrão usados para estimar a margem enquanto o vendedor monta o pedido.

---

## ETAPA 2: Após o fechamento do pedido (2ª Comissão)

A comissão é recalculada com base na **margem de lucro do pedido APÓS o fechamento**.

### Barra de margem e comissão correspondente (Meta de Venda = 120%):

| Faixa de Margem | Comissão Base | + Encargos | Total Comissão |
|-----------------|--------------|------------|----------------|
| 0% a ~15%       | 4%           | 1,85%      | **5,85%**      |
| ~15% a ~18%     | 4%           | 1,85%      | **5,85%**      |
| ~18% a ~25%     | 5%           | 1,85%      | **6,85%**      |
| ~25% a ~29%     | 6%           | 1,85%      | **7,85%**      |
| ≥ 29%           | 7%           | 1,85%      | **8,85%**      |

> **IMPORTANTE**: Os 1,85% de encargos são SEMPRE somados à comissão base.
> Se a margem for menor que 15%, a comissão trava em 4% + 1,85% = 5,85% (piso mínimo).

---

## ETAPA 3: Após o fechamento - Recálculo da margem

Após o fechamento do pedido, a margem de lucro se ALTERA porque:
- Antes: usávamos frete fixo (13%) e comissão fixa (5,85%)
- Depois: o frete será simulado e escolhido pelo vendedor (API das transportadoras) e a comissão mudará conforme a tabela acima

O frete é calculado pela API das transportadoras (Braspress, Alfa, Camilo dos Santos, Rodonaves).

---

## ETAPA 4: 3ª Comissão - Comissão Mensal do Vendedor

É a **média ponderada** de todas as vendas do mês para achar a margem de lucro DO MÊS.

**Fórmula:**

```
% Margem de Lucro = Σ(Valor do Pedido[x] × Margem de Lucro do Pedido[x]) / Σ(Valor do Pedido)
```

---

## REGRA CRUCIAL (Página 6 + Confirmação do Fernando 16/07/2026):

> O tier de comissão é determinado pela margem calculada COM a comissão fixa de 5,85% (não pela margem final).
> A margem final (exibida na barra) é recalculada COM a comissão real do tier.
> NÃO há dependência circular: primeiro define o frete, depois calcula margem com 5,85% fixo, determina o tier, aplica comissão real.

**Fluxo sequencial:**
1. Frete real é definido pela API das transportadoras
2. Margem é calculada COM comissão fixa de 5,85% → essa margem determina o tier
3. Tier determina a comissão real (tabela commission_matrix + 1,85%)
4. Margem FINAL é recalculada com a comissão real (essa é a margem exibida na barra)

---

## Correspondência CONFIRMADA com os tiers da commission_matrix no banco:

| Tier no banco       | Faixa de Margem (c/ 5.85% fixo) | Comissão Base (meta 120%) | + Encargos | Total |
|---------------------|----------------------------------|--------------------------|------------|-------|
| baixo               | 15% a 19,99%                     | 4%                       | 1,85%      | 5,85% |
| medio               | 20% a 24,99%                     | 5%                       | 1,85%      | 6,85% |
| medio_alto          | 25% a 29%                        | 6%                       | 1,85%      | 7,85% |
| mostrado_alto       | ≥ 29%                            | 7%                       | 1,85%      | 8,85% |
| (crítico)           | < 15%                            | 4% (travado)             | 1,85%      | 5,85% |

**CONFIRMADO**: Esses valores estão no banco e batem com o PDF.
