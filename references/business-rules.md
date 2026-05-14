# Regras de Negócio - Grupo Fox

## Variação de Produtos (Madeira)

A fábrica produz apenas medidas-base de varetas e outros produtos de madeira. Quando um cliente solicita uma variação dimensional (ex: 4,0x220mm), a fábrica envia o produto-base correspondente (ex: 4,0x218mm), pois são praticamente equivalentes.

**Regra para o sistema:**
- Quando um pedido sai com um código de produto que é uma **variação dimensional** de outro, o abatimento de estoque deve ser feito no **produto-base**, não no produto da variação.
- Exemplo concreto: código **00087** (VARETA AROMATIZADOR 4,0 X 220 MM) é variação do código **00086** (VARETA AROMATIZADOR 4,0 X 218 MM). Ao vender o 00087, abater do estoque do 00086.
- Isso se aplica a **todos os produtos com variações dimensionais de madeira**, não apenas ao exemplo acima.

### Mapeamento de variações conhecidas

| Código Variação | Produto Variação | Código Base | Produto Base |
|---|---|---|---|
| 00087 | VARETA AROMATIZADOR 4,0 X 220 MM 10.000 | 00086 | VARETA AROMATIZADOR 4,0 X 218 MM |

> **Nota:** Este mapeamento deve ser expandido conforme novas variações forem identificadas. Perguntar ao usuário quando encontrar produtos com medidas muito próximas.

## Saldos Anteriores (Pré-Maxiprod)

Alguns centros de custo possuem saldos de vendas/faturamento anteriores à implantação do Maxiprod que devem ser somados aos valores do sistema.

| Centro de Custo | Saldo Anterior | Observação |
|---|---|---|
| Serragem | R$ 17.230,80 | Somado ao Vendas/Faturamento e Recebido |
| Rojão | R$ 15.251,10 | Somado ao Vendas/Faturamento e Recebido |
