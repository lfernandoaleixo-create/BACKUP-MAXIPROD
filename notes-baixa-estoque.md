# Módulo "Solicitação de Baixa Manual no Estoque"

## Local: Dashboard > Aba Produção > Nova sub-aba "Movimentação de Estoque"

## Quem solicita: Líderes (via tablet/dashboard)
## Quem aprova e executa a baixa: Fiscal (aprova no dashboard + faz a baixa manual no sistema principal)

## Importante: O dashboard apenas registra, controla e rastreia as solicitações. A baixa real é feita manualmente pela fiscal no sistema principal. O dashboard funciona como protocolo de autorização e rastreio.

## Fluxo resumido:
Líder solicita no tablet → Fiscal recebe a pendência no dashboard → Fiscal aprova → Fiscal faz a baixa no sistema principal → Fiscal confirma no dashboard que a baixa foi realizada → Histórico registrado

## Passo a passo:
1. Criar sub-aba "Movimentação de Estoque" dentro da aba Produção
2. Criar formulário de solicitação no tablet do líder com campos:
   - Produto (selecionar da lista de estoque)
   - Quantidade retirada
   - Motivo (lista suspensa): Amostra / Reembalagem / Complemento de Pedido / Outro
   - Se "Reembalagem": abrir campo extra para informar produto de destino + quantidade que entra no estoque
   - Se "Outro": abrir campo de texto para descrever
   - Campo automático: nome do líder (puxar do login) + data/hora
3. Criar tela da Fiscal com lista de solicitações pendentes (fila de aprovação)
   - Cada solicitação pendente mostra: Quem pediu | Produto | Quantidade | Motivo | Data/Hora
4. Botões para a Fiscal em cada solicitação:
   - "Aprovar" → muda status para "Aprovada — Aguardando baixa no sistema"
   - "Recusar" → muda status para "Recusada" (opcional: campo para justificar)
5. Após a Fiscal fazer a baixa no sistema principal, ela volta no dashboard e clica em "Baixa Realizada" → muda status para "Concluída"
6. Criar os status da solicitação: Pendente → Aprovada → Concluída (ou Recusada)
7. Criar histórico/log com todas as movimentações: Data | Líder | Produto | Quantidade | Motivo | Status | Fiscal que aprovou | Hora da aprovação | Hora da conclusão
8. Criar indicador no dashboard do gestor: total de movimentações do mês + motivos mais frequentes
9. Notificação visual para a Fiscal quando chegar uma nova solicitação (destaque ou contador de pendências)
10. Alerta visual se alguma solicitação ficar "Aprovada" por mais de 24h sem ser marcada como "Concluída" (fiscal aprovou mas esqueceu de dar baixa no sistema)

## Motivos para cadastrar na lista suspensa:
| Código | Motivo | O que a Fiscal faz no sistema |
|--------|--------|-------------------------------|
| 1 | Amostra | Dá baixa manual do produto |
| 2 | Reembalagem | Dá baixa no produto A + Soma no produto B |
| 3 | Complemento de Pedido | Dá baixa da caixa extra usada |
| 4 | Outro | Dá baixa + justificativa obrigatória no formulário |

## Status da solicitação (ciclo de vida):
Pendente → Aprovada (aguardando baixa no sistema) → Concluída
ou
Pendente → Recusada

## Regras importantes:
- Só líder pode criar solicitação (não pode ser qualquer funcionário)
- Só fiscal pode aprovar e confirmar a baixa
- Nenhuma baixa manual acontece sem passar por esse fluxo — acabou o boca a boca
- O dashboard NÃO altera o estoque — ele só registra e controla o processo
- A fiscal faz a baixa real no sistema principal e depois confirma no dashboard
- Tudo fica registrado com nome, data, hora e motivo
- O comercial continua olhando o estoque no sistema normalmente — agora o número vai estar correto porque o processo está controlado
