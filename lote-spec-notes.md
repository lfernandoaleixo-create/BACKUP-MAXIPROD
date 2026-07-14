# Módulo de Controle de Lote — Especificação

## Lógica do número de lote
- Formato: SKU-DDMMAA-NOTA
- Exemplo: EC20-100726-4016
  - EC20 = SKU do produto finalizado
  - 100726 = Data de produção (10/07/26)
  - 4016 = Número da nota fiscal da carga de madeira

## Fluxo Completo
1. ENTRADA: Líder registra produção na aba "Lançamento de Lote" → Lote criado com saldo
2. ESTOQUE: Aba "Lotes" mostra todos os lotes com saldo disponível
3. SAÍDA: No pedido, campo "Selecionar Lote" (substitui texto livre de hoje)
   - Seleciona lote(s) + quantidade de caixas de cada
   - Envia para faturar → saldo do lote baixa automaticamente
4. HISTÓRICO: Aba "Lotes" → busca por lote ou por cliente

## Tela 2 — Seleção de Lote no Pedido (envio para faturamento)

### Como é hoje:
- Campo de observação com texto livre onde o líder escreve o lote manualmente

### Como deve ficar:
- Seção "LOTES DO PEDIDO" com botão [+ Selecionar Lote]
- Ao clicar, abre lista de lotes com saldo > 0
- Lista filtra automaticamente pelo SKU do produto do pedido
- Líder informa quantas caixas de cada lote vão nesse pedido
- Não permite colocar mais caixas do que o saldo disponível
- Pode adicionar múltiplos lotes no mesmo pedido
- Ao enviar para faturamento: saldo dos lotes selecionados baixa automaticamente
- Campo de observação continua existindo para texto livre (outras informações)
- O lote SAI do campo de observação — agora tem campo próprio

### Regras:
- Botão "Selecionar Lote" abre lista com lotes que têm saldo > 0
- Lista filtra automaticamente pelo SKU do pedido (só mostra lotes do produto certo)
- Líder informa quantas caixas de cada lote vão nesse pedido
- Não permite colocar mais caixas do que o saldo disponível
- Pode adicionar múltiplos lotes no mesmo pedido (comum)
- Ao enviar para faturamento: saldo dos lotes selecionados baixa automaticamente
- Campo de observação continua existindo para texto livre (outras informações)
- O lote NÃO é mais digitado no campo de observação — agora tem campo próprio

## Banco de Dados necessário:
- Tabela de lotes (código, SKU, data produção, nota carga, quantidade produzida, saldo atual)
- Tabela de movimentações de lote (lote, pedido, cliente, quantidade enviada, data envio)

## Tela 3 — Aba "Lotes" (consulta — gestor/fiscal)
- Seção 1: Estoque de Lotes (saldo > 0, filtro por SKU, ordenação mais recente no topo)
- Seção 2: Histórico (busca por lote OU cliente, filtro por período e SKU)
