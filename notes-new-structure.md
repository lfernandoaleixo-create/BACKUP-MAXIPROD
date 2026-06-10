# Análise: Nova Estrutura de Colunas

## Mapeamento de campos existentes → novos nomes

| Nova Coluna (usuário) | Campo existente no DB | Notas |
|---|---|---|
| Valor Pago ao Fornecedor | `valor_usd` (valorUsd) | Já existe - preço por caixa USD |
| Valor Pago na Ordem de Pagamento | `valor_po_cheia` (valorPoCheia) | Já existe - era "PO Cheia" |
| Diferença | CALCULADO (col2 - col1) | Não precisa de campo no DB |
| Quantidade de Caixas | `quantidade` | Já existe |
| Frete Calculado pelo Fornecedor | CALCULADO (diferença × qtd) | Não precisa de campo no DB |
| Frete com Rateio Correto | CALCULADO (% × frete total) | Não precisa de campo no DB |
| Valor de Referência | `valor_referencia` ou CALCULADO (col1 × qtd) | Já existe mas pode recalcular |

## Campos de PO (custos) - já existem no import_pos:
- pagamento1Remessa, pagamento2Remessa, pagamento3Remessa → Remessas
- despesasLiberacaoRemessa → Despesas de Liberação - Valor Vilela
- freteTermestreRemessa → Frete Terrestre SP/MG
- difalValor → DIFAL
- comissaoSilverio → Comissão Silvério
- totalCiRemessa → Valor da CI (Total CI)
- totalCustosImportacao → Custos Totais da Importação

## Conclusão:
Todos os campos JÁ EXISTEM no banco. Não preciso adicionar colunas novas.
O trabalho é 100% frontend: reorganizar a tabela com os novos nomes e cálculos.

## Lógica do "Frete com Rateio Correto":
- Para cada produto: (valorFornecedor × qtd) / totalOrdemPagamento = % representatividade
- Frete Rateio = % × totalFreteCalculadoFornecedor (soma de todos os fretes col5)
