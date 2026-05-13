# Proteção dos Dados de Inadimplência

## REGRA CRÍTICA - NUNCA PERDER DADOS

Os dados da aba Inadimplência são inseridos **manualmente** pelo time de cobrança e **NUNCA** devem ser perdidos em rollbacks, alterações de código, ou qualquer outra operação.

---

## Tabelas Protegidas (NUNCA fazer DROP, TRUNCATE ou ALTER destrutivo)

| Tabela | Conteúdo | Criticidade |
|--------|----------|-------------|
| `collection_actions` | Status de cobrança, observações, promessas, histórico de contatos | **MÁXIMA** |
| `collection_daily_actions` | Ações diárias dos vendedores | **MÁXIMA** |
| `receivable_protest_config` | Configuração de protesto | **ALTA** |
| `resolved_receivables` | Títulos resolvidos (histórico) | **ALTA** |
| `collection_documents` | Documentos de cobrança | **ALTA** |
| `inadimplencia_backup` | Snapshots automáticos (backup) | **ALTA** |

---

## Sistema de Backup Automático

- **Frequência**: A cada 6 horas via Heartbeat cron
- **Endpoint**: `POST /api/scheduled/inadimplencia-backup`
- **Retenção**: Últimos 30 snapshots (7.5 dias)
- **Conteúdo**: JSON completo de todas as tabelas protegidas

### Como restaurar dados de um backup:

1. Consultar o último backup: `SELECT * FROM inadimplencia_backup ORDER BY id DESC LIMIT 1`
2. Os campos `collectionActionsJson`, `dailyActionsJson`, `protestConfigJson`, `resolvedJson` contêm o snapshot completo
3. Usar os dados do JSON para restaurar registros perdidos

---

## Regras para Rollbacks

1. **NUNCA** fazer rollback que afete as tabelas listadas acima
2. **NUNCA** alterar a estrutura (schema) dessas tabelas sem backup prévio
3. **SEMPRE** verificar se o código após rollback ainda lê corretamente os dados existentes
4. **SEMPRE** testar a aba Inadimplência após qualquer rollback
5. Rollbacks de código são seguros DESDE QUE não alterem:
   - O schema das tabelas protegidas
   - A lógica de leitura/escrita dessas tabelas
   - Os endpoints tRPC que servem dados de inadimplência

---

## Regras para o Agente (Manus)

1. Antes de qualquer rollback, verificar se o checkpoint alvo contém as mesmas tabelas e lógica de inadimplência
2. Nunca executar `webdev_execute_sql` com DROP, TRUNCATE ou ALTER destrutivo nas tabelas protegidas
3. Ao fazer alterações no código, nunca remover ou alterar os routers/handlers de inadimplência sem necessidade explícita do usuário
4. Sempre manter o endpoint de backup `/api/scheduled/inadimplencia-backup` funcional
5. Em caso de dúvida, PERGUNTAR ao usuário antes de fazer qualquer operação que possa afetar dados de inadimplência

---

## Dados que vêm do Maxiprod vs Dados Manuais

| Origem | Dados | Pode ser re-sincronizado? |
|--------|-------|---------------------------|
| **Maxiprod (API)** | Títulos, valores, clientes, datas de vencimento | SIM - re-sync automático |
| **Manual (time)** | Status de cobrança, observações, promessas, histórico de contatos | **NÃO** - perda irreversível |

---

## Histórico de Incidentes

- **13/05/2026**: Rollback para corrigir layout mobile removeu acidentalmente a aba Serragem/Rojão do código. Dados do banco não foram afetados, mas a interface ficou indisponível temporariamente.
- **Lição**: Rollbacks de código podem remover funcionalidades inteiras. Sempre verificar se todas as abas continuam funcionando após rollback.
