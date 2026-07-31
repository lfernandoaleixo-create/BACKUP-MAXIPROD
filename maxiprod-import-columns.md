# Maxiprod Import Columns - Solicitação Formal

## Colunas Existentes (A até AC) - 29 colunas originais
A planilha de importação do Maxiprod tem 29 colunas (A até AC) que já existem.

## Novas Colunas Solicitadas (AD até AI)

| Coluna | Letra | Nome do Cabeçalho      | Tipo    | Obrigatório | Observações                                            |
|--------|-------|------------------------|---------|-------------|--------------------------------------------------------|
| 30     | AD    | Observações internas   | Texto   | Não         | Texto livre, multilinha (quebra com \n)                 |
| 31     | AE    | Transportadora         | Texto   | Não         | Nome fantasia ou razão social da transportadora        |
| 32     | AF    | Valor do frete         | Decimal | Não         | Formato: 463.47 (ponto decimal)                        |
| 33     | AG    | Tipo de frete          | Texto   | Não         | Valores: CIF, FOB, SEM_FRETE, TERCEIROS                |
| 34     | AH    | Forma de pagamento     | Texto   | Não         | Valores: A_VISTA, A_PRAZO, OUTROS                      |
| 35     | AI    | Situação de cobrança   | Texto   | Não         | Valores: PROTESTAR, NEGATIVAR, NENHUM                  |

## Campos Técnicos GraphQL
- observacoesInternas (PedidoDeVenda)
- transportadora.nomeFantasia ou transportadora.razaoSocial (PedidoDeVenda)
- valorFrete (PedidoDeVenda)
- tipoFrete (PedidoDeVenda) - Enumeração: CIF/FOB/SEM_FRETE/TERCEIROS
- formaDePagamento (PedidoDeVenda) - Enumeração: À vista/A prazo/Outros
- formaDeCobrancaPreferencial.boletoProtestarOuNegativar - Enumeração: COM PROTESTO/SEM/PROTESTO/NEGATIVAR

## Tipo de Frete - Valores
- CIF (0 — Contratação do Frete por conta do Remetente)
- FOB (1 — Contratação do Frete por conta do Destinatário)
- SEM FRETE (9 — Sem Ocorrência de Transporte)
- TERCEIROS (2 — Contratação do Frete por conta de Terceiros)
