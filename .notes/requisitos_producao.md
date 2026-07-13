# Requisitos - Aba Produção (Jul 2026)

## 1. Liberar card "Movimentação de Estoque"
Usuários que devem ter acesso: Maria, Erica, Larissa, Bruno, Guilherme, Fernando
Arquivo: client/src/pages/Production.tsx, linhas 912-916
Atualmente permitido: ['Bruno', 'Fernando', 'Guilherme']
Adicionar: 'Maria', 'Erica', 'Larissa'

## 2. PDF "Novos Gráficos de Produção" (ProductionCharts.tsx)
### O que REMOVER:
- Gráfico de pizza "Distribuição por Setor" (linhas 1327-1501)
- Gráfico de barras empilhadas "Produção Diária por Setor" (linhas 968-1222)
- Todos os blocos de texto explicativo dos gráficos
- "Produção Não Necessária" da visualização principal de paradas (mover para info separado)

### O que CRIAR:
1. **Semáforo Geral** (tela principal ao abrir aba produção)
   - Tabela com todos os setores: nome, produção do dia, média do mês, status (círculo cor), vs mês anterior (seta)
   - Status: 🟢 >= média | 🟡 até 10% abaixo | 🔴 mais de 10% abaixo
   - Seta: ▲ verde = acima mês anterior | ▼ vermelho = abaixo mês anterior
   - Referência: média mês atual = soma produção / dias trabalhados até hoje
   - Primeiros 5 dias úteis: usar média mês anterior como referência provisória

2. **Gráfico de Barras por Setor** (ao clicar em um setor no semáforo)
   - Barras = dias da semana
   - Linha tracejada = média do mês atual
   - Barra verde = atingiu/passou média | Amarela = até 10% abaixo | Vermelha = mais de 10% abaixo
   - Abaixo: média mês atual / média mês anterior / diferença %

3. **Tabela de Paradas** (simplificada)
   - Colunas: Setor | Manutenção | Pontual | Falta Mad. | TOTAL
   - Setor com TOTAL > 0 = destaque vermelho
   - "Prod. Não Necessária" em texto cinza embaixo, separado

## 3. PDF "Aba Pirografia" (Production.tsx PirografiaHistoryView linhas 2839-3092)
### O que REMOVER:
- Barras laranjas e verdes dos rankings
- Numeração de posição (1, 2, 3...)
- Informação de "registros" (ex: "5 reg.")
- Formato visual de ranking/competição
- Código do produto

### O que MANTER:
- 3 números resumo no topo (Total Caixas / Nomes Diferentes / Produtos Usados)
- Filtro de período (7d, 30d, 90d, 1 ano)
- Botão "Exportar PDF"
- Filtro de data personalizado

### O que CRIAR:
- **Tabela 1 — Clientes Pirografados** (lado esquerdo): 2 colunas (Cliente | Caixas), ordenada desc, linha TOTAL
- **Tabela 2 — Produtos Utilizados** (lado direito): 3 colunas (Produto | Tipo | Caixas), ordenada desc, linha TOTAL
- Sem barras, sem cores proporcionais, sem numeração

## 4. PDF "Controle de Lote" (NOVO módulo)
### Banco de dados:
- Tabela de lotes: código, SKU, data produção, nota carga, qtd produzida, saldo atual
- Tabela de movimentações: lote, pedido, cliente, qtd enviada, data envio

### Aba "Lançamento de Lote" (líder no tablet):
- Formulário: SKU (dropdown) + Nota da carga + Caixas produzidas
- Data automática, gera código: SKU-DDMMAA-NOTA
- Mostra lote gerado antes de confirmar

### Seleção de lote no pedido (tela de envio para faturamento):
- Campo "Lotes do Pedido" com botão "Selecionar Lote"
- Lista lotes com saldo > 0, filtrado por SKU do pedido
- Informar qtd de caixas de cada lote, múltiplos lotes permitidos
- Bloquear qtd > saldo disponível
- Ao enviar: saldo baixa automaticamente
- Campo de observação separado continua

### Aba "Lotes" (consulta gestor/fiscal):
- Seção "Estoque de Lotes": lotes com saldo > 0, filtro por SKU, mais recente no topo
- Seção "Histórico": busca por código lote OU nome cliente
  - Por lote: mostra clientes + qtd + datas
  - Por cliente: mostra lotes + qtd + datas
  - Filtro por período e SKU
