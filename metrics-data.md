# Dados de Métricas de Cobrança (30/04/2026)

## Contagens de Tabelas
- collection_actions: 126 (registros de ação por título)
- collection_daily_actions: 97 (ações diárias registradas)
- collection_manual_ticks: 335 (bolinhas ticadas)
- collection_manual_tick_history: 706 (histórico de ticagem)
- collection_step_overrides: 3
- collection_documents: 0
- resolved_receivables: 33 (títulos pagos/resolvidos)
- decision_pdf_history: 0
- receivable_protest_config: 1
- collection_action_edits: 10

## Status de Cobrança (collection_actions)
- especial_sem_cobranca: 52
- contatado: 42
- pendente: 18
- promessa: 10
- em_negociacao: 2
- cheque_compensacao: 2

## Tipos de Ação Diária
- whatsapp: 43
- email: 29
- ligacao: 21
- outro: 4

## Manual Ticks por Step
- Step 1 (blue/auto): 92, (green/manual): 116
- Step 2 (blue): 1, (green): 69
- Step 3 (red/falha): 6, (green): 18, (blue): 4
- Step 4 (green): 11
- Step 5 (blue): 1, (green): 4
- Step 6 (green): 1

## Recuperações
- 33 títulos resolvidos, total R$ 196.847,62
- 23 contatos registrados em contatoHistorico

## Notas
- TiDB não suporta JSON_TABLE, preciso usar JSON_EXTRACT para analisar contatoHistorico
- accounts_receivable (A RECEBER) = 0 (dados vêm da sync, não persistidos)
- Dados de inadimplência vêm do Maxiprod via sync
