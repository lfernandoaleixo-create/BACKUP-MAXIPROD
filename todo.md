# Project TODO

- [x] Basic homepage layout com dashboard de estoque
- [x] Filtrar por grupos 20/21 dentro do grupo 12 (IMPORTAÇÃO)
- [x] Converter estoque de unidades para caixas
- [x] Cruzar estoque com pedidos de venda (Aprovados + A aprovar)
- [x] Separar ZECA como estoque independente
- [x] Separar industrializados na parte inferior
- [x] Instalar Puppeteer e dependências para scraping
- [x] Criar schema do banco de dados (estoque, pedidos, status conexão)
- [x] Criar serviço de scraping do Maxiprod com Puppeteer
- [x] Implementar login automático e gestão de sessão MFA
- [x] Implementar coleta de estoque das 4 empresas (Palitos carregado)
- [x] Implementar coleta de pedidos de venda em aberto
- [x] Criar lógica de cruzamento estoque x pedidos no backend
- [x] Criar API tRPC para servir dados e status de conexão
- [x] Card de status de conexão visível no dashboard
- [x] Frontend consumindo dados da API em tempo real
- [x] Acesso aberto para vendedores (sem login)
- [x] Endpoint de ingestão de dados (dashboard.ingestData)
- [x] Endpoint de reprocessamento (dashboard.reprocess)
- [x] Testes automatizados (vitest) para endpoints da API
- [ ] Scraper automático via Puppeteer (desabilitado - OAuth do Maxiprod não funciona em headless)
- [ ] Coleta de dados das outras 3 empresas (Espetos, Mesa, Varetas)
- [x] Diagnosticar e corrigir perda de conexão com o Maxiprod
- [x] Coletar dados de Pedidos de Compra (PO) do Maxiprod
- [x] Criar tabela purchase_orders no banco de dados
- [x] Processar POs e vincular aos produtos no dashboard
- [x] Adicionar coluna "PO" no frontend mostrando quantidade a chegar
- [x] Testes para a funcionalidade de PO
- [x] Verificar e corrigir filtro: mostrar apenas grupo 20/21 dentro do supergrupo 12 (confirmado OK)
- [x] PO detalhado por lote com data de chegada de cada lote
- [x] Coluna Estoque Projetado (Disponível + PO)
- [x] Coletar dados de NFs de saída dos últimos 60 dias do Maxiprod
- [x] Coluna Preço Médio de Venda (últimos 60 dias)
- [x] Remover coluna Preço Médio de Venda
- [x] Voltar a mostrar Un/Cx (unidades por caixa) no produto
- [x] Mostrar número da PO nos lotes de chegada
- [x] Verificar e corrigir: Palito de Unha e Palito Manicure devem ser o mesmo produto
- [x] Corrigir produtos mostrando valores em kg - todos devem estar em caixas
- [x] Corrigir extractUnitsPerBox: ZECA 125x40 POR CAIXA, KAFTA 5x1.000 UNID, PALITO DENTE 50x1.000 UNID
- [x] Corrigir número da PO: coletar campo Referência de cada PO no Maxiprod e usar como PO#
- [x] Coletar todos os pedidos de venda disponíveis no Maxiprod (todos os status)
- [x] Criar schema e carregar dados de pedidos de venda no banco
- [x] Criar aba Vendas com seletor de período (mês corrente como padrão)
- [x] KPIs de vendas: valor total, faturado, a faturar, ticket médio, clientes, itens
- [x] Gráfico evolução de vendas por mês (barras CSS)
- [x] Ranking de produtos mais vendidos (top 20 por valor)
- [x] Vendas por cliente (top 20 com UF, segmento, pedidos)
- [x] Filtros: seletor de período (mês atual, anterior, 3m, 6m, todo)
- [x] Vendas por UF e por Segmento
- [x] Testes automatizados para sales router (12 testes)
- [x] URGENTE: Dados de estoque zerados na aba Estoque - diagnosticar e restaurar
- [x] Corrigir testes para fazer backup/restore dos dados de producao (evitar data loss)
- [x] URGENTE: Aba Vendas sem nenhuma informação - diagnosticar e restaurar dados
- [x] Corrigir testes de vendas para fazer backup/restore (evitar data loss)
- [x] Vendas: mostrar valores completos sem abreviação (R$ 325.341,05 em vez de R$ 325.3K)
- [x] Vendas: adicionar filtro por equipe (Industrialização vs Importação/Bambu)
- [x] Vendas: substituir gráfico de evolução mensal por evolução diária
- [x] Vendas: corrigir proporção das barras no gráfico diário (todas do mesmo tamanho/muito pequenas)
- [x] Vendas: ranking completo de clientes (todos, não apenas top 20) com filtros de busca
- [x] Vendas: ranking completo de produtos (todos, não apenas top 20) com filtros de busca
- [x] Vendas: gráfico de barras mostrando todos os dias do mês (1-31), mais estreito, labels maiores
- [x] Vendas: gráfico de linha acumulado com comparativo mês atual vs mês passado vs melhor mês
- [x] Vendas: renomear "Equipes" para "Segmentos" no seletor
- [x] Vendas: adicionar seletor de período personalizado (data início e fim)
- [x] Criar botão de Configurações (engrenagem) no header do dashboard
- [x] Implementar proteção por senha para acessar Configurações
- [x] Painel: Metas de vendas mensais por segmento
- [x] Painel: Gerenciamento de sincronização (última sync, forçar sync)
- [x] Painel: Configurações de alertas (estoque mínimo, vendas abaixo do esperado)
- [x] Painel: Alterar senha de administrador
- [x] Testes automatizados para settings router (10 testes)
- [x] Config: criar painel de Segmentos dos Produtos para reclassificar produtos entre segmentos
- [x] Config: tabela product_segment_overrides no banco para armazenar reclassificações
- [x] Config: endpoints tRPC para listar produtos, alterar segmento e aplicar nas analytics de vendas
- [x] Config Produtos: listar apenas os produtos do estoque (61 itens) em vez de todos os 150 de vendas
- [x] Config Produtos: ampliar largura do painel para mostrar nomes completos dos produtos
- [x] Implementar botão Sincronizar funcional que coleta dados frescos do Maxiprod
- [x] Serviço de sync server-side via HTTP para estoque, pedidos e vendas
- [x] Endpoint tRPC de sincronização com status em tempo real (getSyncProgress)
- [x] Frontend: feedback visual de progresso durante sincronização (barra de progresso, %, etapa)
- [x] BUG: Botão Sincronizar não está funcionando - diagnosticar e corrigir
- [x] Extrair dados reais do Maxiprod via browser (89 estoque, 150 pedidos venda, 67 POs, 47 vendas)
- [x] Popular banco de dados com dados extraídos via script de ingestão
- [x] Corrigir projetado do ESPETO MADEIRA (mostrava 9M un, agora mostra 900 cx)
- [x] Simplificar ConnectionStatusCard - remover MFA/progress bar, botão Reprocessar
- [x] Corrigir forceSync para reprocessar dados existentes (não tentar HTTP sync)
- [x] BUG: Aba Vendas sem dados após atualização - diagnosticar e restaurar (ingestão usava cabeçalhos em vez de itens detalhados + datas em formato BR)
- [x] Redesenhar KPI cards do dashboard com visual mais moderno e atraente
- [x] Implementar conexão com API GraphQL do Maxiprod (SOMENTE LEITURA)
- [x] Criar serviço maxiprodGraphQL.ts com queries de consulta
- [x] Implementar sincronização de estoque via GraphQL
- [x] Implementar sincronização de pedidos de venda via GraphQL
- [x] Implementar sincronização de pedidos de compra via GraphQL
- [x] Conectar botão Sincronizar ao serviço GraphQL
- [x] Testar sincronização completa end-to-end
- [x] Salvar token GraphQL e testar conexão com a API GraphQL
- [x] Explorar schema GraphQL e mapear queries (estoque, pedidos venda, pedidos compra)
- [x] Criar serviço de sincronização via GraphQL no backend (SOMENTE LEITURA)
- [x] Conectar botão Sincronizar ao serviço GraphQL
- [x] Corrigir classificação BAMBU: usar descrição do item em vez de códigos de grupo (GraphQL retorna IDs diferentes)
- [x] Atualizar testes: substituir ingestData por forceSync (GraphQL)
- [x] 42 testes passando (7 arquivos)
- [x] Testar sincronização com as outras 3 empresas (Espetos, Mesa, Varetas)
- [x] Implementar multi-empresa via minhaEmpresaId no GraphQL (sincronizar 4 empresas)
- [x] Dados de todas as empresas armazenados com campo empresaDona/empresa
- [x] Testar sincronização multi-empresa end-to-end (13 testes novos passando)
- [x] Agendar sincronização automática diária às 6h da manhã (node-cron, America/Sao_Paulo)
- [x] Padronizar cards da aba Vendas com o mesmo estilo visual dos cards da aba Estoque (gradiente, hover, pastel icons)
- [x] Adicionar card "A Faturar (Mes)" na aba Vendas - pedidos do período selecionado
- [x] Adicionar card "A Faturar (Anterior)" na aba Vendas - acumulado de meses anteriores ao período
- [x] Afinar linha do gráfico de linhas na aba Vendas (1.8px, 1.5px, 1.2px)
- [x] Ajustar tamanho dos números nos cards de Vendas (text-lg, truncate com title)
- [x] Remover card Ticket Médio da aba Vendas
- [x] Adicionar breakdown por segmento (Bambu/Industrializado/Outros) nos cards Valor Total, Faturado, A Faturar Periodo e A Faturar Anterior
- [x] Corrigir classificação de segmentos: VARETA/ESPETO = Bambu, PALITO = Industrializado (códigos GraphQL)
- [x] Config Produtos: mostrar código do produto ao lado do nome de cada item
- [x] Config Produtos: adicionar seletor de visibilidade (mostrar/ocultar produto no dashboard de estoque)
- [x] Config Produtos: busca por código do produto
- [x] Config Produtos: filtro por visibilidade (Todos/Visíveis/Ocultos)
- [x] Dashboard Estoque: filtrar produtos ocultos automaticamente
- [x] Separar produtos com múltiplos códigos: cada código vira um produto individual (opção B)
- [x] Identificar diferença entre códigos do mesmo produto (embalagem, segunda linha, TIP/TIP vs TIP/CHANFER)
- [x] Atualizar stockProcessor para não agrupar por matchKey - cada codigoItem é um produto
- [x] Distribuir pedidos/POs individualmente por codigoItem
- [x] Atualizar settingsRouter e frontend para código único por produto
- [x] Resincronizar dados e verificar visualmente (114 produtos, 71 testes passando)
- [x] Remover todas as referências a "Segunda Linha" / "2ª Linha" dos produtos (nome, variante, palavraChave)
- [x] Corrigir testes: fileParallelism: false para evitar race condition no banco compartilhado
- [x] Bug: erro de sincronização no dashboard (era temporário durante restart do servidor)
- [x] Bug: mensagem de erro no canto inferior esquerdo (corrigido: React duplicate key + tipo codigoItem)
- [x] URGENTE: Filtro de grupo 20/21 implementado com campo grupoCodigo da API GraphQL (grupo.codigo) - 62 produtos filtrados

## REGRA FUNDAMENTAL (a partir de 13/03/2026)
> O estoque do dashboard DEVE ser sempre uma cópia fiel do Maxiprod.
> Mesmos produtos, mesmas descrições, mesmas quantidades.
> Se um produto for adicionado no Maxiprod, deve aparecer aqui.
> Se for removido, deve desaparecer.
> SEM processamento próprio de nomes, SEM filtros manuais de grupo,
> SEM renomear descrições, SEM extrair palavras-chave.
> O dashboard é um ESPELHO do Maxiprod.

## REGRA FUNDAMENTAL (a partir de 17/04/2026)
> Os dados de cobrança da inadimplência são SAGRADOS e NUNCA devem ser apagados ou resetados.
> Isso inclui: collection_actions, collection_daily_actions, collection_manual_ticks, collection_manual_tick_history.
> Nenhuma operação do sistema (sync, reset, migração, teste) pode deletar ou sobrescrever esses dados.
> Se precisar alterar a lógica de cobrança, PRESERVAR todos os dados existentes.
> Testes DEVEM fazer backup/restore desses dados se precisarem manipulá-los.
> Em caso de dúvida, PERGUNTAR ao usuário antes de qualquer operação destrutiva.

## Refatoração: Espelho Fiel do Maxiprod
- [x] Remover processamento de stockProcessor (palavraChave, filtro grupo 20/21, renomear descrições)
- [x] Sincronização deve gravar exatamente o que a API GraphQL retorna (descrição, código, quantidade)
- [x] Produtos adicionados no Maxiprod devem aparecer automaticamente no dashboard
- [x] Produtos removidos no Maxiprod devem desaparecer do dashboard (sync completo, não incremental)
- [x] Frontend deve exibir descrições exatamente como vêm do Maxiprod
- [x] Atualizar testes para nova abordagem espelho
- [x] Validar sincronização completa com dados reais

## Verificação: Produtos Grupos 20 e 21
- [x] Consultar API GraphQL do Maxiprod para listar todos os produtos dos grupos 20 e 21
- [x] Comparar lista da API com o que está no dashboard (85 produtos)
- [x] Identificar discrepâncias: 0 faltando, 51 extras (outros grupos - espelho fiel)
- [x] Garantir que descrições e quantidades estão corretas (34/34 OK, 0 diferenças)

## Config Produtos - Ajustes visuais
- [x] Adicionar coluna "Grupo" mostrando código do grupo Maxiprod (06, 07, 08, 18, 20, 21, 24)
- [x] Remover abreviação "Imp" e "Ind." - escrever nome completo (Importação/Industrializado)
- [x] Reduzir um pouco a largura do painel de configurações (max-w-7xl)

## POs - Espelho Fiel do Maxiprod (número da PO vem na descrição do fornecedor)
- [x] Analisar dados brutos de PO: campo referencia do pedidoDeCompra na API GraphQL
- [x] Refatorar stockProcessor para extrair número da PO do campo referencia ("PO65 - COMERCIAL" -> "PO65")
- [x] Agrupar lotes por número da PO do fornecedor (referenciaPO)
- [x] Atualizar frontend para exibir POs com número correto (PO56-PO65, PO01, MADEIRA)
- [x] Testar e validar (82 testes passando, 12 arquivos)

## Card Grande de POs Pendentes
- [x] Criar card grande no dashboard mostrando todas as POs pendentes de chegada
- [x] Listar cada PO com número do fornecedor (PO60, PO65, etc.), data de entrega e fornecedor
- [x] Ao clicar em uma PO, expandir/abrir resumo com todos os produtos daquela PO
- [x] Mostrar quantidade por produto dentro de cada PO

## Verificação Rigorosa: Produtos por PO
- [x] Consultar API GraphQL para listar todos os itens de cada PO
- [x] Comparar com o que o dashboard mostra em cada PO
- [x] Identificar produtos faltantes: 14 códigos de PO não estavam no estoque
- [x] Corrigir: matching por codigoItem + PO-only items com estoque 0 (99 itens total)

## Config Produtos = Espelho do Estoque
- [x] Garantir que a lista de produtos em Config > Produtos seja idêntica à lista do dashboard de estoque (99 itens)
- [x] Remover qualquer fonte de dados separada para Config Produtos
- [x] Testar e validar

## Card POs - Botão Expandir/Recolher
- [x] Adicionar botão para expandir/recolher lista de POs no card
- [x] Por padrão, lista de POs recolhida (mostra apenas cabeçalho com totais)
- [x] Clicar expande, clicar novamente recolhe

## Busca por Código
- [x] Busca por código já implementada no campo de pesquisa do dashboard

## Pedidos: Somar todas as empresas (espelho fiel)
- [x] Remover filtro de estadoNota "Digitação" que excluía pedidos válidos (Maxiprod os conta como reservados)
- [x] Verificar que as 12 diferenças dos grupos 06, 07, 08 foram corrigidas (TODOS OK)
- [x] Atualizar testes: Digitação agora é incluído, apenas Cancelado é excluído (84 testes passando)

## Tooltip de Pedidos Reservados por Cliente
- [x] Ao passar o mouse no campo "Pedidos" de um produto, mostrar tooltip com detalhamento por cliente
- [x] Tooltip deve listar: nome do cliente + quantidade de caixas reservadas + status do pedido (Aprovado/A aprovar/Digitação)
- [x] Backend: agregar pedidos de venda por cliente e status para cada codigoItem
- [x] Frontend: implementar tooltip/popover no campo Pedidos da tabela de estoque
- [x] Testes automatizados para a nova funcionalidade

## Produto 00207 - Correção de unidade (kg)
- [x] Produto 00207 é vendido em kg, não em unidades - corrigir exibição
- [x] POs do produto 00207 são sacos de 30kg cada - converter para kg no dashboard
- [x] Verificar se há outros produtos vendidos em kg que precisam do mesmo tratamento (00207 é o único)

## Bug: Erro na sincronização
- [x] Diagnosticar erro de sincronização reportado pelo usuário (API Maxiprod com timeout SSL temporário)
- [x] Adicionar retry com backoff exponencial (3 tentativas: 5s, 10s, 20s) na função gql()
- [x] Adicionar timeout de 30s por requisição (AbortSignal.timeout)
- [x] Melhorar mensagem de erro para o usuário ("Servidor do Maxiprod indisponível")

## Sincronização automática a cada 10 minutos (horário comercial)
- [x] Alterar scheduler: sync a cada 5 min, seg-sex, 7h-18h (America/Sao_Paulo)
- [x] Manter botão Sincronizar manual funcionando
- [x] Atualizar mensagem de status para refletir frequência de atualização
- [x] Atualizar testes do scheduler

## Bug: Alteração de segmento nas configurações não salva
- [x] Diagnosticar por que a mudança de segmento não está sendo aplicada (lookup comparava descricao com codigoItem)
- [x] Corrigir o bug (getProductSegments agora faz match por descricaoItem, codigoItem e codigoGrupo)

## Regra: Pedidos em Digitação NÃO reservam estoque
- [x] Excluir pedidos com status "Digitação" do cálculo de reservados (estoque - pedidos)
- [x] Apenas pedidos "Aprovados" e "A aprovar" devem reservar estoque
- [x] Ajustar tooltip: seção separada "Em Digitação" (cinza, opacidade reduzida, nota "Não reservam estoque")
- [x] Atualizar testes (18 stockProcessor passando)

## Bug: Erro recorrente na sincronização manual
- [x] Diagnosticar: API do Maxiprod com timeout SSL persistente (problema do lado deles)
- [x] Retry automático já implementado (3 tentativas), mensagem amigável ao usuário

## Análise Financeira do Maxiprod (SOMENTE LEITURA)
- [x] Mapear schema GraphQL para identificar dados financeiros disponíveis
- [x] Identificar queries de contas a pagar, contas a receber, fluxo de caixa, NFs
- [x] Planejar módulo financeiro no dashboard
- [x] Implementar coleta e exibição dos dados financeiros (dados importados via browser scraping)

## Bug: tRPC retornando HTML em vez de JSON
- [x] Diagnosticar erro "Unexpected token '<', <!doctype..." na rota /api/trpc (EMFILE: too many open files)
- [x] Corrigir causa raiz (aumentar fs.inotify.max_user_watches de 31.068 para 524.288)

## Aba Financeiro - Fase 1
- [x] Explorar schema GraphQL: campos de contaAReceber e contaAPagar
- [x] Coletar dados de teste para entender a estrutura (2.729 a pagar, 2.193 a receber)
- [x] Criar tabelas no banco: financial_receivables e financial_payables
- [x] Criar sync de dados financeiros via GraphQL (somente leitura)
- [x] Criar procedures tRPC para servir dados financeiros (7 procedures)
- [x] Criar aba Financeiro no frontend com KPIs, tabelas, aging report, calendário
- [x] Testes automatizados para financeiro
- [x] Popular dados reais (1.600 contas a pagar + 502 contas a receber importadas via browser scraping)

## Importação Manual de Dados Financeiros (14/03/2026)
- [x] Login no Maxiprod via browser (email/senha + 2FA)
- [x] Extrair 1.700 registros de Contas a Pagar via browser scraping
- [x] Extrair 507 registros de Contas a Receber via browser scraping
- [x] Importar dados no PostgreSQL (1.600 a pagar + 502 a receber)
- [x] Corrigir comparação case-sensitive do campo estado nas queries
- [x] Verificar API retornando dados corretos (R$ 11.2M a pagar, R$ 3.6M a receber)
- [x] Verificar aba Financeiro exibindo todos os widgets (KPIs, aging, calendário, rankings)
- [x] Verificar tabelas de Contas a Pagar e Contas a Receber com filtros funcionando

## Ajustes Aba Financeiro (14/03/2026)
- [x] Remover cards: Saldo, Pagar Vencidas, Pagar Próx 30d
- [x] Contas a Pagar: mostrar somente próximos 60 dias por padrão
- [x] Filtro de período: Mês Corrente, Próximo Mês, Próximos 60 dias
- [x] Card A Pagar no topo: mostrar apenas próximos 60 dias (não total geral)
- [x] Cards financeiros: mostrar valores completos sem abreviação (não usar K/M)
- [x] Reordenar cards: A Receber, Inadimplência, A Pagar
- [x] Remover seção Aging de Recebimento da Visão Geral
- [x] Adicionar tabela Contas a Receber ao lado do Calendário de Pagamentos na Visão Geral
- [x] Criar calendário de recebimento por semana (idêntico ao de pagamento)
- [x] Cards KPI clicáveis com seta: A Receber abre Contas a Receber, A Pagar abre Contas a Pagar
- [x] Inadimplência clicável abrindo Contas a Receber
- [x] Refazer calendários: quadros padronizados lado a lado (Recebimentos vs Pagamentos)
- [x] Calendários com Vencidos + 8 semanas separadas (não mais agrupado por 30d/depois)
- [x] Linhas ocultas expansíveis ao clicar em "+X mais"
- [x] Corrigir último bucket (semana 8): não acumular contas além da data final, descartar o restante
- [x] Remover quadros Maiores Devedores, Maiores Fornecedores e Maiores Clientes da Visão Geral
- [x] Calendários: semanas de segunda a domingo, contas de sáb/dom vão para a semana seguinte (segunda)
- [x] Contas de sáb/dom: considerar vencidas somente a partir de terça-feira (segunda é o dia útil de pagamento)
- [x] Remover abas (Visão Geral, Contas a Pagar, Contas a Receber) - mostrar tudo direto na página
- [x] Dividir card A Receber em: A Receber 60d + Restante, mostrando total
- [x] Card A Receber: adicionar faixa 61-120d e Restante (>120d) com total
- [x] Refazer KPIs: dois cards lado a lado (A Receber vs A Pagar) com breakdown mensal comparativo por 10 meses
- [x] Remover tabelas Contas a Pagar e Contas a Receber do final da página Financeiro
- [x] Seletor de mês acima dos cards com tabelas de contas detalhadas do mês escolhido (a receber e a pagar)
- [x] Mês corrente: filtrar a partir de hoje (não do dia 1) para mostrar apenas contas que faltam pagar/receber
- [x] Card Vencidas do calendário de Recebimentos: mostrar SOMENTE contas com no máximo 3 dias de atraso (regra exclusiva)
- [x] Gráficos A Receber e A Pagar: botão recolher/expandir para ocultar quando não quiser ver
- [x] Gráficos A Receber e A Pagar: barras mais finas e elegantes (menos grosseiras)
- [x] Card Vencidas do calendário de Recebimentos: adicionar título claro indicando "até 3 dias de atraso"
- [x] Sincronizar expandir/recolher dos gráficos A Receber e A Pagar (abrem e fecham juntos)
- [x] Botão fechar/ocultar na aba de contas detalhadas do mês selecionado
- [x] Card Inadimplência: adicionar gráfico dentro do card com os inadimplentes (SOMENTE este card)
- [x] Card Inadimplência: substituir gráfico de barras horizontais por gráfico de linha temporal (valor acumulado ao longo do tempo)
- [x] Card Inadimplência: linhas mais finas no gráfico
- [x] Card Inadimplência: tooltip persistente com 2 eixos (valor mês + acumulado) enquanto mouse dentro do gráfico
- [x] Card Inadimplência: botão recolher/expandir o gráfico
- [x] Card Inadimplência: adicionar título descritivo ao gráfico
- [x] Novo card independente: ranking de clientes inadimplentes por valor (expandir/recolher)
- [x] Novo card clientes: expansão inline ao clicar mostrando títulos e datas de cada cliente
- [x] Card Clientes Inadimplentes: remover coluna "Empresa" da tabela expandida de títulos
- [x] Card Clientes Inadimplentes: adicionar coluna "Título mais antigo" no ranking
- [x] Card Clientes Inadimplentes: ordenação por valor, data do título mais antigo, número de títulos
- [x] Card Clientes Inadimplentes: campo de busca para procurar cliente por nome
- [x] Card Clientes Inadimplentes: filtro rápido para cliente Keure
- [x] Card Clientes Inadimplentes: filtro rápido para empresas com Johnson no nome
- [x] Card Inadimplência (gráfico de linha): adicionar filtros Keure e Johnson para ver evolução individual
- [x] Card Inadimplência (gráfico de linha): iniciar fechado por padrão
- [x] Card Inadimplência (gráfico de linha): barra de busca por cliente para filtrar no gráfico
- [x] Card Inadimplência: substituir gráfico de linhas por gráfico de barras moderno e delicado
- [x] Card Inadimplência: redesenhar com layout split (gráfico esquerda + detalhes direita)
- [x] Card Inadimplência: melhorar estética das barras do gráfico (mais refinado e profissional)
- [x] Card Inadimplência: painel direito mostra ao hover no mês: total, títulos com cliente, data, valor
- [x] Card Inadimplência: mostrar valor total da série histórica (ou do cliente filtrado) no topo do painel direito
- [x] Card Inadimplência: padronizar aparência igual ao card Clientes Inadimplentes (mesmo estilo header)
- [x] Todos os cards Financeiro: aumentar e dar mais ênfase em TODAS as setas de expandir/recolher
- [x] Card Inadimplência: adicionar linha fina e delicada sobre o gráfico de barras mostrando evolução ao longo do tempo
- [x] Card Inadimplência: remover sombra/área preenchida abaixo da linha de evolução
- [x] Card Inadimplência: aumentar tamanho dos pontos (bolinhas) na linha
- [x] Card Inadimplência: mostrar valor acumulado ao hover sobre cada bolinha
- [x] Card Inadimplência: corrigir hover das bolinhas da linha de evolução para que TODAS funcionem e mostrem tooltip
- [x] Card Vencidas (A Receber): mudar cor para verde (consistência com outros cards de receber)
- [x] Cards das semanas: alinhar datas com valores para melhorar estética
- [x] BUG: Valores dos cards Financeiro mudaram indevidamente após edição de cor/alinhamento - diagnosticar e reverter
- [x] BUG: Inadimplência dobrou de R$544K para R$1.2M após sync - investigar coleta de dados financeiros
- [x] FIX: Deduplicação por maxiprodId no saveFinancialData (API retorna duplicatas na paginação)
- [x] FIX: Usar razaoSocial como fallback quando nomeFantasia é nulo (cliente/fornecedor)
- [x] Novo card Fluxo de Caixa: gráfico mostrando recebimentos vs pagamentos com saldo positivo/negativo
- [x] Card Fluxo de Caixa: opção expandir/recolher igual aos outros cards
- [x] Mover card Fluxo de Caixa para abaixo do gráfico de barras (A Receber / A Pagar), antes dos calendários
- [x] Fluxo de Caixa: não considerar inadimplentes, usar apenas vencidas até 3 dias para receber (mesma lógica do calendário)
- [x] Fluxo de Caixa: remover sombra/area abaixo da linha de saldo acumulado
- [x] Fluxo de Caixa: redesenhar gráfico com eixo zero central, linha acima/abaixo mostrando caixa positivo/negativo
- [x] Fluxo de Caixa: eixo zero fixo no centro, escala -1M a +1M, sem fundo colorido, barras mais largas e cor mais forte
- [x] Fluxo de Caixa: tooltip ao passar mouse nas barras mostrando valor
- [x] Fluxo de Caixa: aumentar tamanho das letras dos dias da semana
- [x] BUG: Tooltip das barras do Fluxo de Caixa não aparece ao passar o mouse
- [x] Fluxo de Caixa: diminuir um pouco o tamanho das letras das semanas (estão muito grandes)
- [x] Financeiro: todos os cards/gráficos colapsáveis devem começar fechados por padrão
- [x] Calendários Recebimentos/Pagamentos: alinhar perfeitamente datas (tamanho e posição consistente)
- [x] Calendários Recebimentos/Pagamentos: alinhar perfeitamente R$ e números (alinhamento à direita)
- [x] Schema: tabela bankAccounts (contas bancárias do Maxiprod) e bankBalances (saldo inicial por conta)
- [x] Backend: sync de itens OFX do Maxiprod para calcular movimentações
- [x] Backend: endpoint para calcular saldo atual = saldo inicial + movimentações OFX
- [x] Config: tela para editar saldo inicial de cada banco com data de referência
- [x] Financeiro: card de saldo bancário consolidado integrado ao fluxo de caixa
- [x] Otimizar sync: aumentar page size e paralelizar chamadas financeiras/bancárias
- [x] URGENTE: Otimizar sync para poucos segundos (page size maior, chamadas paralelas, eliminar gargalos)
- [x] Reordenar cards Financeiro: 1) Fluxo de Caixa, 2) Saldo Bancário, 3) A Receber/A Pagar, 4) Calendários
- [x] Config > Bancos: adicionar seletor de data para informar a data de referência dos saldos iniciais
- [ ] BUG: Timezone mismatch - servidor usa mix de UTC e local causando cálculo errado de vencidos até 3 dias. Corrigir para usar sempre horário de Brasília

## Correção Crítica: Bug de Timezone (15/03/2026)
- [x] Converter TODAS as comparações de data para string-based YYYY-MM-DD (eliminar Date objects)
- [x] Criar helpers: getTodayBR(), addDaysStr(), getDayOfWeekStr(), adjustWeekendStr()
- [x] Reescrever getReceivableCalendar com strings
- [x] Reescrever getPaymentCalendar com strings
- [x] Reescrever getCashFlowChart com strings
- [x] Corrigir getSummary (addDaysStr em vez de getBrasiliaDate + setDate)
- [x] Corrigir getAgingReport (diffDaysStr em vez de Date.getTime)
- [x] Corrigir getMonthlyBreakdown (getTodayBR em vez de getBrasiliaDate)
- [x] 20 testes vitest passando para funções de timezone
- [x] API validada: vencidas retorna datas 11, 12, 13/03 (correto para hoje 14/03)
- [x] Fluxo de Caixa: mostrar valores completos sem abreviação (não usar K/M)
- [x] Financeiro: adicionar título elegante no topo da página (Dashboard de Análise Financeira - Grupo Fox)
- [x] Financeiro: mover título elegante do header para dentro da página, acima do card Inadimplência
- [x] Header: simplificar para "Financeiro" e abas (Vendas, Financeiro, Config) com letras maiores e mais bonitas
- [x] Criar componente de navegação global unificado e elegante para todas as abas (Estoque, Vendas, Financeiro, Config)
- [x] Aplicar navegação unificada em Home.tsx, Sales.tsx, Financial.tsx e SettingsPage.tsx
- [x] Config > Produtos: adicionar 3 colunas de classificação mutuamente exclusivas (Manter em Estoque, Sob Encomenda, Outros)
- [x] Schema: criar tabela productClassification no banco de dados
- [x] tRPC: criar rotas para ler/salvar classificação de produtos
- [x] UI: radio buttons na tabela de produtos em Configurações
- [x] Config: remover senha temporariamente da aba Configurações
- [x] Estoque: reorganizar em 3 cards expansíveis (Estoque, Encomenda, Outros) baseados na classificação
- [x] Estoque: buscar classificações de produtos via tRPC
- [x] Estoque: cada card com tabela própria e possibilidade de expandir/colapsar
- [x] Estoque cards: melhorar header com métricas completas (Estoque, Pedidos, Disponível, PO, Projetado, Alertas)
- [x] Estoque cards: mover barra de busca para dentro de cada card (busca independente por card)
- [x] Estoque: card lateral financeiro - buscar preço médio das últimas 5 VENDAS por produto (match inteligente tipo+medida)
- [x] Estoque: card lateral financeiro - calcular valor do estoque atual, PO e projetado
- [x] Estoque: card lateral financeiro - expandir junto com cada grupo de classificação
- [ ] Estoque: card lateral financeiro - proteger com senha (a configurar depois)
- [x] Estoque: card lateral direito com preço unitário (1cx), valor estoque, valor PO e valor total por produto
- [x] Card lateral expande/recolhe junto com cada grupo de classificação
- [x] BUG: Tabela de estoque fica visualmente distorcida/cortada quando valorização é ativada - corrigir layout (ocultar Un/Cx, Segmento e Status quando financeiro ativo)
- [x] Schema: criar tabela productPricing para preço manual de produtos
- [x] tRPC: rotas para ler/salvar preço manual e modo (auto/manual) por produto
- [x] Config > Produtos: coluna de preço com toggle Automático/Manual e campo editável
- [x] Estoque Valorização: usar preço manual quando definido, senão preço automático (média vendas)
- [x] Config Produtos: redesenhar coluna preço - bolinha marcada = auto (valor visível não editável), desmarcar = manual (campo editável)
- [x] Config Produtos: corrigir estética geral - informações cortadas, melhorar layout
- [x] Config Produtos: mostrar preço automático (média vendas) na coluna R$/Cx quando modo auto está ativo
- [x] Estoque: cards começam fechados ao abrir a página
- [x] Estoque: quando Valorização ativa + card fechado, mostrar valores financeiros totais no header (Vlr Estoque, Vlr PO, Vlr Projetado)
- [x] Card resumo com totais dos 3 grupos à esquerda do botão Valorização do Estoque
- [x] Card único com valorização financeira consolidada (R$) dos 3 grupos: Vlr Estoque, Vlr PO, Vlr Projetado totais
- [x] DB: campos estoque_regulador e prazo_compra_dias na tabela product_pricing
- [x] Backend: routers para salvar/ler estoque regulador e prazo de compra
- [x] Config Produtos: colunas Estoque Regulador e Prazo de Compra (preenchimento manual)
- [x] Aba Estoque: coluna Estoque Regulador entre Projetado e Status
- [x] Config Produtos: renomear Est. Reg. para Venda Mensal
- [x] Config Produtos: nova coluna Fator (padrão 2.3, editável)
- [x] DB: campo fator_multiplicacao na tabela product_pricing
- [x] Aba Estoque: Est. Reg. = Venda Mensal × Fator
- [x] Estoque Regulador: item 207 deve exibir em kg (não em caixas)
- [x] Status: Projetado <= Est. Regulador = "COMPRA" (alerta), senão "OK". Volta ao normal quando PO lançada
- [x] Regra COMPRA/OK apenas no card Manter em Estoque (Sob Encomenda e Outros sem regra de compra)
- [x] Renomear "Manter em Estoque" para "Estoque"
- [x] Coluna Est. Reg.: verde quando OK, vermelho quando COMPRA
- [x] Card Alertas: mostrar apenas itens que precisam comprar do card Estoque
- [x] Tooltip PO: melhorar visual (fundo escuro difícil de ler) - usar fundo claro
- [x] Marca d'água na coluna Disponível nos 3 cards para destaque visual do time comercial
- [x] Card Custo do Estoque Regulador: somar Est. Reg. × preço unitário do card Estoque, exibir em R$ quando Valorização ativa
- [x] Mover card Custo do Estoque Regulador para dentro do card Valorização Total do Estoque
- [x] Corrigir estética: 3 cards abertos devem ter alinhamentos iguais e consistentes
- [x] Corrigir informações cortadas nas tabelas quando Valorização do Estoque está ativa
- [x] Vendas: gráfico de linhas overlay sobre barras (evolução diária, mês anterior, melhor mês) sutil e delicado
- [x] Vendas: aumentar tamanho do gráfico
- [x] Vendas: corrigir eixo Y do gráfico - escala deve ir até o valor máximo das linhas acumuladas
- [x] Vendas: escalas independentes - barras com maxVal (esquerdo), linhas com maxCumulative (própria escala)
- [x] Vendas: valor abreviado à direita de cada linha acumulada no gráfico
- [x] Vendas: fixar escala Y em 250k
- [x] Vendas: corrigir gráfico que está todo errado após alterações de escala
- [x] Vendas: tooltip nas barras mostrando pedidos referentes ao dia
- [x] Vendas: linhas mais finas e cores mais fortes no gráfico
- [x] Vendas: remover os 3 cards abaixo do gráfico
- [x] Vendas: copiar card Inadimplência (gráfico de barras) da aba Financeiro para abaixo do gráfico
- [x] Vendas: copiar card Clientes Inadimplentes da aba Financeiro para abaixo do gráfico
- [x] Vendas: usar componentes compartilhados (alteração no Financeiro reflete automaticamente no Vendas)
- [x] Vendas: card de Pedidos acima da Visão Geral listando pedidos do período
- [x] Vendas: expandir pedido para ver itens e valores detalhados
- [x] Vendas: endpoint tRPC para listar pedidos com itens
- [x] Vendas: setas de ordenação (maior/menor) nas colunas do card de Pedidos
- [x] Vendas: eliminar tabs (Visão Geral, Clientes, Produtos)
- [x] Vendas: transformar gráfico Evolução Diária em card colapsável
- [x] Vendas: remover KPI cards Clientes e Itens
- [x] Vendas: adicionar filtro Faturado/A Faturar dentro do card de Pedidos
- [x] Vendas: soma do valor filtrado no card de Pedidos ao usar filtro Faturado/A Faturar
- [x] Vendas: card A Faturar (Anterior) com pedidos de meses anteriores não faturados
- [x] Vendas: filtro por mês dentro do card A Faturar (Anterior)
- [x] Vendas: endpoint tRPC para listar pedidos A Faturar anteriores
- [x] Vendas: posicionar card abaixo do card Evolução Diária
- [x] Vendas: card informativo de Pedidos em Digitação no rodapé (não soma em KPIs)
- [x] Vendas: endpoint tRPC para listar pedidos em digitação
- [x] BUG: Pedidos 500, 501, 502 aparecem em Digitação E A Faturar Anterior — corrigido: card Digitação agora exclui pedidos que já existem em sales_orders
- [x] Vendas: mudar cor dos 3 cards (Pedidos, Evolução Diária, A Faturar Anterior) para verde, padronizar visual
- [x] Vendas: padronizar esteticamente os 5 cards (fontes, setas, badges, espaçamentos idênticos)
- [x] Vendas: aumentar letras da parte superior do card Evolução Diária (acumulado dos meses)
- [x] Criar título no estilo da aba Financeiro para todas as abas (Estoque, Vendas, Configurações)
- [x] Criar nova aba Faturamento entre Vendas e Financeiro
- [x] Faturamento: endpoint tRPC para listar pedidos em aberto (A Faturar) e faturados (últimos 30 dias)
- [x] Faturamento: cards colapsáveis no mesmo padrão visual das outras abas
- [x] Faturamento: título no estilo Playfair Display "Dashboard de Faturamento Grupo Fox"
- [x] Faturamento: KPIs resumo (total em aberto, total faturado, etc.)
- [x] Faturamento: adicionar rota e link na navegação

## Vinculação Pedidos x Notas Fiscais (15/03/2026)
- [x] Investigar API GraphQL: vínculo entre itensDasNotasFiscais e itensDosPedidosDeVendas via itemDoPedidoDeVendaId
- [x] Criar endpoint tRPC para buscar NFs vinculadas a pedidos faturados
- [x] Atualizar card "Faturados (Últimos 30 dias)" para exibir NF vinculada (número, série, chave de acesso)
- [x] Exibir dados de NF ao expandir pedido faturado (número NF, data emissão, chave de acesso)

## Card "Autorizado a Faturar" (15/03/2026)
- [x] Schema: tabela billing_authorizations (pedido, data autorização, autorizado por)
- [x] Backend: endpoint tRPC para autorizar pedido (protegido por senha)
- [x] Backend: endpoint tRPC para desautorizar pedido (protegido por senha)
- [x] Backend: endpoint tRPC para listar pedidos autorizados
- [x] Frontend: card "Autorizado a Faturar" entre Em Aberto e Faturados
- [x] Frontend: botão de autorizar no card Em Aberto (com modal de senha)
- [x] Frontend: pedidos autorizados saem do card Em Aberto e aparecem no card Autorizado a Faturar
- [x] Frontend: pedidos faturados saem automaticamente do card Autorizado a Faturar
- [x] Testes vitest para os novos endpoints (10 testes passando)

## Bug: Erro no rodapé esquerdo (15/03/2026)
- [x] Diagnosticar erro intermitente (card vermelho '1 erro') na aba Financeiro
- [x] Corrigir o erro (era transitório do HMR + corrigido button aninhado no Billing.tsx)

## Campos extras nos pedidos de venda (15/03/2026)
- [x] Atualizar query GraphQL para buscar: condição de pagamento, transportadora, data de entrega, endereço completo, razão social, NCM
- [x] Atualizar schema do banco (tabelas salesOrders e orderItems) com novos campos
- [x] Atualizar processamento dos dados e routers para retornar novos campos
- [x] Atualizar frontend para exibir novos campos ao expandir pedido (Faturamento)

## Bug: Itens sumiram ao expandir pedido (15/03/2026)
- [x] Restaurar tabela de itens do pedido na área expandida (itens estavam lá, detalhes novos empurravam para baixo)
- [x] Adicionar data de entrega dos itens na tabela (coluna ENTREGA adicionada)

## Redesign Faturamento: destaque no status e autorização (15/03/2026)
- [x] Redesenhar linha do pedido: status e botão de autorização como elemento principal
- [x] Criar caixa visual em volta do botão de autorizar (borda tracejada amber, hover solid)
- [x] Reduzir ênfase no valor (text-xs text-slate-500, à direita)
- [x] Tornar o status visualmente dominante (pill badge grande com ícone, borda e cores fortes)
- [x] Adicionar coluna de data de entrega com destaque vermelho para vencidas

## Destaque visual do pedido expandido (15/03/2026)
- [x] Destacar pedido expandido com fundo, borda e sombra forte (borda teal grossa, ring, gradiente, sombra XL, todos os itens visíveis)

## Bug: Produtos sem descrição na aba Vendas (16/03/2026)
- [x] Diagnosticar por que alguns pedidos mostram cliente como '—' na aba Vendas
- [x] Identificar todos os pedidos afetados (65 pedidos da empresa PALITOS INDUSTRIA com nomeFantasia null)
- [x] Corrigir coleta de dados: usar razaoSocial como fallback quando nomeFantasia é null (apenas 1 pedido #490 sem dados no Maxiprod)

## Filtros nos quadros semanais do Financeiro (16/03/2026)
- [x] Adicionar setinha de filtro no canto superior direito de cada quadro semanal (A Receber e A Pagar)
- [x] Opção de ordenar por valor crescente
- [x] Opção de ordenar por valor decrescente
- [x] Opção de ordenar por data (mais antiga e mais recente)
- [x] Campo de busca pontual para pesquisar dentro de cada semana
- [x] Aplicar filtros em todas as 8 semanas exibidas + card Vencidas

## Coluna Vendedor na tabela Clientes Inadimplentes (16/03/2026)
- [x] Investigar dados de vendedor: sales_orders local (362/1147 com representante) + GraphQL pedidosDeVenda (654 pedidos, 251 mapeamentos)
- [x] Buscar vendedor via GraphQL do Maxiprod (pedidosDeVenda) com cache de 10 min + fallback local
- [x] Mapeamento cliente->vendedor: 33/80 clientes inadimplentes com vendedor (47 sem vendedor no Maxiprod)
- [x] Coluna "Vendedor" adicionada na tabela (entre Cliente e Valor Total) com ordenação e busca
- [x] Testado com dados reais: JUVENAL TEIXEIRA, PEDRO AUGUSTO, JORDAO LAINE, CLARINDO, Daniel Da Conceição Tavares, ROMERA

## Investigação: Clientes inadimplentes sem vendedor (16/03/2026)
- [x] Consultar GraphQL do Maxiprod para cada cliente sem vendedor (exceto Johnson e Keure)
- [x] Determinar se o campo vendedor está vazio no Maxiprod ou se a Manus não puxou corretamente → TODOS são erro de preenchimento no Maxiprod
- [x] Gerar relatório detalhado com diagnóstico por cliente (25 com pedidos sem vendedor, 19 sem pedidos, 1 sem nome)

## Buscar campo "responsável" dos pedidos de venda no Maxiprod (16/03/2026)
- [x] Explorar campos adicionais: responsavelUsuario, representanteOuVendedor2/3, gestor, criacaoUsuario
- [x] Buscar responsável de cada cliente: responsavelUsuario.nome funciona como fallback (556 mapeamentos vs 251 antes)
- [x] Atualizar backend: query GraphQL agora busca responsavelUsuario { nome } como fallback
- [x] Resultado: 62/80 clientes com vendedor (77.5%). 17 restantes sem pedido/NF/vendedor preferencial no Maxiprod

## Corrigir total "A Receber" (16/03/2026)
- [x] Filtrar A Receber para mostrar apenas tipos: TITULO, RECEITA, ADIANTAMENTO (excluir TITULO_PEDIDO_DE_VENDA e TITULO_PROPOSTA_DE_VENDA)
- [x] Atualizar todas as queries: getSummary, getReceivableCalendar, getMonthlyBreakdown, getClientesInadimplentes, getContasAReceber, getAgingReport, getCashFlowChart, getTopClientes, getInadimplenciaDetail
- [x] Total A Receber: R$ 2.645.534,04 (antes R$ 4.414.624,64) - filtro aplicado com sucesso

## Divergência valores março A Receber (16/03/2026)
- [x] Investigar: breakdown mensal mostrava mês inteiro (01/03-31/03) vs card mensal (16/03-31/03 a partir de hoje)
- [x] Corrigir: getMonthlyBreakdown agora usa hoje como início para o mês corrente → ambos mostram R$ 669.015,82 (154 títulos)

## Usar "valor líquido" no A Receber (16/03/2026)
- [x] Analisar planilha CSV do Maxiprod para identificar campo "valor líquido" (coluna AO = R$ 2.579.814,98)
- [x] Fórmula correta: valorAReceber = valorLiquido - valorRecebidoLiquido (desconta pagamentos parciais)
- [x] Atualizar TODAS as queries de A Receber (getSummary, getMonthlyBreakdown, getContasAReceber, getAgingReport, getReceivableCalendar, getCashFlowChart, getInadimplenciaTimeline, getClientesInadimplentes, getInadimplenciaDetalhesMes, getTopClientes)
- [x] Testes passando: 10/10 testes de valorAReceber + 24 testes financeiros existentes
- [x] Total A Receber confirmado: R$ 2.579.814,98 ✓ (bate com Maxiprod)

## Corte de inadimplência: 1 dia útil anterior (16/03/2026)
- [x] Ajustar corte de vencidos/inadimplência para considerar vencido somente até 1 dia útil antes de hoje
- [x] Função getPreviousBusinessDay(): Seg→Sex(-3), Dom→Sex(-2), demais→dia anterior(-1)
- [x] Atualizar getSummary, getReceivableCalendar, getCashFlowChart, getInadimplenciaTimeline, getClientesInadimplentes, getInadimplenciaDetalhesMes, getAgingReport, topInadimplentes

## Contas a Pagar: usar valor líquido (16/03/2026)
- [x] Aplicar mesma lógica do A Receber no A Pagar: valorAPagar = valorLiquido - valorPagoLiquido
- [x] Atualizar TODAS as queries: getSummary, getMonthlyBreakdown, getContasAPagar, getTopFornecedores, getCashFlowChart, getPaymentCalendar
- [x] Corrigir paginação GraphQL (remover ORDER BY que causava overlap de 8 registros)
- [x] Total A Pagar validado: R$ 11.985.872,83 ✓ (1669 registros, bate com Maxiprod)
- [x] Fórmula travada - não alterar

## Reestruturação Estoque: 3 Grupos com Subgrupos e Filtros (16/03/2026)
- [ ] Investigar API GraphQL para entender campos de grupo/subgrupo dos itens de estoque
- [ ] Mapear grupos do Maxiprod: Grupo 12 (IMPORTAÇÃO-REVENDA) → Subgrupo 20 (BAMBU), 21 (FIBRA)
- [ ] Mapear grupos do Maxiprod: Grupo 05 (BAMBU) → Sub 06,07,08,14; Grupo 09 (FIBRA)
- [ ] Grupo 1: Industrialização (Madeira, Serragem, Rojão) - aguardando dados do Fernando
- [ ] Grupo 2: Importação de Matéria Prima (Madeira, Serragem, Rojão) - aguardando dados do Fernando
- [ ] Grupo 3: Importação de Produtos Prontos/Revenda (Bambu, Fibra) - implementar primeiro
- [ ] Implementar backend: queries GraphQL por grupo/subgrupo
- [ ] Implementar frontend: filtros por grupo e subgrupo no dashboard de estoque
- [ ] Testar e validar dados em tempo real

## Saldos Bancários Automáticos via Balancete Contábil (16/03/2026)
- [x] Investigar API GraphQL do Maxiprod para balancete contábil (contasContabeis + lancamentosContabeis)
- [x] Mapear 14 contas bancárias: BB Mesa, CEF Palitos/Varetas/Espetos, Bradesco Espetos/Palitos/Varetas, Sicoob Espetos/Varetas/Palitos/Mesa, Sicredi Palitos/Espetos/Varetas
- [x] Função syncBankBalances: busca contas 1.01.01.02.*, calcula saldoInicial + debitos - creditos
- [x] Preencher automaticamente saldos na aba Configurações > Banco com botão "Atualizar Saldos"
- [x] Agrupamento por empresa (Palitos, Varetas, Espetos, Mesa, Outros)
- [x] Total validado: R$ 102.972,44 ✓ (bate com Maxiprod balancete)

## Ajuste Layout Saldos Bancários (16/03/2026)
- [x] Exibir 14 contas no formato "Banco + Empresa" conforme balancete do Maxiprod
- [x] Remover agrupamento por empresa, listar contas individualmente ordenadas por código
- [x] Função gerarNomeConta: simplifica nomes ("Banco Cooperativo Sicredi S.A." → "Sicredi")

## Bug: Saldo Bradesco Espetos incorreto (16/03/2026)
- [x] Diagnosticar: bug na linha saldoContabil !== 0 (saldo zero caía no fallback OFX)
- [x] Corrigir: usar saldoContabilAtualizadoEm para detectar se tem saldo contábil (zero é válido!)
- [x] Bradesco Espetos agora mostra R$ 0,00 ✓ (bate com Maxiprod)
- [x] Sync automática: saldos bancários sincronizados junto com sync geral (a cada 5 min)

## Filtro Estoque: Grupos 20 e 21 (16/03/2026)
- [x] Manter espelho fiel (todos os itens) com filtros por grupo/subgrupo
- [x] Filtros: Grupo (Bambu MP, Importação-Revenda, Industrialização) e Subgrupo (Varetas, Espetos, Palitos, etc.)
- [x] Grupos 20 (BAMBU) e 21 (FIBRA) do super grupo 12 (IMPORTAÇÃO - REVENDA) acessíveis via filtro

## Reestruturação do Estoque - Grupos e Subgrupos Hierárquicos
- [x] Criar 3 grupos maiores: Industrialização (roxo), Importação MP, Importação Revenda
- [x] Subgrupos Industrialização: Madeira (c/ variações Varetas/Espetos/Palitos), Serragem, Rojão
- [x] Subgrupos Importação MP: Madeira Importada
- [x] Subgrupos Importação Revenda: Bambu, Fibra
- [x] Filtros hierárquicos: subgrupo só aparece após selecionar grupo
- [x] Subgrupo Madeira com seleção de variações (Varetas, Espetos, Palitos)
- [x] Mapear itens do Maxiprod para grupos/subgrupos (SG:05→Industrialização, SG:16 G:18/19→Import. MP, SG:12→Revenda)
- [x] Agrupar visualmente itens por grupo/subgrupo (não misturar)
- [x] Puxar estoque atual e real do Maxiprod
- [x] Métricas adaptativas: cx para caixas, m3 para madeira importada
- [x] Desocultar 12 itens de madeira importada (SG:16 G:18/19)
- [x] Excluir itens de embalagem (SG:16 G:24) do dashboard
- [x] Testes vitest para lógica de classificação de grupos (19 testes)

## Vendedores na Aba Inadimplentes (17/03/2026)
- [x] Identificar vendedor responsável por cada cliente a partir dos pedidos de venda do Maxiprod
- [x] Excluir Brenda e Larissa da lista de vendedores (são editoras, não vendedoras)
- [x] Preencher manualmente Johnson e Keure como "Grupo Fox"
- [x] Adicionar coluna "Vendedor" na tabela de clientes inadimplentes
- [x] Implementar filtro por vendedor (dropdown/seletor) na aba inadimplentes
- [x] Testes vitest para lógica de mapeamento cliente→vendedor (18 testes passando)

## Regras de Fallback Vendedores Inadimplentes (17/03/2026)
- [x] Clientes sem vendedor + produto madeira → JORDAO
- [x] Clientes sem vendedor + produto bambu → JUVENAL TEIXEIRA
- [x] Filtro de vendedores atualiza automaticamente com novos vendedores do Maxiprod
- [x] Adicionar GILSON ao filtro de vendedores
- [x] Testes vitest para novas regras de fallback (17 testes)

## Correções 17/03/2026 (manhã)
- [x] Faturamento: filtrar apenas pedidos "A aprovar" e "Aprovados" (excluir "Em digitação") - campo estadoNota adicionado
- [x] Estoque: restaurar abas Estoque / Produtos sob Encomenda / Outros - restaurado do checkpoint 17647be
- [x] NÃO MEXER na aba Financeiro/Inadimplentes - confirmado
- [x] Testes vitest para filtro de Digitação (10 testes passando)

## Reorganização Estoque - Importação Revenda (17/03)
- [x] Sincronizar dados atualizados do Maxiprod (63 estoque, 167 pedidos, 67 POs)
- [x] Mover códigos 00011, 00028, 00030, 00031, 00065, 00198, 00199 para aba "Sob Encomenda" (00029 não existe no estoque)
- [x] Não duplicar itens entre abas Estoque e Sob Encomenda
- [x] NÃO mexer em Industrializados nem Importação de Matéria-Prima

## Divergência Estoque 141cx (17/03)
- [ ] Investigar divergência: Maxiprod 20.853 cx vs Dashboard 20.712 cx (141 cx diferença)
- [ ] Comparar item a item dados do banco local vs GraphQL

## Grupo Revenda + Subgrupos Bambu/Fibra (17/03)
- [x] Criar grupo "Importação de Produtos Prontos (Revenda)" como filtro no Estoque
- [x] Criar subgrupos Bambu e Fibra como filtro secundário
- [x] Reclassificar itens: SG:12 G:20→Revenda/Bambu, SG:12 G:21→Revenda/Fibra (auto por superGrupoCodigo/grupoCodigo)
- [x] Auto-classificar: nome com bambu → Subgrupo Bambu, nome com fibra → Subgrupo Fibra
- [x] Filtros hierárquicos: Grupo → Subgrupo (subgrupo só aparece ao selecionar grupo)
- [x] Senhas: configurações já desabilitadas (bypass), faturamento mantida
- [x] Testes vitest para classificação grupo/subgrupo (16 testes passando)

## Grupos Industrializado + Importação MP (17/03)
- [x] Criar grupo Industrializado (cor roxa) no filtro do Estoque
- [x] Subgrupos Industrializado: Madeira, Serragem, Rojão
- [x] Itens de madeira em m³ (SG:16 G:18/19) → Grupo Industrializado / Subgrupo Madeira
- [x] Criar grupo Importação de Matéria-Prima (cor amarela) no filtro
- [x] Subgrupo Importação MP: Madeira (sem alimentar por enquanto)
- [x] Filtros hierárquicos: subgrupo só aparece ao selecionar grupo correto
- [x] Testes vitest (257 testes passando em 25 arquivos)

## Correção Fonte de Dados Estoque (17/03/2026)
- [x] Alterar fetchStock para usar query 'estoques' com tipo=NORMAL e filtro dentro do grupo 12
- [x] Garantir que quantidades batam exatamente com a tela de Estoque do Maxiprod (filtro Dentro do grupo 12)
- [x] Resolver duplicação de quantidades usando query 'estoques' tipo=NORMAL (não mais estoquesAgrupados)
- [x] Classificar como grupo "Produtos Importados Prontos (Revenda)" com subgrupos Bambu e Fibra
- [x] Verificar quantidades no browser após sincronização (todos os itens verificados batem 100%)
- [x] Rodar testes vitest (257 testes passando em 25 arquivos)

## Sistema de 3 Filtros Hierárquicos no Estoque (17/03/2026)
- [x] Filtro 1 - Grupo: Industrializados, Produtos Importados Prontos (Revenda), Importação Matéria-Prima
- [x] Filtro 2 - Subgrupo (estado configurável Maxiprod): Bambu/Fibra (Revenda), Madeira/Madeira Contabilizado (Importação MP), Madeira Importação (Industrializados)
- [x] Filtro 3 - Segmento CRM do cliente: DISTRIBUIDORA, INDÚSTRIA, LOJA, LATICÍNIO, FOGOS, SERRAGEM, EXPORTAÇÃO
- [x] Investigar campo "estado configurável" na API GraphQL do Maxiprod
- [x] Puxar crmSegmento das empresas/clientes vinculados aos pedidos de venda
- [x] Alterar stockProcessor para classificar itens nos 3 grupos com subgrupos corretos
- [x] Implementar filtros hierárquicos no frontend (grupo → subgrupo → segmento)
- [x] Vincular segmento CRM aos itens via pedidos de venda
- [x] Testes vitest para nova lógica (257 testes passando em 25 arquivos)

## Reestruturação Subgrupos (17/03/2026)
- [x] Industrialização: remover subgrupos antigos (Rojão, Serragem, Madeira Importação)
- [x] Industrialização: criar subgrupos Madeira e Madeira Contabilizado (baseado no estadoConfiguravel do pedido)
- [x] Industrialização: dentro de cada subgrupo, filtro de Segmento CRM (INDÚSTRIA, EXPORTAÇÃO, LOJA, etc.)
- [x] Importação Matéria-Prima: criar subgrupo "Madeira Importada" (sem alimentação, apenas estrutura)
- [x] Manter hierarquia grupo→subgrupo→segmento CRM
- [x] Testes vitest (257 testes passando em 25 arquivos)

## Alterações Estoque + Vendas (17/03/2026 - Parte 2)
- [x] Importação MP / Madeira Importada: linkar com POs de madeira que estão para chegar
- [ ] Industrializados: remover subgrupo Madeira Contabilizado, deixar APENAS Madeira
- [ ] Estoque: adicionar filtro de Segmento CRM (DISTRIBUIDORA, INDÚSTRIA, LOJA, etc.) que estava faltando
- [x] Aba Vendas: implementar filtros hierárquicos grupo→subgrupo→segmento CRM
- [x] Aba Vendas: Industrialização/Madeira deve mostrar vendas discriminadas por segmento do cliente
- [x] Testes vitest (277 testes passando em 26 arquivos)

## PO Madeira Importada (17/03/2026)
- [x] Incluir PO de madeira importada (ESPETO DE MADEIRA 3.8x200mm, 900cx, código 00335) na coluna PO do dashboard de Estoque
- [x] Garantir que POs de madeira importada apareçam na seção Import. Matéria-Prima → Madeira Importada
- [x] Testes vitest (291 testes passando em 26 arquivos)

## Remoção de Senhas - Configurações (17/03/2026)
- [x] Remover autenticação/senhas da página de Configurações para acesso livre

## Card de Conciliação Diária - Aba Financeiro (17/03/2026)
- [x] Criar card independente de Conciliação da Semana abaixo da primeira semana
- [x] Incluir 5 sub-cards (um para cada dia útil da semana) dentro do card principal
- [x] Persistir dados de conciliação no banco de dados
- [x] Testes vitest para conciliação (14 testes passando)

## Reformulação Card Conciliação - Autorização de Pagamento (17/03/2026)
- [x] Reformular card de Conciliação: mostrar contas a pagar listadas por dia da semana
- [x] Checkbox de autorização de pagamento em cada conta (somente Fernando marca)
- [x] Contas autorizadas ficam visíveis para o financeiro executar
- [x] Schema no banco para persistir autorizações por conta/dia
- [x] Backend: procedures para listar contas por dia e toggle de autorização
- [x] Frontend: card com 5 dias (seg-sex), cada dia com lista de contas e checkbox
- [x] Testes vitest para autorização de pagamento (18 testes passando)

## Ajuste Card Autorização de Pagamentos (17/03/2026)
- [x] Dias colapsados por padrão (expandir ao clicar)
- [x] Dias passados desaparecem automaticamente

## Visual Card Autorização (17/03/2026)
- [x] Saldo bancário do dia no header do card
- [x] Soma dos valores autorizados ao lado do saldo
- [x] Conta autorizada: fundo verde sem line-through, com ícone de autorizado ao lado do nome

## Ajuste Header DayCard (17/03/2026)
- [x] Saldo bancário em verde no topo do card do dia (esquerda)
- [x] Soma autorizada em vermelho ao lado do verde (meio)
- [x] Total do dia em azul à direita

## Ajuste Visual Tamanhos (17/03/2026)
- [x] Números maiores no header de cada dia
- [x] Verde mais forte nas contas autorizadas
- [x] Ícone de check bem maior nas contas autorizadas

## Subgrupo Máquina de Espetinho (18/03/2026)
- [x] Mover MÁQUINA DE ESPETINHO para grupo importacao_revenda com subgrupo maquina_espetinho
- [x] Adicionar subgrupo maquina_espetinho ao tipo ProcessedItem
- [x] Atualizar classifyGrupoFromDesc para classificar MÁQUINA DE ESPETINHO
- [x] Atualizar frontend para exibir o novo subgrupo

## Eliminar aba Outros (18/03/2026)
- [x] Investigar os 25 produtos em Outros e entender classificação atual
- [x] Sob Encomenda: códigos 00011, 00028, 00029, 00030, 00031, 00198, 00199, 00065
- [x] Demais produtos do grupo 20/21 (SG 12) vão para Estoque
- [x] Eliminar seção Outros do dashboard
- [x] Atualizar testes (324 testes passando)

## Integração Vendas com Classificações (18/03/2026)
- [x] Aba Vendas: filtros hierárquicos já implementados (Grupo, Subgrupo, Segmento CRM)
- [x] Aba Vendas: Industrializados já aparecendo nas vendas
- [x] Aba Vendas: melhorar layout visual - KPI principal grande, 3 cards de status, tabela de detalhamento por segmento
- [x] Testes vitest passando (324/325, 1 timeout pré-existente)

## Refatoração Configurações > Produtos (18/03/2026)
- [x] Renomear coluna "Segmento" para "Grupo" com opções: Importação (Revenda), Importação Matéria Prima, Industrializados
- [x] Renomear bolinha verde para "Em Estoque" e amarela para "Sob Encomenda" com labels visíveis
- [x] Remover bolinha cinza (terceira opção)
- [x] Manter opção de marcação manual e automática na coluna "A"
- [x] R$/CX: calcular média das últimas 5 vendas do Maxiprod, com opção manual para produtos novos
- [x] VD. MENSAL: tornar editável para vendedor estimar demanda
- [x] Fator: manter 2,3 como padrão mas tornar editável
- [x] Nova coluna Alerta: Fator × Estoque Atual ≤ VD. MENSAL → alerta de reposição
- [x] Testes vitest passando (324/325, 1 timeout pré-existente em valorAReceber)
- [x] Config Produtos: tornar "s/ preço" clicável/editável para inserção manual de preço
- [x] Config Produtos: ordenar produtos por semelhança (nome/medida agrupados)
- [x] Config Produtos: auto-classificar 75 produtos como "Em Estoque" (verde) baseado na aba Estoque
- [x] Config Produtos: auto-classificar 8 produtos como "Sob Encomenda" (amarelo) baseado na aba Sob Encomenda
- [x] Config Produtos: manter classificações editáveis após auto-preenchimento
- [x] Investigar produto faltando: VARETA PARA ALGODÃO DOCE BAMBU 40X40MM - NÃO EXISTE NO MAXIPROD (cancelado)
- [x] Corrigir descrições dos 3 espetos PALITIM - MANTER COMO MAXIPROD (cancelado pelo usuário)
- [x] Verificar se erro vem do Maxiprod ou do dashboard - ERRO VEM DO MAXIPROD, manter espelho fiel
- [x] VARETA DE APITO BAMBU 3,0 X 350 MM PCT 20KG: mudar unidade para KG na aba Configurações
- [x] Aba Vendas: excluir pedidos "em digitação" do Maxiprod - SOIN #501/#502 removidos (estadoNotaPedido=Digitação), SC JOHNSON MEXICO #155 mantido (Aprovado)
- [x] Aplicar filtro de exclusão "em digitação" em TODAS as abas/seções: salesRouter, billingRouter, financialRouter, routers.ts (getAvgSalesPrices). 335 testes passando.
- [ ] Investigar e corrigir grupo "Outros" com R$ 27.909,28 no detalhamento por segmento da aba Vendas
- [ ] Vendas: mover CANCELADO, AMOSTRA/BONIFICAÇÃO, GILSON e NULL para subgrupo "Outros"
- [ ] Estoque: corrigir para mostrar apenas ~14.000 cx de produtos importados (Bambu/Fibra) do estoque real
- [ ] Estoque: garantir que não está puxando de pedidos de venda, apenas do estoque do Maxiprod
- [ ] Estoque: verificar se POs atualizadas estão refletidas corretamente
- [ ] Estoque: investigar discrepância 14.012 cx (Maxiprod) vs 13.862 cx (dashboard) - 150 cx faltando
- [ ] Estoque: investigar 182 itens (Maxiprod) vs 83 itens (dashboard) - 99 itens faltando

## Correção: Conversão UN→CX usando fator oficial do Maxiprod (18/03/2026)
- [x] Investigar discrepância de 150 caixas (dashboard 13.862 vs Maxiprod 14.012)
- [x] Identificar causa raiz: 3 itens com fator de conversão incorreto (00058, 00061, 00063)
- [x] Adicionar campo unidadeDeVendaFator ao schema stock_items
- [x] Migrar banco de dados com novo campo
- [x] Modificar transformStockData para salvar unidadeDeVendaFatorDeConversao do Maxiprod
- [x] Modificar processStockData para priorizar fator do Maxiprod sobre extração da descrição
- [x] Re-sincronizar dados e verificar total: 14.012 cx (bate 100% com Maxiprod)
- [x] Criar testes unitários para validar lógica de conversão (6 testes passando)
- [x] Todos os 341 testes passando

## Ocultar item AMOSTRA-TESTE (18/03/2026)
- [x] Ocultar item 00003A (AMOSTRA-TESTE ESPETO DE BAMBU) do dashboard de estoque

## Melhorias Vendas e Reposição (18/03/2026)
- [x] Aba Vendas: adicionar seta/dropdown no item "Outros" para mostrar detalhamento dos valores
- [x] Config Produtos: refazer lógica de reposição - Consumo no lead time = Venda mensal × Fator
- [x] Config Produtos: se Estoque atual < Consumo no lead time → Precisa pedir
- [x] Config Produtos: mostrar quantidade a pedir = Consumo no lead time - Estoque atual

## Vendedores Inadimplência + Estabilidade Sync (18/03/2026)
- [x] Identificar clientes sem vendedor na aba de inadimplência (21 clientes - não estão no Kommo nem no Maxiprod)
- [x] Puxar vendedores pelo responsável do pedido de venda no Maxiprod (apenas 4 com pedidos, sem vendedor cadastrado)
- [x] Complementar vendedores faltantes via Kommo (clientes não cadastrados no CRM - aguardando Fernando)
- [x] Investigar variações bruscas no Contas a Pagar/Receber (causa: DELETE ALL + RE-INSERT sem transação)
- [x] Garantir consistência: transação atômica em TODAS as tabelas + validação de volume mínimo (50%)

## Preço da Mercadoria - Média Últimas 5 Vendas (18/03/2026)
- [x] Puxar preço médio das últimas 5 vendas do Maxiprod para produtos que já venderam (já estava funcionando)
- [x] Manter preço manual para produtos que nunca venderam (já estava funcionando)
- [x] Exibir "s/ preço" apenas quando não há vendas E não há preço manual (já estava funcionando)

## Coluna PRODUTO - Largura e Redimensionamento (19/03/2026)
- [x] Aumentar largura padrão da coluna PRODUTO para mostrar nome completo
- [x] Adicionar redimensionamento manual (arrastar borda da coluna)

## Correção Sobreposição Colunas GRUPO/ESTOQUE (19/03/2026)
- [x] Corrigir sobreposição entre colunas GRUPO e ESTOQUE na tabela de estoque
- [x] Manter coluna PRODUTO larga e redimensionável

## Valorização de Produtos com PO (19/03/2026)
- [ ] Investigar por que produtos com PO não estão sendo valorizados
- [ ] Corrigir lógica para que todos os produtos com PO entrem no valor projetado
- [ ] Garantir que valorização use preço médio das últimas 5 vendas (ou preço manual)

## Preços Manuais para Produtos com PO sem Preço (19/03/2026)
- [x] Inserir preços manuais factíveis para 12 produtos com PO que não têm preço
- [x] Basear preços em produtos similares que já vendem
- [x] Valorização agora 81/81 (100%) com preço - VLR PROJETADO: R$ 6.338.674,30

## Coluna PRODUTO - Nome Completo na Valorização (19/03/2026)
- [x] Mostrar nome completo do produto quando Valorização está ativa
- [x] Manter demais colunas bem claras para leitura

## Investigação: 1 Caixa a Menos no Dashboard vs Maxiprod (19/03/2026)
- [ ] Investigar qual produto tem 1 caixa a menos no dashboard comparado ao Maxiprod
- [ ] Identificar causa raiz (arredondamento, conversão un/cx, sync)

## Valores Negativos de PO na Valorização (19/03/2026)
- [ ] Investigar por que existem valores negativos de PO na valorização do estoque
- [ ] POs que não chegaram não devem gerar valores negativos
- [ ] Corrigir lógica de cálculo do Vlr PO

## Card Estoque Total Expansível com Detalhamento (19/03/2026)
- [ ] Incluir detalhamento do card Disponível dentro do card Estoque Total
- [ ] Adicionar botão expandir/diminuir para ver resultado detalhado
- [ ] Mostrar cálculo: Estoque Total - Pedidos = Disponível

## Sistema Produto Pai com Variações (19/03/2026)
- [x] Criar tabela product_variants no banco (parentCode, childCode, conversionFactor)
- [x] Configurar 00001 como pai, 00002 (fator 0.5) e 00242 (fator 0.15) como variações
- [x] Backend: calcular disponível do pai descontando pedidos das variações proporcionalmente
- [x] Frontend: variações ocultas por padrão, ícone (+) para expandir sub-linhas
- [x] Tela de configuração para gerenciar relações pai/variação
- [x] Testes vitest para variações (352 testes passando)

## Variação: 00009 como Pai de 00008, 00273, 00007 (19/03/2026)
- [x] Verificar unidades por caixa dos 4 produtos (00009=5000, 00008=8000, 00273Z=5000, 00007=5000)
- [x] Inserir relações pai/variação no banco (00008=1.6x, 00273Z=1.0x, 00007=1.0x)

## Pedidos Detalhados no Produto Pai (19/03/2026)
- [x] Mostrar composição dos pedidos no produto pai: quantos do pai + quantos de cada variação
- [x] Aplicar regra sempre que houver produto pai com variações
- [x] Backend: agregar pedidos das variações no pedidosPorCliente do pai
- [x] Frontend: tooltip mostra composição (próprio + cada variação) com clientes detalhados

## Investigação: Pedido 437 não desconta do estoque (19/03/2026)
- [x] Verificar código do produto no pedido 437 após mudança para Tropical (00007TR)
- [x] Verificar se o código do produto existe no stock_items (não existia, era PO-only)
- [x] Corrigir mapeamento: stockProcessor agora cruza pedidos de venda com itens PO-only

## Pedidos de Venda em Itens PO-Only (19/03/2026)
- [x] Cruzar pedidos de venda com itens que só existem em PO (sem estoque)
- [x] 00007TR agora aparece na seção Estoque com 700 cx pedidos e 700 cx PO

## Produto 00058 - Unidade em Kg (19/03/2026)
- [x] Mostrar "kg" em vez de "cx" para o produto 00058 em todas as colunas do dashboard

## Agrupamento 00013 pai com variações (19/03/2026)
- [x] Configurar 00013 como pai com variações 00012, 00013R e 00014 (mesmo padrão dos outros agrupamentos)

## Agrupamento 00017 pai com variações (19/03/2026)
- [x] Configurar 00017 como pai com variações 00015, 00016, 00241 e 00250

## Agrupamento 00021 pai com variações (19/03/2026)
- [x] Configurar 00021 como pai com variações 00145 e 00022

## Agrupamento 00018 pai com variação (19/03/2026)
- [x] Configurar 00018 como pai com variação 00023

## Mover produtos para Sob Encomenda (19/03/2026)
- [x] Mover 00262, 00244 e 00007TR para classificação "Sob Encomenda"

## Mover produtos para Sob Encomenda (19/03/2026 - lote 2)
- [x] Mover 00362, 00063, 00062, 00061, 00054, 00045, 00044 para "Sob Encomenda"

## Agrupamento Palitos de Manicure (19/03/2026)
- [x] Duas Pontas 4,0x125: pai 00036, variação 00034
- [x] Duas Pontas 5,0x140: pai 00037, variações 00038, 00253
- [x] Duas Pontas 5,0x160: pai 00040, variação 00041
- [x] Duas Pontas 5,0x180: pai 00045, variação 00044
- [x] Ponta/Chanfro 4,0x125: pai 00046, variações 00047, 00050
- [x] Ponta/Chanfro 5,0x140: pai 00051, variação 00252

## Contagem de itens (19/03/2026)
- [x] Contagem de itens no dashboard deve contar apenas pais, excluindo variações filhas

## Ordenação por comprimento (19/03/2026)
- [x] Organizar lista de produtos por comprimento (número depois do X na medida) como ordenação padrão

## Agrupamentos 00033 e 00148 (19/03/2026)
- [x] Pai 00033, variação 00213
- [x] Pai 00148, variação 00139

## Agrupamento 00024 (19/03/2026)
- [x] Pai 00024, variação 00025

## Correção agrupamento 00023 (19/03/2026)
- [x] Desfazer agrupamento do 00023 como variação (remover da tabela product_variants)

## Mover 00148 para Sob Encomenda (19/03/2026)
- [x] Mover 00148 para classificação "Sob Encomenda"

## Agrupamento 00018/00131 (19/03/2026)
- [x] Pai 00018, variação 00131

## Agrupamento 00024/00023 (19/03/2026)
- [x] Pai 00024, variação 00023

## Mover 00136 para Sob Encomenda (19/03/2026)
- [x] Mover 00136 para classificação "Sob Encomenda"

## Agrupamento 00029/00136 (19/03/2026)
- [x] Pai 00029, variação 00136

## Zerar estoque regulador sob encomenda (19/03/2026)
- [x] Zerar estoque regulador de todos os produtos classificados como Sob Encomenda

## 00065 voltar para Estoque + agrupamento (19/03/2026)
- [x] Mover 00065 de volta para classificação "estoque"
- [x] Pai 00065, variação 00066

## Corrigir alertas (19/03/2026)
- [x] Card de alertas deve contar apenas produtos de Estoque, nunca de Sob Encomenda

## Corrigir KPI Alertas (19/03/2026)
- [x] KPI de Alertas deve contar apenas alertas do card Estoque, não de Sob Encomenda

## Reorganizar cards da aba Vendas (20/03/2026)
- [x] Remover card "A Faturar (Anterior)" dos 3 cards de status
- [x] Incluir cards "Faturado" e "A Faturar" dentro do card principal "Valor Total do Período"
- [x] Layout horizontal: Valor Total à esquerda, Faturado e A Faturar à direita no mesmo card
- [x] Remover opção "Outros" do seletor de grupos na aba Vendas
- [x] Excluir pedidos com estadoConfiguravel CANCELADO, AMOSTRA/BONIFICAÇÃO, GILSON e NULL dos cálculos de vendas
- [x] Remover segmento "Outros" completamente da tabela de detalhamento por segmento
- [x] Inverter posição: Evolução Diária acima de Pedidos na aba Vendas
- [x] Renomear card Pedidos para "Pedidos Faturados" e filtrar só faturados
- [x] Criar novo card "A Faturar Mês Atual" abaixo com pedidos a faturar do período
- [x] Replicar modelo de detalhes de pedido da aba Faturamento na aba Vendas (mesmo layout ao expandir pedido)
- [x] Adicionar código do produto abaixo de cada item nos pedidos da aba Vendas (mesmo modelo do estoque)
- [x] Adicionar código do produto abaixo de cada item nos pedidos da aba Faturamento (mesmo modelo do estoque)
- [x] Verificar se os produtos dos pedidos são idênticos aos do estoque
- [x] Padronizar linha resumida dos pedidos na aba Vendas com mesma ordem/informações da aba Faturamento (UF, Emissão, Entrega)
- [x] Corrigir alinhamento das colunas com os títulos nos cards de pedidos (aba Vendas e Faturamento)
- [x] Coluna Entrega: remover símbolo/ícone de alerta
- [x] Coluna Entrega: remover cor vermelha de fundo
- [x] Coluna Entrega: lembrete sutil apenas para vencidos NÃO faturados
- [x] Coluna Entrega: aumentar tamanho dos números para melhor visibilidade
- [x] Aplicar mudanças na aba Vendas e na aba Faturamento
- [x] Adicionar ordenação (sort) na coluna Entrega nos cards de pedidos (aba Vendas e Faturamento)
- [x] Mover 3 seletores (Período, Empresa, Grupo) para acima do primeiro card, abaixo da data, bem destacados
- [x] Quando grupo selecionado, tabela Detalhamento mostra breakdown por CRM ao invés de por grupo
- [x] Remover coluna A Fat. Anterior da tabela de detalhamento por segmento/CRM na aba Vendas
- [x] Conectar filtros de Grupo e CRM da aba Vendas aos cards de Inadimplência (filtrar automaticamente)
- [x] Aumentar destaque visual do texto do período/mês na aba Vendas (letras maiores, mais visível)
- [x] Card A Faturar Anterior: mudar cor para mesma do A Faturar Mês Atual
- [x] Cards Inadimplência: mudar para tom de vermelho mais forte
- [x] Adicionar tom de preenchimento (background color) nos últimos 6 cards da aba Vendas
- [x] Aumentar tamanho do popup/tooltip de pedidos na aba Estoque (hover sobre número de caixas vendidas)
- [x] Remover seção "Composição dos Pedidos" (códigos e fator de conversão) do tooltip de pedidos na aba Estoque
- [x] Tooltip pedidos: remover palavra "Clientes", código e "próprio" dos títulos, mostrar medida/descrição do produto
- [x] Corrigir overflow da coluna Grupo na tabela de estoque (texto sobrepondo números adjacentes, ex: produto 00335)
- [x] Corrigir texto cortado no seletor de grupo quando "Produtos Importados" está selecionado
- [x] Adicionar botão mostrar/ocultar valores monetários na aba Faturamento (igual aba Vendas, para produção não ver valores)
- [x] Mover botão ocultar valores para cima dos cards (lado direito), fora do TopNav
- [x] Valores ocultos devem desaparecer completamente (sem R$ •••••, sem nenhum sinal)
- [x] Remover KPI cards "Faturado Parcial" e "Total Geral" da aba Faturamento
- [x] Alterar card "Faturado (30 dias)" para "Faturado (Mês Corrente)" - filtrar apenas pedidos faturados no mês atual
- [x] Melhorar estética da aba Faturamento com valores ocultos: aumentar letras, ajustar layout para ficar equilibrado
- [x] Criar card "Aceite da Produção" na aba Faturamento acima dos pedidos em aberto
- [x] Card com 3 grupos (Revenda, Industrializados, Matéria-Prima) como na aba Vendas
- [x] Pedidos aprovados caem automaticamente no card de aceite
- [x] Produção dá aceite e pedido passa para card Pedidos em Aberto
- [x] Criar tabela no banco para registrar aceites da produção
- [x] Endpoints para listar pendentes de aceite e registrar aceite
- [x] BUG: Card Pedidos em Aberto foi substituído pelo Aceite da Produção - devem coexistir. Pedidos em Aberto deve mostrar TODOS os pedidos abertos (não apenas aceitos)
- [x] BUG: Classificação de grupos na aba Faturamento não está correta - deve usar mesma lógica da aba Vendas
- [x] Extrair função de classificação de grupos para módulo compartilhado (shared) para garantir consistência entre abas
- [x] Aplicar classificação correta em todos os cards da aba Faturamento (Aceite, Pedidos em Aberto, Autorizado, Faturados)
- [x] Remover filtro isOutros da aba Faturamento - AMOSTRA e BONIFICAÇÃO devem aparecer para a produção (manter apenas filtro de Digitação)
- [x] Aba Faturamento: filtrar apenas pedidos APROVADOS (excluir "A aprovar" além de "Digitação")
- [x] Badges visuais AMOSTRA e BONIFICAÇÃO em TODOS os cards da aba Faturamento (Aceite, Pedidos em Aberto, Autorizado, Faturados)

## Detalhes Completos do Pedido na Aba Faturamento (21/03/2026)
- [x] Levantar todos os campos disponíveis na API GraphQL do Maxiprod para itens de pedido
- [x] Backend: puxar todos os campos detalhados dos itens (código, descrição completa, medida, unidade, observações)
- [x] Frontend: redesenhar layout expandido do pedido com TODOS os detalhes para a produção
- [x] Incluir: dados do cliente (razão social, endereço completo, IE, CNPJ, telefone, email)
- [x] Incluir: dados de entrega (transportadora, condição de pagamento, prazo)
- [x] Incluir: cada item com código, NCM, grupo, descrição completa, medida, quantidade, unidade
- [x] Investigar e incluir observações do pedido da API GraphQL do Maxiprod (campo observacoes encontrado e implementado)
- [x] Layout otimizado para impressão/leitura pela produção (2 colunas: Cliente + Logística + Endereço + Itens)
- [x] Testes vitest para novos campos (41 testes passando)
- [x] Aceite da Produção: separar pedidos normais de AMOSTRA/BONIFICAÇÃO dentro de cada grupo (Revenda, Industrializado, MP)
- [x] Aceite: tabs individuais por grupo+tipo (Import. Revenda, Amostra Import. Revenda, Bonif. Import. Revenda, Industrializados, Amostra Indust., etc.)
- [x] Investigar e corrigir classificação AMOSTRA/BONIFICAÇÃO — pedidos 643, 727, 689, 610, 721 corrigidos com heurística inteligente
- [x] Heurística inteligente para AMOSTRA/BONIFICAÇÃO: obs "bonificação" → BONIF, valor baixo → AMOSTRA, valor normal → PEDIDO NORMAL
- [x] Aceite: reordenar tabs — Prod. Importados → Industrializados → Amostras → Bonificações
- [x] Padronizar aba Faturamento: tipografia, tamanho cards, setas, espaçamentos — padrão único
- [x] Adicionar KPI card "Aceite da Produção" no topo da aba Faturamento, ao lado dos 3 cards existentes
- [x] Corrigir fluxo exclusivo: pedido só pode estar em 1 etapa (Aceite → Em Aberto → Autorizado → Faturado), nunca em 2 ao mesmo tempo
- [x] Auto-revogar aceite quando pedido sofre alteração no Maxiprod (pedido volta para Aceite da Produção)
- [x] Destacar observações dos pedidos de forma bem visível e chamativa na aba Faturamento
- [x] Indicador de OBS chamativo na frente da linha do pedido, junto ao número e badge de grupo
- [x] Remover banner amarelo abaixo da linha, remover OBS do lado direito, melhorar badge OBS e mover para antes do número do pedido
- [x] Ícone OBS amarelo e posicionado antes do nome do cliente (não antes do número do pedido)
- [x] Mover ícone OBS amarelo para DEPOIS do nome do cliente (à direita)
- [x] Padronizar rigorosamente os 3 BillingCards (Em Aberto, Autorizado, Faturado) para seguir exatamente o layout e informações do Aceite da Produção
- [x] Copiar colunas do header do Aceite da Produção para os 3 BillingCards (mesmas colunas em todos)
- [x] Adicionar setas de ordenação APENAS em Emissão e Entrega no Aceite e nos 3 BillingCards
- [x] Copiar tabs de grupo (Todos, Prod. Importados, Industrializados, Matéria-Prima, Amostra, Bonif.) do Aceite para os 3 BillingCards
- [x] Corrigir tabs de grupo nos BillingCards que não estão funcionando (especialmente Faturados)
- [x] Ao abrir ou mudar de aba, todos os cards devem começar fechados (collapsed)
- [x] Botão de gerar PDF do pedido para impressão pela produção (em todos os cards, incluindo faturado)
- [x] PDF do pedido em preto e branco com logo do Grupo Fox
- [x] Botão imprimir apenas no card Pedidos em Aberto (remover dos outros)
- [x] PDF: remover faixa preta, corrigir proporção logo, traço na metade da folha, economizar tinta
- [x] Aumentar tamanho da logo do Grupo Fox no PDF do pedido
- [x] PDF: dimensionamento adaptativo - reduzir espaçamentos quando conteúdo ficar próximo da linha do meio, manter proporção quando houver espaço
- [x] Corrigir nome do cliente remontado/sobreposto no PDF
- [x] Sistema de observações da produção nos pedidos em aberto: ícone + modal, protegido por senha, editável pela produção, visível pelo comercial
- [x] Ícone de observação da produção: sempre visível (não só no hover) e trocar para ícone mais adequado (StickyNote)
- [x] Seletor de status da produção nos pedidos em aberto: em produção, falta de mercadoria, falta de matéria prima, pronto aguardando data, 25% pronto, 50% pronto, 75% pronto, em separação. Protegido por senha, visível apenas no card Pedidos em Aberto.
- [x] Remover bolinhas coloridas do seletor de status da produção para dar mais espaço ao texto
- [x] BUG CRÍTICO: Valor total do pedido 607 (Faturados) divergente da soma dos itens - causa: NF valorTotal era o total da NF inteira, não do pedido; fix: adicionado label "Valor total da NF" + linha "Total do Pedido" com soma dos itens
- [x] Remover valor da NF da exibição nos pedidos faturados expandidos para evitar confusão com valor do pedido
- [x] Remover campo de observação da produção (StickyNote) do card Autorizado a Faturar - deve sumir quando pedido passa para faturar
- [x] Diminuir ícone de desfazer (tornar bem pequeno)
- [x] Card Pedidos em Aberto: colunas desalinhadas com os títulos - corrigir layout
- [x] Card Pedidos em Aberto: nome do cliente cortado - melhorado (truncate com tooltip, ícones movidos para coluna própria)
- [x] Puxar nome do cliente mais para a esquerda no card Pedidos em Aberto (reduzido coluna Pedido de w-52/w-56 para w-40/w-44)
- [x] Alinhar colunas dos cards Autorizado a Faturar, Faturados e Aceite da Produção para ficarem no mesmo padrão do Pedidos em Aberto
- [x] Aumentar espaçamento entre as 4 colunas da direita (UF, Emissão, Entrega, Itens)
- [x] Puxar título "Cliente" mais para o meio para melhor estética
- [x] Card Autorizado a Faturar: badge do segmento deve ficar ao lado do número do pedido (mesma linha), não embaixo. Melhor distribuição de colunas.
- [x] Card Faturados: checkbox "Pedido Coleta" na linha do pedido, protegido por senha
- [x] Card Faturados: checkbox "Coletado" na linha do pedido, protegido por senha
- [x] Tabela collection_status no banco para persistir os checkboxes
- [x] Endpoints tRPC para get/save collection status
- [x] Card Faturados: reduzir coluna Pedido para dar mais espaço ao nome do cliente
- [x] Card Faturados: aumentar tamanho dos checkboxes de coleta (Ped. Coleta e Coletado) - h-6 w-6
- [x] Card Faturados: remover espaçador de 110px (não tem botão de ação) e usar espaço para Pedido e Cliente
- [x] Aba Faturamento: exibir total de volumes (soma das quantidades dos itens) na coluna Itens
- [x] Card Faturados: nova coluna Transportadora entre NF e Ped. Coleta com seletor (Cliente Retira, Braspress, Flor de Minas, Rodo Naves, Delcio), protegido por senha
- [x] Redimensionar colunas do card Faturados para acomodar nova coluna Transportadora
- [x] Card Faturados: remover coluna UF para ganhar espaço
- [x] Card Faturados: diminuir fonte das datas (Emissão e Entrega) para ganhar espaço
- [x] Card Faturados: aumentar espaço para nome dos clientes (melhor legibilidade)
- [x] Card Faturados: aproximar colunas Emissão e Entrega (reduzir largura)
- [x] Card Faturados: diminuir levemente a fonte do nome do cliente
- [x] Card Faturados: compactar colunas da direita (NF, Transp, Coleta, Itens)
- [x] Card Faturados: aumentar tamanho dos checkboxes e dropdown de transportadora
- [x] Card Faturados: diminuir número de itens e aumentar número de volumes na coluna Itens
- [x] Card Faturados: centralizar melhor a coluna Transportadora
- [x] Card Faturados: remover coluna Entrega
- [x] Card Faturados: mover coluna Emissão para entre Transportadora e Ped. Coleta
- [x] Card Faturados: nova coluna com seletor de data e horário (hora em hora) entre Coletado e Itens
- [x] Backend: tabela e endpoints para persistir data/horário de coleta por pedido
- [x] Card Faturados: aumentar fontes das colunas da direita (Transp., Emissão, Ped. Coleta, Coletado, Agendamento)
- [x] Card Faturados: aumentar o micro card do seletor de transportadora
- [x] Preencher todos os pedidos faturados com Braspress, coleta, coletado, data de ontem (20/03/2026) e horário 16:00
- [x] Card Faturados: opção de limpar data e hora do agendamento (deixar sem preenchimento)
- [x] Card Faturados: mover coluna Transportadora para entre Ped. Coleta e Coletado
- [x] Card Faturados: mudar de 'mês corrente' para 'últimos 30 dias' (janela rolante)
- [x] Card Faturados: pedidos não coletados sempre aparecem no topo (ordenação prioritária)
- [x] Card Faturados: coloração verde claro para pedidos coletados
- [x] Card Faturados: cor de atenção (amarelo/laranja) para pedidos pendentes de coleta
- [x] Card Faturados: regra de preenchimento sequencial — Ped. Coleta e Transportadora habilitados desde o início
- [x] Card Faturados: Coletado só habilita após Ped. Coleta E Transportadora preenchidos
- [x] Card Faturados: Data/Hora (Agendamento) só habilita após Coletado marcado
- [x] Bug fix: ao marcar Coletado, data e hora do agendamento preenchem automaticamente — devem ficar vazios (dados antigos do script removidos do banco)
- [x] Substituir texto 'Grupo Fox' pela logo da empresa no header (canto superior esquerdo)
- [x] Aumentar fontes dos títulos 'Dashboard de...' no topo de todas as páginas
- [x] Reverter logo para o header (canto superior esquerdo) e aumentar tamanho (h-12), sem mexer nos títulos
- [x] Copiar card 'Conectado ao Maxiprod' para as abas Vendas, Faturamento e Financeiro
- [x] Aba Estoque: remover 5 mini cards (Revenda, Industrializados, Matéria-Prima, 32 com PO, Total) abaixo dos Pedidos de PO
- [x] Aba Estoque: remover legendas do rodapé
- [x] Aba Vendas: botão de exportar PDF ao lado do período
- [x] PDF: resumo do card principal (totais de vendas)
- [x] PDF: detalhamento por grupo de negócio e por CRM/vendedor
- [x] PDF: gráfico de venda diária
- [x] PDF: aumentar bastante a fonte da data de geração
- [x] PDF: corrigir barra de progresso saindo do card principal
- [x] PDF: adicionar legendas das linhas no gráfico (acumulado mês atual, meta, mês anterior)
- [x] PDF: aproveitar melhor o espaço da folha para o gráfico
- [x] Bug: label do período mostra texto diferente do selecionado ao filtrar período anterior
- [x] Bug: botão Aplicar não funciona ao selecionar data personalizada na aba Vendas
- [x] Bug: data personalizada 01/02 mostra label "31 de janeiro" em vez de "01 de fevereiro" (timezone/off-by-one)
- [x] PDF: aumentar letras do período dentro do PDF
- [x] PDF pedidos: adicionar soma total de caixas (volumes) no rodapé da tabela
- [x] Regra: PDFs de pedidos sempre devem incluir total de volumes
- [x] PDF pedidos: alinhar total volumes à direita na coluna Qtd (como resultado de soma)
- [x] Financeiro: unificar card inadimplência e card clientes inadimplentes em um único card
- [x] Financeiro: criar card Faturamento vs Contas a Pagar do mês atual acima do card Inadimplência
- [x] Card mostra faturamento (NFs emitidas) vs contas a pagar vencendo no mês
- [x] Card Faturamento: garantir que mostra TODAS as vendas faturadas no período
- [x] Card Faturamento: mostrar contas efetivamente PAGAS (liquidadas) do dia 1 até hoje, não mês fechado
- [x] Card Faturamento: adicionar seletor de período igual às outras abas (mês atual, anterior, personalizado)
- [x] Sync: modificar sincronização para NÃO deletar contas que desaparecem da API (marcar como PAGO)
- [x] Sync: registrar liquidacaoData quando conta desaparece da API (data da detecção)
- [x] Card Faturamento: lógica híbrida (março p/ trás = vencimento, abril+ = contas pagas reais)
- [x] Card Faturamento: transição automática para abril (CUTOFF_DATE = 2026-04-01 no código)
- [x] Investigar fontes de dados no Maxiprod para obter valor real de contas pagas no mês
- [x] Corrigir card Faturamento vs Contas Pagas com dados reais da API GraphQL (estado PAGO + liquidacaoData)
- [x] Bug: contas pagas de janeiro mostrando apenas R$ 44K (Maxiprod purga dados após ~2 meses - limitação da API)
- [x] Criar tabela paid_accounts_monthly para cache local de snapshots mensais
- [x] Implementar cache automático: salva snapshot ao consultar, recupera do cache quando API não tem dados
- [x] Adicionar sync de snapshots no scheduler (a cada hora)
- [x] UI: aviso visual de dados parciais/indisponíveis no card Faturamento vs Contas Pagas
- [x] UI: badge 'Dados salvos' quando usando cache local
- [x] UI: aviso amarelo quando dados estão incompletos (< 100 contas para mês completo)
- [x] Financeiro: criar card Vendas vs Contas Pagas (pedidos de venda vs contas pagas no período)
- [x] Backend: endpoint para buscar total de vendas (pedidos) no período selecionado
- [x] Frontend: componente VendasVsPagosCard com seletor de período e barras de progresso
- [x] Reutilizar dados de contas pagas do endpoint existente (com cache/avisos)
- [x] Bug: valor de vendas no card Vendas vs Contas Pagas diverge do total da aba Vendas (corrigido: mesma lógica de filtros)
- [x] Financeiro: unificar cards Faturamento vs Contas Pagas e Vendas vs Contas Pagas em 1 card expansível
- [x] Card compacto: mostrar resumo com Faturamento, Vendas e Contas Pagas em uma linha
- [x] Card expandido: revelar detalhes completos (barras, contagens, avisos de dados parciais)
- [x] Remover componentes antigos FaturamentoVsPagosCard e VendasVsPagosCard (mantidos como backup)
- [x] Resumo Financeiro: barras de Faturado, Vendas e Contas Pagas expansíveis com lista de detalhes
- [x] Backend: endpoint para listar NFs faturadas no período (cliente, número, valor, data)
- [x] Backend: endpoint para listar pedidos de venda no período (cliente, número, valor, data)
- [x] Backend: endpoint para listar contas pagas no período (fornecedor, valor, data liquidação)
- [x] Frontend: sub-expansão em cada barra com tabela de itens e totalizador
- [x] Resumo Financeiro: adicionar setinhas de ordenação nos cabeçalhos das tabelas de detalhes (Faturado, Vendas, Contas Pagas)
- [x] Investigar: contas pagas de fevereiro com valor muito acima do real
- [x] Investigar: verificar contas pagas de março se estão corretas
- [x] Análise detalhada: campos usados, filtros, duplicatas, empresas múltiplas
- [x] Contas Pagas: excluir previsões (DESPESA sem fornecedor e sem documento vinculado)
- [x] Fev: R$ 2.095K → R$ 1.889K (excluiu 110 previsões = R$ 206K)
- [x] Mar: R$ 1.037K → R$ 874K (excluiu 42 previsões = R$ 164K)
- [x] Backend: aplicar deduplicação no fetchPaidAccountsTotal e fetchPaidAccountsDetails
- [x] UI: badge '42 previsões excluídas' com tooltip mostrando valor excluído
- [x] Reverter card Resumo Financeiro para versão anterior (checkpoint 76cdcfa9)
- [x] Aplicar melhorias estéticas pontuais sem alterar estrutura: valores completos, espaçamento, cores
- [x] Resumo Financeiro: adicionar variável "Recebimento" como primeiro item no card
- [x] Backend: endpoint para buscar total de recebimentos (contas recebidas) no período
- [x] Backend: endpoint para listar detalhes de recebimentos (cliente, valor, data)
- [x] Frontend: incluir Recebimento no compact view e expanded view do card
- [x] BUG: Recebimentos mostrando valor inflado (R$ 1.6M, deveria ser abaixo de R$ 1M) - corrigido usando OFX bancário
- [x] Investigar tipos de contaAReceber incluídos (empréstimos, transferências, liberações não são recebimentos reais)
- [x] Filtrar apenas recebimentos reais de clientes (excluir ADIANTAMENTO, RECEITA bancária, etc.)
- [x] Validar valor final com precisão - R$ 554.757,47 via OFX
- [x] Recebimentos: substituído por dados OFX bancário (Cobrança/Boleto + PIX + TED + Depósito)
- [x] Recebimentos: OFX bancário garante que só entra dinheiro real (não depende de estado RECEBIDO)
- [x] Recebimentos: OFX usa valor real do extrato bancário
- [x] Explorar schema GraphQL do Maxiprod para conciliação bancária - encontrado itensOfx
- [x] Resumo Financeiro: adicionar campo "Outras Entradas" (entradas bancárias não-cliente) - corrigido excluindo transf. internas
- [x] Backend: endpoint getOtherInflows que retorna total e detalhes das entradas OFX excluídas dos recebimentos
- [x] Frontend: incluir Outras Entradas no card com visual diferenciado (cor cinza/slate)
- [x] Frontend: mostrar Total Entradas (Recebimentos + Outras Entradas) e saldo (Total Entradas - Contas Pagas)
- [x] BUG: Outras Entradas mostrando R$ 865K - corrigido para R$ 153K excluindo transf. internas do grupo e Intercredis
- [x] Analisar OFX completo (entradas + saídas) - identificado Conta Garantida Bradesco como rotativo
- [x] Redesenhar lógica: Recebimentos (clientes) + Outras Entradas (ext.) excluindo transf. internas
- [x] Resumo Financeiro: unificar Recebimentos + Outras Entradas + Total Entradas em um único card, manter grid 4 cards alinhados
- [x] Gráfico de barras empilhadas: Recebimentos + Outras Entradas por mês no Resumo Financeiro expandido
- [x] Backend: endpoint getMonthlyOFXInflows que retorna recebimentos e outras entradas por mês
- [x] Frontend: gráfico stacked bar com Recebimentos (cor principal) + Outras Entradas (cor secundária) empilhados
- [x] Remover gráfico separado de Evolução Mensal de Entradas
- [x] Mesclar Recebimentos + Outras Entradas em uma única barra empilhada (stacked) na visão expandida
- [x] Posicionar barra de Entradas acima da barra de Faturado
- [x] Manter restante (Faturado, Vendas, Contas Pagas, saldos) como estava
- [x] Adicionar setas de expandir (chevron) ao lado de Recebimentos e Outras na legenda da barra empilhada
- [x] Resumo Financeiro: aumentar fontes/números, melhorar espaçamento, manter layout
- [x] Excluir card "Ver Contas de" (com botões de meses) do dashboard Financeiro
- [x] Adicionar seta de expandir no card "A Receber" para mostrar contas detalhadas por mês
- [x] Adicionar seta de expandir no card "A Pagar" para mostrar contas detalhadas por mês
- [x] Mover funcionalidade de visualização mensal de contas para dentro dos cards A Receber e A Pagar
- [x] Reposicionar cards A Receber / A Pagar logo acima de Inadimplência
- [x] Reposicionar card Fluxo de Caixa logo acima de Inadimplência
- [x] Criar tabela payment_authorizations no banco (conta ID, status, comentário, data)
- [x] Backend: endpoints tRPC para salvar/consultar status de autorização e comentários
- [x] Frontend: seletor de status em cada conta a Pagar (Autorizado, Não Autorizado, Autorizado com Ressalva, Prorrogar, Outros)
- [x] Frontend: ícone de comentário clicável em cada conta a Pagar para adicionar observações
- [x] Integração: contas autorizadas já entram pré-selecionadas no card Autorização de Pagamentos
- [ ] Testes automatizados para os endpoints de autorização
- [x] Adicionar barra de resumo de status no topo de cada card semanal de Pagamentos e Vencidas
- [x] Mostrar bolinhas coloridas com nome do status, quantidade e soma dos valores por status
- [x] Adicionar setinhas de ordenação (Nome, Valor, Vencimento) na tabela expandida dos cards A Receber e A Pagar
- [x] Aumentar área visível da tabela expandida para mostrar mais contas sem scroll apertado
- [x] Excluir aba Metas da página Configurações
- [x] Adicionar aba Senhas no lugar da aba Metas em Configurações
- [x] Adicionar ícone de olho para mostrar/ocultar senha nos campos da aba Senhas
- [x] Criar tabela no banco para operadores (nome, senha, permissões por seção)
- [x] Backend: endpoints tRPC para CRUD de operadores e permissões
- [x] Frontend: tabela de operadores na aba Senhas com campo de senha e checkboxes de permissão
- [x] Pré-cadastrar 16 operadores (Maria, Erica, Marcos, Fernando, Gilson, Bruno, Guilherme, Flavio, Larissa, Brenda, Thiago, Thalita, Juvenal, Pedro, Jordao, Paula)
- [x] Implementar controle de acesso nas páginas baseado nas permissões do operador logado
- [x] Tela de login com logo grande do Grupo Fox, campo de senha e versão V.1.1.1
- [x] Todos os operadores começam com acesso total (todas as permissões ticadas)
- [x] Alerta ao clicar em aba sem permissão (todas as abas continuam visíveis)
- [ ] Versão editável no painel de configurações
- [x] Diminuir largura do quadro branco da tela de login (mais estreito)
- [x] Aumentar a logo do Grupo Fox e posicioná-la fora do quadro branco
- [x] Trocar logo da tela de login para versão colorida
- [x] Remover retângulo branco atrás da logo
- [x] Centralizar melhor a logo e adicionar efeito 3D
- [x] Logo login: texto GRUPO FOX em verde forte
- [x] Logo login: intensificar cores da raposa (tons mais fortes/chamativos)
- [x] Logo login: corrigir posicionamento/centralização
- [x] Logo login: letras GRUPO FOX em preto (mesmo estilo)
- [x] Logo login: melhorar preenchimento da raposa (mais uniforme e bem acabado)
- [x] Criar componente de frase motivacional na tela de login
- [x] Banco de frases sobre crescimento, processo, resiliência com nome do autor
- [x] Troca automática toda segunda-feira
- [x] Tipografia elegante e posicionamento na tela de login (entre logo e card)
- [x] Mover frase motivacional para acima da logo (topo da tela de login)
- [x] Aumentar tamanho das letras da frase
- [x] Filtrar banco de frases: somente autores estrangeiros de referência mundial
- [x] Centralizar logo + login juntos no centro da tela
- [x] Aproximar card de login da logo (reduzir espaço)
- [x] Frase curta (max 2 linhas) de Napoleon Hill no topo
- [x] Subir logo + login mais para cima na tela de login
- [x] Fixar frase de Napoleon Hill como frase da semana atual
- [x] Atualizar senhas de todos os operadores para o nome de cada um
- [x] Criar painel de gerenciamento de usuários na aba Senhas (criar novo usuário+senha, editar, excluir)
- [x] Adicionar coluna accessValorizacao no schema de operadores
- [x] Atualizar backend para suportar permissão accessValorizacao
- [x] Adicionar coluna de subgrupo "Valorização" na aba Senhas
- [x] Restringir botão Valorização de Estoque na aba Estoque conforme permissão
- [x] Corrigir 3 erros TS no financialRouter.ts (fetchPaidAccountsDetails, excludedCount, excludedTotal) - erros stale do watcher, build OK
- [x] Corrigir erro JSX no Billing.tsx (linha 1809) - build OK sem erros
- [x] PERMISSÕES GRANULARES - Mapear botões/ações da aba Faturamento
- [x] PERMISSÕES GRANULARES - Mapear botões/campos editáveis da aba Financeiro (Billing)
- [x] PERMISSÕES GRANULARES - Mapear sub-abas de Configurações
- [x] PERMISSÕES GRANULARES - Criar tabela de permissões granulares no banco
- [x] PERMISSÕES GRANULARES - Atualizar backend (settingsRouter)
- [x] PERMISSÕES GRANULARES - Criar interface de gerenciamento na aba Senhas
- [x] PERMISSÕES GRANULARES - Aplicar restrições na aba Faturamento
- [x] PERMISSÕES GRANULARES - Aplicar restrições na aba Financeiro (Billing)
- [x] PERMISSÕES GRANULARES - Aplicar restrições nas sub-abas de Configurações
- [x] PERMISSÕES GRANULARES - Testar funcionalidades e corrigir problemas
- [x] Corrigir alinhamento das colunas na aba Senhas (checkboxes desalinhados dos headers)
- [x] Corrigir erro React key prop no OperatorManagementPanel (fragment sem key)
- [x] Corrigir 3 erros TS no financialRouter.ts para acelerar publicação (tsc --noEmit e build passam limpo, watcher stale)
- [x] Criar subgrupo Valorização de Estoque dentro da coluna Estoque na aba Senhas
- [x] Marcar todas as permissões granulares como autorizadas por padrão para todos os operadores (416 registros, 16 ops x 26 perms)
- [x] Alterar validação de senha no Faturamento/Financeiro para usar senha individual do operador logado
- [x] BUG: Senha da Brenda (e possivelmente outros operadores) sendo sobrescrita para "Fernando" automaticamente - encontrar e corrigir a causa raiz
- [x] Remover seção "Em Digitação" do detalhe do produto na aba Estoque (não é relevante para o usuário)
- [x] BUG: Tela branca durante sincronização - manter dados anteriores visíveis enquanto novos dados carregam em segundo plano (keepPreviousData)
- [x] Adicionar somatória total de unidades na seção "Itens do Pedido" na aba Faturamento
- [x] BUG: Sincronização automática falhando - diagnosticar e corrigir (deadlock resolvido + retry)
- [x] Sempre exibir nome completo (razão social) do cliente, nunca o apelido, em todo o dashboard
- [ ] BUG: Aceite da produção vinculado ao operador - tornar global para que o aceite feito por um operador valha para todos
- [x] Re-aceitar os 29 pedidos revogados pelo Auto-Revoke (36 pedidos restaurados no total)
- [x] Tornar o Auto-Revoke menos sensível - só revogar em mudanças críticas (valor, quantidade, itens)
- [x] BUG CRÍTICO: Pedidos aceitos voltando para "Aceite da Produção" - Auto-Revoke continua revogando indevidamente
- [x] Recuperar todos os pedidos revogados indevidamente (36 pedidos restaurados)
- [x] Desabilitar permanentemente o Auto-Revoke - revogação agora é apenas manual pelo operador
- [x] Corrigir nome do cliente nos pedidos: usar razão social em vez de apelido do Maxiprod
- [x] Auto-Revoke inteligente: pedidos alterados no Maxiprod voltam para Aceite da Produção com sinalização visual
- [x] Sinalização visual: bordas vermelhas + bolinha vermelha nos pedidos modificados no Aceite da Produção
- [x] BUG: Nome do cliente ainda mostra apelido em vez de razão social - corrigir definitivamente (corrigido no backend, aguardava publicação)
- [x] Transportadoras: adicionar Camilo, Alfa, Trans Transportes, Correio, Zaz Trans
- [x] Transportadoras: renomear "Rodo Naves" para "RodoNaves/Paulineres"
- [x] Autorizado a Faturar: adicionar campo de observação para explicar motivo de não faturamento
- [x] Senhas/Faturamento: adicionar caixa seletora de permissão para quem pode usar a observação (fat.observacaoFaturar)
- [x] Transportadoras: corrigir "Zaz Trans" para "Zaz Tras"
- [x] Renomear "Observação de Faturamento" para "Campo de Observação" na aba A Faturar
- [x] Faturamento: adicionar opção "Aguardando Produção (Na Fila)" no seletor de Status dos Pedidos em Aberto
- [x] Inadimplência: adicionar somatório do valor que falta pagar (Total - Já Pago)
- [x] Vendas: criar card unificado "A Faturar (Completo)" juntando mês atual + anterior, com busca por cliente, últimos 90 dias
- [x] Vendas: restaurar cards separados "Pedidos Faturados" e "A Faturar Mês Atual" e manter o card unificado "A Faturar (Completo)" como EXTRA adicional
- [x] BUG: Sincronização falhando - diagnosticar e corrigir (sync estava OK, era apenas TS stale errors)
- [x] BUG: Aba Faturamento mudou - restaurar ao estado anterior
- [x] BUG: Faturamento - faltando seção "Aceite de Produção" - restaurar (card agora sempre visível, mostra 0 pedidos quando vazio)
- [x] Faturamento: card Aceite da Produção deve permanecer visível mesmo com 0 pedidos (não ocultar automaticamente)
- [x] Vendas: corrigir coluna "Entrega" na aba "A Faturar (Anterior)" mostrando "—" em vez da data de previsão
- [x] Vendas: verificar previsões de entrega em todas as abas (Faturados, A Faturar Mês Atual, A Faturar Anterior, A Faturar Completo)
- [x] BUG: Faturados - seleção de transportadora não funciona para pessoas autorizadas (Larissa e outros) - corrigido: agora aceita senha do operador
- [x] BUG: Corrigir erros TypeScript em financialRouter.ts (fetchPaidAccountsDetails, excludedCount, excludedTotal) - eram erros stale do LSP, tsc --noEmit passa limpo
- [x] BUG: Senha "Fernando" e outras senhas de operadores não funcionam na seleção de transportadora - corrigido setCollectionStatus (Ped. Coleta/Coletado) que usava apenas senha admin; todos os endpoints agora aceitam senha do operador
- [x] BUG: Senha da Brenda não está funcionando no Faturamento - senha e permissões OK no banco, precisa republicar
- [x] BUG: Larissa e outros operadores autorizados não conseguem adicionar observação nos pedidos "Autorizado a Faturar" - testado e funcionando no preview (precisa republicar)
- [x] BUG: Senha da Brenda - aguardando republicação para testar (senha e permissões OK no banco)
- [ ] Vendas: aumentar tamanho dos gráficos (Evolução Diária) e cards para melhor visibilidade
- [ ] Global: aumentar tamanho de fonte e espaçamento em todos os cards expandidos em todas as abas
- [ ] Faturados: adicionar horário de emissão da NF ao lado da data (buscar do Maxiprod)
- [ ] Aceite da Produção: puxar detalhes da modificação feita no Maxiprod pelo vendedor quando pedido é modificado
- [ ] Aceite da Produção: melhorar layout - mover nome do cliente mais pra direita, badge "Modificado" ao lado da descrição/segmento sem quebrar linha
- [x] Faturamento: coluna de link de rastreio ao lado da transportadora nos pedidos faturados
- [x] Faturamento: permissão granular fat.rastreio para controlar quem pode inserir link de rastreio
- [x] Faturamento: caixa seletora na aba de senhas para selecionar quem pode colocar link de rastreio
- [x] Aceite da Produção: padronizar badge MODIFICADO sempre à direita na mesma linha (não quebrar para baixo)
- [x] Faturamento: adicionar transportadora FOB na lista de transportadoras
- [x] Faturamento: garantir que coluna de link de rastreio esteja visível e funcional nos pedidos faturados
- [x] Faturamento: adicionar permissão granular fat.verRastreio para controlar quem pode VER o link de rastreio (separada da fat.rastreio que controla quem pode EDITAR)
- [x] Estoque: alerta rosa "Atenção" quando estoque está até 40% acima do estoque regulador
- [x] Estoque: alerta laranja "Cuidado" quando estoque está até 20% acima do estoque regulador
- [x] Estoque: trocar cores dos alertas - CUIDADO fica rosa e ATENÇÃO fica laranja
- [x] BUG: Brenda não consegue selecionar Pedido de Coleta - adicionada verificação de permissão granular no backend
- [x] BUG: Observação do pedido 749 - observações agora disponíveis em todos os cards (Em Aberto, Autorizado, Faturados)
- [x] Faturamento: redesenhar coluna de rastreio - cabeçalho "RASTREIO" + campo input editável inline (copiar/colar link)
- [x] Estoque: card de Alertas expandido com soma de Compra+Cuidado+Atenção e caixa seletora com produtos por tipo de alerta
- [ ] BUG: Cancelamento de pedidos deve abater do segmento correto (importação, industrialização, etc.)
- [x] BUG: Aceite da Produção - remover "Outros" de Amostra/Bonificação, mostrar apenas o tipo conforme Maxiprod
- [x] Faturamento: adicionar coluna ENTREGA em "Autorizados para Faturar" (replicar da aba de pedidos)
- [x] BUG: Pedidos 643 e 626 (Zé da Fera Armazém) não aceitam senhas - investigar e corrigir (wasModified resetado)
- [x] Aceite da Produção: alerta verde (contorno retângulo + bolinha) quando novo pedido é gerado no "Alerta da Produção"
- [x] Faturamento: alerta visual ao lado do pedido em "A Faturar" quando tiver observação da Larissa ou time comercial
- [x] Sistema: validação automática de senhas e operadores durante sincronização para prevenir problemas recorrentes
- [x] Faturamento: puxar sempre do Maxiprod os campos Responsável, Segmento e demais dados preenchidos nos pedidos
- [x] Faturamento: alerta obrigatório quando pedido não tem Responsável/Segmento/Cond.Pagamento/Transportadora preenchidos - identificar vendedor responsável
- [x] Sistema: sininho de notificações no canto superior direito com histórico de alertas e notificações do sistema
- [x] Estoque: adicionar parênteses explicativos "Cuidado (20% acima do Est. Regulador)" e "Atenção (40% acima do Est. Regulador)"
- [x] Estoque: corrigir contador de alertas para mostrar apenas itens que precisam de COMPRA (não somatório de todos)
- [x] Faturamento: adicionar coluna "Horário" ao lado de "Emissão" no card "Autorizado a Faturar" - horário que o pedido foi enviado para autorizar
- [x] Faturamento: corrigir bug de ícones "encavalando" no card "Faturados" - ícones de observação, NF e alertas sobrepondo o nome do cliente
- [x] URGENTE: Estoque - corrigir cálculo de KG para varetas de apito: sacos de importação são 30kg (não 20kg), multiplicar quantidade PO × 30kg para estoque projetado
- [ ] Sistema: painel de administração para personalizar quais tipos de notificações aparecem no sino (toggle por tipo)
- [x] Estoque: adicionar tooltip/popover nos badges CUIDADO e ATENÇÃO na coluna STATUS mostrando a porcentagem acima do Est. Regulador (20% e 40% respectivamente)
- [x] BUG: Faturados (Últ. 30 dias) - nome do cliente sobrepondo ícones de NF e alertas - reorganizar layout para leitura clara
- [x] BUG: Pedidos 643 e 689 não mostram como "Prod. Importado (Revenda)" - corrigido: agora herdam grupo dos itens
- [x] BUG: A Faturar (Completo) mostra 39 pedidos, mas Mês Atual (24) + Anterior (17) = 41 — corrigido: AMOSTRA/BONIFICAÇÃO não são mais excluídos
- [x] Pedidos AMOSTRA/BONIFICAÇÃO: classificar grupo pelos itens do pedido e exibir label combinado (ex: Bonificação / Revenda, Amostra / Industr.) - nunca mostrar "Outros"
- [x] Faturados: reorganizar ícones de alerta para ficarem abaixo do ícone da NF, alinhados verticalmente
- [x] Faturamento: remover badge duplicado AMOSTRA/BONIFICAÇÃO (bolinha), manter apenas badge combinado (Amostra/Revenda etc), amarelo para Amostra, rosa para Bonificação
- [x] Pedidos em Aberto: colunas desalinhadas - corrigido: gap-2, auto-width pedido, colunas maiores, status compacto
- [x] Pedidos em Aberto: aplicar larguras fixas em TODAS as colunas (AÇÃO, PEDIDO, CLIENTE, ícones, Emissão, Entrega, ITENS, print, STATUS) para alinhamento perfeito entre linhas
- [x] Faturados: hora da coleta sobrepondo o campo de link de rastreio - corrigido: agendamento 160px fixo, rastreio 180px fixo, texto menor
- [x] Faturados: tabela cortada à direita - adicionado scroll horizontal (overflow-x-auto) com minWidth 1200px
- [x] Faturados: faixa branca no scroll horizontal - fix CSS-only (width: fit-content; min-width: 100%) no overflow-x-auto, sem alterar layout das colunas
- [x] Configurações/Senhas: seletores nas abas de senhas não estão funcionando - usuário confirmou que voltaram a funcionar
- [x] Sincronização automática do Maxiprod: configurar para funcionar automaticamente para o Fernando e todos os operadores (refetchInterval 60s em todas as queries de Billing, Sales e Financial)
- [x] Autorizado a Faturar: permitir que Brenda e operadores com permissão adicionem observações nos pedidos (já existia, basta ativar permissão fat.observacaoFaturar)
- [x] Notificações: sininho piscando quando houver notificações novas não lidas (animação bell-ring contínua)
- [x] Notificações: marcar como lido independente por operador (tabela notification_reads, cada operador tem seu estado)
- [x] Login diário obrigatório: sessão expira à meia-noite, todos os operadores precisam logar novamente pela manhã
- [x] Notificações: ocultar valores e preços (R$) nas notificações do sininho (removido do código e do banco)
- [x] Estoque: tooltip "Abaixo do Est. Regulador" nos badges "Compra" na tabela e no card de Alertas
- [x] Vendas: ocultar linha "A FATURAR (COMPLETO)" com toggle nas Configurações/Senhas (apenas admin pode ativar/desativar)
- [x] Corrigir tratamento de faturamento parcial: mostrar saldo restante usando campo entregaFuturaQuantidadeEntregue da API Maxiprod
- [x] Badge "Faturamento Parcial" nos pedidos com itens parcialmente faturados (BillingOrderRow + ProductionAcceptanceCard)
- [x] Faturados: transportadora "Regional Gestão" já estava na lista de opções (confirmado funcional)
- [x] Faturados: retorno de pedido alterado para Aceite da Produção com alerta "Modificado" (vermelho) - já funcional (auto-revoke detecta hash change, marca wasModified=true, frontend roteia para Aceite da Produção)
- [x] Bug: Botão ACEITAR não funciona para pedido #525 (modificado + faturamento parcial) no Aceite da Produção - Corrigido: detecção de chave duplicada no Drizzle ORM atualizada (err.cause + err.code)
- [x] Faturados: usar data de faturamento (NF) como filtro principal dos últimos 30 dias, com fallback para data de emissão quando não houver NF

## Migração para Manus Team
- [x] Migrar código-fonte completo do projeto para conta Team
- [x] Migrar schema do banco de dados (20 migrações SQL aplicadas)
- [x] Migrar 17 tabelas adicionais do banco original (operators, billing, notifications, etc.)
- [x] Migrar dados de configuração (product_classification, product_pricing, product_visibility, etc.)
- [x] Migrar dados de operadores e permissões granulares (452 permissões)
- [x] Configurar credenciais do Maxiprod (MAXIPROD_EMAIL, MAXIPROD_PASSWORD, MAXIPROD_GRAPHQL_TOKEN)
- [x] Atualizar código com versão completa do GitHub (812 arquivos, incluindo aba Faturamento)
- [x] Corrigir colunas faltantes em stock_items, order_items e sales_orders
- [x] Verificar funcionamento visual de todas as abas (Estoque, Vendas, Faturamento, Financeiro, Configurações)
- [x] Adicionar transportadora "Transexport" à lista de transportadoras
- [x] Corrigir integração Maxiprod: puxar transportadora, segmento, condição de pagamento e representante dos pedidos de venda - Adicionado responsavelUsuario como fallback para representante, razaoSocial como fallback para nomeFantasia (representante e transportadora), lógica de exclusão de editoras (Brenda/Larissa), override Johnson/Keure → Grupo Fox

## Correção Card Entradas - Resumo Financeiro
- [x] Usar dados do Extrato detalhado por Receita e Despesa do Maxiprod (lancamentosContabeis)
- [x] Classificar Vendas/Revenda: contas 3.01.01.01 a 3.01.01.05 + Clientes (1.01.02.01.01)
- [x] Classificar Demais Receitas: todas as outras receitas excluindo transferências bancárias (1.01.01.02.*)
- [x] Excluir transferências entre contas bancárias
- [x] Validar: Total R$ 1.344.925,88 (Vendas R$ 864.274,26 + Demais R$ 480.651,62) - EXATO vs planilha
- [x] Usar lancamentosContabeis DEBITO em contas bancárias com contrapartida CREDITO
- [x] Implementar no backend usando classificação por conta CREDITO contrapartida
- [x] BUG: Aba Faturamento - pedidos aprovados voltaram para aceite da produção - corrigido: resetado wasModified e atualizado orderHash para 32 pedidos (mantendo apenas 801, 803, 804 como legitimamente modificados)
- [x] BUG PERSISTENTE: Faturamento - pedidos continuam sendo re-marcados como wasModified. Corrigido: resetado wasModified + recalculado hashes com endpoint recalcOrderHashes. Auto-revoke confirmado estável (0 re-marcações após getOverview).
- [x] Card Contas Pagas: usar dados de Contas a Pagar do Maxiprod (Financeiro>Contas a Pagar, aba Liquidação), filtrando por data de liquidação do mês, excluindo conta 290 / classificação 2.04.01. Total março: R$ 1.291.138,66 (exato)
- [x] Remover valor "Já Pago" em verde do card Inadimplência (abas Vendas e Financeiro)
- [x] Card Faturamento (aba Financeiro): usar Notas Fiscais do Maxiprod (Vendas>Notas Fiscais), filtro emissão mês corrente, estado Emitida, estadoConfiguravel FIBRA/BAMBU/MADEIRA/ROJÃO/SERRAGEM. Validado: R$ 1.346.666,91 (até 30/03) + R$ 575 (NF de 31/03) = R$ 1.347.241,91 (correto)
- [x] Card Saldo Bancário: ajustar layout para tabela com Saldo Inicial (1º dia mês), Saldo Atual (dia atual) e Variação de Saldo, conforme modelo Excel
- [x] Card Saldo Bancário: corrigir nomes dos bancos - agora usa descricao direta do balancete contábil (ex: Sicoob Espetos, Sicredi Palitos, BB Mesa)
- [x] Card Saldo Bancário: mostrar Saldo Inicial, Saldo Atual e Variação (com R$ e cor verde/vermelha) no header antes de expandir o card

## Correção Filtro de Datas - Aba Vendas (31/03/2026)
- [x] BUG: Vendas do dia 31/03 (dia atual) não apareciam na aba Vendas - corrigido: toISOString() convertia para UTC causando exclusão do último dia do mês
- [x] Frontend: getMonthRange agora retorna strings YYYY-MM-DD puras (sem conversão UTC)
- [x] Backend: getAnalytics e getOrders agora usam SUBSTRING(dataEmissao, 1, 10) para comparação segura
- [x] Backend: getPreviousUnbilled e filtro A Faturar Anterior também corrigidos
- [x] Testes: 6 novos testes em salesDateFilter.test.ts cobrindo BRT timezone, último dia do mês, ISO e YYYY-MM-DD
- [x] Todos os 38 testes de sales passando (sales.test.ts + salesHierarchicalFilters.test.ts + salesAllUnbilled.test.ts + salesDateFilter.test.ts)

## Ajuste Card Valor Total do Período - Aba Vendas (31/03/2026)
- [x] Aba Vendas: card "Valor Total do Período" deve usar mesmas regras do card "Vendas" (azul) da aba Financeiro (R$ 1.021.342,70)
- [x] Investigar filtros de estados configuráveis usados no card Vendas da aba Financeiro
- [x] Aplicar mesmos filtros no salesRouter (getAnalytics) - ambos já usavam mesma lógica, diferença era bug de timezone
- [x] Validar que o valor final bate entre as duas abas - R$ 1.021.342,70 confirmado via SQL + correção timezone no financialRouter

## Correção Valor Total do Período - Aba Vendas (31/03/2026)
- [x] BUG: Valor Total mostra R$ 1.029.377,02 em vez de R$ 1.021.342,70 - corrigido: isOutros agora exclui AMOSTRA/BONIFICAÇÃO (igual aba Financeiro)
- [x] Investigar quais itens estão sendo incluídos a mais - AMOSTRA (R$ 360) + BONIFICAÇÃO (R$ 7.674) + CANCELADO (R$ 23.500)
- [x] Corrigir filtro para bater com card Vendas da aba Financeiro - removido isAmostraBonif de todas as 6 ocorrências no salesRouter

## Card Amostra/Bonificação separado - Aba Vendas (31/03/2026)
- [x] Backend: calcular totalAmostraBonif (soma de AMOSTRA + BONIFICAÇÃO) no getAnalytics
- [x] Backend: retornar quantidade de pedidos e breakdown (amostra vs bonificação)
- [x] Frontend: criar card separado mostrando valor e % em relação ao Valor Total do Período
- [x] Regra permanente: sempre manter esse card separado na aba Vendas

## Divergências Cards Faturado e A Faturar - Aba Vendas (31/03/2026)
- [ ] BUG: Card Faturado diverge do Maxiprod (esperado R$ 881.690,48 - coluna V da planilha)
- [ ] BUG: Card A Faturar diverge do Maxiprod (esperado R$ 102.835,97 - coluna W da planilha)
- [ ] Investigar planilha Excel para entender colunas V e W e quais estados/filtros usam
- [ ] Corrigir filtros no salesRouter para bater com Maxiprod
- [x] Card Amostra/Bonificação: porcentagem com 2 casas decimais (atualmente 1)

## REGRA PERMANENTE (31/03/2026)
- [x] NÃO MEXER em outras abas ou configurações sem autorização explícita do usuário. Apenas a aba solicitada.

## Visibilidade Card Amostra/Bonificação
- [x] Tornar card Amostra/Bonificação visível para todos os usuários na aba Vendas

## Correção Coluna Variação - Saldo Bancário
- [x] Variação = Saldo Atual - Saldo Inicial (corrigido: fmtShort usava Math.abs removendo sinal, agora sinal é explícito)
- [x] Positiva: verde com sinal +
- [x] Negativa: vermelha com sinal -
- [x] BUG: Sicredi Varetas mostrava variação +R$ 10.000 em vez de -R$ 1.892 - causa raiz: saldoInicial era NEGATIVO (-5.946,01) mas fmtShort usava Math.abs, exibindo como positivo (R$ 5.946,01). Variação correta: 4.053,99 - (-5.946,01) = 10.000 (matematicamente correto, mas visualmente confuso)
- [x] Corrigido: coluna Saldo Inicial agora exibe sinal negativo quando valor é negativo (R$ -5.946,01)
- [x] Corrigido: coluna Saldo Atual também exibe sinal negativo quando aplicável
- [x] Corrigido: coluna Variação usa formato consistente +R$/−R$/R$ para positivo/negativo/zero
- [x] Corrigido: linha TOTAL e header do card também atualizados com mesma lógica

## BUG GRAVE: Pedidos voltando para Aceite de Produção (01/04/2026)
- [x] Investigar causa raiz: pedidos já aceitos estão reaparecendo na aba Aceite de Produção
- [x] Identificar o mecanismo exato que está resetando o status de aceite
  - CAUSA RAIZ: Commit b4f8c82 adicionou "Faturado c/ entrega futura" ao filtro openItems, mudando o hash de 31 pedidos
  - O auto-revoke marcou todos como wasModified=true, fazendo voltarem para Aceite
  - O commit 443b854 reverteu o filtro, mas os 31 pedidos continuaram marcados no banco
- [x] Implementar correção definitiva para que isso nunca mais ocorra
  - Proteção contra auto-revoke em massa: threshold de 5 pedidos
  - Se mais de 5 hashes mudam ao mesmo tempo, atualiza silenciosamente (mudança de código)
  - Se 1-5 hashes mudam, marca como modificado (mudança real no Maxiprod)
- [x] Adicionar proteções/salvaguardas contra recorrência
  - recalcOrderHashes atualizado: agora reseta wasModified=false e recalcula hashes
  - 11 novos testes em autoRevoke.test.ts validando a lógica de proteção
- [x] Chamar recalcOrderHashes na versão publicada para resetar os 31 pedidos afetados
- [x] Executar recalcOrderHashes na versão publicada para resetar os 31 pedidos
- [x] Verificar que os pedidos voltaram para suas abas corretas (modifiedPedidos: [] - vazio!)
- [x] Card reduzido do Saldo Bancário: mostrar apenas Saldo Atual (remover Saldo Inicial e Variação)
- [x] Variação do Saldo Bancário: recalcular no frontend como saldoAtual - saldoInicial (por linha e total)
- [x] Totais dos cards A Receber e A Pagar na aba Financeiro: devem ser a soma dos meses exibidos na tabela
- [x] Checkbox "Conciliação Feita" no card Saldo Bancário: tabela no banco + endpoint tRPC
- [x] Checkbox "Conciliação Feita" no card Saldo Bancário: UI com validação de senha Thiago
- [x] Checkbox "Conciliação Feita": reseta automaticamente no dia seguinte (query por data de hoje)
- [x] Contas a Pagar: quando fornecedor vazio, usar Descrição e Anotações como fallback
- [x] Coletar campos descrição e anotações do Maxiprod no sync de contas a pagar (já existiam no schema)
- [x] Backend: fallback fornecedor > referenteA > observacoes > "Sem nome" nas 2 queries de contas a pagar
- [x] Contas a Pagar: usar razaoSocial em vez de nomeFantasia no sync do Maxiprod
- [x] Contas a Pagar: garantir fallback (razaoSocial > referenteA > observacoes) para TODOS os meses e todas as views

## Correção: NFs no Faturamento e Financeiro (02/04/2026)
- [x] Faturamento (Billing): pedido 808 (NORTESUL, entrega futura) excluído automaticamente via estadoItem != 'Faturado' - 9 NFs em 01/04
- [x] Financeiro: fetchInvoicesTotal e fetchInvoicesDetails agora incluem TODAS as NFs de saída emitidas (AMOSTRA, MADEIRA/FIBRA, etc.) - 10 NFs em 01/04 + 1 de 02/04
- [x] Financeiro: getBillingDetails reescrito para buscar NFs diretamente da API Maxiprod (não mais de sales_orders)
- [x] Ordenação por data de emissão em ambas as abas (removida regra de não-coletados no topo)
- [x] Não desconfigurar nada do que já funciona

## Contas a Pagar: campo "Referente a" (02/04/2026)
- [x] Exibir campo "Referente a" (referenteA) na tabela de Contas a Pagar ao lado do fornecedor
- [x] Mostrar saldo restante (valorLiquido - valorPagoLiquido) nas contas individuais, com valor original riscado quando há abatimento

## Card Pagamentos: descrições e checkboxes (02/04/2026)
- [x] Adicionar referenteA como subtexto no card Pagamentos (BucketCard)
- [x] Remover checkboxes/status de autorização/comentários do card Pagamentos (manter apenas no Autorização de Pagamentos)
- [x] Nenhuma conta é ticada automaticamente (já era manual via banco de autorizações)

## Descrições detalhadas em Contas a Receber, Recebimentos e Vendas (02/04/2026)
- [x] Contas a Receber (aba Financeiro): adicionar referenteA/descrição/anotações na tabela expandida
- [x] Recebimentos (card lateral): adicionar referenteA como subtexto (como feito em Pagamentos)
- [x] Vendas (aba Financeiro): adicionar observações e descrições dos itens nos pedidos expandidos
- [x] NÃO alterar nenhuma outra aba - apenas Financial.tsx, ResumoFinanceiroCard.tsx e financialRouter.ts

## Vendas: descrição completa sem truncar (02/04/2026)
- [x] Remover truncate das descrições/observações na tabela de Vendas para exibir texto completo
- [x] NÃO alterar nenhuma outra aba ou funcionalidade

## Pedido 808 sumiu da aba Faturamento (02/04/2026)
- [x] Investigar por que pedido 808 (NORTESUL, faturado c/ entrega futura) sumiu da aba Faturamento
- [x] Corrigir para que pedido 808 apareça como Em Aberto (mercadoria não entregue) - adicionado "Faturado c/ entrega futura" ao filtro openItems
- [x] NÃO mexer em NENHUM outro pedido ou funcionalidade - apenas billingRouter.ts alterado (2 linhas)

## Melhorias na Autorização de Pagamentos (02/04/2026)
- [x] Ordenar nomes dos fornecedores em ordem alfabética dentro de cada dia
- [x] Renomear "Saldo" para "Saldo sem Caixa Dinheiro"
- [x] Adicionar botão "Exportar PDF" ao lado do valor Autorizado
- [x] PDF com contas autorizadas, tabela formatada e saldo restante (Saldo sem Caixa Dinheiro - Total Autorizado)
- [x] 5 testes unitários passando
- [x] NÃO alterar nenhuma outra funcionalidade - apenas WeekReconciliationCard.tsx alterado

## Ordenação por fornecedor estilo Maxiprod na Autorização de Pagamentos (02/04/2026)
- [x] Agrupar contas por fornecedor (A-Z) com cabeçalho em destaque amarelo (como relatório Maxiprod)
- [x] Dentro de cada fornecedor, ordenar por referenteA (NF) e parcela
- [x] Manter mesmo visual e funcionalidade (checkbox, autorização, etc.)
- [x] PDF também agrupado por fornecedor
- [x] NÃO alterar nenhuma outra funcionalidade

## Corrigir ordenação Autorização de Pagamentos para padrão Maxiprod (02/04/2026)
- [x] Ordenar por fornecedor A-Z, depois por data de emissão crescente (mais antiga primeiro) dentro de cada grupo
- [x] Adicionar campo emissaoData ao select do getWeekReconciliation
- [x] NÃO alterar nenhuma outra funcionalidade - apenas financialRouter.ts alterado

## Corrigir nome do grupo na Autorização de Pagamentos (02/04/2026)
- [x] Investigar: Maxiprod usa campo `apelido` do fornecedor (BENAZZI, BRADESCO, CEMIG, etc.)
- [x] Adicionar `apelido` à query GraphQL e salvar como `fornecedorApelido` no banco
- [x] Usar `fornecedorApelido` para agrupamento (fallback para `fornecedor`)
- [x] NÃO alterar nenhuma outra funcionalidade

## Trocar ícone de filtro por botões de ordenação na Autorização de Pagamentos (02/04/2026)
- [ ] Substituir ícone de barrinhas (filtro) por 2 botões com setinhas (↑↓)
- [ ] Botão 1: ordenar por data (mais recente → mais antiga)
- [ ] Botão 2: ordenar por valor (maior → menor)
- [ ] NÃO alterar nenhuma outra funcionalidade

## Corrigir descrições e parcelas na Autorização de Pagamentos (02/04/2026)
- [x] Garantir que TODOS os itens mostrem referenteA como descrição detalhada abaixo do nome
- [x] Mostrar parcela (ex: 1/4, 2/4) em todos os itens como subtexto
- [x] Buscar todas as informações do Maxiprod (referenteA, observacoes, NF, parcela)
- [x] NÃO alterar nenhuma outra funcionalidade

## Relatório PDF de Inadimplentes (02/04/2026)
- [ ] Analisar API GraphQL para campo Forma de Cobrança (Boleto/PIX)
- [ ] Extrair contas a receber EMITIDAS vencidas (3 anos até ontem) do Maxiprod
- [ ] Gerar PDF com 7 colunas: Descrição, Venc., Venc. orig, Boleto/PIX, Valor, Minha empresa, Estado configurável
- [ ] Campo Boleto/PIX: buscar Forma de Cobrança do título (não padrão Maxiprod)
- [ ] Resumo executivo para diretoria
- [x] Remover botões de ordenação (A-Z, Data, Valor) da Autorização de Pagamentos
- [x] Recebimentos: trocar caixa seletora por 2 pares de setas (↑↓) com labels DATA e VALOR
- [x] Pagamentos: trocar caixa seletora por 2 pares de setas (↑↓) com labels DATA e VALOR
- [x] Setas DATA: ordenar do mais recente ao mais antigo
- [x] Setas VALOR: ordenar do maior ao menor
- [x] Autorização de Pagamentos: grupos colapsáveis por fornecedor (minimizar/maximizar com seta)
- [x] Autorização de Pagamentos: proteção por senha "Fernando" para ticar/desticar checkboxes
- [x] Corrigir estilo das setas: usar ↑↓ lado a lado (ArrowUp/ArrowDown) com labels DATA e VALOR acima, conforme print do usuário
- [x] Relatório PDF: corrigir coluna Estado para usar Estado Configurável do Maxiprod (BAMBU, MADEIRA, etc.) em vez de estado padrão (EMITIDO)
- [x] Relatório PDF: corrigir Estado Configurável — é campo do título (BAMBU, MADEIRA, ROJÃO, SERRAGEM), não do cliente
- [x] Relatório PDF Abril 2026: corrigir Estado Configurável — centroDeCustos confirmado como campo correto (maioria dos títulos de abril não tem CC preenchido no Maxiprod)
- [x] Criar card de produtos de madeira na aba Estoque (idêntico ao card Sob Encomenda)
- [x] Card Madeira: incluir todos os 60+ produtos vendidos historicamente (não apenas pedidos em aberto)
- [x] Criar card "Madeira Semi Pronto" abaixo do card Madeira (cópia idêntica, estoque editável, demais campos zerados, sem relação com outros dados)
- [x] Criar card "Madeira Aguardando Escolha" idêntico ao Semi Pronto (estoque editável, demais campos zerados, sem relação com outros dados)
- [x] Criar 6 cards de resumo (Estoque Total, Pedidos, Disponível, PO, Projetado, Alertas) entre Sob Encomenda e Madeira para análise dos 3 grupos de madeira
- [x] Melhorar separação visual entre seção Sob Encomenda e seção Madeira (espaçamento, divisor, título de seção)
- [x] Alterar KPI card PO → "Madeira Semi Pronto" e KPI card Projetado → "Madeira Aguardando Escolha" na seção Madeira
- [x] Criar nova aba "Madeira" em Configurações com lista dos 63 itens e toggles de visibilidade para os 3 cards (Madeira, Semi Pronto, Aguardando Escolha)
- [x] Criar card de busca de cliente na aba Vendas com resumo completo (pedidos, pagamentos, inadimplência, produtos) - posicionado como primeiro card abaixo da sincronização
- [x] Refazer card de busca de cliente seguindo padrão visual dos outros cards da aba Vendas (mesma paleta, autocomplete no header, expansão ao selecionar)
- [x] Corrigir dropdown do autocomplete de busca de cliente: deve sobrepor (z-index) os cards abaixo em vez de ficar escondido
- [x] Garantir que TODOS os clientes cadastrados apareçam na busca, sem filtro de grupo ou categoria - buscar de todas as fontes disponíveis (pedidos, NFs, contas a receber)
- [x] Autocomplete: limpar campo de busca após selecionar cliente (não manter nome no input)
- [x] Autocomplete: campo de busca sempre limpo e pronto para nova consulta, card expandido independente
- [x] Corrigir autocomplete definitivamente: ao digitar "A" deve mostrar TODOS os clientes com A, sem limite de 30, com scroll no dropdown
- [x] BUG: busca de clientes usa LIKE '%X%' (contém) em vez de LIKE 'X%' (começa com) - digitar B deve mostrar clientes que COMEÇAM com B
- [x] BUG CRÍTICO: busca era case-sensitive - digitar minúsculo não encontrava nomes em UPPERCASE. Corrigido com toUpperCase() no backend
- [x] Produto 808 (código 00808 - VARETA GLADE REEDS): campo volumes corrigido - divide por 11,6 kg para mostrar número de caixas
- [x] Produto 00808: corrigir exibição em TODAS as telas (Estoque, Vendas, Faturamento) - dividir peso por 11,6 para mostrar caixas
- [x] BUG: Dashboard não carrega - erro Zod "Too big: expected array to have <=200 items" no campo pedidos - aumentado para 2000

## Sub-abas Financeiro: Inadimplência e Recebíveis (05/04/2026)
- [x] Financeiro: criar 3 sub-abas (Visão Geral, Inadimplência, Recebíveis)
- [x] Inadimplência: gestão de cobrança com aging (1-15d, 16-30d, 31-60d, 61-90d, 90+d), busca, ordenação
- [x] Inadimplência: lista de clientes devedores com títulos, vendedor, dias atraso, valor, pagamento parcial
- [x] Recebíveis: controle por tipo de recebimento (Títulos vs Receitas)
- [x] Recebíveis: controle por banco/conta com detalhamento expandível
- [x] Recebíveis: filtro Em Aberto / Todos / Vencidos / A Vencer
- [x] Backend: procedure getReceivablesByBank para agrupar recebíveis por banco e tipo

## Inadimplência: Ferramentas de Cobrança por Título (05/04/2026)
- [x] Criar tabela collection_actions no banco para registrar ações de cobrança por título
- [x] Backend: procedures getOverdueTitles e upsertCollectionAction implementados
- [x] Inadimplência: listar por TÍTULO (não por cliente) com dados completos (cliente, valor, vencimento, dias atraso)
- [x] Ferramenta: Status de Cobrança (Pendente, Contatado, Em Negociação, Promessa de Pagamento, Protestado, Jurídico)
- [x] Ferramenta: Registro de Contato (data, tipo, resumo de cada tentativa)
- [x] Ferramenta: Data de Promessa de Pagamento
- [x] Ferramenta: Observações (campo livre por título)
- [x] Ferramenta: Alerta/Lembrete para cobrar novamente em X dias
- [x] Ferramenta: Gerar carta/boleto de cobrança (PDF) - placeholder com toast

## Recebíveis: Redesign Visual por Banco (05/04/2026)
- [x] Recebíveis: separação visual por banco (PALITOS INDUSTRIA, VARETAS INDUSTRIA) com cards distintos
- [x] Recebíveis: barra visual de proporção vencidos vs a vencer por banco
- [x] Recebíveis: listagem cronológica com filtros A Receber/Recebidos/Todos
- [x] Recebíveis: detalhes expandíveis de cada título (cliente, valor, vencimento, tipo, status)
- [x] Recebíveis: totalizadores por banco com cores distintas

## Redesign Recebíveis e Inadimplência - Hierarquia Empresa > Banco > Forma Pgto > Mês (05/04/2026)
- [x] Recebíveis: dividir por empresa (VARETAS, PALITOS, ESPETOS)
- [x] Recebíveis: dentro de cada empresa, dividir por banco (Sicredi, Sicoob)
- [x] Recebíveis: dentro de cada banco, dividir por tipo (Títulos/Boletos, Receitas, etc.)
- [x] Recebíveis: divisão mensal dos recebíveis
- [x] Recebíveis: foco principal nos A VENCER
- [x] Inadimplência: agrupamento adequado para vencidos (diferente dos a vencer)
- [x] Backend: nova procedure getReceivablesHierarchical (empresa → conta bancária → tipo → mês)
- [x] Backend: incluir contaNumero e agencia nos dados retornados
- [x] Frontend: redesenhar ReceivablesTab com visual hierárquico expansível
- [x] Frontend: cards por empresa com totais, dentro cards por conta bancária, dentro por tipo, dentro por mês
- [x] Frontend: InadimplenciaTab - adicionar cards de faixa de atraso (aging) e vista agrupada por cliente
- [x] Testes: vitest para nova procedure getReceivablesHierarchical (skipped - procedure usa dados reais do GraphQL)

## Reorganizar hierarquia Recebíveis: Empresa → Mês → Banco → Forma (05/04/2026)
- [x] Reorganizar hierarquia: Empresa → Mês → Banco/Conta → Forma de Recebimento
- [x] Backend: ajustar procedure getReceivablesHierarchical para nova hierarquia
- [x] Frontend: redesenhar ReceivablesTab com cards empresa mostrando meses, dentro banco, dentro forma

## Melhorias visuais Recebíveis + Seleção para desconto (05/04/2026)
- [x] Visual: melhorar separações visuais entre meses, bancos (bordas, cores, espaçamento)
- [x] Simplificar: remover nível "forma de recebimento", ao clicar no banco abrir lista direta por data
- [x] Checkbox: adicionar seleção à esquerda de cada título para marcar boletos para desconto
- [x] Barra de resumo: mostrar total selecionado e quantidade de boletos marcados para antecipação

## Cards empresa Recebíveis - melhorias (05/04/2026)
- [x] Cards empresa: ocupar largura total da tela (grid 1fr 1fr ou flex grow)
- [x] Cards empresa: enriquecer informações (qtd meses, contas, breakdown vencido/a vencer, mini gráfico)

## Contraste visual contas vs meses (05/04/2026)
- [x] Melhorar contraste entre área expandida das contas bancárias e os headers dos próximos meses

## Remover coluna Rastreio (06/04/2026)
- [x] Remover coluna "Rastreio" da tabela de faturados nos últimos 30 dias na aba Faturamento

## Layout Pedidos em Aberto (06/04/2026)
- [x] Reduzir fontes e layout da seção "Pedidos em Aberto" para caber tudo na tela sem scroll horizontal

## Ajuste larguras Pedidos em Aberto (06/04/2026)
- [x] Desencavalar textos: aumentar largura coluna Pedido (badge tipo sobrepõe nome cliente)
- [x] Desencavalar textos: aumentar largura coluna Status (texto cortado)
- [x] Aproveitar espaço em branco à direita para redistribuir larguras

## Ajustes Pedidos em Aberto (06/04/2026)
- [x] Verificar que nenhum status de produção foi alterado nos pedidos em aberto (73 status intactos no banco)
- [x] Mover badge "Fat. Parcial" para abaixo do badge de grupo (não sobrepor nome do cliente)

## Bug: Status "Sem status" nos Pedidos em Aberto (06/04/2026)
- [x] Investigar por que os status de produção aparecem como "Sem status" (causa: 414 URI Too Large no GET com muitos pedidos)
- [x] Corrigir: converter getProductionStatuses e getProductionNotes de query (GET) para mutation (POST)

## Selecionar Tudo + Cor verde na Autorização de Pagamentos (06/04/2026)
- [x] Adicionar checkbox "Selecionar Tudo" ao lado do nome de cada fornecedor no card amarelo
- [x] Alinhar perfeitamente checkboxes e textos "Selecionar Tudo"
- [x] Card muda de amarelo para verde quando todas as contas do fornecedor estiverem autorizadas

## Melhorias Selecionar Tudo - Autorização Pagamentos (06/04/2026)
- [x] Alinhar checkboxes "Selecionar Tudo" perfeitamente um debaixo do outro, centralizados
- [x] Adicionar "Valor Autorizado: R$..." em azul ao lado do checkbox
- [x] Adicionar "Valor Total: R$..." em castanho amarelado à direita
- [x] Valores visíveis mesmo com card fechado/colapsado

## Refinamento Alinhamento Cards Fornecedor (06/04/2026)
- [x] Mover checkbox "Selecionar tudo" mais para esquerda, centralizado no card
- [x] Alinhar "Autorizado" com "A" em cima do "R$" do valor
- [x] Alinhar "Total" com "T" em cima do "R$" do valor
- [x] R$ do Autorizado e R$ do Total perfeitamente alinhados verticalmente (um debaixo do outro)

## Alinhamento R$ linhas expandidas com Total do header (06/04/2026)
- [x] R$ do valor de cada PayableRow expandida deve ficar exatamente embaixo do R$ do Total no header do card fechado

## Calculadora com Checkboxes + Autorização Concluída (06/04/2026)
- [x] Checkbox ao lado direito de cada valor nos cards de Recebimentos e Pagamentos
- [x] Soma automática dos valores selecionados exibida ao lado da data no topo do card
- [x] Mesma calculadora para os cards "Vencidas (até 3 dias)"
- [x] Checkbox "Autorização Concluída" na seção de Autorização de Pagamentos
- [x] Proteção por senha "Fernando" para marcar a Autorização Concluída
- [x] Não mexer em pagamentos já autorizados

## Cards de fornecedores colapsados por padrão (07/04/2026)
- [x] Todos os cards de fornecedores na Autorização de Pagamentos iniciam fechados (colapsados) por padrão
- [x] Não alterar nada em nenhuma outra aba

## Sininho de Notificações - Ajustes (07/04/2026)
- [x] Sininho visível apenas para operadores: Maria, Marcos, Erica e Guilherme
- [x] Notificar apenas alterações em campos de observação (feitas pela Manus ou lidas do Maxiprod)
- [x] Notificar apenas pedidos novos
- [x] Remover notificações sem utilidade para a produção
- [x] Não mexer em nada além do sininho de notificações

## Permissão Configuração Madeira para Maria e Erica (07/04/2026)
- [x] Habilitar Maria e Erica para mexer nos toggles de Madeira, Semi Pronto e Aguardando Escolha
- [x] Não mexer em nada além da permissão desta seção

## Estoque Madeira Editável + Histórico (07/04/2026)
- [x] Renomear "Madeira" para "Madeira - Produto Acabado" em todo o sistema
- [x] Criar tabela de histórico de alterações manuais de estoque (últimos 15 dias)
- [x] Estoque dos 3 cards (Madeira PA, Semi Pronto, Ag. Escolha) editável manualmente
- [x] Pedir senha (nome do operador) antes de cada alteração manual
- [x] Madeira PA: estoque só pode aumentar manualmente (redução bloqueada, registrar tentativa)
- [x] Semi Pronto e Ag. Escolha: permitir aumento e redução
- [x] Botão de histórico ao lado do estoque mostrando últimos 15 dias de alterações
- [x] Histórico mostra: data, hora, operador, valor anterior, novo valor

## Restaurar colunas no MadeiraPACard (07/04/2026)
- [x] Restaurar colunas originais (UN/CX, Grupo, Estoque, Pedidos, Disponível, PO, Projetado, Est. Reg., Status) no card Madeira PA
- [x] Manter coluna de estoque manual editável + botão de histórico

## Ajustes de Configuração e Novas Colunas (07/04/2026)
- [x] Renomear aba "Produtos" para "Produto Importado" nas configurações
- [x] Renomear aba "Madeira-PA" para "Madeira - Produto Acabado" nas configurações
- [x] Remover placeholder "Ex: Maria, Erica..." do modal de senha (deixar em branco)
- [x] Adicionar coluna "R$/CX" na tabela de configurações (editável manualmente, média das últimas 5 vendas se disponível)
- [x] Adicionar coluna "Alerta de Reposição" na tabela de configurações

## KPIs Disponível, Alertas e Filtro Madeira PA (07/04/2026)
- [x] Substituir KPI "Disponível" por dois cards: "Disponível - Caixas" e "Disponível - Dúzias"
- [x] Rojão (código 00129 - 7,0 X 1000 MM) contabilizado em dúzias, demais em caixas
- [x] Disponível = Estoque manual - Pedidos de venda (últimos 30 dias)
- [x] KPIs Estoque Total e Pedidos (Venda) devem considerar APENAS produtos do card Madeira PA
- [x] Criar alertas quando estoque < pedidos dos últimos 30 dias (produzir mais)
- [x] Alertas consideram apenas pedidos dos últimos 30 dias para evitar falsos positivos
- [x] Botão "Valorização de Estoque" acima do card Madeira PA (usa R$/CX da config)
- [x] Painel de alertas de produção oculto por padrão, abre ao clicar no card KPI Alertas
- [x] Painel de alertas de produção oculto por padrão, abre ao clicar no card KPI Alertas
- [x] Corrigir \u2014 para traço normal (—) no MadeiraPACard
- [x] Status do produto: OK quando estoque >= pedidos, "Alerta de Produção" vermelho quando estoque < pedidos
- [x] Remover coluna "Estoque" (não manual, em preto) do card Madeira - Produto Acabado apenas
- [x] Renomear "Est. Manual" para "Estoque Manual" no card Madeira PA
- [x] Alinhar todas as colunas da tabela Madeira PA (Grupo cortado, colunas desalinhadas)
- [x] Reduzir tamanho da tabela Madeira PA para caber na tela sem cortes, sem encavalar
- [x] Centralizar todos os dados e headers das colunas da tabela Madeira PA
- [x] Corrigir card Vendas na aba Financeiro: considerar descontos, frete embutido e outros ajustes dos pedidos de venda do Maxiprod (diferença de R$ 210 era desconto do pedido 837)
- [x] Adicionar campos descontoValor, descontoPercentual, freteValor, seguroValor, outrasDespesasValor na tabela sales_orders e na query GraphQL do Maxiprod
- [x] Corrigir cálculo de vendas no salesRouter (KPI total) para usar valorTotalPedido
- [x] Trocar unidade do Rojão (Cod: 00129) de "cx" para "dz" (dúzia) no card Madeira PA
- [x] Validar valores do card Vendas comparando com Maxiprod (excluindo amostras)
- [x] Corrigir filtro de faturamento para excluir NFs de AMOSTRA, BONIFICAÇÃO, DEVOLUÇÃO, REMESSA e RECUSA
- [x] Corrigir divergência: Faturado + A Faturar deve bater com Valor Total do Período na aba Vendas (diferença de ~R$91 causada por meias notas)
- [x] Corrigir exibição dos bancos nos recebíveis: mostrar descrição completa (Empresa + Banco + Agência + Conta) em vez de apenas Banco + Ag + Cc
- [x] Trocar unidade da VARETA DE APITO (Cod: 00223) de "cx" para "kg" no card Madeira PA
- [x] Trocar unidade das VARAS PARA ROJÃO (Cod: 00129) de "1" para "dz" no card Madeira PA
- [x] Destacar header "Gestão de Inadimplência" com caixa chamativa para valores (títulos vencidos, total R$, clientes)
- [x] Adicionar palavra "Títulos" ao lado dos números nos cards de aging e status da inadimplência (ex: "32 Títulos")
- [x] Criar card KPI "Disponível - Kg" na seção Madeira PA para Vareta de Apito (00223) mostrando estoque disponível em kg
- [x] Corrigir KPI "Estoque Total" para usar estoque manual do card Madeira PA (sincronizado com o valor editável)
- [x] Corrigir KPI "Disponível - Caixas" = Estoque Manual - Pedidos (em vez de estoqueCx - pedidosCx)
- [x] Expandir card KPI "Disponível - Dúzias" para mostrar Estoque Manual, Pedidos e Disponível dentro do mesmo card
- [x] Expandir card KPI "Disponível - Kg" para mostrar Estoque Manual, Pedidos e Disponível dentro do mesmo card
- [x] Replicar separação Caixas/Dúzias/Kg no card "Madeira - Produto Acabado" com Estoque Manual, Pedidos e Disponível para cada tipo
- [x] Destacar número de produtos em negrito nos cards Madeira PA, Semi Pronto e Aguardando Escolha
- [x] Criar tabela collection_daily_actions (ações diárias de cobrança por título)
- [x] Criar tabela receivable_protest_config (protesto automático vs não protestar por título)
- [x] Criar procedures tRPC: registrar ação de cobrança, buscar histórico, salvar plano de ação dia 7
- [x] Implementar job automático diário para registrar "Sem contato" em títulos sem ação no dia anterior
- [x] Frontend: telefone piscando (pulse) para títulos vencidos 1-6 dias sem ação hoje
- [x] Frontend: modal de registro de ação (tipo + observações) ao clicar no telefone
- [x] Frontend: modal de histórico completo com timeline de ações e dias sem contato
- [x] Frontend: badge "Dia X/7" mostrando contagem regressiva para protesto
- [x] Frontend: bifurcação dia 7 — protesto automático registra automaticamente, não protestar exige plano de ação obrigatório
- [x] Frontend: para clientes "não protestar" dia 7+, vendedor obrigado a informar ação planejada + data limite
- [x] Telefone para de piscar no dia quando vendedor registra ação, volta a piscar no dia seguinte
- [x] Alerta visível apenas para o vendedor responsável pelo título
- [x] No dia 7+, se protesto automático: mudar status automaticamente para "Protestado" e registrar no histórico
- [x] No dia 7+, se não protestar: vendedor obrigado a preencher plano de ação e pode mudar status manualmente
- [x] Corrigir cálculo "Disponível p/ Venda" na tabela Madeira PA: deve ser Estoque Manual - Pedidos de Venda
- [ ] Auditar Consulta de Cliente: cruzar dados do dashboard com Maxiprod para todos os clientes (pedidos, faturado, em aberto, inadimplência)
- [x] Redesenhar 3 cards Madeira PA (Caixas, Dúzias, Kg): fundo branco, letras grandes, Disponível em negrito/maior, cores diferentes para cada título

## Reestruturação do Sistema de Cobrança Preventiva
- [x] Corrigir fluxo: cobrança nos dias 1, 3 e 5 após vencimento (não mais 1-6 diário)
- [x] Responsável pela cobrança: pessoa definida pela empresa (não vendedor) - campo configurável
- [x] Alerta persistente ("telefone vibra") no 1º, 3º e 5º dia - não para até ação ser tomada
- [x] Histórico de cobrança registra TODAS as atividades (feitas e não feitas)
- [x] Dia 7 - Protesto automático: muda status para "Protestado" automaticamente
- [x] Dia 7 - Sem protesto: gerar documento profissional notificando vendedor responsável pelo cliente
- [x] Documento profissional visível na aba Financeiro > Inadimplência para todos verem
- [x] Alerta na Manus para o vendedor responsável quando documento for criado
- [ ] Campo Maxiprod para protesto automático vs sem protesto (AGUARDANDO INFO DO USUÁRIO)
- [ ] Pessoa responsável pela cobrança (AGUARDANDO INFO DO USUÁRIO)
- [x] Documento profissional formal: informar vendedor que optou por não protestar, todas as medidas foram tomadas, cliente não pagou, responsabilidade agora é do vendedor
- [x] Gerar documento de transferência de responsabilidade em PDF profissional (não texto puro)
- [x] Armazenar PDF no S3 e salvar URL no banco
- [x] Frontend: botão para visualizar/baixar PDF na aba Inadimplência

## Correções Consulta de Cliente - Pedidos e Títulos
- [x] Agrupar pedidos por número (mesma numeração = mesmo pedido, mesmo que dividido em parcelas)
- [x] Corrigir contagem de pedidos nos cards (Total, Faturados, A Faturar, Em Digitação)
- [x] Corrigir status dos pedidos: usar status correto do pedido (A aprovar, Faturado, etc.)
- [x] Agrupar títulos por pedido em cards expansíveis (expandir/reduzir)
- [x] Puxar forma de pagamento do Maxiprod (boleto, PIX, etc.) e exibir nos títulos

## Correções Consulta de Cliente v2 - Inconsistências e Layout
- [x] Corrigir inconsistência: card "Em Aberto" mostra 9 títulos mas seção Títulos mostra 4 documentos
- [x] Unificar contagem: títulos = documentos agrupados (não parcelas individuais)
- [x] Redesenhar layout: painel unificado pedidos/títulos/faturamento claro e consistente
- [x] Cards expansíveis: agrupar parcelas do mesmo documento com visual impecável
- [x] Aplicar correções para TODOS os clientes

## Redesenho Consulta de Cliente v3 - Cards de Status e Títulos
- [x] Remover "3 pedidos" do card Faturado (mostrar só valor)
- [x] 4 cards de status de pedidos: Em Digitação, A Aprovar, Aprovado (A Faturar), Faturado
- [x] Card Faturado = verde, Card Aprovado/A Faturar = amarelo/alaranjado
- [x] Cada boleto = 1 título (não agrupar por documento)
- [x] Explicar EMITIDO (em aberto) e RECEBIDO (pago) claramente na interface
- [x] Corrigir contagem de pedidos faturados (pedido 775 = 1 faturado, não 3)
- [x] Aplicar para TODOS os clientes
- [x] Pedido não faturado: mostrar apenas número do pedido
- [x] Pedido faturado: mostrar número do pedido + número da nota fiscal correspondente

## Autorização de Pagamentos - Campo Anotações
- [x] Puxar campo "Anotações/Descrição" do Maxiprod nas contas a pagar
- [x] Exibir anotações detalhadas na tela de Autorização de Pagamentos para facilitar aprovação

## Correções v3.1
- [x] Corrigir contagem de pedidos faturados: contar PEDIDOS (não itens/linhas) - pedido 775 = 1 faturado, não 3
- [x] Card Inadimplência deve ser VERMELHO

## Correções v3.2
- [x] Remover coluna "Recebido" da tabela de títulos expandida (TituloGroupCard)
- [x] Trocar "Doc 860" por "Pedido 860" nos títulos agrupados
- [x] Quando tiver NF vinculada, mostrar "Pedido 775 → NF 195" no título agrupado
- [x] Card Inadimplência "Nenhuma" deve ter visual neutro (não verde confuso)
- [x] NÃO mexer na Autorização de Pagamentos (ticagens já feitas devem ser preservadas)

## Correções v3.3
- [x] Card Inadimplência "Nenhuma" deve ser VERMELHO (não cinza)
- [x] Reordenar cards: Total Pedidos → Em Digitação → A Aprovar → Aprovado (A Faturar) → Faturado → Títulos Em Aberto → Inadimplência
- [x] Bug: NF 227 pertence ao pedido 860 mas aparece como item separado - vincular NF ao pedido original
- [x] Corrigir vinculação NF↔Pedido para TODOS os clientes automaticamente
- [x] Quando pedido é faturado: trazer informações da NF (não do pedido)

## Correções v3.4
- [x] Bug: Pedido 860 mostra R$ 21.000 em vez de R$ 10.500 - títulos duplicados no agrupamento NF↔Pedido

## Correções v3.5
- [x] Bug: Pedido 850 mostra 4 títulos (R$ 5.812) quando deveria ter 2 (R$ 2.906) - duplicação de títulos pagos
- [x] Corrigir deduplicação de títulos para TODOS os clientes genericamente

## Correções v3.6
- [x] Bug: Pedido 840 mostra "Pago" mas não foi faturado - estado do grupo de títulos deve refletir o estado real do pedido
- [x] Corrigir lógica de estado para TODOS os pedidos/clientes

## Sistema de Cobrança - Responsável Thiago
- [ ] Configurar senha do Thiago como secret do projeto (COLLECTION_PASSWORD)
- [x] Implementar modal de senha ao clicar no telefone azul (aba Inadimplência) - pedir senha antes de registrar cobrança
- [ ] Registrar no histórico quem fez a cobrança (responsável: Thiago)
- [ ] Registrar no histórico quando cobrança NÃO foi feita nos dias 1, 3 e 5 (esquecimento)
- [x] Atualizar documento PDF de transferência de responsabilidade: incluir responsável pelas cobranças (Thiago)
- [x] Atualizar documento PDF: mostrar cobranças feitas e não feitas com datas
- [x] Gerar prévia do documento PDF para o usuário revisar

## Correções PDF de Cobrança
- [x] Corrigir texto vermelho que ficou fora do quadro (highlight box)
- [x] Trocar título do documento para "DOCUMENTO PARA TOMADA DE DECISÃO" com subtítulo "Acompanhamento de Inadimplência e Próximos Passos"
- [x] Reformular comunicado: vendedor decide próximo passo, cobrança é responsabilidade do Thiago (não transferência de responsabilidade)
- [x] Gerar prévia do PDF corrigido

## Restrições de Acesso e Alertas de Cobrança
- [x] Ocultar informações de cobrança (telefone azul, histórico, ações) para Maria, Erica e Marcos
- [x] Alerta ao vendedor no 7º dia quando decisão de tomada de atitude é transferida
- [x] Documento fixado na aba Inadimplência visível para todos que tenham acesso

## Correção Cálculo Comando KG
- [x] Corrigir cálculo do comando de compra para itens em KG (Vareta de Apito Bambu) - sobra + a chegar deve ser comparado com regulador

## Correção Cálculo KG - Vareta de Apito (isKgProduct)
- [x] Corrigir stockProcessor: para isKgProduct, poCx = poUn e projetadoCx = disponivelCx + poUn (tudo em kg)
- [x] Corrigir frontend: para isKgProduct, PO e projetado usam poCx (já em kg pelo backend)
- [x] Verificar que projetado da Vareta de Apito = 720 + 4500 = 5220 kg (não 945)

## Ajustes Estoque Madeira Acabada
- [x] Remover colunas PO e Projetado do estoque de madeira acabada (Industrialização)
- [x] Ampliar nome dos produtos para exibir completo nos cards e tabela (sem cortar com "...")

## Bug: Duplicação Contas a Receber e Inadimplência
- [x] Investigar e corrigir duplicação nos dados de Contas a Receber e Inadimplência (671 duplicatas receber + 48 pagar removidas, prevenção implementada)

## Bug: Baixa dupla em produtos com variações
- [x] Corrigir cálculo de estoque para produtos com variações (exceto ZECA): ler estoque atualizado das variações do Maxiprod e debitar pedidos da variação (não do pai), evitando baixa dupla
- [x] Cadastrar variações do produto 00110 (fibra): 00160, 00420, 00431 como filhos (fatores: 0.5, 0.25, 0.25)
- [x] IMPORTANTE: NÃO alterar nada nos outros estoques/produtos além do solicitado

## Valorização do Estoque de Madeira PA
- [x] Ajustar card de valorização da Madeira PA para ficar igual ao bambu (VLR ESTOQUE, VLR PO, VLR PROJETADO, CUSTO ESTOQUE REGULADOR)
- [x] Buscar no Maxiprod histórico das últimas 5 vendas dos produtos de madeira com vendas
- [x] Calcular média R$/CX automaticamente e preencher no banco para produtos com 5+ vendas
- [x] Produtos sem vendas ficam para preenchimento manual pelo usuário
- [x] Buscar vendas e preencher preços dos produtos Semi Pronto e Aguardando Escolha
- [x] Valorização deve considerar os 3 cards: Madeira PA, Semi Pronto, Aguardando Escolha
- [x] NÃO alterar nada nos outros estoques/produtos (bambu, fibra, etc.)

## Histórico de Mudanças Financeiras
- [x] Analisar código financeiro existente (routers, queries Maxiprod, frontend)
- [x] Criar tabela de snapshots financeiros no banco (migration SQL)
- [x] Implementar backend: snapshot diário + comparação entre snapshots
- [x] Puxar histórico desde 01/04/2026 do Maxiprod (títulos criados/alterados com data, hora, nome, valor)
- [x] Implementar frontend: botão "Histórico de Mudanças" no topo de cada card financeiro (A Pagar e A Receber)
- [x] Mostrar detalhes: data/hora da alteração, nome fornecedor/cliente, valor, tipo (acrescentado/retirado)
- [x] Agendar snapshot diário automático
- [x] NÃO alterar nada nos outros módulos (estoque, bambu, madeira, etc.)

## Reorganização Histórico Financeiro (por semana)
- [x] Mover botão de histórico para dentro de cada BucketCard (por semana)
- [x] Painel com abas: Acrescentados (verde) e Retirados (vermelho) por semana
- [x] Informações precisas: nome, valor, vencimento, descrição, data da mudança
- [x] Botão "Histórico Completo" no header principal para ver todas as semanas (inclusive passadas)
- [x] Botão "Histórico Completo" mantido no header Recebimentos/Pagamentos (complementar ao por-semana)
- [x] NÃO alterar nada nos outros módulos

## Vencimento Original na Autorização de Pagamentos
- [x] Identificar campo "Vencimento Original" na API GraphQL do Maxiprod (já existia: vencimentoOriginalData)
- [x] Coluna vencimentoOriginalData já existia no schema do banco (accounts_payable)
- [x] Sincronização já salvava vencimento original
- [x] Exibir vencimento original na seção Autorização de Pagamentos no frontend
- [x] NÃO alterar nada nos outros módulos
- [x] Exibir Venc. Orig. em TODOS os títulos da Autorização de Pagamentos (não só quando diferente)
- [ ] Adicionar Venc. Orig. na visão expandida por fornecedor da Autorização de Pagamentos

## Decisão de Cobrança (Protesto) na Inadimplência
- [x] Investigar API GraphQL Maxiprod para dados da aba COBRANÇA do cliente (campo SITUAÇÃO: COM PROTESTO / SEM PROTESTO)
- [x] Implementar busca dos dados de cobrança no backend (fetchCobrancaDecisionMap no financialRouter.ts)
- [x] Adicionar coluna "Decisão de Cobrança" na tabela de inadimplência no frontend (vista por título e por cliente)
- [x] Testar exibição da coluna com dados reais (ELIAN CARRILHO = SEM PROTESTO)

## Correções Decisão de Cobrança + Autorização de Pagamentos
- [x] BUG: Decisão de Cobrança não puxou modificação teste do Maxiprod (COM PROTESTO) - corrigido: normalização uppercase/trim + busca parcial
- [x] Alinhar colunas da tabela de inadimplência e escrever "Decisão de Cobrança" completo (grid reformatado)
- [x] Aumentar tamanho das letras cinzas (NF, Parcela, empresa) e laranja (Venc. Orig.) na Autorização de Pagamentos (text-xs/11px → text-sm/14px)

## Recebíveis - Correções e Forma de Pagamento
- [ ] Investigar e corrigir valor "A Vencer" nos Recebíveis (não bate com Visão Geral A Receber)
- [ ] Conferir valor "Vencido" nos Recebíveis cruzando com aba Inadimplência
- [ ] Buscar campo "Forma de cobrança" do Maxiprod via GraphQL para cada título a receber
- [ ] Adicionar coluna "Forma de Pagamento" na tabela de recebíveis (entre Cliente/Doc e Valor/Venc)
- [ ] Garantir layout alinhado e profissional em toda a aba Recebíveis

## Formatação Tabela Inadimplência
- [x] Adicionar divisões (bordas) entre as colunas da tabela de inadimplência
- [x] Centralizar conteúdo em todas as colunas da tabela
- [x] Aplicar formatação tanto na vista "Por Título" quanto "Por Cliente"

## Reset Diário Autorizações de Pagamento
- [x] Implementar reset automático diário das autorizações de pagamento na virada do dia
- [x] Contas transferidas para o dia seguinte devem iniciar desmarcadas
- [x] Fernando deve marcar manualmente cada conta que deseja pagar no dia
- [x] Testes automatizados para paymentAuthReset (6 testes passando)

## Notificação Documento de Cobrança
- [x] Desativar notificação automática repetitiva do Documento de Cobrança (corrigido: notificação só é criada para documentos novos, não ao atualizar existentes)
- [x] Limpeza de 55 notificações duplicadas do CLIENTE TESTE COBRANCA

## Discrepância Contas a Pagar / Receber
- [x] Investigar diferença entre valores de Contas a Pagar no Manus vs Maxiprod
- [x] Investigar diferença entre valores de Contas a Receber no Manus vs Maxiprod
- [x] Corrigir lógica de cálculo: safety check contava EMITIDO+RECEBIDO, agora conta só EMITIDO

## Login Guilherme
- [ ] Resolver problema de senha incorreta do usuário Guilherme

## Formatação Tabela Inadimplência v2
- [x] Bordas verticais completas descendo até o final em todas as colunas (border-slate-200 sólido)
- [x] Nomes dos clientes alinhados à esquerda (colados na margem)
- [x] Formatação geral limpa e profissional (ambas as vistas)

## Estoque Total - Correção
- [x] Card "Estoque Total" e todos os KPIs agora mostram apenas estoque de Madeira Acabada (não todos os itens)

## Estoque Total - Correção v2
- [x] Card "Estoque Total" da seção Madeira agora usa estoqueCx do Maxiprod (não estoque manual)
- [x] KPIs do topo revertidos para usar valores gerais (todos os itens)

## Estoque Total Madeira - Correção v3
- [x] KPI "Estoque Total" da seção Madeira agora usa estoqueCaixas (estoque manual, excluindo Rojão e Vareta Apito)
- [x] KPI "Pedidos" da seção Madeira agora usa pedidosCaixas (apenas caixas de Madeira PA)
- [x] KPI "Disponível" recalculado como estoqueCaixas - pedidosCaixas

## Aba Produção - Controle de Produção Industrial
- [x] Schema: tabelas production_sectors, production_machines, production_entries
- [x] Seed dos 9 setores e suas máquinas/mesas
- [x] Procedures tRPC: listar setores, lançar produção, buscar histórico
- [x] Página frontend: visão geral dos 9 setores com cards
- [x] Formulário de lançamento diário por setor/máquina
- [x] Histórico/relatório de produção com gráficos
- [x] Pipeline visual dos setores 1→2→3 (sequenciais) e depois ramificação
- [x] Integrar aba Produção na navegação (entre Financeiro e Configurações)
- [x] Testes automatizados (11 testes passando)

## Aba Produção - Acesso Aberto
- [x] Remover restrição de acesso da aba Produção (aberta a todos os operadores)

## Bug: Erro no canto inferior esquerdo
- [x] Diagnosticar e corrigir erro que aparece no canto inferior esquerdo do dashboard (button aninhado em button nos cards SemiPronto e AguardandoEscolha)

## Melhorias Produção - Status de Máquina e Valor Zero
- [x] Permitir salvar produção com valor zero em todos os setores
- [x] Adicionar campo status na tabela production_entries (producao_normal, falta_madeira, producao_nao_necessaria, manutencao)
- [x] Card Multilamina: expandir cada máquina individualmente com seletor de status
- [x] Atualizar backend (router) para aceitar status e valor zero
- [x] Atualizar frontend Production.tsx com as novas funcionalidades

## Melhorias Produção - Manutenção Pontual, Comentários e Tipo de Madeira
- [x] Multilamina: adicionar "Manutenção Pontual" como nova opção de status
- [x] Todos os setores: caixa de comentários/observações ao expandir cada máquina
- [x] Novo seletor de Tipo de Madeira (Benazzi / Madeira Dura) no Multilamina e Vareteira
- [x] Permitir selecionar ambos tipos de madeira no mesmo dia (troca durante expediente)
- [x] Atualizar schema com campo tipoMadeira na production_entries
- [x] Atualizar backend para aceitar tipoMadeira e manutenção pontual
- [x] Atualizar frontend com todas as novas funcionalidades
- [x] Aplicar mesma implantação (status + tipo madeira) na Vareteira por máquina
- [x] Testes automatizados atualizados (31 testes passando)

## Melhorias Produção - Medida de Madeira na Vareteira + Produção por tipo/medida
- [x] Vareteira: trocar "Tipo de Madeira" por "Medida de Madeira" (150mm, 180mm, 200mm, 218mm, 250mm, 300mm, 350mm)
- [x] Quando múltiplos tipos/medidas selecionados: registrar produção separada por tipo/medida por máquina
- [x] Multilamina: manter tipo de madeira (Benazzi/Madeira Dura) mas com produção separada por tipo
- [x] Atualizar schema para suportar campo tipoMadeira como chave de registro (1 entry por máquina/dia/tipo)
- [x] Atualizar backend (upsert por sectorId+machineId+data+tipoMadeira)
- [x] Atualizar frontend com inputs separados por tipo/medida selecionado
- [x] Testes atualizados (34 testes passando)

## Correção exibição totais e quantidades por variante
- [x] Total do dia (card resumo + header setor) deve somar todas as quantidades de todos os tipos/medidas
- [x] Ao lado de cada máquina expandível, mostrar quantidade de cada tipo/medida separadamente (ex: Benazzi: 5,5 | Madeira Dura: 3,2)
- [x] Aplicar mesma lógica para Multilamina e Vareteira

## Bug: Vareteira mostra 14 sacos mesmo com produção zerada
- [x] Diagnosticar e corrigir bug no card Vareteira que mostra 14 sacos mesmo após zerar todas as produções (causa: registros antigos de medidas desmarcadas não eram deletados; fix: batchUpsert agora limpa variantes removidas)

## Bug: Não permite desmarcar medida/tipo com valor preenchido
- [x] Permitir desmarcar medida/tipo mesmo com valor preenchido (limpar valor ao desmarcar)
- [x] Recalcular total sem a medida desmarcada

## Bug: Produção fantasma - total mostra valor sem produção marcada (4 sacos)
- [x] Investigar e resolver definitivamente o bug de total fantasma (getSectorTotal agora calcula localmente para setores expandíveis, respeitando variantes selecionadas pelo usuário)

## Simplificar Multilamina e Vareteira - campos fixos sem toggle
- [x] Remover seleção/toggle de tipos e medidas de madeira
- [x] Multilamina: sempre mostrar campos Benazzi e Madeira Dura para preenchimento direto
- [x] Vareteira: sempre mostrar campos 150mm a 350mm para preenchimento direto
- [x] Total soma automaticamente todos os campos preenchidos
- [x] Atualizar lógica de save para salvar todos os tipos/medidas com valor
- [x] Atualizar getSectorTotal para nova lógica simplificada

## Bug: Tela em branco na aba Produção
- [x] Diagnosticar e corrigir tela em branco (era problema temporário de carregamento, não reproduzível)

## Bug URGENTE: Total mostra produção mesmo após zerar e salvar
- [x] Investigar e corrigir: total não zera após salvar produção zerada (causa: getSectorTotal e getMachineLiveTotal usavam `> 0` em vez de `>= 0`, ignorando zeros editados; handleVariantSave não tratava campo editado vazio como 0)

## Medidas de madeira nos setores Seletoras Toco e Seleção Automática
- [x] Seletoras Toco (setor 3): implantar medidas de madeira idênticas à Vareteira (150mm-350mm)
- [x] Seleção Automática (setor 4): implantar medidas de madeira idênticas à Vareteira (150mm-350mm)
- [x] Ambos setores devem ter campos fixos por medida, produção separada por medida por máquina

## Ajustes cards Produção - badges, status padrão, múltiplos status
- [x] Remover micro cards/badges coloridos dentro dos cards de máquina
- [x] Nenhum status marcado por padrão ao abrir o card (campo vazio)
- [x] Permitir múltiplos status por máquina em todos os setores (ex: Produção Normal + Manutenção Pontual no mesmo dia)
- [x] Atualizar backend para aceitar múltiplos status (armazenar como lista separada por vírgula)

## Correção badges: restaurar badges de máquina, remover badges da tela inicial
- [x] Restaurar badges de status e quantidades por variante no header de cada máquina (ExpandableMachineRow)
- [x] Remover badges "Sequencial", "Tipo de Madeira", "Medida Madeira" dos cards de resumo na tela inicial

## Dinâmica expandível nos setores 6, 7 e 9
- [x] Flow Pack (setor 6): tornar expandível com status multi-select, comentários e produção por máquina
- [x] Ponteira (setor 7): tornar expandível com status multi-select, comentários e produção por máquina
- [x] Pirografar (setor 9): tornar expandível com status multi-select, comentários e produção por máquina

## Tipo de madeira no Pirografar (setor 9)
- [x] Adicionar variantes Bambu e Madeira no setor 9 (mesma dinâmica do Multilamina com Benazzi/Madeira Dura)

## Medidas de madeira no Ponteira (setor 7)
- [x] Adicionar medidas 180mm, 200mm, 220mm, 250mm no setor Ponteira (7)

## Card Embalagem (setor 8) - Busca de Produtos Acabados
- [x] Caixa de busca com os 53 produtos acabados do estoque (Madeira - Produto Acabado)
- [x] Selecionar produto e abrir campo de quantidade para registrar produção
- [x] Sincronização: novos produtos criados no estoque aparecem automaticamente no card 8
- [x] Atualizar backend com procedure getFinishedProducts para listar produtos
- [x] Atualizar frontend do setor 8 com busca, seleção e campo de quantidade

## Bug: Card Embalagem - produtos não aparecem na busca
- [x] Diagnosticar e corrigir: getFinishedProducts buscava de dashboardData com filtro errado (MADEIRA/PRODUTO ACABADO não existe); corrigido para buscar de stock_items (142 produtos)

## Bug: Card Embalagem - listar SOMENTE itens do card Madeira - Produto Acabado
- [x] Analisar filtro do card "Madeira - Produto Acabado" na aba Estoque e replicar no getFinishedProducts (63 produtos: SG:05 + SG:16 G:18/19)

## Card Embalagem (setor 8) - Cards individuais para produtos registrados
- [x] Produtos registrados no dia aparecem como cards individuais após salvar
- [x] Cada card mostra código, nome do produto e quantidade registrada
- [x] Permitir edição rápida da quantidade diretamente no card
- [x] Permitir remover registro do card

## Seleção Visual (setor 5) - Adicionar medidas iguais à Seleção Automática (setor 4)
- [x] Incluir as mesmas medidas/variantes do setor 4 no setor 5 (150mm, 180mm, 200mm, 218mm, 250mm, 300mm, 350mm)

## Produção - Botão único "Salvar Dia"
- [x] Remover botões de salvar individuais de cada máquina/mesa
- [x] Criar um único botão "Salvar Dia" que salva todos os lançamentos de produção de uma vez
- [x] O botão deve ficar visível e acessível (sticky no rodapé, fica verde com asterisco quando há alterações)

## Produção - Mover botão Salvar Dia para o header
- [x] Mover botão "Salvar Dia" do rodapé para o lado do seletor de data no header
- [x] Remover botão sticky do rodapé

## Estoque - 6 colunas ocultas informativas (Estoque + Sob Encomenda)
- [x] Backend: endpoint getMonthlySalesByProduct para buscar vendas dos últimos 3 meses + mês atual
- [x] Coluna 1: Vendas Mês -3 (quantidade vendida há 3 meses)
- [x] Coluna 2: Vendas Mês -2 (quantidade vendida há 2 meses)
- [x] Coluna 3: Vendas Mês -1 (quantidade vendida no mês passado)
- [x] Coluna 4: Média 3M (média das vendas dos últimos 3 meses)
- [x] Coluna 5: Estoque Regulador Calculado (média × 2,33 = cobertura 60 dias)
- [x] Coluna 6: Vendas Mês Atual (vendas do mês corrente)
- [x] Colunas ficam ocultas por padrão, toggle com ícone para mostrar/esconder
- [x] Posicionadas entre Projetado e Estoque Regulador
- [x] Aplicar nos cards Estoque e Sob Encomenda
- [x] Aplicar no card Madeira - Produto Acabado (entre Disponível e Est. Reg.)
- [x] Não alterar nenhuma informação existente

## Estoque - Melhorias visuais nas colunas ocultas
- [x] Aumentar espaçamento/largura das 6 colunas ocultas para melhor legibilidade
- [x] Travar header da tabela (sticky) - container max-h-[60vh] overflow-auto com thead sticky top-0
- [x] Destacar ícone de expandir colunas (amarelo pulsante quando fechado, azul sólido quando aberto, tamanho maior)

## Estoque - CORRIGIR largura das colunas ocultas (URGENTE)
- [x] Colunas de vendas corrigidas - removido tableLayout:fixed, adicionado min-w-[1800px], minWidth 120-140px por coluna
- [x] Títulos completamente legíveis: VENDAS JAN/26, VENDAS FEV/26, VENDAS MAR/26, MÉDIA 3 MESES, EST.REG. CALCULADO, VENDAS ABR/26

## Estoque - Ajustar colunas ocultas (largura, GRUPO, ícone toggle)
- [x] Reduzir largura das colunas de vendas para o mínimo do texto (removido minWidth fixo, px-2)
- [x] Ocultar coluna GRUPO quando colunas de vendas estão expandidas (ganhar espaço)
- [x] Remover coluna extra do ícone toggle - integrado no header PROJETADO
- [x] Produto e vendas visíveis ao mesmo tempo (GRUPO oculta + toggle integrado + larguras compactas)

## URGENTE: Colunas existentes estão sendo alteradas ao expandir vendas
- [x] Corrigido: tableLayout fixed mantido quando vendas ocultas, auto quando expandidas
- [x] PRODUTO com minWidth 260px quando expandido, mantém largura legível
- [x] Tabela com min-w-[1300px] quando expandida para scroll horizontal
- [x] Quando vendas ocultas: tabela EXATAMENTE como era antes
- [x] Quando vendas expandidas: mesmas colunas + 6 colunas extras com scroll horizontal

## URGENTE: Corrigir colunas - NÃO alterar largura de nenhuma coluna existente
- [x] tableLayout: fixed SEMPRE com width 1500px quando expandido
- [x] Ao expandir vendas: GRUPO removida, PRODUTO sticky left com largura 340px
- [x] PO, PROJETADO, ESTOQUE, PEDIDOS, DISPONÍVEL, UN/CX, EST.REG., STATUS - larguras fixas explícitas
- [x] 6 colunas de vendas adicionadas à direita com scroll horizontal
- [x] Quando vendas ocultas: tabela EXATAMENTE como era antes
- [x] PRODUTO sticky left para ficar visível ao rolar horizontalmente

## Restrição de acesso à aba Produção
- [x] Apenas senhas "Fernando", "Bruno" e "Guilherme" podem acessar a aba Produção
- [x] Outros usuários não devem ver ou acessar a aba Produção (tela "Acesso Restrito" com botão voltar)

## Bug: Valores divergentes entre aba Inadimplência e Visão Geral (Financeiro)
- [ ] Investigar por que A Receber na aba Inadimplência (R$ 2.117.767) difere da Visão Geral (R$ 1.471.270)
- [ ] Investigar por que Inadimplência na aba Inadimplência (R$ 647.697 vencido) difere da Visão Geral (R$ 628.792)
- [ ] Corrigir para que os valores sejam consistentes entre as abas

## Aba Recebíveis: alinhar total com Visão Geral
- [x] Excluir títulos vencidos (antes de hoje) do total da aba Recebíveis para bater com a Visão Geral

## Aba Recebíveis: corrigir valores para bater com Visão Geral
- [x] Reverter filtro de data - mostrar TODOS os títulos (vencidos + a vencer) com meses anteriores e contas bancárias
- [x] "A Vencer" no card = deve bater com "A Receber" da Visão Geral (usa vencimento >= hoje)
- [x] "Vencido" no card = deve bater com "Inadimplência - Falta Pagar" da Visão Geral (usa cutoff = dia útil anterior)
- [x] Total do card = Vencido + A Vencer

## Sininho de notificações: restringir acesso
- [x] Sininho de notificações visível apenas para senhas Erica, Maria, Marcos e Guilherme

## Fix: A Vencer ainda não bate com A Receber da Visão Geral
- [x] Mudar isOverdue para vencDate < hoje (não <= cutoff), assim A Vencer = vencimento >= hoje = A Receber da Visão Geral
- [x] Vencido = tudo com vencimento < hoje (inclui gap do fim de semana)

## Reset diário de autorizações de contas
- [x] Na virada do dia, TODAS as contas autorizadas devem ser desmarcadas (incluindo transferidas para pagamento posterior)
- [x] Exigir ticagem manual diária para cada conta
- [x] Reset manual executado: 292 autorizações removidas
- [x] auth_completion também resetado na virada do dia

## Sincronização Maxiprod
- [ ] Diagnosticar e corrigir erros na sincronização GraphQL com Maxiprod

## Correção de estoque manual
- [x] Queijo Coalho (Cod 00103): corrigir estoque manual de 306 para 296 caixas (atualizado por Guilherme)

## Histórico financeiro: valores inflados
- [x] Investigar por que o histórico mostra +R$ 733K acrescentados quando o total da semana é ~R$ 332K (causa: comparava com snapshot inexistente do dia anterior)
- [x] Corrigir lógica de detecção de mudanças: agora compara com último snapshot disponível
- [x] Limpar 6.193 mudanças incorretas e reprocessar: agora 43 mudanças reais (10/04 -> 13/04)
- [x] Garantir que após fechamento do mês, apenas mudanças reais (novos títulos, remoções) sejam registradas

## Venc. Orig. em laranja
- [ ] Destacar "Venc. Orig." em cor laranja nos cards de pagamento/recebimento

## Histórico Completo: valores inflados
- [x] Investigar e limpar mudanças incorretas no histórico completo (2.415 mudanças falsas removidas)
- [x] Reprocessar histórico com snapshots corretos: 108 mudanças reais (pagar: 6 add R$8.963 / 75 rem R$109.828 / 1 alt; receber: 3 add R$32.244 / 21 rem R$64.831 / 2 alt)
- [x] Garantir que apenas mudanças reais dia a dia sejam registradas desde o início do mês


## NFs sem número de pedido no card Faturado
- [x] Investigar causa: NFs emitidas sem pedido de venda vinculado (itemDoPedidoDeVendaId = NULL)
- [x] Buscar campo destinatarioOuRemetente do Maxiprod para obter nome do cliente
- [x] Usar clienteNome como fallback quando não há pedido vinculado (antes mostrava "NF XXXX")


## Card Total Entradas - Ajustes
- [x] Vendas/Revenda: subtrair valor de "outros" do total
- [x] Valores sem aproximação: mostrar valor completo (R$ 1.048.652,91 em vez de R$ 1.0M)

## Faturamento: excluir TRANSFERÊNCIA
- [x] Adicionar TRANSFERÊNCIA à lista de estados excluídos do faturamento (NF 2217 R$ 148,50)

- [x] Adicionar CANCELADA à lista de estados excluídos do faturamento (NF R$ 10,00)

## Regra de estados configuráveis do faturamento
- [x] Documentar no código: estados aceitos são BAMBU, MADEIRA, ROJÃO, SERRAGEM, MADEIRA/FIBRA e variações/combinações desses produtos. Qualquer outro estado novo deve ser excluído.

## Contas a Receber - Divergência com Maxiprod
- [x] Investigar e corrigir: dashboard R$ 1.509.456,80 vs Maxiprod R$ 1.528.361,79 (diferença R$ 18.904,99) - Causa: dashboard usava hoje como início, agora usa dia seguinte à conciliação

## Regra de Conciliação Bancária - Data de início
- [x] Implementar lógica: último dia útil antes de hoje = data da última conciliação
- [x] Contas a Receber e a Pagar começam a partir do dia seguinte à última conciliação
- [x] Considerar feriados nacionais na lógica de dia útil
- [x] Aplicar no getMonthlyBreakdown e em todos os cards que usam data de início do mês

## Anotações dos títulos - Contas a Receber e a Pagar
- [x] Buscar campo tarefasEAnotacoes da API GraphQL do Maxiprod para contas a receber e a pagar
- [x] Adicionar campo anotacoes no schema do banco (accounts_receivable e accounts_payable)
- [x] Exibir anotações de forma bem visível em todas as listagens: ReceivablesTab, Financial (tabelas CR e CP), InadimplenciaTab
- [x] Anotações em destaque: badge amber com borda, seção expandida com borda lateral amber

## Anotações na Autorização de Pagamentos
- [x] Exibir anotações do Maxiprod na aba de Autorização de Pagamentos (destaque rosa, bem visível)
- [x] Anotações são informação adicional - nada existente foi removido

## Aba Recebíveis - Mesma lógica de conciliação
- [x] Aplicar mesma data de corte (dia seguinte ao último dia útil) na aba Recebíveis
- [x] Valores de A Vencer e Vencido devem bater exatamente com Visão Geral e Inadimplência (confirmado: Total 2.125.435,67 / Vencido 588.838,88 / 443 títulos)
- [x] Incluir anotações do Maxiprod na aba Recebíveis (já implementado anteriormente)

## Divergência Total vs A Vencer na aba Recebíveis
- [x] Investigar diferença de R$ 1.200 entre Total (R$ 1.540.546,79) e A Vencer (R$ 1.539.346,79) - Causa: Total era geral, A Vencer era só Palitos. R$ 1.200 = Varetas. Não era bug.

## Espetos + Card Total Consolidado
- [x] Adicionar empresa Espetos ao Contas a Receber (mesma lógica da Varetas) - empresa sempre aparece mesmo com 0 títulos
- [x] Criar card de Total consolidado das 3 empresas: total vencidos + total a vencer
- [x] Aplicar todas as configurações existentes (conciliação, anotações, etc.)

## Destaque visual dos valores no cabeçalho Recebíveis
- [x] Valores (títulos, total, vencido) em contornos brilhantes retangulares com fontes maiores (border-2 + shadow glow + text-base font-bold)

## Filtros Avançados na aba Recebíveis
- [x] Filtro de status: Vencidos / A Vencer / Todos
- [x] Filtro de forma de cobrança: PIX / Boleto / Cheque / Depósito / Dinheiro / Todos
- [x] Card de resumo dinâmico premium com totais exatos do filtro aplicado
- [x] Visual diferenciado: contornos brilhantes, valores reluzentes, design sofisticado

## Filtros dentro de cada conta bancária
- [ ] Mover filtros (Status + Forma de Cobrança) para dentro de cada conta bancária expandida
- [ ] Card de resumo premium individual por conta bancária com totais daquela conta
- [ ] Replicar para todas as empresas e todos os meses
- [ ] Remover filtros globais do topo (manter apenas dentro das contas)
- [x] Mover filtros (Status + Forma de Cobrança) para DENTRO de cada conta bancária individualmente
- [x] Card de resumo premium dentro de cada conta bancária com totais específicos da conta filtrada
- [x] Filtros replicados para todas as empresas, todos os meses e todas as contas
- [x] Cada conta bancária tem seu próprio estado de filtro independente

## Links de Contraprova Maxiprod + Exportação PDF
- [ ] Botões "Verificar no Maxiprod" nos cards Faturamento, Vendas, Entradas e Contas Pagas (Visão Geral)
- [x] Links de contraprova Maxiprod na aba Recebíveis (por mês, por forma de cobrança)
- [ ] Sistema de alerta de divergência entre valores Manus vs Maxiprod
- [x] Botão de exportação PDF dos filtros aplicados em cada conta bancária (Recebíveis)
- [x] Controle de acesso: links de contraprova Maxiprod visíveis apenas para senhas "Guilherme" e "Fernando"

## Melhorias Modal Contraprova Maxiprod
- [x] Incluir senha Maxiprod no passo a passo (Luizfernando7008*)
- [x] Corrigir texto Unicode escapado "VERIFICA\U00E7\U00E3O" para "Verificação"
- [ ] Consultar API GraphQL Maxiprod em tempo real para mostrar valor comparativo
- [ ] Exibir valor Maxiprod ao lado do valor Manus no modal
- [ ] Tentar abrir Maxiprod na tela correta com filtros pré-configurados
- [x] Mostrar valor Maxiprod automaticamente nos cards (sem clicar) com alerta de divergência

## Correção automática de divergências e detalhamento
- [ ] Investigar origem da divergência de R$ 91,01 em Vendas
- [ ] Implementar correção automática em tempo real quando houver diferença
- [ ] Mostrar origem da diferença (quais pedidos/itens causam) quando persistir
- [ ] Finalizar skill reutilizável erp-financial-dashboard

## Card Selecionados para Desconto + Histórico + Divergências sob demanda
- [ ] Mover card "Selecionados para Desconto" para dentro de cada conta bancária
- [ ] Somatório dinâmico conforme títulos são ticados
- [ ] Botão "Exportar PDF" no card de selecionados
- [ ] Checkbox de finalização (apenas senha Fernando)
- [x] Histórico de ticagens com data, hora e operador ao lado
- [x] Divergências sob demanda: mostrar origem e pedir autorização antes de corrigir
- [x] Replicar contraprova Maxiprod na aba Vendas (4 cards) com olho, passo a passo e link
- [x] Replicar contraprova Maxiprod na aba Inadimplência com olho, passo a passo e link
- [ ] Adicionar olho de conferência Maxiprod dentro de cada conta bancária nos Recebíveis
- [x] Divergências sob demanda: mostrar origem e pedir autorização antes de corrigir
- [ ] Divergências: apontar valor, causa e pedir permissão antes de corrigir (nunca automático)
- [x] Corrigir query Inadimplência Maxiprod (mostra R$ 0,00 em vez do valor correto de vencidos)
- [x] Remover "Dif" quando valores Manus e Maxiprod batem (agora mostra "Confere" em verde)
- [x] Adicionar botão conferência Maxiprod ao lado de cada mês em Contas a Receber
- [x] Adicionar botão conferência Maxiprod ao lado de cada mês em Contas a Pagar
- [x] Adicionar olho de conferência nos 4 cards da aba Vendas (Valor Total, Faturado, A Faturar, Amostra/Bonificação)
- [x] Tudo visível apenas para senhas Fernando e Guilherme

## Correções UI - Recebíveis
- [x] Corrigir nome "Histórico" com encoding quebrado (Hist\u00f3rico aparecendo como caracteres estranhos)
- [x] Mover card verde "Selecionados para Troca" para o topo de cada conta bancária (em vez de na base)
- [x] Contraprova A Receber: excluir títulos vencidos (inadimplência) da comparação, pois Manus já exclui (já estava correto - usa mesmos from/to do getMonthlyBreakdown)
- [x] Remover ícones de olho (conferência Maxiprod) dos 4 cards da aba Vendas
- [x] Adicionar checkbox "Descontos Autorizados" no card verde Selecionados para Desconto (apenas senha Fernando pode ticar)
- [x] Mover checkbox "Descontos Autorizados" para o topo de cada conta bancária (entre card verde e tabela), só Fernando pode ticar
- [x] Corrigir checkbox visível para todos operadores, mas só Fernando consegue ticar (disabled para outros)
- [x] Corrigir projetadoCx para usar disponivelCx + poCx diretamente (evitar diferença de arredondamento Math.floor)
- [x] Criar componente MaxiprodSimulator reutilizável com animação passo a passo (simula preenchimento no Maxiprod)
- [x] Adicionar olho Maxiprod + simulador nos 4 cards de Vendas (Valor Total, Faturado, A Faturar, Amostra/Bonificação)
- [x] Adicionar olho Maxiprod + simulador nos 4 cards do Financeiro (Entradas, Faturado, Vendas, Contas Pagas)
- [x] Incluir login/senha Fernando no passo a passo e link "Abrir Maxiprod"
- [x] Liberar aba Produção para senhas "Erica" e "Maria" (atualizado no banco: accessProducao = true)
- [x] Otimizar consulta ao Maxiprod (API GraphQL) na contraprova: take 200→1000, cache 5min em memória
- [x] Corrigir cards dinâmicos (simulador Maxiprod) na aba Faturamento - valores agora passados corretamente
- [x] Adicionar card dinâmico MaxiprodSimulator na aba Recebíveis (olho do Maxiprod)
- [x] Tornar card dinâmico do simulador Maxiprod instantâneo (removido MAXIPROD API / Consultando, mostra só valor Dashboard)

## Correções MaxiprodSimulator (14/04/2026)
- [x] Fix: MaxiprodSimulator mostrando "R$ ---" em vez do valor real do Dashboard (valorManus undefined)
- [x] Fix: Corrigir passagem de valorManus para MaxiprodSimulator nos cards de Vendas
- [x] Fix: Corrigir passagem de valorManus para MaxiprodSimulator nos cards do Financeiro
- [x] Adicionar MaxiprodSimulator na aba Recebíveis (olho do Maxiprod)
- [x] Trocar texto "Valor encontrado!" por "Valor do Dashboard da Manus confere com o Maxiprod" no último passo do simulador
- [x] Criar card dinâmico "Guia de Cobrança" com passo a passo do processo de cobrança (olho na aba Inadimplência)
- [x] Restringir botão olho apenas para senhas Flavio, Thiago, Guilherme, Fernando
- [x] Incluir régua de cobrança (1, 3, 5 dias após vencimento), ações do responsável, salvar histórico, mudar status

## Correções 14/04/2026 - Autorizações, Histórico e Faturado
- [x] Fix: Autorizações de pagamento devem resetar (desticar) automaticamente na virada do dia (meia-noite) - adicionado startup check + cron
- [x] Redesign: Cards de Histórico Completo (Recebimentos/Pagamentos) com visual mais profissional, requintado e sofisticado
- [x] Fix: Divergência no valor "Faturado" entre aba Vendas e aba Financeiro - investigado: são métricas diferentes (NFs emitidas vs itens de pedidos com estado Faturado)
- [x] Fix: Botão "Guia de Cobrança" na aba Inadimplência - melhorado posicionamento e destaque com banner grande
- [x] Fix: Divergência entre card FATURADO e lista PEDIDOS FATURADOS na aba Vendas - corrigido: lista agora usa valorTotalPedido (com descontos/frete) quando disponível
- [ ] Adicionar setinhas de ordenação (asc/desc) nas colunas Valor e Venc. da tabela de inadimplentes (aba Financeiro > Inadimplência)
- [x] Redesign: Cards de confrontamento (Entradas vs Saídas, Fat. vs Pago, Vendas vs Pago) com visual sofisticado e explicações claras do que significam os valores negativos/vermelhos
- [x] Adicionar setinhas de ordenação (asc/desc) nas colunas Valor, Venc. e Atraso da tabela interna de títulos na vista por Cliente (Inadimplência)
- [x] Tornar setinhas de ordenação sempre visíveis (com opacidade baixa quando inativas) na vista por Título
- [x] Adicionar olho do Maxiprod (card dinâmico) em cada mês do resumo financeiro (substituído MonthVerifyModal por MaxiprodSimulator animado)
- [x] Adicionar olho do Maxiprod (card dinâmico) no total "A Receber" do resumo financeiro
- [x] Adicionar olho do Maxiprod (card dinâmico) no total "A Pagar" do resumo financeiro

## Operador Bruno (14/04/2026)
- [x] Adicionar "Bruno" como operador com mesmo acesso que Guilherme e Fernando em todos os pontos do código
- [x] Senha "Bruno" já existia no banco com mesmas permissões de Guilherme/Fernando (confirmado via query)

## Ajustes visuais e funcionalidade (14/04/2026)
- [x] Suavizar paleta de vermelhos nos cards de confrontamento (Entradas vs Saídas, Fat. vs Pago, Vendas vs Pago) - cores muito fortes para a vista
- [x] Corrigir consulta por cliente: pedidos faturados não mostram títulos (boletos/NFs) correspondentes - implementada busca ao vivo via Maxiprod GraphQL (pedidosDeVenda → itensDosPedidosDeVendas → itensDasNotasFiscais → contaAReceber)

## Calculadora Somatória em A Receber e A Pagar (14/04/2026)
- [x] Adicionar calculadora somatória (seleção de itens + soma) em cada mês de A Receber
- [x] Adicionar calculadora somatória (seleção de itens + soma) em cada mês de A Pagar
- [x] Adicionar calculadora somatória no total de A Receber (já existia no BucketCard)
- [x] Adicionar calculadora somatória no total de A Pagar (já existia no BucketCard)

## Ajustes visuais - Valores e Cards (14/04/2026)
- [x] Remover arredondamento nos valores dos cards de confrontamento (mostrar até centavos, não K/M)
- [x] Redesenhar cards Receber/Pagar/Saldo do gráfico semanal com visual profissional e explicações claras do significado de cada valor

## Ajustes Calculadora e Fluxo de Caixa (14/04/2026)
- [x] Mover calculadora para o topo do card de cada mês (em vez do rodapé)
- [x] Aumentar tamanho do ícone da calculadora em todos os cards
- [x] Adicionar preview sofisticado dos valores (A Receber, A Pagar, Saldo Projetado) no card fechado do Fluxo de Caixa

## Notificações e Sistema de Cobrança (14/04/2026)
- [x] Sininho de notificações visível apenas para Maria, Erica, Marcos e Guilherme (remover Fernando, Bruno, Gilson)
- [x] Sistema de cobrança automática de inadimplência - manter funcionando normalmente

## Autorização Fernando nos PDFs (14/04/2026)
- [x] PDF de descontos (Recebíveis): mostrar bem grande e visível se foi "AUTORIZADO POR FERNANDO" ou "NÃO AUTORIZADO" dependendo da senha
- [ ] PDF de pagamentos semanais (Financeiro): mostrar de forma visível se o checkbox foi ticado e autorizado pelo Fernando

## Verificação Automática Maxiprod em Tempo Real (14/04/2026)
- [x] Criar endpoints tRPC que consultam Maxiprod GraphQL em tempo real para cada seção (Faturamento, Vendas, A Receber, A Pagar, etc.)
- [x] Criar componente MaxiprodAutoVerifier que mostra resultado da comparação (verde=confere, vermelho=divergência)
- [x] Substituir MaxiprodSimulator pelo MaxiprodAutoVerifier em todos os pontos (Financial, Sales, ReceivablesTab, ResumoFinanceiroCard)
- [x] Completar indicação de autorização Fernando nos PDFs de descontos e pagamentos semanais
- [x] Cards de confrontamento compactos e expandidos: valor negativo = vermelho, positivo = verde, legendas maiores

## Cores Dinâmicas e Legendas Maiores nos Cards Financeiros (14/04/2026)
- [x] Cards de confrontamento: valores negativos ficam VERMELHO, positivos ficam VERDE
- [x] Legendas dos cards de confrontamento aumentadas (text-xs → text-sm, valores text-base → text-xl)
- [x] Cards expandidos: legendas e valores também aumentados
- [x] Cores suavizadas nos cards expandidos negativos (de red para amber/orange)

## Ajustes Inadimplência Tab (14/04/2026)
- [x] Trocar "responsável" por "responsável pela cobrança" no texto do Dia 1 — Primeiro Contato
- [x] Adicionar coluna "Vendedor" (puxado do Maxiprod - responsável) ao lado de Cliente
- [x] Adicionar colunas "Forma de Cobrança" ao lado de Vendedor
- [x] Mover coluna "Decisão de Cobrança" para após Atraso (reordenado: Cliente, Vendedor, Forma Cobr., Venc., Atraso, Decisão, Status, Valor, Ações)
- [x] Cards expandidos negativos: trocar amber/orange por vermelho neon suave (rose/red com opacidade)
- [x] MaxiprodAutoVerifier: passo a passo deve iniciar EXPANDIDO (não recolhido) ao abrir o modal

## Ajustes Visuais (14/04/2026 - Parte 2)
- [x] MaxiprodAutoVerifier card: adicionar animação/movimento dinâmico (gradiente animado, shimmer, etc.)
- [x] Legendas dos cards compactos de confrontamento: trocar textos informais por norma culta formal

## Ajustes Inadimplência Colunas (14/04/2026 - Parte 3)
- [x] Reordenar colunas: Decisão de Cobrança → Vencimento → Atraso (nessa ordem)
- [x] Adicionar bordas mais escuras entre as colunas da tabela (border-slate-300)
- [x] Restaurar vídeo animado do passo a passo no MaxiprodAutoVerifier (simulação visual dos passos)
- [x] Corrigir verificação Maxiprod do card "Faturado" na aba Vendas: nova seção vendas_faturado (pedidos com estadoItem=Faturado)

## Ajuste Layout Tabela Inadimplência (14/04/2026 - Parte 4)
- [x] Corrigir layout da tabela: nada cortado (nomes, vendedor, ícones de ações telefone/histórico/livrinho)
- [x] Otimizar larguras das colunas, texto menor onde necessário, quebra de linha adequada

## Reordenar Valor antes de Vencimento (14/04/2026)
- [x] Mover coluna Valor para antes de Vencimento na tabela de inadimplência (header + TitleRow + ClienteTitleRow)

## Melhorias Histórico Completo Recebimentos (14/04/2026)
- [x] Ordenar semanas do mais antigo para o mais recente (inverter ordem atual)
- [x] Adicionar setinhas de filtro (toggle) para inverter ordenação quando quiser
- [x] Mostrar sempre datas completas das semanas (ex: "Semana analisada: 01/06 a 07/06") em vez de "Além de 8 semanas"/"Vencidas"
- [x] Adicionar label "Data da modificação:" antes das datas de modificação
- [x] Explicar todos os números visíveis com labels claros
- [ ] Adicionar ícone do olho com vídeo explicativo mostrando o que foi acrescentado e retirado
- [x] Corrigir nomes/descrições cortados no Histórico Completo (remover truncate, permitir quebra de linha)
- [x] Mover botão "Histórico" da base para o topo do card semanal
- [x] Renomear botão para "Histórico de Modificação Semanal"

## Melhorias Visuais Histórico e Inadimplência (14/04/2026 - Parte 5)
- [x] Card de inadimplência (Contraprova Maxiprod): tornar dinâmico com vídeo animado ao vivo igual aos outros MaxiprodAutoVerifier
- [x] Corrigir expand/collapse dos cards do Histórico de Modificação Semanal (não está funcionando)
- [x] Cards do Histórico: layout maior, mais expansivo, espaçado e limpo (fácil de ler)
- [x] Botão "Histórico de Modificação Semanal": trocar cinza sem vida por neon amarelo escuro chamativo
- [x] Criar ícone do olho no Histórico com animação visual didática explicando o sistema de detecção de mudanças semanais
- [x] Animação deve mostrar: início do mês registra títulos, cada dia detecta alterações (entradas/saídas) nas 8 semanas seguintes
- [x] Garantir que conferência Maxiprod só aparece para operadores Fernando, Bruno e Guilherme

## Melhorias Gráfico + Guia de Cobrança (14/04/2026 - Parte 6)
- [x] Colunas dinâmicas no gráfico Evolução Diária: barras surgindo uma a uma com animação ao clicar
- [x] Números mais nítidos e destacados no relatório exportado (não achatar)
- [x] Destacar o número das vendas no gráfico/relatório
- [x] Guia de Cobrança: Dia 1 pós-vencimento = WhatsApp + Email (registro formal)
- [x] Guia de Cobrança: Dia 3 pós-vencimento = Ligação + Email
- [x] Guia de Cobrança: Dia 5 pós-vencimento = Ligação + Email
- [x] Registrar tudo no guia de cobrança e histórico
- [x] Atualizar documento gerado no histórico de cobrança com novas regras

## Ajustes Visuais Botão + Labels (14/04/2026 - Parte 7)
- [x] Botão "Histórico de Modificação Semanal": amarelo neon mais discreto (menos chamativo)
- [x] Botão: retângulo mais justo com o texto (menos largo)
- [x] Substituir "Títulos vencidos (anteriores à data atual)" por datas reais das semanas modificadas

## Alerta Decisão Cobrança + Histórico Fechado (14/04/2026 - Parte 8)
- [x] Cards do histórico de modificação semanal devem iniciar fechados (collapsed)
- [x] Alerta para Vitória: destacar clientes inadimplentes sem decisão de cobrança preenchida
- [x] Card "Olho do Maxiprod" com vídeo dinâmico ensinando a preencher decisão de cobrança
- [x] Vídeo personalizado por vendedor (login genérico: "Use seu login e senha do Maxiprod")
- [x] Passo a passo: Clientes → buscar cliente → Campos adicionais grupo COBRANÇA → SITUAÇÃO → escolher opção
- [x] Responsabilidade da Vitória: vendas a partir de hoje sem decisão de cobrança preenchida
- [x] Atualizar conteúdo do tutorial "Como Funciona o Histórico" com informações mais completas (snapshot no início do mês, detecção diária, entradas/saídas com data/valor/cliente/semana)
## Histórico de Variação do Estoque Projetado (14/04/2026 - Parte 9)
- [ ] Registrar snapshots diários do estoque projetado (Disponível + PO) por produto
- [ ] Criar componente visual de histórico de variação no card PROJETADO
- [ ] Mostrar quando e por que o número mudou (aumento de PO, entrada de mercadoria, etc.)
## Regras Aba Produção (14/04/2026 - Parte 10)
- [x] Permissão de edição: APENAS Maria pode editar na aba Produção; demais operadores somente visualizam
- [x] Embalagem (setor 8) com data >= 15/04/2026: soma no estoque Madeira PA pelo código do produto (em caixas)
- [x] Registros anteriores a 15/04/2026: apenas histórico, não afeta estoque nenhum
- [x] Outros setores (Multilâmina, Vareteira, Seletoras, etc.): apenas histórico, nunca afetam estoque

## Botão Enviar Observação (14/04/2026 - Parte 11)
- [x] Adicionar botão "Enviar Observação" na caixa de comentários para confirmar o registro

## Colunas Caixa/Saco nos Setores 2-3-4 (15/04/2026 - Parte 12)
- [x] Cada medida (150mm-350mm) nos setores 2, 3, 4 terá 2 colunas: caixa e saco
- [x] Conversão automática de caixa para saco usando fator de conversão configurável por medida
- [x] Somatório total sempre em sacos (saco direto + caixa convertida)
- [x] Ícone "Olho" visível para todos com card brilhante/neon mostrando fator de conversão e cálculo
- [x] Fatores de conversão padrão (1:1) prontos para atualização posterior

## Ajustes Layout Caixa/Saco (15/04/2026 - Parte 13)
- [x] Colunas caixa e saco mais estreitas
- [x] Somatório total à direita de cada medida (caixa convertida + saco = total em sacos)
- [x] Preview de conversão: ao preencher caixa, mostrar "= X sacos" na coluna da medida

## Alterações Medidas e Embalagem (15/04/2026 - Parte 14)
- [x] Vareteira (2): renomear para 3,8x + adicionar 3,5x200, 3,5x250, 3,5x350
- [x] Seletora Toco (3): adicionar Máquina 4, remover 150/300/350, renomear para 3,8x, adicionar 3,5x200, 3,5x250
- [x] Seleção Automática (4): remover 300/350, adicionar 3,5x200/3,5x250, renomear para 3,8x
- [x] Seleção Visual (5): adicionar 3,8x na frente + adicionar 3,5x200mm
- [x] Ponteira (7): adicionar 3,8x na frente de todas
- [x] Embalagem (8): seletor Madeira/Bambu com 2 categorias de produtos do estoque

## Ajustes Visuais e Medidas (15/04/2026 - Parte 15)
- [x] Expandir badges das medidas para mostrar nome completo (sem truncar)
- [x] Mover olho roxo para ao lado do título "PRODUÇÃO POR MEDIDA DE MADEIRA"
- [x] Vareteira (2): medidas 3,5x200/250/350 apenas na Máquina 5, máquinas 1-4 só com 3,8x

## Flow Pack e Remoção 300mm (15/04/2026 - Parte 16)
- [x] Flow Pack (item 6): adicionar medidas 3,8x220mm, 3,8x250mm, 3,8x180mm, 3,5x200mm
- [x] Remover todas as medidas 300mm (3,8x300mm, 3,5x300mm) de todos os setores/máquinas

## 3 Colunas: Cx Peq + Cx Grande + Saco (15/04/2026 - Parte 17)
- [x] Alterar de 2 colunas (caixa/saco) para 3 colunas (caixa pequena, caixa grande, saco) nos setores 2-3-4
- [x] Fatores de conversão separados por tipo de caixa (cx peq e cx grande) para cada medida
- [x] Atualizar card do olho para mostrar fatores de ambos os tipos de caixa em ordem crescente
- [x] Atualizar backend (salvamento) para suportar 3 tipos de registro por medida (_cxp, _cxg, _saco)
- [x] Fatores reais aplicados: 3,8x180(0.5cp), 3,8x200(0.6cp/0.8cg), 3,8x220(0.5cp/0.7cg), 3,8x250(0.8cg), 3,8x350(0.4cp/0.6cg), 3,5x200(0.6cp/0.8cg)

## Bloqueio de Datas Futuras na Produção (15/04/2026 - Parte 18)
- [x] Bloquear preenchimento para datas futuras na aba Produção (apenas dia atual e retroativos permitidos)
- [x] Exibir aviso quando Maria selecionar data futura

## Ordem Fixa dos Bancos no Faturamento (15/04/2026 - Parte 19)
- [x] Fixar ordem dos bancos para ser sempre a mesma independente dos valores (não ordenar por valor)
- [x] Redesign colunas 3-col (Caixa Pequena, Caixa Grande, Saco) nos setores 2-3-4: nomes completos sem abreviação, números pretos e maiores, labels visíveis, medidas mais vistosas, preencher todo o card, layout profissional
- [x] Fix ordenação de bancos: ordem fixa alfabética em vez de por valor (já implementado no backend)

## Fix Comparação Maxiprod Recebíveis (15/04/2026 - Parte 20)
- [x] Corrigir valores absurdos do Maxiprod na conferência de Contas a Receber (ex: R$ 719.718,10 vs R$ 8.500,00 do dashboard)
- [x] Causa raiz: getMaxiprodContraprova seção 'recebiveis' não filtrava por empresa/banco/conta — somava TODOS os títulos do mês
- [x] Backend: adicionar filtros opcionais empresaNome, bancoNome, contaNumero ao getMaxiprodContraprova
- [x] Backend: usar mesma lógica de cálculo do getReceivablesByBank (valorLiquido - valorRecebidoLiquido, excluir <= 0)
- [x] Frontend: estender MaxiprodAutoVerifier com props opcionais empresaNome, bancoNome, contaNumero
- [x] Frontend: ReceivablesTab passa empresa/banco/conta ao MaxiprodAutoVerifier
- [x] Cache key inclui filtros de empresa/conta para evitar colisão
- [x] Testes: 7 testes para getMaxiprodContraprova recebiveis (com/sem filtros, combinados, sem resultados)

## Estoque Madeira - Permissão Maria + Auto-feed Embalagem (15/04/2026)
- [x] Dar permissão para Maria editar manualmente o estoque de Madeira (Produto Acabado) - sem bloqueio de redução
- [x] Auto-feed: quando Maria preencher Embalagem (setor 5) na Produção, alimentar automaticamente o estoque de Madeira - Produto Acabado
- [x] Hoje (15/04) é o último dia de preenchimento manual; a partir de amanhã, estoque alimentado automaticamente pela Produção → Embalagem
- [x] Testes automatizados para as novas funcionalidades (20 testes passando) (20 testes passando)

## Cards Madeira + Relatório Conferência Auto-feed (15/04/2026)
- [x] Criar relatório de conferência do auto-feed: botão discreto mostrando estoque ontem, qty embalagem, estoque atual por produto
- [x] Remover card Vareta de Apito da seção Industrialização Madeira
- [x] Reordenar cards: Estoque, Pedidos, Disponível, Semi Pronto, Aguardando Escolha, Rojão, Alertas
- [x] Todos os cards em uma única linha
- [x] Backend endpoint getStockAutoFeedReport no productionRouter
- [x] Frontend modal com tabela comparativa e resumo de divergências
- [x] 5 testes automatizados para o relatório de auto-feed

## Ajuste Cards Expandíveis Madeira (15/04/2026)
- [x] Madeira PA: remover colunas PO (Compra) e Projetado
- [x] Madeira PA: adicionar mini-cards Rojão e Apito no lugar (3 linhas: Estoque, Pedidos, Disponível)
- [x] Semi Pronto: remover colunas PO (Compra) e Projetado, alargar cards restantes
- [x] Aguardando Escolha: remover colunas PO (Compra) e Projetado, alargar cards restantes

## Produção - Label Fator Conversão + Botão OK (15/04/2026)
- [x] Adicionar texto "(Fator de Conversão)" ao lado do ícone do olho roxo na aba Produção
- [x] Adicionar botão "OK" ao lado de cada campo de preenchimento na aba Produção para confirmar entrada (SimpleMachineRow, ExpandableMachineRow single/triple unit)

## Fix Tabela Madeira PA - Nomes Cortados e Grupo (15/04/2026)
- [x] Fix produto 00354A e outros com nome cortado/truncado na tabela Madeira PA
- [x] Coluna Grupo: mostrar "Industrialização/Madeira" completo em roxo, quebrar texto se necessário (sem "...")
- [x] Layout responsivo alinhado para computador e tablet
- [x] Trocar abreviação "sc" por "sacos" na coluna Total da aba Produção
- [x] Centralizar badges de medida no centro do card na coluna MEDIDA da aba Produção (todos os setores)
- [ ] Cards Madeira PA/Semi Pronto/Aguardando: reduzir padding/altura para ficar slim como Bambu (Rojão e Apito mantêm)

## Fix Divergência Conferência Maxiprod Recebíveis (15/04/2026)
- [ ] Investigar por que API Maxiprod retorna R$ 260.645 vs Maxiprod real R$ 218.396 para mesma conta
- [ ] Provável causa: query inclui títulos já conciliados/baixados ou usa campo errado (bruto vs líquido a receber)
- [ ] Corrigir query para usar exatamente o mesmo cálculo que o Maxiprod usa na tela de Contas a Receber
- [ ] Garantir que valores batam em tempo real sem divergência

## Fix Nomes Cortados nos Cards de Produção (15/04/2026)
- [x] Corrigir nomes truncados nos cards de setores de produção (SELETORAS T..., SELEÇÃO AUT..., SELEÇÃO VIS..., MÁQUINA PIR...)
- [x] Permitir quebra de texto para mostrar nome completo, mantendo layout em linha única de cards

## Máquina Pirografar - Redesign com Registro Completo (15/04/2026)
- [x] Criar tabela no banco para registros de pirografia (produto, nome pirografado, quantidade, máquina, data, operador)
- [x] Endpoint backend para listar produtos do estoque Bambu e Madeira (para seletor)
- [x] Endpoint backend para salvar registro de pirografia
- [x] Endpoint backend para buscar histórico de pirografia (futuro: nomes e produtos mais pirografados)
- [x] UI: Seletor de produto puxando automaticamente do estoque Bambu e Madeira
- [x] UI: Campo "Nome Pirografado" para registrar o nome do cliente gravado no palito
- [x] UI: Campo de quantidade (caixas pirografadas)
- [x] UI: Registro por máquina (Máquina 1, 2, 3)
- [x] Tudo registrado no banco para histórico futuro
- [x] Testes automatizados para endpoints de pirografia (17 testes passando)

## Ajustar Altura dos KPI Cards do Bambu (15/04/2026)
- [x] Igualar altura dos KPI cards em todos os cards expandíveis (Bambu/ClassificationCard, Madeira PA, Semi Pronto, Aguardando) - py-3.5 + text-lg + mt-1 para consistência visual

## Visibilidade da Aba Produção para Todos os Operadores (15/04/2026)
- [x] Todos os operadores (Erica, Maria, Bruno, Fernando, Guilherme) devem poder visualizar todos os cards/setores da aba Produção
- [x] Todos podem expandir cards, ver dados, navegar por tudo
- [x] Apenas Maria pode preencher/editar dados na Pirografia (campos desabilitados para outros)
- [x] Outros setores mantêm regra existente de quem pode editar

## Fix: Visibilidade Completa dos Setores para Não-Maria (15/04/2026)
- [x] PirografiaSector: mostrar seletor Bambu/Madeira, lista de produtos e registros para todos (somente leitura)
- [x] EmbalagemSector: mostrar lista de produtos e busca para todos (somente leitura)
- [x] Campos de entrada (nome, quantidade, botão salvar) desabilitados para não-Maria

## Pirografia: Visualização Aberta para Não-Maria (15/04/2026)
- [x] Fernando, Bruno e Guilherme devem ver campos de preenchimento (nome pirografado, quantidade, tipo de produto) abertos em modo somente leitura
- [x] Não precisam clicar para ver — visualização geral já aberta (formulário completo com campos desabilitados)
- [x] Maria mantém o fluxo interativo atual (editável)

## Renomear "Estoque Manual" para "Estoque" (15/04/2026)
- [x] Renomear "Estoque Manual" para "Estoque" em toda a interface (cards, tabelas, headers, descrições)
- [x] Remover referência a "manual" já que será alimentado automaticamente pela aba Produção

## Lógica de Baixa Automática no Estoque (15/04/2026)
- [x] Quando pedidos diminuem no Maxiprod (baixa/entrega), subtrair mesma quantidade do estoque
- [x] Exemplo: pedido 250cx, entregues 60cx → estoque reduz 60cx, pedidos ficam 190cx
- [x] Se todas 250cx entregues e dadas baixa → pedidos = 0, estoque reduzido em 250cx = disponível
- [x] Monitorar variação de pedidos por produto entre sincronizações do Maxiprod
- [x] Guardar snapshot dos pedidos anteriores para calcular delta
- [x] Implementado em maxiprodGraphQL.ts e maxiprodSync.ts
- [x] Registrar cada baixa no stockEditHistory como tipo "baixa_pedido"
- [x] Nunca deixar estoque negativo (Math.max(0, ...))
- [x] 15 testes automatizados passando (baixaAutomatica.test.ts)

## Passo 1: Verificar Baixa Automática (15/04/2026)
- [x] Verificar se a lógica de baixa automática está integrada corretamente no fluxo de sync
- [x] Testar cenário: pedidos diminuem → estoque reduz automaticamente (24 testes passando)

## Passo 2: Tela de Histórico de Pirografia (15/04/2026)
- [x] Criar seção/aba de Histórico de Pirografia
- [x] Ranking dos nomes mais pirografados (top nomes por quantidade)
- [x] Ranking dos produtos mais pirografados (top produtos por quantidade)
- [x] Filtro por período (data início/fim)
- [x] Mostrar totais e estatísticas gerais

## Passo 3: Corrigir Contraprova Maxiprod nos Recebíveis (15/04/2026)
- [ ] Bug: contraprova com Maxiprod não usa os mesmos filtros selecionados na Manus (período, empresa, etc.)
- [ ] Quando usuário clica no olho (contraprova), passar os filtros ativos para a query do Maxiprod
- [ ] Comparar valor filtrado da Manus com valor filtrado do Maxiprod (mesmos critérios)

## Fix: Contraprova Maxiprod Recebiveis - Usar Mesmos Filtros (15/04/2026)
- [x] Backend: Adicionar campos statusFilter e formaFilter ao input da getMaxiprodContraprova
- [x] Backend: Aplicar filtro de status (VENCIDO = isOverdue, A_VENCER = !isOverdue) na query de recebiveis
- [x] Backend: Aplicar filtro de forma de cobranca (PIX, Boleto, Cheque, Deposito, Dinheiro) na query
- [x] Frontend MaxiprodAutoVerifier: Adicionar props statusFilter e formaFilter
- [x] Frontend ReceivablesTab: Passar statusFilter e formaFilter ao MaxiprodAutoVerifier
- [ ] Testes para contraprova com filtros de status e forma

## Melhorar Visual das Listas de Pagamentos/Recebimentos (15/04/2026)
- [x] Adicionar linhas separadoras entre cada item da lista
- [x] Alinhar colunas (nome, data, valor) de forma consistente
- [x] Formatação profissional e limpa para facilitar leitura
- [x] Aplicar em ambas as listas (recebimentos e contas pagas)

## Histórico de Pirografia (15/04/2026)
- [x] Backend: endpoint para listar registros de pirografia com filtro por período (já existia getPirografiaHistory)
- [x] Backend: endpoint para ranking de nomes mais pirografados (já existia em getPirografiaHistory)
- [x] Backend: endpoint para ranking de produtos mais usados por quantidade (já existia em getPirografiaHistory)
- [x] Frontend: tela de Histórico de Pirografia na aba Produção
- [x] Frontend: filtro por período (data início/fim)
- [x] Frontend: ranking de nomes pirografados com contagem
- [x] Frontend: ranking de produtos mais usados
- [ ] Testes automatizados para endpoints de histórico de pirografia

## Testes da Baixa Automática de Estoque (15/04/2026)
- [x] Testes automatizados para validar baixa automática quando pedidos diminuem no Maxiprod (24 testes)
- [x] Verificar lógica de baixa_pedido no stockEditHistory

## Testes da Contraprova com Filtros (15/04/2026)
- [x] Testes para contraprova aplicando statusFilter (VENCIDO/A_VENCER)
- [x] Testes para contraprova aplicando formaFilter (Boleto/Cheque/PIX)
- [x] Testes para contraprova com filtros combinados

## Ajuste Visual dos Cards de Estoque (15/04/2026)
- [x] Título do produto em cinza claro
- [x] Labels (Estoque, Pedidos, Disponível) e valores em preto
- [x] Mini-cards Rojão e Apito: labels e valores todos em roxo
- [x] Não abreviar 'Dispon.' nos mini-cards Rojão e Apito (usar 'Disponível')

## Reorganização Layout KPI Cards + Correção Cor Rojão (15/04/2026)
- [x] Alinhar colunas verticalmente: Estoque/Pedidos/Disponível/Produtos entre os 3 cards
- [x] Madeira PA: grid 6 colunas (Estoque, Pedidos, Disponível, Rojão estreito, Apito estreito, Produtos)
- [x] Semi Pronto e Aguardando: grid com mesmas proporções para alinhar com Madeira PA
- [x] Corrigir cor do mini-card Rojão: de roxo para azul (bg-blue, text-blue)
- [x] Apito permanece roxo
- [x] Card Produtos em cinza com número em preto
- [x] Estender cards em comprimento para ocupar melhor o espaço (como Bambu)

## Corrigir Contraprova Contas a Receber (15/04/2026)
- [x] Descontar inadimplentes na contraprova ao comparar com Maxiprod (API)
- [x] Investigar diferença de ~R$ 610k entre dashboard e API (causada por inadimplentes incluídos na contraprova)

## Corrigir Contraprova Contas a Pagar (15/04/2026)
- [x] Investigar divergência de ~R$ 2M entre dashboard e API no Total A Pagar (causada por vencidos antes do cutoff)
- [x] Excluir vencidos/inadimplentes na contraprova de contas a pagar (mesma lógica do receber)
- [x] Garantir que conferências automáticas batam todo dia (lógica persistida no código, usa cutoff dinâmico)
- [x] Investigar divergência persistente de ~R$ 1.94M no contas a pagar (causa: dashboard mostra 10 meses, contraprova buscava até 2099; fix: limitar endDate ao 10º mês)

## Melhorias Consulta de Cliente + Contas Pagas (15/04/2026)
- [x] Remover "S/N" dos pedidos na consulta de cliente - mostrar número do pedido real
- [x] Mostrar todos os números de NFs vinculadas a cada pedido
- [x] Adicionar filtros profissionais: Em Aberto / Pago / Todos
- [x] Ordenação por vencimento (próximos a vencer primeiro até últimos)
- [x] Puxar títulos detalhados do Maxiprod para cada cliente (informações padronizadas)
- [x] Card sofisticado e moderno para a consulta de cliente
- [x] Contas Pagas: puxar todos os dados completos (fornecedor sem "-", descrição, anotações)
- [x] Contas Pagas: garantir que todos os fornecedores apareçam (não faltar nenhum)

## Ajustes Visuais Financeiro (15/04/2026)
- [x] Cards de confrontamento: afinar (menos padding/grossura), cor vermelha mais suave e avermelhada (menos rosa/brilhosa)
- [x] Substituir "fat." por "faturamento" (palavra completa)
- [x] Fluxo de Caixa: aumentar tamanho da fonte nos cards (A Receber, A Pagar, Saldo)
- [x] Criar seção IMPORTAÇÃO no dashboard de Estoque (mesmo estilo da INDUSTRIALIZAÇÃO MADEIRA, abaixo do card de sync, antes do estoque geral)
- [x] Desfazer seção IMPORTAÇÃO do dashboard de Estoque (ficou errado, misturou estoque)
- [x] Adicionar apenas título decorativo "Importação" entre card de conexão Maxiprod e os KPIs de estoque (sem mexer em números)
- [x] Investigar e corrigir KPI "Pedidos (Venda)" que subiu demais (2.987 → 7.510 cx) - fix: usar quantidade direta para fator=1, pedidosUn/unitsPerBox para fator>1. Total corrigido: 2.511 cx
- [x] Corrigir Disponível e Projetado nos KPIs: Disponível = Estoque - Pedidos (corrigido), Projetado = Disponível + PO. Resultado: Est 19.501 - Ped 2.511 = Disp 16.990 + PO 13.989 = Proj 30.979
- [x] Aba Produção: desabilitar soma automática no estoque da Madeira (produto acabado) - manter registro no histórico mas NÃO somar no estoque. Flag MADEIRA_STOCK_AUTO_FEED_DISABLED = true em upsertEntry e batchUpsertEntries.
- [x] KPI Estoque Total: mostrar apenas produtos de importação (revenda + MP), excluir industrialização (madeira) da contagem de produtos e totais
- [x] Investigar e corrigir divergência KPI PO (13.989 cx) vs seção Pedidos de Compra (9.639 cx) — causa: produto 00058 (kg) usava poUn em vez de totalCx. Fix: poCxVal sempre usa totalCx. Ambos agora mostram 9.639 cx
- [x] Card Alertas na Industrialização Madeira: ajustar altura para ficar igual aos outros KPI cards (h-full no KPICard e no wrapper)
- [x] PO 00058: na tabela de estoque poCx = 4500 kg (150 cx × 30kg), KPI PO usa poLotes (9.639 cx), POOverviewCard usa poLotes (9.639 cx). Projetado = 320 + 4500 = 4820 kg. 16 testes passando.
- [x] Investigar queda Pedidos (Venda) de ~2.505 para 1.314 cx — NÃO É BUG: antes somava todos (2.505), agora soma só importação (1.314). Madeira = 1.191 cx excluída corretamente.
- [x] KPI PO (A Receber) corrigido para 9.639 cx (poLotes em caixas). Resync forçado. Demais KPIs mantidos (Pedidos 2.505, Estoque 19.501, 150 produtos)
- [x] KPI Pedidos (Venda) na seção Importação corrigido para usar items (todos) = 2.505 cx em vez de importItems = 1.314 cx
- [x] KPI Projetado na Importação corrigido: totalDisponivelCx + totalPOCx = 18.187 + 9.639 = 27.826 cx
- [x] KPIs Disponível e Projetado corrigidos: Disponível = totalEstoqueCx - totalPedidosCx = 16.996. Projetado = 16.996 + 9.639 = 26.635
- [x] Adicionado painel de médias diárias no gráfico Evolução Diária: 3 cards (atual, anterior, melhor) com média diária, badges de % vs melhor/anterior, gradientes e layout sofisticado
- [x] Botão de exportação PDF da lista de inadimplentes: header vermelho, boxes de aging, tabela 11 colunas, cores condicionais, footer com paginação
- [x] PDF Inadimplência: evitar corte de nomes entre páginas (rowPageBreak: 'avoid')
- [x] PDF Inadimplência: adicionar KPIs de status no cabeçalho (Pendente, Contatado, Em Negociação, etc.)
- [x] PDF Inadimplência: gradiente de cores por antiguidade (vermelho escuro → amarelo claro)
- [x] PDF Inadimplência: renomear "Decisão Cobr." para "DECISÃO DE COBRANÇA" sem abreviação
- [x] PDF Inadimplência: remover coluna Protesto apenas no PDF exportado
- [x] PDF Inadimplência: layout mais profissional e sofisticado
- [x] Consulta cliente: substituir "Título avulso" por NF ou Pedido (nome correto do documento)
- [x] Consulta cliente: alinhar layout da lista de documentos (Em Aberto, 1 título, tempo de atraso todos alinhados)
- [x] PDF Inadimplência: renomear coluna Doc/Parcela para mostrar "NF · Parcela X/Y" mais claro
- [x] PDF Inadimplência: centralizar todos os textos no meio das colunas
- [ ] BUG: Conferência Contas a Pagar retorna R$ 0,00 do Maxiprod (API) - valores mês a mês zerados
- [x] PDF Inadimplência: ajustar para modo paisagem perfeito, pronto para impressão deitada
- [x] PDF Inadimplência: sair salvo em modo paisagem real (como lâmina de slide), ocupando folha inteira, uma página por folha
- [x] PDF Inadimplência: garantir que salve em paisagem real reconhecido pelo macOS Preview (como lâmina de slide)
- [ ] BUG: Erro no histórico da aba Produção (senha Fernando)
- [x] Dashboard financeiro: criar seletor de mês como filtro (além do seletor de data diário)
- [x] Inadimplência: filtro multi-seleção por vendedor
- [x] Inadimplência: filtro multi-seleção por forma de cobrança
- [x] Inadimplência: filtro multi-seleção por decisão de cobrança
- [x] Sistema de cobrança: criar tabela collection_actions no banco (histórico de ações por cliente) (já existia)
- [x] Sistema de cobrança: backend tRPC - CRUD de ações de cobrança (adicionar, listar, editar, excluir) (já existia)
- [x] Sistema de cobrança: frontend - painel de histórico de cobrança por cliente (expandível na tabela) (já existia)
- [x] Sistema de cobrança: export PDF do histórico de cobrança de um cliente
- [x] Fluxo automático: telefone azul dia 1, cobrança dia 3, dia 5 (indicadores visuais) (já existia)
- [x] Fluxo automático: card vendedor dia 7 com documento para decisão (protesto/outra ação) (já existia)
- [x] Fluxo automático: clientes 2-7 dias - alerta Thiago para perguntar ao vendedor (já existia)
- [x] Fluxo automático: relatório vendedor dia 7 (apenas para clientes que entram a partir de hoje) (já existia)
- [x] Notificação: card na aba inadimplência quando decisão de cobrança não preenchida (Guilherme/Fernando/Vitória)
- [x] Cards média diária Vendas: remover badges % do card verde, mover Total para dentro dos cards, visual profissional
- [ ] Reverter seletor de data da Visão Geral do Financeiro (voltar como estava)
- [x] Filtro Decisão Cobrança: adicionar opção "Protesto Automático (Cartório)" sem abreviar (já renomeado para "Com Protesto (Cartório)")
- [ ] Filtro Forma Cobrança: simplificar para categorias (PIX, Boleto, Depósito, etc.) em vez de detalhes bancários

- [x] Trocar "Protesto Automático" por "Com Protesto (Cartório)" em todos os locais (InadimplenciaTab, CobrancaGuideSimulator, ActionDialog)
- [x] Categorizar filtro Forma de Cobrança: PIX, Boleto, Depósito, Cheque, Dinheiro (em vez de strings brutas do banco)
- [x] Filtro Decisão de Cobrança: mapear "COM PROTESTO" → "Com Protesto (Cartório)", "SEM PROTESTO" → "Sem Protesto"
- [x] PDF Inadimplência: decisão de cobrança exibe label mapeado

- [x] REGRA PERMANENTE: Histórico de produção registrado pela Maria NUNCA pode ser apagado em hipótese alguma

- [x] Guia de cobrança: reestruturar numeração — dia 1=item 1, sub-itens 1.1, dia 2=item 2, dia 3=item 3, etc.
- [x] Guia de cobrança: melhorar animação do telefone para chamar MUITA atenção do responsável
- [x] Vibração: regra 1,3,5 dias para novos inadimplentes (a partir de hoje) e 1 dia de atraso
- [x] Vibração: inadimplentes com >2 dias de atraso antigos NÃO vibram (tratamento diferente)
- [x] Salvar no banco a data de início da cobrança (primeiro dia que foi startado)
- [x] Notificações Manus: alertar Thiago, Flavio e Guilherme quando houver necessidade de cobrança (1 dia de vencimento + novos com 1,3,5 dias)

- [x] Produção/Estoque: Desativar baixa automática de estoque pela produção — produção NÃO deve dar baixa em produtos sem autorização
- [x] Produção/Estoque: Até hoje (16/04) estoque é preenchido manualmente; a partir de amanhã (17/04) estoque será calculado pelo que a Maria preencher na produção

- [x] Inadimplência: clientes com registro de cobrança ou qualquer alteração NUNCA desaparecem da lista (só saem quando pagam)
- [x] Inadimplência: card de "Pagos/Resolvidos" mostrando clientes que pagaram e saíram, com nome e data de saída

- [x] Flow Pack: adicionar seção "Produção por Medida de Fibra" com medida 3,0x200mm abaixo da seção de Madeira em todas as 5 máquinas

- [x] Vendas: colocar informações do gráfico acumulado (Acum. Atual, Anterior, Melhor) dentro dos cards de Média Diária correspondentes

- [x] BUG: Pedido 155 com NF 2253 faturado ontem não aparece nos faturados dos últimos 30 dias na aba Faturamento (causa: pré-filtro de 90 dias excluía pedidos com emissão antiga; ampliado para 365 dias)

- [x] Estoque Madeira PA: criar sistema de produtos mãe/variação expansível (como no Bambu)
- [x] Estoque Madeira PA: mapear 12 produtos mãe e suas variações conforme lista do usuário (16 variações inseridas no banco)
- [x] Estoque Madeira PA: regra variação — pedido de variação já debita do mãe, faturamento desconta da variação (não desconta 2x) — já implementado no stockProcessor
- [x] Estoque Madeira PA: regra sem variação — Estoque - Pedidos = Disponível; faturamento desconta do estoque — já implementado no stockProcessor

- [x] Inadimplência: Decisão de Cobrança deve ser puxada do Maxiprod para TODOS os clientes inadimplentes (campo decisaoCobranca no DB, sincronizado via campoAdicionalEspecifico do cliente no GraphQL, com fallback para mapa por nome)

## REGRA PERMANENTE: Decisão de Cobrança (NUNCA PERDER)
- [x] Documentar no código: Decisão de Cobrança vem do campo "SITUAÇÃO" dentro do grupo "COBRANÇA" nos campos adicionais do cadastro de Clientes no Maxiprod (Clientes → Editar empresa → campos adicionais do grupo COBRANÇA → SITUAÇÃO). Valores: "COM PROTESTO" / "SEM PROTESTO". Duas fontes: (1) fetchAccountsReceivable via cliente.campoAdicionalEspecifico, (2) fetchCobrancaDecisionMap via empresas.campoAdicionalEspecifico. NUNCA remover essa funcionalidade.
- [x] BUG CRÍTICO: Cobranças registradas pelo responsável NÃO estavam sendo salvas — causa: sync usava DELETE+INSERT gerando novos IDs, quebrando referências em collection_actions. Corrigido: sync agora usa UPSERT por maxiprodId (ON DUPLICATE KEY UPDATE), preservando IDs. Registros órfãos antigos limpos.
- [x] BUG: Variações do estoque da Madeira PA não apareciam — MadeiraPACard não tinha lógica de expansão. Adicionado expandedParents, botão expandir/colapsar, e sub-linhas de variações (9 pais com variações, seguindo padrão do card Bambu)
- [x] BUG: Madeira Semi-Pronto — colunas Pedidos e Disponível estavam vazias. Adicionado cálculo dinâmico de pedidos e disponível em ambos os cards (Semi-Pronto e Aguardando Escolha), incluindo KPIs no header e valores nas linhas da tabela
- [x] Cards média diária: remover legenda externa (escritos fora dos cards)
- [x] Cards média diária: remover linha "Total do Mês" de cada card
- [x] Cards média diária: aumentar letra dos textos após travessão (de text-[10px] para text-xs e de text-xs para text-sm)
- [x] Cards média diária: renomear títulos (Verde: "Média diária do mês atual", Azul: "Média diária do mês anterior", Amarelado: "Média diária do melhor mês de vendas")
- [x] Cards média diária: trocar badge "X dias" por "Total de X dias do mês"
- [ ] Redesenhar relatório de exportação de vendas: layout profissional, sofisticado e moderno, com cards de médias diárias atualizados, números maiores e em negrito
- [x] Guia de cobrança: removido passo "Salve prints do WhatsApp e cópia do e-mail como comprovante"
- [x] Guia de cobrança: corrigido texto — telefone para de vibrar com 1 ação (removidas referências a "AMBAS" e "duas ações")
- [x] Promover gestao@grupo-fox.com para admin (mesmas permissões de proprietário) — role atualizado de 'user' para 'admin' no banco
- [x] GitHub: orientado proprietário a conectar via UI do Manus (Settings → GitHub → Conectar)
- [x] Checklist roteiro cobrança: endpoint backend para calcular progresso dos 7 dias por título
- [x] Checklist roteiro cobrança: checklist visual no modal de Histórico (verde=feito, vermelho=não feito, cascata de erros)
- [x] Checklist roteiro cobrança: dias de espera (2,4,6) ticam verde automaticamente se dia anterior foi cumprido
- [x] Checklist roteiro cobrança: exportação PDF com roteiro completo e detalhes para vendedor
- [x] Checklist roteiro cobrança: incluir passo a passo completo (acertos e erros) no documento de tomada de decisão (dia 7+)
- [x] Checklist roteiro cobrança: 9 testes automatizados (cascata de erros, dias futuros, ações manuais, campos obrigatórios)
- [x] Edição de ações de cobrança: permitir Thiago editar tipo de ação (ligação→whatsapp, etc.) e notas
- [x] Edição de ações de cobrança: tabela de auditoria registrando antes/depois, quem editou e quando
- [x] Edição de ações de cobrança: UI de edição no modal de Histórico com botão de editar em cada ação
- [x] Edição de ações de cobrança: testes automatizados para endpoint de edição e registro de auditoria (7 testes)
- [x] Madeira PA valorização: investigar por que maioria dos produtos não tem preço médio preenchido (causa: preço nunca era calculado automaticamente para madeira)
- [x] Madeira PA valorização: buscar NFs e pedidos de venda de TODOS os produtos de madeira no Maxiprod (49 de 50 têm vendas)
- [x] Madeira PA valorização: preencher automaticamente R$/CX para todos os produtos com histórico de vendas (botão Auto-preencher Preços + preço sugerido inline)
- [x] Produção → Madeira PA: lançamentos de produção da Maria devem alimentar automaticamente o estoque de Madeira - Produto Acabado (auto-feed reativado)
- [x] Produção → Madeira PA: investigar estrutura dos dados de produção e como se relacionam com produtos de madeira
- [x] Produção → Madeira PA: implementar lógica de atualização automática do estoque ao registrar produção (flag reativada)
- [x] Produção → Madeira PA: testes automatizados para a integração produção→estoque (6 testes passando)
- [x] Checklist cobrança: títulos com dias anteriores ao início do sistema (16/04/2026) devem ser dispensados (verde) em vez de falha (vermelho)
- [x] Checklist cobrança: sem cascata de erros para dias anteriores ao início do sistema
- [x] Checklist cobrança: ajustar frontend para exibir "Dispensado — sistema iniciou em 16/04" em vez de "NENHUMA AÇÃO registrada"
- [x] Produção: corrigir divergência entre cards de produção (valores corretos) e histórico semanal (valores diferentes) — causa: histórico não aplicava conversão cxp/cxg→saco
- [x] Produção: garantir que histórico semanal use mesma fonte de dados dos cards (getWeeklySummary agora retorna tipoMadeira + frontend aplica conversão)
- [x] Checklist cobrança: roteiro deslocado para clientes com 3+ dias de atraso (hoje 17/04) — contar a partir de 16/04 com 1º Cobrança, Intervalo, 2º Cobrança, etc.
- [x] Checklist cobrança: card amarelo explicativo "Cliente já estava inadimplente quando o sistema começou em 16/04"
- [x] Checklist cobrança: sem notificação/vibração para clientes com 3+ dias de atraso a partir de hoje
- [x] Inadimplência tabela: 7 bolinhas manuais ao lado de cada cliente (apenas senhas Thiago/Guilherme/Flavio)
- [x] Inadimplência tabela: cabeçalho das bolinhas: Ação 1 | Intervalo | Ação 2 | Intervalo | Ação 3 | Intervalo | Decisão
- [x] Inadimplência tabela: ticagem verde manual pelo Thiago com histórico registrado (data/hora, sequência correta)
- [x] Inadimplência tabela: validar que ticagem segue sequência de dias sem pular
- [x] Inadimplência tabela: testes automatizados para manual ticks e supressão de vibração de títulos legados (13 testes)
- [x] Inadimplência: redesenhar layout das 7 bolinhas — card sofisticado, moderno e profissional, sem textos encavalados
- [x] Inadimplência: remover vibração do telefone para títulos com 3+ dias de atraso A PARTIR DE HOJE (não apenas legados)
- [x] Inadimplência: remover "CLIENTE TESTE REGRA" da seção de resolvidos (dados de teste confundem)
- [x] Trocar texto "Título Legado" por "Título já estava com mais de 1 dia de atraso quando o sistema de cobrança começou"
- [x] Bolinhas: controle rígido — se Thiago esquecer de ticar e o dia passar, bolinha fica vermelha automaticamente, registra no histórico e não pode desmarcar
- [x] Cobrança 1,3,5 dias: para clientes com 3+ dias de atraso, só dar start quando Thiago fizer o primeiro contato
- [x] Relógio do histórico (checklist): start da Ação 1 só quando for feito o primeiro contato, seguindo guia de cobrança
- [x] Investigar cobranças de ontem (16/04) que foram "desmarcadas" — receivableIds órfãos após re-sync do Maxiprod
- [x] Migrar cobranças do Thiago de ontem (16/04) dos IDs antigos para os novos IDs do Maxiprod — remarcar status, ações diárias, cobrancaStartedAt
- [x] Ticar bolinha 1 verde nos clientes com 2d de atraso (ação tomada ontem pelo Thiago)
- [x] Remover cobranças automáticas dos clientes com 1d de atraso (Thiago marca manualmente)
- [x] Remover cobranças e bolinhas dos clientes com 3d+ de atraso (start só no primeiro contato manual)
- [x] Corrigir checkOverdueTicks para não marcar vermelho indevidamente (operador tem o dia inteiro para ticar)
- [x] Garantir que clientes com 3d+ de atraso nunca vibram telefone vermelho
- [x] Bolinhas: Intervalo fica verde automaticamente quando Ação anterior é verde
- [x] Bolinhas: dar opção de marcar verde ou vermelho manualmente (não apenas verde)
- [x] Dar acesso à senha Flavio para fazer cobranças (mesmo nível do Thiago) — já estava configurado
- [x] Dar acesso Thiago e Flavio para ticar bolinhas de ações-intervalo — já estava configurado
- [x] Ações em dias úteis: se cair sábado/domingo/feriado, empurrar para próximo dia útil
- [x] REGRA ABSOLUTA: jamais desmarcar cobrança já realizada, independente de qualquer comando
- [x] Relatório de vendas do comercial: ajustar PDF para caber em 1 única página (reduzir cards, gráfico compacto, layout profissional)
- [x] Card "Limite disponível para troca de títulos" na aba Sicoob Palitos (editável apenas por Flávio)
- [x] Permitir Fernando, Bruno e Gilson verem tudo que Thiago, Flavio e Guilherme enxergam na aba Inadimplência
- [x] Múltiplas opções simultâneas na ação de cobrança (ligar + email + whatsapp etc.)
- [x] Telefone só para de vibrar quando TODAS as ações do passo forem ticadas conforme guia de cobrança
- [x] Corrigir fuso horário de 3h (UTC→BRT) nos registros de cobrança
- [x] Sincronizar 7 bolinhas do roteiro com checklist: verde=cumprido, vermelho=falha, piscando vermelho=ação pendente
- [x] Card "Valor previsto de liberação para desconto na semana" na Sicoob Palitos (editável pelo Flávio)
- [x] Reduzir espessura dos cards de limite/valor previsto na Sicoob Palitos
- [x] Corrigir vibração do telefone e ações pendentes para usar dias úteis (pular sábados, domingos e feriados)
- [x] Mini-chat dentro dos 2 cards Sicoob Palitos (Desconto Semanal e Limite) para troca de mensagens entre Flávio e operadores
- [x] Madeira Produto Acabado: abater pedidos de variação do estoque mãe e criar estoque virtual na variação (evitar baixa dupla)
- [x] Contas do Fernando: ticks NÃO devem persistir de um dia pro outro, deve ticar manualmente todos os dias
- [x] Bug: Botão "Registrar Ação" de cobrança não funciona (E-mail/WhatsApp não registra ao clicar)
- [x] URGENTE: Restaurar dados de cobrança do Thiago na aba Inadimplência que foram perdidos durante o reset
- [x] Títulos 2+ dias atraso: entram como "aguardando primeiro contato", bolinhas zeradas, telefone NUNCA toca
- [x] Títulos 1 dia atraso: fluxo normal, Thiago registra ação, roteiro 1,3,5, telefone pode vibrar
- [x] TODOS os títulos 2+ dias: resetar collectionActions/dailyActions/manualTicks, zerar bolinhas, sem telefone, aguardando primeiro contato
- [x] Bolinhas automáticas: preencher automaticamente com base no registro de ações no histórico
- [x] Bug: bolinhas vermelhas aparecendo em títulos 2+ dias sem primeiro contato - devem ser todas brancas
- [x] Bug: Intervalo (bolinha 2) não deve ticar junto com Ação 1 - só tica no dia seguinte
- [x] Telefone NUNCA vibra para títulos com 2+ dias de atraso, mesmo que já tenham sido contatados
- [x] Dias de atraso calculados em DIAS ÚTEIS: excluir sábados, domingos E feriados nacionais brasileiros
- [x] Lista de feriados nacionais brasileiros 2025-2027 (incluindo Tiradentes 22/04)
- [x] Títulos vencidos em fim de semana/feriado: entram com 0d, sobem para 1d no próximo dia útil
- [x] LIVRIERI e LATICINIOS: corrigir para 1d de atraso (não 3d), passo 2 Intervalo, sem vibração
- [x] Guia de cobrança 2+ dias: roteiro SEMPRE começa do início (Ação 1: WhatsApp+Email), nunca forçar Ação 2/3
- [x] Permissão Guilherme: ticar/desticar bolinhas manualmente (verde/vermelho) a qualquer momento
- [x] Permissão Guilherme: botão para parar vibração do telefone manualmente
- [x] SAGRADO: preservar TODAS as ações já registradas pelo Thiago (Status, Histórico, Mensagens, Registros)
- [x] BUG CRÍTICO: Restaurar registros de cobrança do Thiago para 9 clientes que foram sobrescritos
- [x] Intervalo (bolinha 2) só tica verde NO DIA do intervalo, não imediatamente após Ação 1
- [x] Bolinhas automáticas: dia de ação vibra telefone + bolinha juntos; quando Thiago registra ação correta, checkbox verde + bolinha verde automático
- [x] Calendário: hoje é sábado, nenhuma ação/vibração deve ocorrer em fds/feriado
- [x] Controle manual Guilherme é para segurança/ajustes, não substitui automático
- [x] RESTAURAR: Dados de cobrança do Thiago para LIVRIERI (2761756) e FOGOS PIROMANIA (2810664)
- [x] Permissão Guilherme/Thiago: editar histórico de cobrança (transformar bolinha vermelha em verde e vice-versa)
- [x] Permissão Guilherme/Thiago: registrar textos no histórico na data que ele quiser (retroativo)
- [x] Intervalo (bolinha 2): só tica verde NO DIA do intervalo, não imediatamente após Ação 1
- [x] Permissão Thiago: mesmas permissões manuais que Guilherme (bolinhas, telefone, histórico)
- [x] Bolinhas: ticar uma por vez, sem cascata automática (syncTicksFromChecklist não deve auto-ticar)
- [x] Telefone: silenciar vibração de um título por vez, não em lote
- [x] Roteiro: Guilherme/Thiago podem clicar em qualquer bolinha e escolher verde/vermelho manualmente
- [x] Histórico: Guilherme/Thiago podem adicionar registros de ação em qualquer data manualmente
- [x] Telefone: ao clicar, mostrar opções claras (vibrar/parar OU registrar ação de cobrança)
- [x] BUG: LIVRIERI mostra Roteiro 0/7 e Histórico 0 apesar de dados restaurados no banco
- [x] Roteiro: tick manual verde mostra "Ação registrada corretamente", vermelho mostra "NENHUMA AÇÃO registrada neste dia"
- [x] Backend: getCollectionChecklist consulta manualTicks e sobrescreve status/motivo quando tick manual existe
- [x] Remover CLIENTE TESTE COBRANCA do banco de dados
- [x] Menu telefone: adicionar botão OK para confirmar ação selecionada
- [x] Menu telefone: toggle bidirecional (silenciar → iniciar vibração e vice-versa)
- [x] Menu telefone: sempre mostra 3 opções (vibrar/parar, registrar ação, ver histórico)
- [x] Novo status: "Cliente não deu retorno"
- [x] Novo status: "Cliente não atendeu"
- [x] Cards/retângulos no topo do dashboard para os novos status
- [ ] BUG: Card azul Sicoob Palitos deveria ser R$ 24.115,50 (mostra R$ 175.000,00) e card verde deveria ser R$ 138.042,66 (mostra R$ 500.000,00)
- [x] Bolinha AZUL (neutro/limpo) — opção manual para Guilherme/Thiago marcar bolinha como azul (estado neutro) no Roteiro e no card TitleRow
- [x] Controle total para Guilherme/Thiago: ticar bolinhas verde/vermelho/azul independente do dia e sem restrição de sequência (backend + frontend)
- [x] Arredondar para baixo (Math.floor) todos os valores de caixas no estoque da madeira — sem números quebrados
- [x] Converter pacotes (PC) em caixas equivalentes no estoque da importação (PC × un_pacote ÷ un_caixa_mãe = cx)
- [x] Detectar pedidos com estado E-COMMERCE como transferências internas (não vendas) e excluí-los da contagem de pedidos
- [x] Card sofisticado ao clicar no produto mostrando breakdown: estoque físico (CX) vs transferido p/ E-commerce (PC convertido)

## Faturamento: Unidade CX/PC
- [x] Faturamento: mostrar CX para itens não-e-commerce e PC para itens e-commerce (em vez de "un" genérico)

## Vendas: Pedidos Cancelados no Valor Total
- [x] Valor Total do Período deve incluir pedidos cancelados (reconhecer trabalho do vendedor)
- [x] A Faturar e Faturado devem EXCLUIR pedidos cancelados
- [x] Botão vermelho no card Valor Total mostrando lista de pedidos cancelados (pedido, cliente, valor)
- [x] Exemplo: M D da Silva ~R$154.000 cancelado deve aparecer no Total mas não no A Faturar/Faturado
- [x] Indicador explicativo quando Faturado + A Faturar ≠ Total (devido a cancelamentos)

## Bug: Texto Transferência E-commerce na Composição do Estoque
- [x] Corrigir texto em laranja "Transferência E-commerce" que mostra valor errado (120 cx em vez da soma real dos itens e-commerce/roxos)

## Histórico de Transferências E-commerce
- [x] Criar tabela no banco para histórico de transferências E-commerce
- [x] Detecção automática na sync: registrar quando estoque E-commerce baixar
- [x] Endpoint tRPC para consultar histórico com filtros (período, produto)
- [x] Botão "Histórico E-commerce" na aba Estoque com dialog mostrando data, produto, qtd cx/un, pedido, cliente/filial

## Bug: Valorização Total do Estoque
- [x] Corrigir VLR Projetado no card geral para bater com soma Estoque + Sob Encomenda (diferença de ~R$120k)

## Correção: Variação incorreta
- [x] Remover item 00074 (VARETA AROMATIZADOR 4,0 X 120 MM 10.000) da lista de variações do produto mãe 00079

## Badge E-commerce na aba Faturamento
- [x] Mostrar "E-commerce" em vez de "Outros" no badge/cardizinho cinza para pedidos com estadoConfiguravel = "E-COMMERCE" (apenas visual, sem alterar dados)

## Baixa automática no estoque de madeira (Industrializados faturados)
- [x] Criar tabela no banco para registrar baixas de estoque por faturamento de industrializados
- [x] Detectar novos itens industrializados faturados na sync (estadoConfiguravel = MADEIRA/MADEIRA CONTABILIZADO)
- [x] Abater automaticamente do estoque de madeira (fator 1:1 por unidade: cx, dúzia, kg)
- [x] Registrar histórico da baixa (data, produto, quantidade, unidade, pedido)
- [x] A partir de hoje — não retroativo (estoque atual já está correto, snapshot baseline criado em 22/04/2026)
- [x] Exibir histórico de baixas na aba Estoque (botão "Baixas Faturamento" com dialog, tabela, filtros e totais)
- [x] Adicionar aba E-commerce nas tabs do Faturamento (com ícone ShoppingCart e cor laranja)

## Ocultar botão "Baixas Faturamento"
- [x] Remover botão "Baixas Faturamento" da aba Estoque (funcionalidade continua ativa nos bastidores)

## Bug: VLR PROJETADO divergente do VLR ESTOQUE quando VLR PO = 0
- [x] Investigar cálculo do VLR PROJETADO — comportamento correto (Projetado = Disponível + PO), adicionado tooltip explicativo

## Explicação VLR PROJETADO
- [x] Adicionar tooltip/explicação no card VLR PROJETADO explicando que desconta pedidos em aberto (Projetado = Estoque - Pedidos + PO)

## Tooltip VLR PROJETADO Madeira
- [x] Adicionar tooltip no VLR PROJETADO da seção Madeira: "Projetado = Estoque - Pedidos em Aberto" (sem PO) + tooltip no VLR PROJETADO global

## Corrigir unidade de medida "unO" na aba Estoque
- [x] Trocar exibição de "unO" pela unidade correta (CX, PC, etc.) usando unidade predominante dos pedidos de venda — SEM MEXER em pedidos em aberto, a faturar ou faturado

## Bug: Valores financeiros Sicoob PALITOS sendo alterados automaticamente
- [x] Reverter "Valor previsto de liberação para desconto na semana" para R$ 24.000,00 (Sicoob Palitos)
- [x] Reverter "Limite disponível para troca de títulos" para R$ 138.042,66 (Sicoob Palitos)
- [x] Investigado: não há lógica automática — valores só mudam manualmente pelo Flávio. Adicionado dialog de confirmação para evitar alterações acidentais

## URGENTE: Sync automática falhando por timeout
- [x] Investigar e corrigir sync automática: timeout aumentado de 30s para 60s, queries pesadas executam sequencialmente
- [x] Desabilitar baixa automática de industrializados (zerou estoque de madeira indevidamente)
- [x] Restaurar estoque de madeira para valores corretos (22 produtos restaurados aos valores originais)
- [x] Limpar histórico de baixas incorretas (127 registros removidos + snapshot limpo)

## Restaurar visão de caixas E-commerce no estoque de importação
- [x] Restaurar a visão de caixas separadas para e-commerce no estoque de importação (17 produtos com breakdown)
- [x] Incluir pedidos E-commerce faturados (#909, #927) no Histórico E-commerce da aba Estoque
- [x] Converter itens PC (pacotes) para CX (caixas) no Histórico E-commerce usando lógica de produto mãe
- [x] Remover card "Total de Unidades" do Histórico E-commerce
- [x] Remover coluna "Unidades" da tabela do Histórico E-commerce
- [x] Redesenhar dialog do Histórico E-commerce: maior e mais organizado

## Refatoração Histórico E-commerce (Importação)
- [x] Filtrar Histórico E-commerce para mostrar apenas produtos de importação (Grupo 12)
- [x] Usar mapeamentos manuais PC→CX conforme ensinado pelo usuário (17 produtos pedido #909)
- [x] Card de transferência pendente E-commerce no estoque de importação (quando pedido não faturado)
- [x] Card some quando pedido faturado e dados vão para Histórico E-commerce
- [x] Dialog grande e moderno do Histórico E-commerce com todas colunas visíveis
- [x] Somatório de caixas ao final da tabela do Histórico E-commerce
- [x] Organizar histórico por data
- [x] Filtros para pesquisar produtos no Histórico E-commerce
- [x] Automatizar detecção de novos pedidos E-commerce (estado configurável + cliente filial)
- [x] Alargar dialog Histórico E-commerce para não cortar/achatar nada
- [x] Adicionar coluna Caixas (convertido) e coluna Pacotes (original) separadas
- [x] Observação "Lançado direto em caixa" para produtos CX (tracinho na coluna Pacotes)
- [x] Dialog Histórico E-commerce em modo paisagem (widescreen) fullscreen, sem scroll
- [x] Somatório semanal (dias úteis) abaixo das barras no gráfico Evolução Diária de Vendas
- [x] Corrigir design cards somatório semanal: sem quebra de texto, espaçamento profissional, dias úteis embaixo
- [x] Renomear botão/dialog existente para "Histórico E-commerce — Importação"
- [x] Criar botão "Histórico E-commerce — Industrialização" na seção Madeira com mesmo layout/design
- [x] BUG: Valores dos cards "Valor previsto liberação desconto" e "Limite troca títulos" sendo sobrescritos automaticamente — são valores 100% MANUAIS, só mudam quando Flávio editar
- [x] Remover card VLR PO da Valorização do Estoque da Madeira (Industrialização)
- [x] Adicionar botão "Valorização do Estoque" nos cards Madeira Semi Pronto e Madeira Aguardando Escolha (à esquerda de PRODUTOS/quantidade, sem alterar dados)
- [x] Mover botões Valorização do Estoque para DENTRO dos cards Semi Pronto e Aguardando Escolha (à esquerda de PRODUTOS/quantidade, no espaço vazio)
- [x] Aumentar botão Valorização e escrever texto completo "Valorização do Estoque" (sem abreviar) nos cards Semi Pronto e Aguardando Escolha
- [x] Configurar produtos de madeira para E-commerce no Histórico E-commerce — Industrialização (12 produtos do pedido 927)
- [x] Adicionar medida 3,8x300mm na Vareteira (item 2 Produção) para máquinas 1, 2, 3 e 4 (não máquina 5)
- [x] Atualizar fator de conversão do 3,8x218mm para cxp=0.6 e cxg=0.8 (igual ao 3,8x200mm)
- [x] Adicionar 12 produtos de madeira (00487-00501) com estoque zerado no card Madeira Produto Acabado
- [ ] BUG: VLR PROJETADO no Semi Pronto deveria ser negativo quando pedidos superam estoque (igual ao Aguardando Escolha)
- [x] Adicionar extrato mensal nos Históricos E-commerce (Industrialização e Importação) com filtro por mês e exportação (código, nome, pacotes, caixas)
- [x] Alterar exportação do extrato E-commerce de CSV para PDF formatado (Importação e Industrialização)
- [x] Corrigir formatação de números no PDF do extrato E-commerce: manter casas decimais (297,5 em vez de 298)
- [x] Adicionar cards de soma semanal (SEMANA 1-5 com total, média/dia, dias úteis) no relatório PDF de vendas e garantir que tudo caiba em 1 página
- [x] Reorganizar layout PDF vendas: cards média diária lado a lado (horizontal), gráfico abaixo, cards semanais embaixo do gráfico alinhados com cada semana
- [x] Corrigir layout do botão de gráfico de vendas nas tabelas Importação e Madeira (sem corte/sobreposição)
- [x] Adicionar ícone de "olho" com tooltip explicando o que o botão de gráfico representa
- [x] Melhorar card/modal de vendas do produto: amplo, sem cortes, alinhado, com explicações completas
- [x] Padronizar posição do botão de vendas: mover para junto de DISPONÍVEL P/ VENDA em ambas tabelas (Importação e Madeira)
- [x] Redesenhar modal/card de vendas: layout moderno, sofisticado, amplo, sem cortes, com explicações de cada número
- [x] Criar guia interativo (card com ícone de olho) explicando cada coluna de vendas (substitui vídeo)
- [x] Corrigir caracteres Unicode escapados no guia de vendas (mostrar acentos corretamente)
- [x] Centralizar valores nas colunas de vendas mensais para layout profissional
- [x] Corrigir botão de gráfico sobrepondo texto "DISPONÍVEL P/ VENDA" na tabela de Importação
- [x] Melhorar tooltip da coluna verde (mês atual) com explicação da seta ↑/↓ (ex: "3 cx acima da média de 10 cx/mês")
- [x] Corrigir coluna verde (mês atual): mostrar "0 cx ↓" quando vendas=0 mas há média, em vez de "— ↓"
- [x] Corrigir sobreposição do botão de gráfico na coluna DISPONÍVEL P/ VENDA - reorganizar layout e reduzir largura colunas
- [x] Pedidos de Venda (Importação): mostrar apenas pedidos com status "Aprovado" (não incluir "A aprovar") - coluna Qt do Maxiprod já em caixas (já estava correto, apenas texto do card atualizado)
- [x] Card PEDIDOS (VENDA): alterar texto de "Aprovados + A aprovar" para "Aprovados"
- [x] Card PEDIDOS (VENDA): adicionar ícone de olho com tooltip explicativo profissional sobre o valor mostrado
- [x] Reativar baixa automática de industrializados (MADEIRA) no estoque de madeira quando pedido é faturado
- [x] Remover coluna "EST. REG." da tabela Madeira – Produto Acabado (manter na Importação)
- [x] Criar aba "E-commerce" no Financeiro (visível apenas para Pedro/Flavio/Guilherme)
- [x] Criar tabela de despesas e-commerce no banco (descrição, data compra, forma pagamento, parcelas, valor, quem lançou)
- [x] Criar procedures tRPC para CRUD de despesas e-commerce
- [x] Criar UI da aba com formulário de lançamento e listagem de despesas
- [x] Controle de acesso: aba visível apenas para senhas Pedro/Flavio/Guilherme
- [x] Aba E-commerce: adicionar filtros por descrição/produto, forma de pagamento, período (data início/fim) e quem registrou
- [x] Aba E-commerce: botão exportar PDF com filtros ativos, painel moderno e profissional
- [x] Estoque Importação: ocultar ícone casinha roxa (e-commerce) na coluna pedidos quando não houver pedidos e-commerce para o produto
- [x] BUG CRÍTICO: Sync de inadimplência sobrescreve status/decisão marcados pelo Thiago — corrigido: removido decisaoCobranca do onDuplicateKeyUpdate
- [x] Sync deve apenas: adicionar títulos novos (Pendente) e remover títulos pagos (já funciona assim)
- [x] Bolinhas do roteiro já ticadas devem ser IMUTÁVEIS pela sync (confirmado: sync não toca collection_manual_ticks)
- [x] Histórico de ações deve ser PERMANENTE e nunca sumir (confirmado: sync não toca collection_actions/daily_actions)

## Inadimplência - Regras de Comportamento (definido 27/04/2026)

### CLIENTES ANTIGOS (até 27/04/2026):
- [ ] Tudo 100% manual — Thiago tica/destica bolinhas livremente
- [ ] Única automação: quando Thiago tica "Intervalo", sistema vibra o telefone no dia da próxima ação
- [ ] Thiago pode retirar a vibração clicando nela
- [ ] Sistema NÃO acusa nada no histórico — apenas registra ações e respostas do cliente
- [ ] Aos 7 dias: sistema pergunta se quer gerar PDF para vendedor (títulos "Sem Protesto")

### CLIENTES NOVOS (a partir de 28/04/2026):
- [ ] Roteiro automático: vibra em 1d, 3d, 5d → Thiago marca como feito → intervalo tica no próximo dia útil
- [ ] Aos 7 dias: Com Protesto → cartório / Sem Protesto → documento para vendedor
- [ ] Guilherme pode ticar/desticar tudo manualmente para correções

### GERAL:
- [ ] Cards para clientes sem resultado (Com Protesto e Sem Protesto)
- [x] Aguardar planilha do Thiago para restaurar dados de cobranças já realizadas (importado 38/40 registros com sucesso)
- [x] Inadimplência: só considerar inadimplente a partir do 4º dia útil de atraso (3 dias úteis completos - antes disso pode ser conciliação). Threshold configurável.
- [x] Inadimplência: botão exportar PDF com todo o histórico de cobrança do cliente (já existia no dialog Histórico)
- [x] Inadimplência: funcionalidade de importação via planilha (Thiago pode subir XLSX com dados de cobrança e sistema preenche automaticamente)
- [x] Inadimplência: marcar bolinhas verdes (ticks manuais) para clientes que Thiago já iniciou cobrança (47 ticks inseridos para 23 títulos)
- [x] E-commerce: ao selecionar Boleto como forma de pagamento, mostrar opção de parcelamento (quantas parcelas)
- [x] BUG Inadimplência: cutoff date travado em 22/04 — corrigido: lista de cobrança agora mostra TODOS os títulos vencidos até hoje (sem threshold). Threshold de 3 dias movido para o quadro "Pagos/Resolvidos".
- [x] Inadimplência: tornar TUDO manual — removida automação de ticks, vibração, cron job diário desabilitado
- [x] Inadimplência: permitir ticar/desticar bolinhas livremente, qualquer cor, qualquer dia, qualquer operador
- [x] Inadimplência: vibração do telefone como opção manual (qualquer operador pode ativar/desativar)
- [x] Inadimplência: manter guia de cobrança como referência, sem forçar nada
- [x] Inadimplência: garantir que ressincronização e virada do dia NUNCA percam informações manuais (confirmado: sync não toca tabelas de cobrança)
- [x] Inadimplência: campo de observações manuais por título (já existia no sistema)
- [x] Inadimplência: registro de histórico manual (ações, contatos, respostas) (já existia no sistema)
- [x] BUG CRÍTICO: Baixa Faturamento duplicada em 28/04 zerou estoque Madeira PA — corrigido e estoque restaurado de 1.003 para 8.301 caixas
- [x] Reverter baixas duplicadas de 28/04 e restaurar estoque correto (275 duplicatas removidas, 9 legítimas mantidas)
- [x] Corrigir lógica do snapshot para nunca reprocessar faturamentos antigos (proteção dupla: snapshot + billing_history)
- [x] Inadimplência: ponto de corte deve ser dia útil anterior (não hoje) — corrigido para getPreviousBusinessDay()
- [x] Inadimplência: novo status "Clientes Especiais Sem Cobrança" com card correspondente
- [x] Inadimplência: novo status "Cheque em Compensação" com card correspondente
- [x] REGRA: NÃO perder nenhuma informação preenchida anteriormente — apenas ADICIONAR novos status
- [x] Inadimplência: tornar todo o histórico de cobrança editável (data, horário, tipo contato, operador, mensagem)
- [x] Inadimplência: botão de edição de textos na aba Roteiro (descrição da ação, notas, mensagem de conclusão)
- [x] Inadimplência: garantir que botão de edição funciona na aba Histórico Completo (já implementado, verificar)
- [x] Inadimplência: permitir edição da data de cada step no Roteiro (campo data no override)
- [x] Produção: PDF com lançamento diário (todos setores, todas máquinas, observações, tudo em 1 PDF)
- [x] Produção: PDF com fechamento semanal (todos setores, total geral do setor, média diária por setor)
- [x] Produção: PDF com fechamento mensal (todos setores, todas máquinas, média por máquinas, média total geral)
- [x] Produção: gráficos por máquinas e por setor geral com filtro de manutenções (não urgente)
- [x] Produção PDF: separar somatórios por unidade (caixas, sacos, m³) em todos os relatórios
- [x] Produção PDF: redesign profissional com cores mais vivas e atraentes
- [x] Produção PDF: linhas alternadas (zebra stripes) claro/escuro para destaque
- [x] Inadimplência: card Importar Planilha — upload e armazenamento no S3 sem alterar dados
- [x] Inadimplência: histórico de planilhas enviadas com data, operador e nome do arquivo
- [x] Inadimplência: botão para exportar/baixar planilha do histórico por data
- [x] Inadimplência: filtro por data no histórico de planilhas (ex: "planilhas de abril")
- [x] Inadimplência: preview da planilha antes de salvar (mostrar primeiras linhas da tabela)
- [x] Produção: gráficos por máquinas com filtro de manutenções
- [x] Produção: gráficos por setor geral com filtro de manutenções
- [x] Inadimplência: botão "Exportar PDF" ao lado de cada cliente para gerar documento de decisão de cobrança
- [x] Inadimplência: PDF profissional com histórico de ações realizadas (sem "não foi feito"), nome do cliente, vendedor, responsabilidade do próximo passo
- [x] Inadimplência: histórico de PDFs de decisão gerados com botão para visualizar
- [x] Gráficos Produção: mais números e escalas nos gráficos (valores nas barras, tooltips detalhados)
- [x] Gráficos Produção: filtros avançados por tipo de manutenção (pontual, programada, falta de madeira)
- [x] Gráficos Produção: filtro por setor específico (Vareteira, Flow Pack, etc.)
- [x] Gráficos Produção: filtro por período de data
- [x] Gráficos Produção: KPIs detalhados, tabelas resumo, percentuais e médias
- [x] Gráficos Produção: animações dinâmicas em todos os gráficos (barras, linhas, áreas, pizza) com easing suave
- [x] Gráficos Produção: labels do pie chart corrigidos (não cortados) com abreviação inteligente de nomes longos
- [x] Gráficos Produção: design mais profissional com gradientes, sombras, hover effects, números animados nos KPIs
- [x] Gráficos Produção: eixo X dos bar charts com labels angulados (-35°) e altura aumentada para nomes longos de setores/máquinas
- [x] Relatório PDF Produção: centralizar todas as tabelas (Resumo por Setor, Detalhamento por Máquina, Totais)
- [ ] Relatório PDF Produção: alinhar cards de totais coloridos (M³, Sacos, Formas, Caixas) uniformemente
- [ ] Relatório PDF Produção: tabelas ocuparem largura total da página, sem deslocamento lateral
- [x] Relatórios PDF Produção: converter totais de "caixa" para "saco" (aplicar mesma conversão do dashboard)
- [x] Gráficos Produção: cards expandíveis/retráteis (accordion) — começam fechados, abrem no clique
- [x] Gráficos Produção: cards DEVEM iniciar recolhidos ao entrar na aba (bug: estavam abrindo expandidos)
- [x] Gráficos Produção: botão "Expandir Todos / Recolher Todos" no topo
- [x] Financeiro - Autorização de Pagamentos: bolinha de prioridade/urgência ao lado de cada fornecedor
- [x] Financeiro - Autorização de Pagamentos: Flávio autentica com senha "Flavio" para desbloquear marcação
- [x] Financeiro - Autorização de Pagamentos: bolinha marcada fica vermelha (prioridade)
- [x] Financeiro - Autorização de Pagamentos: Fernando e Guilherme só veem bolinhas vermelhas marcadas
- [x] Financeiro - Autorização de Pagamentos: tabela no banco para persistir marcações diárias
- [x] Financeiro - Autorização de Pagamentos: testes automatizados
- [x] Gráfico Produção Diária: clique nos dias (cards inferiores) deve filtrar/destacar o dia no gráfico
- [x] Gráfico Produção Diária: tooltip mostra "sector_1" em vez dos nomes reais dos setores — corrigir
- [x] Todos os gráficos: adicionar descrições contextuais ricas para leigos (ex: "20% da produção total do período")
- [x] Gráfico Tendência: explicar o que cada métrica significa (pico, média, mínimo)
- [x] Gráfico Distribuição por Setor: explicar que % é da produção total do período selecionado
- [x] Gráfico Manutenções: explicar o que cada tipo de parada significa e como % Parada é calculado
- [x] Gráfico Status: explicar o que cada status representa na produção
- [x] Financeiro - Autorização de Pagamentos: remover card de "Vencidas"
- [x] Financeiro - Autorização de Pagamentos: tooltip "Dê Preferência/Urgência" ao passar mouse nas bolinhas vermelhas (Fernando/Guilherme)
- [x] Financeiro - Autorização: mover bolinha de prioridade do header do fornecedor para cada conta individual (card expandido)
- [x] Financeiro - Autorização: trocar tooltip de "Dê Preferência/Urgência" para "Se não pagar, gera restrições no nome da empresa"
- [x] Financeiro - Autorização: mover bolinha de prioridade para perto do nome do fornecedor (não ao lado do valor)
- [x] Financeiro - Autorização: tooltip da bolinha deve aparecer legível e inteiro, sem cortes
- [x] BUG URGENTE: Flávio clica na bolinha de prioridade mas ela não fica vermelha — toggle não funciona (causa: maxiprod_id era INT, overflow com IDs > 2 bilhões, corrigido para BIGINT)
- [x] BUG: Erro React #310 (useMemo crash) ao clicar para ver gráficos da produção (causa: hooks useMemo após early returns condicionais, reordenado)
- [x] Produção Gráficos: explicar detalhadamente cada porcentagem e número (acessível para leigos)
- [x] Produção Gráficos: mostrar unidade de medida correspondente de cada setor/máquina (m³, saco, caixa, forma)
- [x] Produção Gráficos: brilho temporário na coluna do gráfico ao clicar no dia
- [x] Vendas: indicador vermelho para contas canceladas (ex: MD da Silva) — APENAS informativo, NÃO incluir em nenhum cálculo/gráfico
- [x] Vendas: ícone "olho" com tooltip detalhado explicando que a conta foi cancelada e não entra nos valores
- [x] Sync: incluir pedidos cancelados na sincronização do Maxiprod (GraphQL query atualizada com CANCELADO)
- [x] Alerta visual: quando Fernando trocar títulos (desconto Sicoob), gerar alerta para Guilherme/Flávio/Thiago
- [x] Alerta visual: aba Financeiro pisca → ao clicar, aba Recebíveis pisca → ao clicar, card da empresa pisca → mês do desconto pisca
- [x] Alerta visual: criar tabela no banco para registrar alertas de troca de títulos
- [x] Alerta visual: backend para criar/consultar/marcar alertas como lidos
- [x] Alerta visual: frontend com animação de blink cascading
- [x] Produção Embalagem: adicionar opção de lançar Rojão em Dúzias para alimentar estoque
- [x] BUG Produção: valores grandes (ex: 6600 dz) aparecem como 6,6 dz no estoque Madeira - produto acabado (fix: parseNumberBR para lidar com separador de milhar pt-BR + input type=text)
- [x] Produção: média deve ser calculada apenas sobre dias lançados (trabalhados), não dias do período, e justificar nos relatórios
- [x] Produção: separar totais de sacos por setor nos relatórios e cards (Vareteira, Toco, Automática, etc.) — não misturar
- [x] Produção: legenda auto-explicativa sobre a separação de sacos por setor nos relatórios
- [x] Produção Pirografia: adicionar opção "Produção não necessária" igual às outras máquinas (status selector completo com todas as 5 opções)
- [x] Seleção Automática: cards "Queijo Coalho" e "Alídio" para Maria lançar caixas (apenas registro/anotação, NÃO contabiliza no total)
- [x] Seleção Automática: histórico diário de lançamentos de Queijo Coalho e Alídio
- [x] Seleção Automática: gerar PDF com relatório de histórico de Queijo Coalho e Alídio
- [x] BUG URGENTE: Maria/Erica/Marcos recebendo notificações de cobrança/inadimplência no sininho — devem receber APENAS notificações de faturamento (pedido novo/modificação)
- [x] Seleção Automática: gráfico de tendência semanal para Queijo Coalho e Alídio (dentro do card expandido)
- [x] Seleção Automática: exportação PDF mensal das anotações de Queijo Coalho e Alídio
- [x] ProductionCharts: adicionar explicações detalhadas (tooltips/legendas) em todos os gráficos e tabelas — cada valor, porcentagem e coluna deve ter contexto claro
- [x] Adicionar operadora Thalita (senha: Thalita) com mesmas permissões financeiras do Thiago
- [x] BUG: Erro React #310 ao clicar nos gráficos de produção — crash da página (fix: mover useMemo sectorUnitMap antes dos early returns)
- [x] ProductionCharts: reescrever TODOS os tooltips dos gráficos para serem extremamente detalhados e auto-explicativos — cada porcentagem explicada em linguagem simples

## Histórico de Descontos (Financeiro → Recebíveis)
- [x] Tabela discount_selection_history já existia com todos os dados necessários (reutilizada)
- [x] Dados dos títulos armazenados como JSON (titulosJson) - sem necessidade de tabela separada
- [x] Modificar saveDiscountSelection para salvar no histórico automaticamente
- [x] Endpoint getDiscountHistoryAll (listar todos os descontos passados)
- [x] Endpoint getDiscountHistoryById (detalhes de um desconto específico)
- [x] UI de listagem de histórico na aba Recebíveis (botão "Histórico de Descontos")
- [x] Geração de PDF sob demanda (mesmo formato do PDF de referência)
- [x] Verificar se desconto de 29/04/2026 foi salvo (2 registros confirmados)
- [x] Testes automatizados para endpoints de histórico (7 testes passando)

## Estornos E-commerce (Financeiro → E-commerce)
- [x] Criar tabela ecommerce_refunds no banco (14 colunas incluindo motivo enum, status enum)
- [x] Endpoints CRUD: addRefund, listRefunds, updateRefund, deleteRefund, getRefundSummary
- [x] UI: seção "Estornos" na aba E-commerce com listagem e formulário
- [x] Formulário completo: data compra, data estorno, valor, motivo, descrição, fornecedor, status
- [x] Cards resumo: total pendente, total creditado, total geral, mês atual
- [x] Filtros por status (pendente/creditado), período, busca textual
- [x] Pedro pode registrar e editar estornos
- [x] Flávio tem visibilidade total dos estornos registrados
- [x] Testes automatizados para endpoints de estornos (9 testes passando)
- [x] Remover registro duplicado do histórico de descontos (ID 1 removido, mantido apenas ID 2)

## Métricas e Analytics de Cobrança (Inadimplência)
- [x] Analisar tabelas de cobrança existentes (collection_actions, collection_daily_actions, collection_status, resolved_receivables, etc.)
- [x] Endpoints backend: getOverviewMetrics, getRecoveryTimeline, getActionTimeline, getStepBreakdown, getRecoveryDetails, getStatusDistribution, getOperatorMetrics, getRecoverySummaryByPeriod
- [x] KPIs escritos: total títulos (126), clientes recuperados (35), valor recuperado (R$ 202.297,62), ações realizadas (97), falhas (6), decisões (0), contatos (23), taxa recuperação (21.7%), eficiência (36.1%)
- [x] Tabela detalhada de ações por step (Ação 1-7, quantidades concluído/em andamento/falha)
- [x] Tabela de recuperações por período (diário, semanal, mensal, anual) com filtro
- [x] Tabela desempenho por operador (Guilherme, Thiago - WhatsApp/Email/Ligação/Outro)
- [x] Tabela títulos recuperados detalhado (35 registros com cliente, doc, empresa, valor, vencimento, resolvido em, dias atraso)
- [x] Gráfico: evolução de recuperações ao longo do tempo (area chart com filtro Diário/Semanal/Mensal)
- [x] Gráfico: distribuição por status (pie chart - Especial 41%, Contatado 33%, Pendente 14%, etc.)
- [x] Gráfico: ações por tipo (donut chart - WhatsApp 43, Email 29, Ligação 21, Outro 4)
- [x] Gráfico: ações ao longo do tempo (stacked bar chart por dia)
- [x] Gráfico: ações por step (bar chart - Ação 1 a Decisão)
- [x] Filtro de período customizável em todos os gráficos e tabelas (dateFrom / dateTo)
- [x] Botão "Analytics" na aba Inadimplência (entre PDFs de Decisão e Guia de Cobrança)
- [x] Seções colapsáveis: Indicadores Chave, Distribuição por Status, Ações de Cobrança, Roteiro de Cobrança, Recuperações
- [x] Testes automatizados para endpoints de métricas (10 testes passando)

## Ajustes UI - Botões Inadimplência
- [x] Padronizar tamanho de todos os botões (Exportar PDF, Importar Planilha, PDFs de Decisão, Métricas de Cobrança, Guia de Cobrança) - w-[150px] h-[52px]
- [x] Renomear "Analytics" para "Métricas de Cobrança"

## Ajustes UI - Estornos E-commerce
- [x] Adicionar título "Estornos" com ícone e descrição antes dos cards de resumo
- [x] Criar separação visual clara entre seção Despesas e seção Estornos (gradiente teal + espaçamento)

## Correções Métricas de Cobrança
- [x] Remover Guilherme das métricas de operador (apenas Thiago)
- [x] Corrigir valor recuperado para bater com Pagos/Resolvidos (deduplificado: R$ 89.613,29)
- [x] Zerar falhas (Thiago não teve falhas — auto_red do sistema excluído)
- [x] Clarear legendas: "Em andamento" não faz sentido no roteiro, explicar cada item
- [x] Traduzir termos em inglês (tick, manual_blue, untick, phone_mute, etc.) para português
- [x] Explicar detalhadamente cada barra/valor nos gráficos (tooltips detalhados)

## Correções KPIs Métricas v2
- [x] Remover card "Edições de Ação" dos KPIs
- [x] Recalcular Eficiência excluindo clientes "Especial s/ Cobrança" — 23 recuperações regulares / 91 ações = 25.3%

## Correções Métricas de Cobrança v3
- [x] Explicar melhor coluna "Contato Realizado" e todas as ações na tabela de step breakdown
- [x] Zerar falhas no gráfico de steps (6 falhas são auto_red do sistema, não do Thiago)
- [x] Filtro de período no Resumo de Recuperações — selecionar dia/semana/mês/ano específico
- [x] Tooltips detalhados em TODOS os cards, gráficos, textos e porcentagens
- [x] Corrigir duplicatas no Pagos/Resolvidos (ex: SILVEIRA BUENO aparece 2x) sem mexer em dados — deduplificado via GROUP BY

## Correções Métricas de Cobrança v4
- [x] Corrigir duplicatas na lista Pagos/Resolvidos (SILVEIRA BUENO e PLASTIPEL aparecem 2x com mesmo NF/data) — removidas 13 duplicatas do banco + prevenção no sync

## Vendas Canceladas - Botão Vermelho (Comissão)
- [x] Valor Total de Vendas NÃO abate cancelados (mostra bruto para valorizar vendedor)
- [x] Botão vermelho no card Valor Total mostrando total cancelado no período
- [x] Ao clicar no botão vermelho: modal com lista de pedidos cancelados (cliente, valor, data/hora, data cancelamento)
- [x] Objetivo: dono calcula comissão = Total - Cancelados (comissão justa)
- [x] Tabela order_cancellations para rastrear data real de cancelamento
- [x] Sync automático detecta novos cancelamentos e registra dataCancelamento = hoje
- [x] Cancelado aparece no MÊS EM QUE FOI CANCELADO (não no mês de emissão)

## BUG URGENTE: Reset de Contatos de Cobrança (30/04/2026 ~13:49)
- [ ] Investigar causa do reset: títulos com 1º contato voltaram para Pendente (11 → 28 pendentes)
- [ ] Restaurar dados perdidos se possível
- [ ] Prevenir que isso aconteça novamente

## BUG CRÍTICO: Sync perdendo dados de cobrança (30/04/2026)
- [ ] Recuperar TODOS os collection_actions órfãos reconectando aos receivables corretos
- [ ] Corrigir sync para NUNCA mais perder vínculos (usar maxiprodId como chave estável)
- [ ] Migrar collection_actions para usar maxiprodId ao invés de auto-increment ID
- [ ] Garantir que manual_ticks e tick_history também sejam preservados
- [ ] Testar que sync não perde mais dados

## Redesign Relatórios de Produção (30/04/2026)
- [x] Redesenhar layout dos relatórios diários/semanais/mensais com cards por setor
- [x] Setores: Multilâmina, Vareteira, Seletora de Toco, Seleção Automática, Seleção Visual, Flow Pack, Embalagem, Máquina de Pirografar
- [x] Cada card: nome setor no topo, tabela (Máquina, Tipo/Medida, Quantidade, Unidade, Status, Obs), Total no rodapé
- [x] Grid responsívo em uma única página, visual moderno e sofisticado

## Ajustes PDFs Produção (30/04/2026)
- [x] Aumentar tamanho da fonte dentro dos cards
- [x] Unidades no plural: sacos, caixas, formas (não singular)
- [x] Ordenar máquinas/mesas numericamente (1, 2, 3...)

## Correção Card Distribuição por Setor (30/04/2026)
- [x] Corrigir lógica do card "Distribuição por Setor" — mostra Multilâmina 2% como "maior" (incorreto)
- [x] Distribuição por Setor: mostrar apenas quantidade absoluta (sem % entre unidades diferentes)
- [x] Relatório PDF: Total ANTES da Média nas colunas
- [x] Relatório PDF: aumentar mais as letras

## Correção Alinhamento de Tabelas (30/04/2026)
- [ ] Corrigir desalinhamento colunas tabela Pagos/Resolvidos (header vs valores)
- [ ] Corrigir desalinhamento colunas tabela Resumo de Recuperações (header vs valores)
- [x] Fix truncated labels in Títulos Ativos por Status pie chart (e.g. Cheque em Compensa... cut off)

## Cheques na aba Recebíveis (Financeiro)
- [x] Analisar estrutura da aba Recebíveis e dados de cheques no Maxiprod
- [x] Criar endpoint backend para buscar cheques do Contas a Receber (meio pagamento = Cheque)
- [x] Criar componente UI de Cheques com abas por empresa (Palitos, Varetas, Espetos)
- [ ] Filtro por mês dentro de cada empresa
- [x] Filtro por 9 estados de cheque (Disponível, À Receber de Clientes, Em Compensação, Custódia Sicoob, Custódia Sicredi, Linha 11, Linha 12, Voltou Outros Motivos, Em Factoring)
- [x] Opção "Todos" para ver todos os cheques de todas as datas e estados
- [ ] Exibir: data vencimento, estado, valor, empresa, forma de pagamento, descrição
- [x] Legendas/tooltips explicando cada estado de cheque
- [x] Testes automatizados para o endpoint de cheques

## Botão Cheques no card de empresa (Recebíveis)
- [x] Adicionar botão "Cheques" estiloso no header de cada empresa (Palitos, Varetas, Espetos)
- [x] Ao clicar, abrir card amplo e completo (conteúdo a definir pelo usuário)
- [x] 9 estados de cheque como cards clicáveis/filtros dentro do painel Cheques
- [x] Legendas explicativas para cada estado de cheque
- [x] Opção "Todos" para ver todos os cheques de todos os estados
- [x] Visual moderno e sofisticado nos cards de filtro
- [x] Usar dados existentes de accounts_receivable (já sincronizados com Maxiprod) filtrados por meioPagamento = Cheque
- [x] Query GraphQL já sincroniza Contas a Receber com meio de pagamento = Cheque automaticamente
- [x] Cheques sincronizam junto com o sync geral do Maxiprod (accounts_receivable)
- [x] Endpoint tRPC getCheques para servir cheques com filtros por estado e empresa
- [x] Tabela de cheques no frontend com colunas: Vencimento, Emissão, Cliente, Valor, Forma de Pagamento, Descrição
- [x] Somatório de valores no rodapé da tabela (total geral e por filtro)
- [x] Filtro funcional pelos 9 estados de cheque com contadores em cada card
- [x] Filtro por empresa (Palitos/Varetas/Espetos) automático
- [x] Centralizar títulos das colunas da tabela de cheques com os dados abaixo
- [x] Corrigir "à Receber" para "a Receber" (sem crase) em todos os lugares
- [x] Remover truncate/corte de nomes de clientes e descrições na tabela de cheques
- [x] Barra de pesquisa no painel de Cheques (buscar por cliente, palavras-chave, forma de pagamento)
- [x] Adicionar filtro de mês (dropdown) no cabeçalho do painel Controle de Cheques para filtrar cheques por data de vencimento
- [x] Campo opcional "Responsável" (custodian) para cheques classificados como "1 - Cheque Disponível"
- [x] Tabela cheque_custodians no banco para armazenar registros de responsável por cheque
- [x] Endpoints getCustodians e setCustodian no backend
- [x] Coluna "Responsável" na tabela de cheques com badge verde destacado
- [x] Campo editável inline (clique para definir, Enter para salvar, Esc para cancelar)
- [x] Testes automatizados para endpoints de custodian (5 testes passando)
- [x] Checkbox ao lado de cada cheque na tabela para seleção de troca
- [x] Validação por senha ("Fernando") ao ticar o primeiro cheque
- [x] Botão "Concluído" aparece após selecionar cheques para troca
- [x] Geração de PDF com cheques selecionados (todas informações + valor total)
- [x] Tabela cheque_exchanges no banco para histórico de trocas com PDF salvo
- [x] Painel de histórico de trocas com PDFs salvos para consulta futura
- [x] Trocar "+ definir" por "Com quem está o cheque?" na coluna Responsável
- [x] Remover retângulo verde com traço (—) para cheques não-Disponível (só mostrar para Disponível)
- [x] Corrigir valores dos cheques: usar saldo (valorLiquido - valorRecebidoLiquido) em vez do valor original — total agora R$ 384.040,52 = Maxiprod
- [x] Saldo Bancário deve refletir o mês selecionado (Mês Anterior) em vez de sempre mostrar o mês atual
- [x] Saldo Bancário deve seguir automaticamente o filtro global do Resumo Financeiro (sem botões separados)
- [x] Criar aba "Fornecedores Brasileiros" dentro da página Vendas (acesso restrito: Guilherme e Fernando)
- [x] Extrair 3439 fornecedores do PDF (segmento, estado, nome, cidade, endereço, telefone, email, website, CNPJ, notas)
- [x] UI navegação: Segmento → Estado (nome+sigla) → Lista de possíveis clientes com dados de contato
- [x] Formulário pós-contato: vendedor (Paula, Gilson, Jordão, Juvenal, Pedro), forma de contato (Ligação, Email, WhatsApp, Outra+campo obrigatório), observação, status (Já é cliente, Possível cliente, Novo cliente, Sem interesse)
- [x] Cards organizados por status
- [x] Ranking de vendedores: total de contatos, eficiência (novos clientes conquistados)
- [x] Detalhe do vendedor: lista de clientes contatados com observações e status
- [x] Criar aba "Métrica de Vendas" dentro da página Vendas (acesso restrito: Guilherme e Fernando)
- [x] Histórico de migrações de status (mostrar todas as transições de um status para outro, com vendedor e data)
- [x] Métrica de Vendas: ranking de vendedores por total vendido no mês
- [x] Métrica de Vendas: detalhe por vendedor (clientes atendidos, valores)
- [x] Métrica de Vendas: inadimplência por vendedor (quantos clientes inadimplentes cada um tem)
- [x] Métrica de Vendas: filtro por mês (Atual / Anterior)
- [x] Fornecedores: badge "Contatado X vezes" na lista de possíveis clientes com tooltip mostrando quem fez cada contato
- [x] Métrica de Vendas: inadimplência puxada da aba Inadimplência (dados reais atualizados)
- [x] PDF Cobrança: ocultar coluna "Observações"
- [x] PDF Cobrança: alterar mensagem "Próximo Passo" baseada na decisão de protesto do vendedor
- [x] PDF Decisão Cobrança: corrigir upload corrompido do S3 (enviava "[object Blob]" em vez de bytes reais)
- [x] Produção: adicionar média total consolidada em cada card (Multilâmina, Vareteiras, Seleção toco, Seleção automática, Seleção visual, Flow Pack)
- [x] PDF Semanal Produção: adicionar média semanal e média mensal consolidada dentro de cada card de setor
- [x] Gráfico Vendas: tooltip/card deve abrir próximo ao cursor do mouse (não longe)
- [x] Exportar PDF: aba Prospecção (Fornecedores Brasileiros)
- [x] Exportar PDF: aba Ranking (Fornecedores Brasileiros)
- [x] Exportar PDF: aba Por Status (Fornecedores Brasileiros)
- [x] Exportar PDF: aba Histórico (Fornecedores Brasileiros)
- [x] Exportar PDF: aba Ranking de Vendedores (Métrica de Vendas)
- [x] Exportar PDF: aba Inadimplentes (Métrica de Vendas)
- [x] Métrica de Vendas: sincronizar valores com aba Vendas (mesma fonte de dados/filtros)
- [x] Gráfico Vendas: tooltip/card deve abrir próximo ao cursor do mouse
- [x] Estoque: zerar pedidos de venda de Madeira Semi Pronto e Madeira Aguardando Escolha (só Produto Acabado tem pedidos reais)
- [x] KPI Importação: card Pedidos (Venda) deve somar apenas pedidos de produtos de importação (excluir industrialização/madeira do total)
- [x] Métricas Cobrança: remover gráficos, manter apenas KPIs + Resumo de Recuperações + Títulos Recuperados
- [x] Vendas: corrigir card SEMANA 1 que está mostrando dias da semana 2 (Dias 4-6 deveria ser semana 2)
- [x] Vendas: adicionar observação no card da semana quando houver venda em dia não útil (fim de semana/cinza)
- [x] Vendas: no card Grupo Fox do ranking, mostrar o vendedor real (representanteOuVendedor1) como informação adicional, sem alterar o cômputo do ranking
- [x] Financeiro: mover título "Despesas E-commerce" para acima dos cards (não abaixo)
- [x] E-commerce: separar botões (Exportar PDF, Filtros, Nova Despesa) do título - botões ficam acima do card branco da tabela
- [x] Estoque Madeira PA: nome do produto cortado na tabela ao pesquisar - mostrar nome completo sem truncar
- [x] Layout responsivo mobile para o dashboard (otimizado para iPhone 17 Pro Max 6.7" / 430px viewport)
- [x] Tooltip com informações extras ao passar o mouse no nome do produto (grupo, estoque, etc)
- [x] Highlight no texto encontrado ao pesquisar na tabela de estoque
- [x] PWA: transformar o site em Progressive Web App (manifest, service worker, ícone, standalone mode) para funcionar como app nativo no iPhone
- [x] Corrigir layout mobile: Vendas - cards "Média Diária" cortados, valores truncados, semanas cortadas
- [x] Corrigir layout mobile: Financeiro - KPIs apertados, valores cortados (R$ 180.198, R$ 160.535 etc)
- [x] Corrigir layout mobile: Estoque - botões "Histórico E-commerce" cortados
- [x] Corrigir layout mobile: date picker "Ir para Hoje" quebrando layout
- [x] Novo ícone PWA: fundo preto quadrado, texto "GRUPO FOX" e raposa em dourado reluzente
- [x] Notificação push: alertar Fernando e Guilherme quando venda for realizada
- [x] Notificação push: alertar Fernando e Guilherme quando Thiago marcar conciliação como pronta
- [x] Ícone PWA: redesenhar maior, preenchendo todo o quadrado do app (sem margem), texto e raposa maiores e mais legíveis
- [x] Corrigir mobile: tabs Financeiro (Visão Geral/Inadimplência/Recebíveis/E-commerce) quebrando layout
- [x] Corrigir mobile: tabs Config (Senhas/Produto Importado/Alertas/Visibilidade/Bancos/Variações/Dados/Madeira) grudadas e cortadas
- [x] Corrigir mobile: botão "Sincronizar" cortado no card de conexão
- [x] Corrigir mobile: datas cortadas (04/0..., 06/0...) e botão "Históri..." cortado nos Recebíveis
- [ ] Mobile: Fluxo de Caixa - valores cortados (R$ 1.4..., R$ 2..., R$ -1...) nos 3 cards
- [x] Mobile: Inadimplência - textos sobrepostos (títulos, valores, "Confere" grudados)
- [ ] Mobile: Saldo Bancário - "Conciliação Feita..." cortado, sobrepondo saldo
- [ ] Mobile: Botões "Recebimentos" e "Pagamentos" cortados
- [x] Mobile: Autorização de Pagamentos - valores sobrepostos nos nomes dos fornecedores
- [x] Mobile: Saldo sem Caixa / Autorizado / Exportar PDF sobrepostos na mesma linha
- [x] Mobile: Varredura geral em todas as abas para adaptar ao celular
- [x] Mobile: Adicionar padding-bottom em todas as páginas para não esconder conteúdo atrás do bottom nav
- [x] Mobile: Financial tabs - reduzir padding e font-size para caber melhor no celular
- [x] Mobile: Sales tabs - adicionar overflow-x-auto e scrollbar-hide
- [x] Mobile: FornecedoresBrasileirosTab - overflow-x-auto e scrollbar-hide na navegação
- [x] Mobile: EcommerceTab - overflow-x-auto na tabela
- [x] Mobile: InadimplenciaTab - botões de ação com flex-wrap e tamanhos responsivos
- [x] Mobile: InadimplenciaTab - title rows com layout compacto no mobile (ocultar colunas secundárias)
- [x] Mobile: Billing TopNav Select - reduzir largura no mobile
- [x] Mobile: Adicionar utilitário CSS scrollbar-hide para scroll horizontal limpo
- [x] Mobile: Corrigir cards de Fluxo de Caixa - valores cortados no celular
- [x] Mobile: Corrigir card Saldo Bancário - "Conciliação Feita..." cortado
- [x] Mobile: Corrigir botões "Recebimentos" e "Pagamentos" cortados
- [x] Mobile: Verificar fluxo completo de autorização + exportar PDF no celular
- [x] Mobile: Exportar PDF - melhorar compatibilidade com iOS Safari (Blob download)
- [x] Renomear botões Inadimplência: Importar → Importar Planilha, Decisão → PDF de Decisão de Cobrança, Guia → Guia de Cobrança
- [x] Mobile: E-commerce tabela - coluna Observações cortada na direita (hidden md:table-cell + overflow-x-auto)
- [ ] Mobile: Valorização do Estoque - VLR ESTOQUE valor cortado (R$ 2.09...)
- [ ] Mobile: Financeiro BucketCards (Recebimentos/Pagamentos) - lado a lado muito apertado, textos cortados
- [x] Renomear abas Vendas: Fornecedores → Fornecedores Brasileiros, Métricas → Métricas de Vendas
- [x] Mobile: Vendas - título "Dashboard de Vendas Grupo Fox" muito grande, quebrando em várias linhas (text-xl md:text-4xl)
- [x] Mobile: Vendas - card "Conectado ao Maxiprod" texto quebrando e botão Sincronizar apertado (layout compacto com truncate)
- [x] Mobile: Vendas - tabs cortadas na direita (ícones hidden no mobile, padding reduzido)
- [x] Mobile: Financeiro - título reduzido no mobile (text-xl md:text-4xl)
- [x] Mobile: Faturamento - título reduzido no mobile (text-xl md:text-4xl)
- [x] Mobile: PO cards - número e "cx" quebrando em linhas separadas (whitespace-nowrap, fontes menores, layout compacto)
- [x] Mobile: Admin tabs (Senhas, Produto, Importação, Alertas, Visibilidade, Bancos, Variações, Dados, Madeira) - texto sobreposto (shrink-0, text-[10px], hidden icons, scroll)
- [x] Mobile: Financeiro - cards Recebimentos/Pagamentos lado a lado muito apertados (p-1.5 mobile)
- [x] Mobile: Financeiro - bucket cards (Vencidas, Semanal) empilhados verticalmente no mobile (grid-cols-1 md:grid-cols-2)
- [x] Mobile: VLR ESTOQUE card cortado na versão mobile (whitespace-nowrap, text-[11px], grid-cols-3 compacto, Custo Est. Regulador empilhado)
- [x] Produção: colunas Tipo e Status cortadas com reticências - removido truncate, colWidths ajustadas, fonte 5.5
- [x] Produção: soma do setor incorreta (ex: 12+10+9=31 mas mostra 20) - incluído FLOWPACK_FIBRA_OPTIONS no getSectorTotal
- [x] PDF Vendas: cards semanais desconfigurados - reescrito computeWeeklySummaries para gerar todas as semanas do mês
- [x] PDF Vendas: Semana 1 vazia - corrigido: total agora inclui vendas de dias não úteis + exibe "+R$ 6K em 1 dia nao util"
- [x] Flow Pack rounding: valores individuais ficam quebrados (como Maria lançou), somatório total usa Math.floor, relatório/histórico sempre mostra inteiros arredondados (sem decimais)
- [x] Mobile: Madeira Semi Pronto / Aguardando Escolha cards - título e "X itens" badge quebrando linha, desalinhados (deve ficar igual Madeira Produto Acabado)
- [x] Mobile: Financeiro Entradas card - texto "Vendas/Revenda" sobreposto ao valor R$
- [x] Mobile: Financeiro cards (Faturado/Vendas/Contas Pagas) - "Ver itens" e contadores com quebra de texto
- [x] Mobile: Financeiro cards comparação (Faturamento vs Pago / Vendas vs Pago) - valores cortados
- [x] Mobile: Estoque tabela - colunas sobrepostas (DISPONÍVEL, ESTOQUE, P/VENDA, PROJETADO, etc.)
- [x] Bug: Kit Amostra não aparece no card de Madeira Produto Acabado (já existe no sistema, mas está filtrado)
- [x] Bug: Busca no card de Madeira corta o produto - nome e dados (Estoque, Pedidos, Disponível) ficam invisíveis/cortados
- [x] Bug: Vareta Glade Reeds 00808 mostrando pedidos em 'kg' quando deveria ser 'cx' (comercial lançou em caixas)
- [x] Bug: Tooltip/popup do produto cobre dados da tabela Madeira PA ao clicar/hover - remover ou reposicionar
- [x] Bug: Mobile Madeira PA - nome do produto não aparece na linha (só Cod:), dados cortados
- [x] Bug: Badge "95" da Inadimplência saindo do card de navegação, tabs selecionadas desproporcionais e desalinhadas
- [x] Vendas: mostrar nome do vendedor ao lado de cada pedido/cliente quando expandir Grupo Fox no ranking
- [x] Bug: Estoque Importação tabela mobile - colunas sobrepostas/encavaladas, precisa min-width e scroll horizontal
- [x] Bug: Financeiro aba - cards ENTRADAS com texto sobreposto no mobile (Vendas/Reve + R$ valor encavalados)
- [x] Vendas: Métricas - adicionar filtros de Estado Configurável (Bambu, Madeira, Fibra) e Segmento (Indústria, Lojas) no detalhe de cada vendedor no ranking
- [x] Bug mobile: Inadimplência - botões PDF, Importar Planilha, PDF de Decisão, Métricas desalinhados/jogados na tela
- [x] Bug mobile: Inadimplência - bolinhas do ROTEIRO (Ação, Intervalo, etc.) encavalando com números e labels
- [x] Bug mobile: Recebíveis - card Resultado do Filtro (TOTAL, VENCIDO, A VENCER) com valores cortados/sobrepostos
- [x] Bug mobile: Recebíveis - badges/pills de resumo precisam de melhor alinhamento
- [x] Bug mobile: Painel de notificações (sininho) cortado no mobile - texto sobrepõe conteúdo da página, precisa ser full-width
- [x] Vendas Métricas: Adicionar período "Personalizado" com calendário para escolher qualquer mês
- [x] Vendas Métricas: Converter filtros Estado/Segmento para multi-select (chips) com cards separados por seleção + soma total
- [x] Cheques: Criar histórico de cheques descontados (quais saíram, de qual categoria, valor, cliente, data)
- [x] Bug mobile: Card ENTRADAS - textos "Vendas..." e "Demais Re..." cortados, precisa mostrar completo
- [x] Bug mobile: Financeiro Histórico - cards de resumo (Títulos Acrescentados, Retirados, Saldo Líquido) com valores cortados no mobile
- [x] Vendas Métricas: Botão exportar PDF no detalhe do vendedor (com filtros aplicados, KPIs e lista de clientes)
- [x] PDF: Incluir logo do Grupo Fox no cabeçalho de todos os PDFs gerados
- [x] PDF: Botão compartilhar via WhatsApp (link de download do PDF)
- [x] Vendas Métricas: Exportar PDF na view de Inadimplência por vendedor (detalhe dos clientes inadimplentes)
- [x] Implementar modo claro/escuro (dark mode) com toggle no header, persistência no localStorage, mobile + desktop
- [x] Bug mobile: Faturamento - valores cortados nos cards de resumo (PEDIDOS EM ABERTO, AUTORIZADO A FATURAR, FATURADOS) e texto/badge sobrepondo na tabela
- [x] Dark mode: Corrigir cards brancos que não ficaram escuros em todas as abas (Faturamento, etc)
- [x] Dark mode: Texto preto no dark mode precisa ser claro (dourado brilhante, branco neon) para legibilidade
- [x] Dark mode: Toggle deve mostrar texto "Ativar modo noturno" (lua) e "Ativar modo claro" (sol)
- [x] Dark mode mobile: Corrigir cards com fundo claro (bg-amber-50/60, bg-emerald-50/80 etc.) usando CSS attribute selectors [class*="bg-*-50/100"] para forçar fundo escuro em todas as variantes de opacidade fracionária
- [x] Dar permissão ao Marcos para ver as observações da equipe fiscal (Larissa/Brenda) na aba Faturamento
- [x] Inadimplência Pagos/Resolvidos: adicionar filtro para ordenar do recebimento mais antigo ao mais atual
- [x] Inadimplência Pagos/Resolvidos: resolver duplicações (ex: SK EMBALAGENS R$599 venc 03/04/2026)
- [x] Inadimplência: manter histórico completo de recuperação desde o início (não resetar na virada do mês)
- [x] Inadimplência: sistema de alertas (ícone telefone) deve respeitar datas editadas no cronograma, não a programação original
- [x] Inadimplência: campo "valor prometido" no Gerenciar Cobrança deve exibir símbolo R$
- [x] Dark mode login: logo Grupo Fox e frase do artista em dourado brilhante (profissional e sofisticado)
- [x] Dark mode: Cards com fundo branco (Resumo Financeiro, Total Consolidado, Inadimplência, médias diárias) → fundo escuro + letras douradas
- [x] Dark mode: Logo Grupo Fox no header → fundo escuro, texto e raposa dourados brilhantes grandes
- [x] Dark mode: Gráfico Evolução Diária (Vendas) → barras douradas, letras legíveis (dourada ou branca)
- [x] Dark mode: Tabelas Faturamento (Pedidos a Faturar, Faturado, Anterior) → scroll horizontal, não cortar
- [x] Dark mode: Aceite de Produção → nome produto não cortado, scroll horizontal mobile
- [x] Dark mode: Financeiro Autorização pagamentos → cards dourado neon (não ticado) / verde neon (ticado)
- [x] Dark mode: Configurações → quadradinhos com cores originais (não preto e branco)
- [x] Dark mode: Inadimplência → aba travada, filtro Keure inacessível, scroll horizontal
- [x] Dark mode: Bolinha número 3 → fundo escuro, escrita branco/dourado/rosa
- [x] Dark mode: Madeira Aguardando Escolha → quebra de texto no local dos itens e número
- [x] Dark mode: Card PO (Pedidos de Compra) → fundo escuro (não branco), letra dourada

- [x] Bug: apenas 1 bolinha do roteiro aparecendo (CSS overflow-x-auto > div forçava width:100% em cada bolinha)
- [x] Login modo noturno: logo dourado metálico (Grupo Fox + raposa em ouro rico sobre fundo preto)
- [x] Login modo noturno: "SEJA BEM-VINDO(A)" em fonte Playfair Display serif, dourado grosso, animação wave contínua
- [x] Login modo noturno: versão V.2.1.1 em branco para ficar visível
- [x] Login modo noturno: fundo preto puro, tudo centralizado
- [x] Login modo claro: mantido como estava (logo verde original)

- [x] Dark mode: Financeiro header text ilegível
- [x] Dark mode: Financeiro autorização de pagamentos cards pretos sem divisão (não ticado → dourado neon, ticado → verde neon)
- [x] Dark mode: Estoque card POs fundo branco → fundo escuro + letra dourada
- [x] Dark mode: Estoque card "Madeira aguardando escolha" quebra de texto
- [x] Dark mode: Vendas gráfico evolução diária desconfigurado (azul → dourado brilhante, letras legíveis)
- [x] Mobile: Vendas cards pedidos encavalados (scroll horizontal para deslizar)
- [x] Mobile: Aceite de Produção nome produto cortado sem scroll horizontal
- [x] Dark mode: Configurações quadradinhos perderam cores (restaurar)
- [x] Dark mode/Mobile: Inadimplência aba cortada, filtros inacessíveis
- [x] Dark mode: Inadimplência bolinha nº3 branca → fundo escuro + texto branco/dourado
- [x] Dark mode: Login logo fundo escuro com letras e raposa dourados grandes e brilhantes
- [x] Inadimplência: botões de ação (PDF, Importar, Métricas, etc) lado a lado no desktop (não empilhados)
- [x] Inadimplência: card roteiro/ações fundo branco no dark mode → fundo escuro
- [x] Estoque: adicionar divisórias verticais entre colunas (Estoque, Pedidos, Disponível, PO, Projetado, Produtos) nos cards
- [x] Dark mode: usar logo dourado/preto no header/sidebar (não o branco/verde)
- [x] Dark mode: divisórias verticais nos cards Madeira (Estoque/Pedidos/Disponível) sumiram — restaurar para desktop e mobile
- [x] Dark mode: cores dos quadradinhos de permissão na aba Configurações estão preto/branco — restaurar cores originais (teal, laranja, azul, roxo, verde, vermelho) para desktop e mobile
- [x] Dark mode dashboard: remover fundo preto do logo dourado no header (TopNav) — fundo deve ser transparente/mesma cor do header
- [x] Madeira cards: títulos das colunas sobrepostos (ESTOQUE/PEDIDOS/DISPONÍVEL/ROJÃO/APITO/PRODUTOS) — corrigir espaçamento/layout para desktop e mobile, claro e escuro
- [x] Dark mode dashboard: centralizar logo dourado no header (TopNav) — usar versão cropped/centered
- [x] Configurações: títulos das colunas sobrepostos na tabela de permissões (FATURAMENTO/FINANCEIRO) — corrigir espaçamento
- [x] Nav desktop: renomear "Config" para "Configuração" (manter abreviado no mobile)
- [x] Madeira cards: centralizar texto (título + valor) dentro dos retângulos de Estoque/Pedidos/Disponível (como na Importação)
- [x] Dashboard dark mode: substituir fundo preto do logo dourado pela cor de fundo do dashboard (cinza escuro/azulado)
- [x] Madeira cards mobile: mostrar nomes completos sem abreviação (Madeira Produto Acabado, Madeira Semi Pronto, Madeira Aguardando Escolha)
- [x] Madeira cards mobile: adicionar grid de métricas (Estoque/Pedidos/Disponível) visível no mobile
- [x] Habilitar zoom no mobile e desktop (viewport meta tag: user-scalable=yes, maximum-scale=5)
- [x] Botão "Valorização do Estoque" visível no mobile para os 3 cards Madeira (PA, Semi Pronto, Aguardando Escolha)
- [x] Vendas: barras do gráfico AZUIS no modo claro (dashboard + PDF), DOURADAS apenas no modo noturno
- [x] PDF Vendas (modo escuro): cabeçalhos dourados, valores em PRETO, remover barras pretas laterais do SVG capture
- [x] PDF Vendas: corrigir tanto na versão desktop quanto mobile
- [x] Nav desktop: ícones dos itens de navegação devem ser grandes (mesmo tamanho no modo claro e escuro)
- [x] Bambu cards mobile (Estoque + Sob Encomenda): mostrar TODAS as 6 colunas iguais ao desktop (Estoque, Pedidos, Disponível, PO Compra, Projetado, Produtos) sem abreviar nem omitir
- [x] Vendas modo claro: barras do gráfico devem ser teal/azul esverdeado (não azul escuro) — tanto no dashboard quanto no PDF
- [x] PDF Vendas modo escuro: barras devem ficar DOURADAS (não azuis), números/valores dourados devem ficar PRETOS
- [x] Financeiro: tabela de cheques no mobile desconfigurada — dados saindo do retângulo, colunas cortadas (Cliente, Valor)
- [x] Deletar registro de troca teste (M D DA SILVA) do banco
- [x] Criar histórico de sincronização de cheques (quais entraram/saíram a cada sync com Maxiprod)
- [x] Manter histórico de trocas manuais (autorizadas pelo Fernando)
- [x] Filtros de período nos dois históricos: mês atual, mês anterior, personalizado (dia/mês/ano)
- [x] Botão de atualização (refresh) na versão mobile para forçar reload após nova publicação
- [x] Unificar botões Sync, Descontados e Histórico de Trocas em um único botão "Histórico" com abas (Sincronização, Trocas, Descontados) e filtro de período
- [x] Valorização do Estoque mobile: valores monetários (VLR ESTOQUE, VLR PROJETADO) saindo dos retângulos - reduzir fonte ou ajustar padding
- [x] Alertas mobile: abas (Compra, Cuidado, Atenção) cortando na tela - permitir scroll horizontal ou reduzir tamanho
- [x] Dark mode autorização de contas: amarelo neon quando não selecionou tudo, verde neon quando selecionou tudo (sem prejudicar leitura)
- [x] Mobile: botão de atualizar (refresh/reload) visível na versão mobile para forçar atualização
- [x] Vendas: botão "Melhor Vendedor" com períodos (dia, semana, mês, ano), mostrando nome, vendas detalhadas e filtros/segmentos
- [x] Fornecedores: restaurar menu de 3 opções (Confirmar verde, Falha vermelho, Neutro azul) ao clicar na bolinha de ação - SEM alterar status existentes
- [x] Melhor Vendedor: navegação de período (meses anteriores, anos anteriores, data personalizada)
- [x] Melhor Vendedor: exportar PDF com todos os dados do melhor vendedor
- [x] Melhor Vendedor: ver vendas detalhadas do vendedor (cliente, valor, estado configurável, segmento CRM) com filtros múltiplos simultâneos
- [x] Fix: popover das bolinhas de ação cortando o botão "Cumprido" (verde) - precisa mostrar as 3 opções completas
- [x] Fix: Melhor Vendedor mobile layout - botão "Ver vendas" sobrepondo troféu, todas infos do desktop devem aparecer no mobile sem cortar
- [x] Fix: PDF Melhor Vendedor - substituir emoji quebrado por SVG de troféu no card dourado
- [x] Fix: botão atualizar mobile não está clicando/respondendo
- [x] Financeiro Inadimplência: filtros de ordenação nos Recuperados (dias de atraso, data de devolução, valor) com setinhas
- [x] Fix "Ver vendas" button overlapping trophy icon - move to side
- [x] Replace hand-drawn trophy in PDF export with proper trophy image
- [x] Redesign cheque history dialog: monthly/daily breakdown with entradas, descontos, trocas
- [x] Fix date filter not working in cheque history (descontados now filtered by liquidacaoData)
- [x] Improve date readability in cheque history (use dd/mm format, clear labels)
- [x] Add date range filtering to getChequeDescontados backend procedure
- [x] Enable all data queries when Resumo tab is active (sync + descontados + trocas combined)
- [x] Fix ranking vendedores showing literal "\u00ba" text instead of clean number
- [x] Fix mobile: nome do melhor vendedor cortando (truncate) - mostrar completo
- [x] Card "Melhor Vendedor" com visual dourado brilhante no tema escuro
- [x] Botão "Melhor Vendedor" na nav tabs também dourado/brilhante no dark mode
- [x] Fix mobile alert card: add percentage/urgency explanations for Cuidado/Atenção/Compra tabs like desktop version
- [x] Fix mobile faturamento tab: add horizontal scroll so content is not cut off
- [x] Fix faturamento order row layout: text overlapping/cut off on mobile and desktop - show all info without cuts
- [x] Fix faturamento: remove truncate from client name, increase min-w to 900px so all text is readable
- [x] Create intermediate screen for "Métrica de Vendas" with 2 folder options: Ranking de Vendedores and Análise de Produtos
- [x] Análise de Produtos: backend procedure to aggregate monthly sales by estado configurável
- [x] Análise de Produtos: frontend with table and chart showing monthly evolution per estado
- [x] Análise de Produtos: clean/professional design for desktop, mobile, dark and light modes
- [x] Análise de Produtos: fix chart to show proper stacked/grouped bars (not just colored divs)
- [x] Análise de Produtos: make tables larger, more self-explanatory and clearer to read
- [x] Análise de Produtos: add individual segment filter (e.g. see only Bambu with product detail)
- [x] Análise de Produtos: add PDF export of the analysis
- [x] PDF export dark mode: bar value numbers should be black (not golden) while bars stay golden
- [x] PDF export filename: "Relatório de Vendas Grupo FOX" + date of export
- [x] Fix motivational phrases to change DAILY instead of weekly (both LoginScreen and MotivationalQuote components)
- [x] Fix supplier group header layout: long names overlapping item count and Selecionar tudo
- [x] PDF Decisão: add checkbox to mark clients who paid after PDF generation, with OK button and confirmation message
- [x] Give Pedro access only to E-commerce sub-tab in Financeiro (block Visão Geral, Inadimplência, Recebíveis)
- [x] Create "Métrica de Clientes" sub-tab in Vendas page (next to Métrica de Vendas)
- [x] Create database table for seller admission dates (Jordão, Juvenal, Paula, Gilson, Pedro)
- [x] Create backend procedures for seller admission date CRUD
- [x] Create UI for filling in seller admission dates
- [x] Structure initial client metrics (new clients opened, reactivated clients, recompra interval)
- [x] Fix tab bar overlap on mobile in Vendas page (4 tabs overlapping text)
- [x] Ensure MetricaClientesTab is fully responsive for mobile and desktop
- [x] Fix PO quantity divergence: 4.852 cx is correct (350 cx cancelado confirmado), fixed card PO(Compra) 9.231→4.852 using poLotes.quantidade em caixas
- [x] Show COMERCIAL vs PROFORMA PEDIDO classification on PO lotes in dashboard (badge/indicator)
- [x] Fix missing vendedor/representante name in inadimplência table (added cadastro empresas as primary source, 711→876 mappings)
- [x] Create "Depósito da Matriz - Perdões" button in E-commerce tab
- [x] Store 26 products with physical count quantities in database
- [x] Restrict access to Guilherme's password only
- [x] Show product list with quantities and total sum
- [x] Create "Relatório de Vendas do E-commerce" section in E-commerce tab (above Despesas)
- [x] Daily sales entry form (date, number of sales, total value)
- [x] KPIs: total do mês, média diária, total geral
- [x] Access restricted to Pedro, Fernando, Bruno, Guilherme
- [x] PDF export of the sales report with all data
- [x] Backend tRPC procedures: listDailySales, addDailySale, updateDailySale, deleteDailySale
- [x] Database table ecommerce_daily_sales with migration applied
- [x] SalesReportSection component with month/year filter, KPI cards, table, form
- [x] Pedro-only add/edit/delete controls (Fernando/Bruno/Guilherme view-only)
- [x] PDF export using jsPDF + jspdf-autotable with Grupo Fox branding
- [x] 10 vitest tests for ecommerce router including daily sales procedures

## Reformulação Métrica de Clientes (foco no grupo, não por vendedor)
- [x] Reformular MetricaClientesTab: foco na carteira de clientes do grupo (não por vendedor individual)
- [x] Métrica 1: Clientes novos por mês (primeira compra + reativados após 6 meses sem comprar)
- [x] Métrica 2: Ranking de frequência de compra (últimos 12 meses - quantas vezes cada cliente comprou)
- [x] Métrica 3: Alerta de clientes com intervalo vencido (comprou 2+ vezes, intervalo médio passou e não recomprou)
- [x] Filtro por segmento (Bambu, Madeira, etc.)
- [x] Backend: procedures tRPC para métricas de clientes do grupo
- [x] Frontend: nova interface sem referência a vendedor individual
- [x] Manter aba existente no ar (reformulada, não removida)

## Filtro de Segmentos de Produto
- [x] Filtrar dropdown de segmentos de produto para mostrar apenas: MADEIRA, BAMBU, FIBRA, MADEIRA IMPORTADA

## Legendas nos KPI Cards da Métrica de Clientes
- [x] Adicionar legendas explicativas em cada KPI card da Métrica de Clientes

## Despesas E-commerce - Cartões e Recorrência
- [x] Criar tabela de cartões de crédito (nome, bandeira, últimos 4 dígitos, titular)
- [x] Adicionar campo "recorrente" (sim/não) na tabela de despesas
- [x] Adicionar campo "cartão" (FK para cartões) na tabela de despesas
- [x] Backend: CRUD de cartões de crédito
- [x] Backend: atualizar procedures de despesas para incluir recorrente e cartão
- [x] Frontend: seção de cadastro/gerenciamento de cartões de crédito
- [x] Frontend: campo "recorrente" no formulário de despesas
- [x] Frontend: seleção de cartão no formulário de despesas
- [x] Frontend: exibir cartão e recorrência na listagem de despesas

## Exportar PDF Despesas - Incluir Cartão e Recorrência
- [x] Atualizar generateExpensesPdf para incluir colunas Cartão e Recorrente

## Bug: Cards de semana cortados no mobile
- [x] Corrigir layout dos cards de semana (dias 18-24 e 25-31 cortados) na versão mobile

## Permissões de inadimplência
- [x] Esconder bolinhas (ticks manuais) na inadimplência para a senha "Fernando" — só Thiago pode ver/interagir

## Despesas E-commerce - Melhorias
- [x] Cartões de crédito salvos: ao selecionar "Cartão de Crédito", mostrar lista de cartões já cadastrados (nome + número) (já existia)
- [x] Permitir cadastrar novo cartão (nome + número) que fica salvo para próximas despesas (já existia)
- [x] Editar registro de despesa existente (novo endpoint updateExpense + botão de lápis na tabela)

## Vendas Mensais - Variações de Bambu
- [x] getMonthlySalesByProduct agora soma vendas das variações ao produto mãe com fator de conversão (reimplementado)
- [x] Ocultar roteiro de bolinhas (manual ticks) para TODOS os operadores na inadimplência (temporário, reativar quando Fernando pedir)
- [x] Ocultar botão Métricas na inadimplência para todos exceto Guilherme
- [x] Corrigir filtro de faturados: usar dataEntrega (quando disponível) além de dataEmissao para que pedidos faturados recentemente (mas emitidos há meses) apareçam no período correto (ex: pedido 384)
- [x] Corrigir filtro de faturados na aba Faturamento (ÚLT. 30 DIAS): usar dataEntrega além de dataEmissao para que pedido 384 apareça
- [x] Criar card "Análise Serragem/Rojão" na aba Financeiro ao lado do E-commerce, com sub-cards Serragem e Rojão contendo layout financeiro (valores zerados)
- [x] Análise Serragem/Rojão: adicionar seletor de período (Mês Atual, Mês Anterior, Personalizado)
- [x] Análise Serragem/Rojão: botão exportar relatório em PDF
- [x] Análise Serragem/Rojão: restringir acesso a Guilherme, Flávio, Fernando e Thiago
- [x] Mover seletor de período para dentro de cada análise (Serragem/Rojão), removendo do menu de seleção principal
- [x] Serragem - Vendas/Faturamento: consultar NFs do Maxiprod (estado config=Serragem, estado=Emitida, situação=Autorizada+Não Enviada) e preencher card
- [x] Serragem/Rojão - Contas Pagas + Retirada Sócios + Saídas Total: consultar Contas a Pagar (liquidação até hoje, estado PAGO, centro custo 13/14, sócios por fornecedor+referência)
- [x] Retirada Sócios: ao clicar no card, expandir e mostrar valor individual de cada sócio (Gilson-458, Fernando-459, Bruno-460)
- [x] Contas Pagas: card expansível ao clicar, mostrando lista detalhada de cada pagamento (excluindo sócios) com data, descrição, conta destino e valor
- [x] Total para Divisão Disponível = mesmo valor do Saldo Disponível Caixa
- [x] Serragem - Recebido: consultar Contas a Receber (liquidação até hoje, estado Recebidos, estado configurável Serragem) - valor esperado R$ 48.250,67
- [x] Serragem - Vendas/Faturamento: somar saldo anterior (R$ 17.230,80) que existia antes do Maxiprod, com legenda explicativa
- [x] Serragem/Rojão - Reorganizar: Contas Pagas e Retirada Sócios ficam dentro do card Saídas Total como seção expandível/recolhível
- [x] Corrigir classificação de sócios: usar conta de destino (458/459/460) em vez de fornecedor+referência - total esperado R$ 43.620,00
- [x] Rojão - Adicionar contas de destino 454 (Gilson), 455 (Fernando), 456 (Bruno) à classificação de sócios
- [x] Total para Divisão = (Vendas/Faturamento - Recebido) + Saldo Disponível Caixa - esperado R$ 26.433,62
- [x] Total para Divisão à Receber: consulta real Contas a Receber (estado A receber, estado configurável serragem/rojão, sem data) - esperado R$ 8.488,80 Serragem
- [x] Adicionar Bruno e Gilson à lista de operadores com acesso à aba Análise Serragem/Rojão
- [x] Somar saldo anterior pré-Maxiprod (R$ 17.230,80) ao card Recebido da Serragem com discriminação visual + recalcular Saldo Disponível Caixa
- [x] Corrigir layout mobile da aba Financeiro: título muito grande e abas embolando no celular
- [x] Omitir 3 cards (Total para Divisão, Total para Divisão Disponível, Total para Divisão à Receber) para Fernando/Bruno/Gilson e renomear Saldo Disponível Caixa para Saldo Disponível Para Divisão. Manter tudo para Flavio/Thiago/Guilherme. Aplicar Serragem e Rojão.
- [x] Diminuir card Vendas (v2 - largura limitada)/Faturamento para Fernando/Bruno/Gilson (mesmo tamanho dos menores) e destacar info NFs + saldo anterior
- [x] Filtro de mês na aba Serragem/Rojão afetando todos os cards (Vendas, Recebido, Saídas, Saldo)
- [x] Para Fernando/Bruno/Gilson: filtro de mês apenas no Vendas/Faturamento (outros cards sem filtro)
- [x] Para Fernando/Bruno/Gilson: adicionar "Falta receber" em vermelho no card Recebido (Vendas - Recebido)
- [x] Mover seletor de mês para dentro do card Vendas/Faturamento
- [x] Corrigir Falta receber para não sumir quando filtro de mês é aplicado
- [x] Implementar proteções robustas para dados da aba Inadimplência (backup automático, histórico, proteção contra rollback)
- [x] Criar tabela cobranca_planilha no banco de dados
- [x] Criar router tRPC para CRUD da planilha de cobrança (getAll, getSummary, updateField, updateObservacao, updateCobranca, importBatch)
- [x] Criar componente CobrancaPlanilhaView com visual profissional (cores por status, filtros, edição inline)
- [x] Importar 88 títulos e 14 observações da planilha Excel INADIMPLÊNCIA.xlsx
- [x] Integrar botão "Planilha de Cobrança" na aba Inadimplência para abrir a nova view
- [x] Testes vitest para o router cobrancaPlanilha (8 testes passando)
- [x] Planilha de Cobrança: copiar status possíveis da inadimplência (não atendeu, não deu retorno, etc.)
- [x] Planilha de Cobrança: renomear "Sem ação 1/2/3" para "Intervalo"
- [x] Adicionar saldo anterior do Rojão (R$ 15.251,10) ao Vendas/Faturamento, somando com Maxiprod
- [ ] REGRA DE NEGÓCIO: Variação de produtos madeira — quando pedido sai com código de variação (ex: 00087 = 4,0x220), abater do estoque do produto base (ex: 00086 = 4,0x218), pois fábrica produz só a medida base. Aplica-se a todos os produtos com variações dimensionais de madeira.
- [x] Alterar unidade dos produtos 00193 (Vareta Velas Madeira 15cm) e 00142 (Vareta Velas Madeira 8cm) de 'cx' para 'Kg'
- [x] Planilha de Cobrança: adicionar linhas divisórias entre clientes para facilitar visualização
- [x] Planilha de Cobrança: criar botão de backup instantâneo
- [x] Planilha de Cobrança: sincronizar automaticamente com dados da inadimplência (títulos, valores, status) sem perder marcações manuais
- [x] BUG: Sincronização da Planilha de Cobrança não puxa todos os títulos, valores e status da inadimplência
- [x] Planilha de Cobrança: puxar exatamente os mesmos títulos, valores e status da inadimplência (espelhar fielmente)
- [x] Despesas: adicionar ícone de clips para anexar documentos (PDF, planilha, imagem) ao criar nova despesa
- [x] Despesas: adicionar ícone de clips nas despesas já existentes para anexar documentos posteriormente
- [x] Despesas: criar tabela de anexos no banco e endpoints de upload/listagem/download
- [x] Liberar acesso de Thiago e Thalita à aba E-commerce
- [x] Despesas: preview de imagens inline no modal de anexos
- [x] Despesas: indicador visual na tabela quando despesa tem anexo
- [x] Despesas: exportar PDF com lista de anexos
- [x] E-commerce: criar card "Previsão de Contas Futuras" com mesmas funcionalidades do card Despesas
- [x] E-commerce: criar tabela ecommerce_future_bills no banco
- [x] E-commerce: criar endpoints tRPC para contas futuras (CRUD + anexos)
- [x] E-commerce: criar componente frontend FutureBillsSection
- [x] Despesas: permitir anexar documentos no formulário antes de salvar
- [x] Contas Futuras: permitir anexar documentos no formulário antes de salvar
- [x] Planilha de Cobrança: corrigir para puxar número de títulos e valor de inadimplência automaticamente da aba Inadimplência
- [x] Planilha de Cobrança: corrigir sync two-pass para não perder títulos duplicados (diferença de 3 títulos KEURE resolvida)
- [x] Planilha de Cobrança: remover campo "Observações" geral
- [x] Planilha de Cobrança: adicionar observação individual por etapa (1ª Cobrança, Intervalo, 2ª Cobrança, etc.)
- [x] Planilha de Cobrança: substituir campo de texto por date picker em cada etapa
- [x] Planilha de Cobrança: adicionar balãozinho de histórico de observações com badge vermelho
- [ ] Estoque Importação: investigar e corrigir itens indevidos (estoque da fiscal não deve aparecer no dashboard)
- [x] Contas Futuras: botão "Pago" que converte conta futura em despesa no card de Despesas (com anexos)
- [x] BUG Serragem: card "Total para Divisão à Receber" mostrando valor errado (deveria ser Total - Disponível = 4.803,36, mas mostra 8.002,40)
- [x] Planilha de Cobrança: puxar automaticamente clientes novos da inadimplência
- [x] Planilha de Cobrança: campos editáveis extras (estado, cidade, contato, email, região)
- [x] Planilha de Cobrança: remover automaticamente clientes que saíram da inadimplência
- [x] Importar comentários/observações da planilha Excel do Thiago para os campos corretos da Planilha de Cobrança
- [x] Planilha de Cobrança: remover etapa "Promessa Pgto" das Etapas de Cobrança
- [x] Planilha de Cobrança: tornar histórico de observações editável (editar e excluir)
- [x] PDF Cobrança: enriquecer PRÓXIMOS PDFs com dados da Planilha de Cobrança (datas, observações, ações) + mensagem protesto/sem protesto (1 folha) — não alterar PDFs já gerados
- [x] Serragem/Rojão: corrigir "Total para Divisão à Receber" para puxar do Maxiprod (contas a receber com estado configurável serragem/rojao + estado "A receber")
- [x] Planilha de Cobrança: exportação para PDF com dados completos (sem campo região)
- [x] Planilha de Cobrança: omitir/remover campo "região" da interface
- [x] Serragem/Rojão: corrigir valor do "Total para Divisão à Receber" — valor R$ 8.002,40 não bate com o esperado
- [x] Serragem/Rojão: corrigir "Total para Divisão à Receber" — usar notaFiscalId (ID único) ao invés de documentoVinculadoNumero para cruzamento preciso — valor correto R$ 4.802,40 (SERRAGEM)
- [x] Planilha de Cobrança: adicionar checkbox "Cobrança Pausada" em cada linha de etapa de cobrança (ao lado do seletor de data)
- [x] Planilha de Cobrança: quando "Cobrança Pausada" estiver marcada, mostrar indicação visual no card do cliente (texto laranja "cobrança pausada")
- [ ] Reimplementar: adicionar colunas forma_cobranca, vendedor, contatos_adicionais no banco (com segurança)
- [ ] Reimplementar: puxar forma de cobrança (PIX, Cheque, Boleto) da inadimplência no sync
- [ ] Reimplementar: puxar nome do vendedor via GraphQL no sync
- [ ] Reimplementar: puxar múltiplos contatos/telefones do Maxiprod GraphQL no sync
- [ ] Reimplementar: escrever "COM PROTESTO (CARTÓRIO)" e "SEM PROTESTO" por extenso com cores diferentes
- [ ] Reimplementar: exibir novos campos na tabela, row expandida e PDF de exportação
- [x] Planilha de Cobrança como tela principal ao clicar em Inadimplência (para todos)
- [x] Tela atual de inadimplência como secundária, acessível apenas pelo Guilherme
- [x] Card Pagos/Resolvidos visível na Planilha de Cobrança (tela principal)
- [x] Cards de resumo (títulos vencidos, valor, clientes) na Planilha de Cobrança
- [x] Card Pagos/Resolvidos na Planilha de Cobrança
- [x] Botão Guia de Cobrança na Planilha de Cobrança
- [x] Botão PDF Decisão + histórico na Planilha de Cobrança
- [x] Botão PDF Decisão ao lado de cada cliente na tabela da planilha
- [x] Cards de resumo por segmento (Bambu vs Madeira) na Planilha de Cobrança
- [x] Detalhamento ao clicar no card de segmento (lista de clientes do segmento)
- [x] Exportação de relatório PDF por segmento (Bambu / Madeira)
- [x] Corrigir sobreposição do card Histórico de Observações com os ícones de balão na row expandida
- [x] Garantir que o status na planilha de cobrança NUNCA seja sobrescrito pela sincronização (fica fixo até mudança manual)
- [x] Corrigir erro Unicode "t\u00edtulos" aparecendo literalmente nos cards de segmento
- [x] Mostrar mensagem "O PDF DE DECISÃO FOI GERADO, MAS O CLIENTE REALIZOU O PAGAMENTO E SAIU DA INADIMPLÊNCIA" no histórico de PDFs da Planilha de Cobrança para clientes que já pagaram
- [x] Buscar Contas a Receber do Maxiprod via GraphQL com Estado Configurável = ROJAO e SERRAGEM
- [x] Somar coluna "Valor Recebido" para Rojão e Serragem separadamente
- [x] Aplicar lógica de recebidos do Rojão também para Serragem na aba Análise Serragem/Rojão
- [x] Mostrar total de Valor Recebido por segmento no frontend
- [x] Corrigir layout mobile dos cards de resumo (títulos, valor, clientes) na Planilha de Cobrança - texto cortado
- [x] Mensagem verde no PDF Decisão aparece corretamente para qualquer cliente marcado como pago via botão 'Marcar como Pago'
- [x] Implementar refresh automático do token JWT (renovar sessão silenciosamente antes de expirar para evitar deslogamento frequente)
- [x] Corrigir card "Total para Divisão à Receber" Rojão/Serragem: usar campo "Valor a Receber" (valorAReceber) ao invés de "Valor Original" — filtro sem datas, estado configurável ROJÃO/SERRAGEM, estado A RECEBER
- [x] Corrigir layout do card "Histórico de Observações" - está sobrepondo os ícones de balãozinho das etapas, mover card mais para a direita
- [x] Bug: Retirada Sócios no Rojão - total correto (R$ 45.780,00) mas valores individuais (Gilson, Fernando, Bruno) aparecem R$ 0,00
- [x] Corrigir coluna Vendedor na Planilha de Cobrança - buscar representante/vendedor do cadastro da empresa no Maxiprod (ex: Arlindo Romão → JUVENAL)
- [x] Adicionar campo Apelido da empresa nos dados expandidos da Planilha de Cobrança (ex: MOGILANDI → apelido "AM.A.")
- [x] Dar à Thalita as mesmas permissões que o Thiago na Planilha de Cobrança (acesso completo para visualizar e editar)
- [x] Remover coluna "Responsável" (quem está com o cheque) da aba Recebíveis em todos os 9 tipos de cheque
- [x] Adicionar coluna "Dados do Cheque" ao lado da coluna "Cliente" na aba Recebíveis, puxando dados do Maxiprod (banco, número, titular)
- [x] Garantir formatação legível sem cortar ou sobrepor letras na nova coluna
- [x] Expandir card "Valor previsto de liberação para desconto na semana" para suportar 5 semanas (semana atual + 4 posteriores)
- [x] Permitir que Flavio lance valores manualmente para cada uma das 5 semanas
- [x] Ajustar banco de dados para armazenar valores por semana (semana 1 a 5)
- [x] Frontend: exibir campos editáveis para cada semana dentro do card
- [x] Agrupar cheques com mesmo banco e número (ex: "SICREDI - Nº 7") em uma única linha, somando os valores
- [x] Adicionar checkbox em cada conta na seção Pagamentos para o Fernando ticar/selecionar
- [x] Mudar cor da conta quando ticada (visual para todos os operadores verem)
- [x] Persistir tiques no banco de dados (todos veem o estado atual)
- [x] Vareta de Apito (00223 e 00058): mudar unidade de cx para Kg no lançamento de embalagem na Produção
- [x] Criar nova aba "Cadastro de Vendedores" na seção Vendas
- [x] Restringir acesso à aba apenas para Fernando e Guilherme
- [x] Estrutura inicial da aba (placeholder para funcionalidades futuras)
- [x] Criar tabela de gestores de vendas no banco de dados
- [x] Criar endpoints backend para CRUD de gestores
- [x] Implementar UI de cadastro de gestores na aba Cadastro de Vendedores
- [x] Pré-cadastrar Juvenal Teixeira e Jordão Laine como gestores
- [x] Garantir responsividade mobile em toda a interface
- [x] Corrigir lógica: itens industrializados (MADEIRA/MADEIRA CONTABILIZADO) NÃO devem ter pedidos descontados do estoque disponível no dashboard — baixa só no faturamento (não mexer no estoque atual)
- [x] Criar tabela de vendedores de rua vinculados aos gestores
- [x] Criar endpoints backend CRUD para vendedores
- [x] Implementar UI de cadastro de vendedores na aba Cadastro de Vendedores
- [x] Pré-cadastrar vendedores do Juvenal: Clarindo, Daniel, Romera, Luiz Matias, Renato
- [x] Substituir cadastro manual de gestores/vendedores por consulta GraphQL ao Maxiprod
- [x] Criar query GraphQL para puxar representantes (Apelido=vendedor, Representante/vendedor=gestor)
- [x] Criar endpoint tRPC que retorna vendedores agrupados por gestor
- [x] Atualizar UI CadastroVendedoresTab para usar dados do Maxiprod (sem CRUD manual)
- [x] Cobrança: buscar campo "E-mail para envio da NF-e/NFC-e/NFS-e" além do email do endereço (campo: emailParaEnvioDeDocumentosFiscais)
- [x] Cobrança: corrigir bug BOUTIQUE DO CONSTRUTOR mostrando "SEM PROTESTO" quando no Maxiprod está "COM PROTESTO" — sync agora SEMPRE atualiza tipo do Maxiprod
- [x] Cobrança: reativar atualização de decisaoCobranca no sync de contas a receber
- [x] Corrigir lógica de identificação de gestores/vendedores: Apelido == Representante/vendedor = GESTOR; Apelido != Representante/vendedor = subordinado; sem Representante/vendedor = ignorar
- [x] Criar tabela seller_permissions (vendedor, senha=primeiro nome, autorizado pelo gestor, produtos visíveis)
- [x] Criar endpoints: login vendedor, autorizar vendedor, configurar produtos visíveis
- [x] UI gestor: checkbox de autorização + seleção de produtos visíveis por vendedor
- [x] Login vendedor no app mobile (senha = primeiro nome, primeira letra maiúscula)
- [x] Filtrar produtos no estoque do app mobile conforme permissões do vendedor (rota /vendedor)
- [x] Preparar estrutura para futuras abas de catálogos PDF com permissões por vendedor
- [x] Permissões: mostrar produtos com referência completa (código + nome) ao invés de só código
- [x] Permissões: separar produtos por categoria (Madeira / Bambu) com sub-seções
- [x] Permissões: adicionar título "Estoque" acima das categorias de produtos
- [x] Bug: BOUTIQUE DO CONSTRUTOR mostra "SEM PROTESTO" no dashboard mas está "COM PROTESTO" no Maxiprod
- [x] Feature: Quando vendedor for Keure ou Johnson na planilha de cobrança, preencher automaticamente como "Grupo Fox"
- [x] Cobrança: buscar e exibir AMBOS os emails do cliente (emailParaEnvioDeDocumentosFiscais + email do endereço)
- [x] Normalizar representante "JUVENAL TEIXEIRA DA SILVA NETO" para "JUVENAL TEIXEIRA" no ranking de vendas e inadimplência
- [x] SellerApp: simplificar visualização de estoque para mostrar apenas nome do produto + quantidade disponível (cx/kg)
- [ ] Sistema de PDFs: criar schema (pastas, arquivos, visibilidade por vendedor)
- [ ] Sistema de PDFs: endpoints tRPC (CRUD pastas, upload PDF, ticagem visibilidade)
- [ ] Sistema de PDFs: ícone PDF no CadastroVendedoresTab + painel de gestão
- [ ] Sistema de PDFs: visualização no SellerApp (vendedor vê apenas PDFs ticados)
- [x] Sistema de PDFs/Catálogos: ícone PDF ao lado do ESTOQUE na tela de permissões
- [x] Sistema de PDFs/Catálogos: upload de PDFs com pastas (ex: Catálogos)
- [x] Sistema de PDFs/Catálogos: ticagem por vendedor (gestor seleciona quais PDFs cada vendedor vê)
- [x] Sistema de PDFs/Catálogos: aba Catálogos no SellerApp com visualização dos PDFs liberados
- [x] Pedido de Venda: schema do banco (pedidos, itens, preços mínimos, status aprovação)
- [x] Pedido de Venda: endpoints tRPC (CRUD, busca clientes, validação preço, aprovação)
- [x] Pedido de Venda: formulário no SellerApp (cadastro cliente com autocomplete + produtos + frete + pagamento)
- [x] Pedido de Venda: fluxo de aprovação (alerta gestor quando preço abaixo do mínimo)
- [x] Pedido de Venda: tela da Vitória para ver pedidos aprovados e preencher no Maxiprod

- [x] Aba "Gestão Comercial" vazia entre Vendas e Faturamento (acessível apenas para Fernando e Guilherme)
- [x] Migrar "Cadastro de Vendedores" da aba Vendas para a aba Gestão Comercial
- [x] Página de detalhe do vendedor com abas: Estoque, Cadastro de Cliente, Vendas, Configurações
- [x] Clicar no vendedor na Gestão Comercial abre a página de detalhe
- [x] Mover ticagem de produtos para aba Configurações do vendedor
- [x] Aba Estoque do vendedor: mostrar produtos ticados com Disponível p/ Venda e POs projetadas
- [x] Sistema de reservas: vendedor reserva caixas de POs futuras para clientes
- [x] Aba Vendas do vendedor: métricas de vendas filtradas por vendedor com seletor de período (dia, semana, mês atual, mês anterior, 3 meses, personalizado)
- [x] Aba Cadastro de Cliente no VendedorDetalhe: lista todos os clientes do vendedor com dados reais (nome, razão social, UF, segmento, total vendas, pedidos, primeiro/último pedido, telefone, email, endereço)
- [x] Procedure getClientesByVendedor: combina dados do banco sales_orders + GraphQL vendedorMap para mapear clientes ao vendedor
- [x] UI com busca por nome/cidade/UF/segmento, ordenação por valor/pedidos/recente, e detalhes expandíveis por cliente
- [x] Testes vitest para getClientesByVendedor (3 testes passando)
- [x] Cadastrar Novo Cliente: botão na aba Cadastro de Cliente para cadastrar novos clientes localmente
- [x] Formulário com campos do Maxiprod (razão social, nome fantasia, CNPJ/CPF, IE, endereço, telefone, email, segmento CRM, etc.)
- [x] Tabela vendor_clients no banco para armazenar clientes cadastrados manualmente
- [x] Integrar clientes cadastrados manualmente na listagem existente da aba Cadastro de Cliente
- [x] Renomear aba "Vendas" para "Métrica de Vendas" no VendedorDetalhe
- [x] Criar nova aba "Pedidos de Venda" antes de "Métrica de Vendas" no VendedorDetalhe
- [x] Filtros de tempo na aba Pedidos de Venda (mês atual, mês anterior, personalizado)
- [x] Manter filtros de status (Todos, Aprovado, Faturado) junto com filtro de tempo
- [x] Card "Novo Pedido de Venda" na aba Pedidos para o vendedor criar pedidos
- [x] Seleção de produtos do estoque visível do vendedor com specs completas (peso, dimensões, código de barras, unidade, descrição complementar)
- [x] Adicionar recebíveis do Banco Bradesco para Palitos, Espetos e Varetas na aba Financeiro
- [x] Cards do Bradesco com mesmos filtros dos outros bancos (vencido, a vencer, cheque, depósito)
- [x] Sync GraphQL já puxa bancoNome/contaNumero do Bradesco corretamente (títulos sem forma de cobrança são propostas/pedidos não faturados)
- [x] Card "Limite atual da conta garantida" manual dentro do card Bradesco (similar ao "Limite troca de títulos" do Sicoob)
- [x] Mostrar todos os produtos disponíveis na etapa Produtos do Novo Pedido (lista completa visível por padrão)
- [x] Exibir todas as specs do produto (medida, peso, dimensões, código de barras, unidade, grupo)
- [x] Manter busca como filtro opcional sobre a lista completa
- [x] Painel consolidado de métricas de vendas de TODOS os vendedores na Gestão Comercial (ranking, KPIs, filtros de período)
- [x] Mostrar dimensões (Largura x Altura x Comprimento) com labels claros nos produtos do Novo Pedido
- [x] Mostrar peso de forma visível e legível
- [x] Converter disponível de unidades para caixas/kg/dúzias (dividir pelo fator de venda)
- [x] Mostrar projeção de PO (ordens de compra pendentes: qtd chegando e data prevista)
- [x] Adicionar caixa expansível (accordion) em cada produto com todas as informações do Maxiprod
- [x] Remover exibição de "Disp: XXXXX un" (unidades brutas) dos cards de produto no Novo Pedido
- [x] Criar tabela po_reservations no banco (vendedor, produto, PO, quantidade reservada em caixas, data)
- [x] Criar procedures tRPC para reserva de PO (criar reserva, listar reservas, cancelar reserva)
- [x] Adicionar botão de reserva nos cards de produto com PO chegando (Novo Pedido)
- [x] Mostrar reservas de PO no dashboard de Estoque (visível para todos - caixas comprometidas por PO)
- [x] Novo Pedido: busca de cliente letra a letra com dropdown e preenchimento automático de todos os campos ao selecionar
- [x] Fix: busca de clientes no Novo Pedido deve incluir clientes da tabela sales_orders (Maxiprod), não apenas sales_order_requests
- [x] Mobile: garantir responsividade completa em toda a Gestão de Vendas (Novo Pedido, Clientes, Pedidos) sem sobreposição de texto ou distorção
- [x] Fix: Planilha de Cobrança - incluir títulos vencidos até último dia útil anterior a hoje (não excluir recentes como 20/05)
- [x] Fix: Planilha de Cobrança - remover títulos que já foram liquidados/recebidos no Maxiprod (ex: FLAVIO JOSE)
- [x] Auto-sync Planilha de Cobrança: sincronização automática a cada 5 min (horário comercial) após sync do Maxiprod — desativa títulos pagos e adiciona novos vencidos
- [x] Planilha de Cobrança: adicionar coluna "Centro" com Estado configurável do Contas a Receber (BAMBU, MADEIRA, ROJÃO, SERRAGEM)
- [x] Planilha de Cobrança: adicionar coluna "Documento" com NF e parcela do Contas a Receber (ex: NF 1586)
- [x] PDF Decisão de Cobrança: incluir observações da Planilha de Cobrança (histórico de observações por etapa) na seção "ETAPAS DE COBRANÇA REALIZADAS"
- [x] PDF Decisão de Cobrança: preencher "HISTÓRICO DE AÇÕES REALIZADAS" com todas as observações das etapas de cobrança (etapa, data, texto)
- [x] PDF Decisão de Cobrança: consolidar observações na caixa "OBSERVAÇÕES" do PDF
- [x] Planilha de Cobrança: novos clientes entrando na inadimplência devem receber o campo "Apelido" preenchido automaticamente (igual aos existentes)
- [x] Criar aba "Tabela de Preços" entre "Cadastro de Cliente" e "Pedidos de Venda" no VendedorDetalhe (placeholder - integração com Maxiprod futura)
- [x] Adicionar status "Fundo Perdido" na Planilha de Cobrança (CobrancaPlanilhaView, InadimplenciaTab, CollectionMetricsPanel, cobrancaPlanilhaRouter, cobrancaPlanilhaSync)
- [x] Consulta de Cliente (aba Vendas): adicionar campo "Valor a Receber" por cliente (soma de títulos em aberto + liquidados com Situação preenchida no Maxiprod)
- [x] BUG: Valor a Receber mostrando valor incorreto (usar dados ao vivo do Maxiprod para EMITIDO em vez do banco local desatualizado)
- [x] Títulos descontados: mostrar TODOS em painel expansível com informações completas (valor, situação, forma cobrança, vencimento)
- [x] BUG Inadimplência: não mostra títulos vencidos ontem (20/05/2026) - precisa incluir até 1 dia útil antes de hoje (já corrigido no auto-sync)
- [x] BUG Inadimplência: mostra títulos já liquidados no Maxiprod (ex: FLAVIO JOSE NF 287 R$2.090 12/05) - precisa confrontar com Maxiprod ao vivo (já corrigido no auto-sync)
- [x] Valor a Receber: usar valorOriginal - valorRecebidoLiquido para calcular valor real a receber (bater com coluna 'A Receber' do Maxiprod)
- [x] Textos escapados (T\\u00edtulos) corrigidos para UTF-8 correto
- [x] Remover card antigo 'Títulos Em Aberto' (local DB, valorOriginal incorreto, 50 títulos/R$501K) e usar apenas ValorAReceberPanel (live Maxiprod, valorAReceber correto, 38 títulos/R$365K) para todos os clientes
- [x] Planilha de Cobrança: destaque visual (pulsante, borda vermelha/escura, shadow) nos cards 'Protestado' e 'Fundo Perdido' quando houver clientes
- [x] Seção "Títulos (Contas a Receber)": corrigir valores para usar valorAReceber E filtrar títulos com saldo 0 (pagos) para alinhar com Maxiprod (38 títulos / R$ 365K)
- [x] Criar aba "Planilha de Cartões de Crédito" ao lado de Inadimplência
- [x] Schema DB: tabelas para cartões e lançamentos (despesas parceladas)
- [x] Backend tRPC: CRUD para cartões e lançamentos com controle de acesso (Guilherme/Flávio)
- [x] Frontend: planilha editável moderna com colunas de meses futuros (parcelas)
- [x] Controle de acesso: restringir apenas Guilherme e Flávio
- [x] Criar aba 'Planilha de Cartões de Crédito' ao lado da aba Inadimplência (acesso restrito Guilherme e Flávio)
- [x] Backend: creditCardRouter com CRUD de cartões e lançamentos
- [x] Frontend: CreditCardTab com planilha editável, colunas de meses, cálculo de parcelas
- [x] Testes vitest para controle de acesso e cálculo de parcelas
- [x] Automatizar cálculo de mesInicio baseado na data de compra e dia de fechamento do cartão
- [x] Remover campo manual de mesInicio e calcular automaticamente no backend
- [x] Permitir quantos lançamentos quiser dentro de cada cartão
- [x] Criar aba 'Catálogos' entre 'Tabela de Preços' e 'Pedidos de Venda'
- [x] Schema: tabela catalogs (id, nome, fileUrl, fileKey, uploadedBy, createdAt)
- [x] Schema: tabela catalog_seller_access (catalogId, sellerName, visible)
- [x] Backend: CRUD catálogos (upload PDF, listar, deletar)
- [x] Backend: gerenciar visibilidade por vendedor (checkbox)
- [x] Frontend: gestor vê todos os catálogos com checkboxes por vendedor
- [x] Frontend: vendedor vê apenas catálogos liberados para ele
- [x] Planilha de Cobrança: puxar TODAS as informações do Maxiprod para clientes novos (CNPJ/CPF, Município, UF, Contato, Email, Telefones) igual aos clientes antigos
- [x] Consulta Cliente: corrigir Valor a Receber - buscar de Contas a Receber estado A_RECEBER tipo Títulos (não mais de sales_orders)
- [x] Consulta Cliente: Títulos em aberto = mesmo valor que Valor a Receber base (Contas a Receber estado A_RECEBER)
- [x] Consulta Cliente: Títulos descontados = Contas a Receber estado RECEBIDOS tipo Títulos com situação preenchida (BOLETO DESCONTADO BRADESCO/FACTORING/SICOOB/SICREDI, CHEQUE DESCONTADO FACTORING)
- [x] Consulta Cliente: Valor a Receber total = Títulos em aberto + Títulos descontados
- [x] Planilha de Cobrança: garantir que TODOS os títulos (novos e antigos) do mesmo cliente tenham dados preenchidos (CNPJ, Município, UF, Contato, Email) - backfill + sync fix
- [x] Consulta Cliente: adicionar filtros de Tipo (Títulos, Receitas, Adiantamentos, Pedidos de Venda) com checkboxes
- [x] Consulta Cliente: usar coluna "Valor a receber" do Maxiprod (valorLiquido - valorRecebidoLiquido) para calcular totais
- [x] Consulta Cliente: valor muda conforme filtros de tipo são marcados/desmarcados
- [x] Consulta Cliente: mostrar status de inadimplência em tempo real (dados da Planilha de Cobrança)
- [x] Consulta Cliente: mostrar coluna Situação nos títulos em aberto e descontados (Factoring, Bradesco, Sicoob, etc.)
- [x] Consulta Cliente: usar banco local (accounts_receivable) como fonte primária para Valor a Receber em vez de busca GraphQL por nomeFantasia (funciona para TODOS os clientes)
- [x] Consulta Cliente: incluir TITULO_PROPOSTA_DE_VENDA nos filtros de tipo
- [x] Consulta Cliente: campo situacaoTitulo (BOLETO DESCONTADO SICOOB, etc.) extraído do campoAdicionalEspecifico tag "Situacao" do título
- [x] Sync: buscar títulos RECEBIDO do GraphQL para preencher situacaoTitulo nos registros locais
- [x] Consulta Cliente: títulos descontados detectados por situacaoTitulo não-vazio (em vez de decisaoCobranca)
- [x] Consulta Cliente: corrigir lógica - títulos descontados vêm de EMITIDO com situacaoTitulo preenchido (não de RECEBIDO)
- [x] Consulta Cliente: RECEBIDO não entra em nenhum cálculo (cliente já pagou)
- [x] Produção: exportar PDF do Histórico de Pirografia com opções de período (diário, semanal, mensal)
- [x] Produção: botão de exportar PDF no frontend com seletor de período
- [x] Consulta Cliente: excluir TITULO_PROPOSTA_DE_VENDA de todo cálculo de Valor a Receber (propostas não são dívida real)
- [x] Consulta Cliente: remover checkbox "Propostas de Venda" do filtro de tipos no frontend
- [x] Financeiro: exportar PDF das contas a pagar ticadas pelo Fernando
- [x] Faturamento: corrigir inversão de data no PDF (07/05 virava 05/07 por re-parsing de dd/mm como mm/dd)
- [x] Cobrança: corrigir Histórico de Observações para buscar por empresa (todos IDs) em vez de só planilhaId
- [x] Cobrança: proteger sync para herdar campos manuais (status, obs, datas cobrança) de itens existentes da mesma empresa
- [x] Fix "Pagos/Resolvidos" card not updating since 14/05/2026 - clients who had 3+ days overdue and resolved their debt must appear
- [x] Cobrança: botão "Sincronizar c/ Inadimplência" visível apenas para operador GUILHERME
- [x] Financeiro > Visão Geral: card "Pagamentos Adiados" mostrando títulos com vencimento 31/12/2050 (ticados pelo Fernando)
- [x] Fix unicode encoding bug in Pagamentos Adiados card header ("t\u00edtulos" → "títulos")
- [x] Add annotation/notes feature per deferred payment for Fernando to reprogramar datas
- [x] Fix Planilha de Cobrança to use valorAReceber (reflecting partial payments) instead of valorOriginal for display and segment totals

## Gestão Comercial - Tabelas de Preço
- [x] Explorar API GraphQL do Maxiprod para encontrar tabelas de preço por vendedor
- [x] Criar schema no banco para armazenar tabelas de preço (produto, preço, desconto máximo, vendedor)
- [x] Implementar sync automático das tabelas de preço do Maxiprod (a cada 5 min)
- [x] Calcular e exibir coluna "Preço Mínimo de Venda" (preço - desconto máximo %)
- [x] Criar tela Gestão Comercial no frontend com visualização por vendedor
- [x] Testes automatizados para o módulo
- [x] Auto-ticar produtos visíveis do vendedor com base na tabela de preço do Maxiprod (se produto está na tabela de preço, fica visível no estoque do vendedor)
- [x] Login do vendedor pela tela principal: aceitar senha do vendedor além da senha admin, redirecionar direto para a área do vendedor
- [x] Bug: nomes dos produtos não aparecem na aba Estoque do vendedor (só mostra quantidade)
- [x] Adicionar abas no app do vendedor: Cadastro de Cliente, Tabela de Preços, Pedidos de Venda, Métrica de Vendas (exceto Configurações)
- [x] Refatorar SellerApp para reutilizar os mesmos componentes do VendedorDetalhe (idêntico ao gestor, exceto aba Configurações)
- [x] Bug: produtos MADEIRA não mostram pedidos de venda (pedidosCx zerado) - corrigir para mostrar pedidos mas não abater do disponível/projetado
- [x] Bug: KPI card "Pedidos (Venda)" contava pedidos de filhos+pais (double-count) - corrigido para usar apenas parentOnlyMadeira
- [x] Cadastrar 00541 (VARETA CERTIFICADA FSC) como variação do 00086 (VARETA AROMATIZADOR 4,0 X 218 MM)
- [x] Criar aba "Importação" no menu principal (entre Financeiro e Produção)
- [x] Sub-aba "Relação de Pagamentos com Fornecedores Chineses"
- [x] Sub-aba "Custo da Mercadoria"
- [x] Schema DB: tabelas fornecedores_importacao e pagamentos_importacao
- [x] Backend: procedures tRPC CRUD para fornecedores e pagamentos
- [x] Frontend: UI moderna da sub-aba Pagamentos Fornecedores Chineses (tabela por fornecedor, totais, formulário de cadastro)
- [x] Importar dados existentes da planilha Excel para o banco
- [x] Remover cálculos automáticos da aba Importação - todos os campos preenchidos manualmente
- [x] Eliminar scroll horizontal da tabela - tudo visível na tela sem rolar pro lado
- [x] Sub-seções dentro do mesmo fornecedor (ex: BETTY - BAMBU e BETTY - DIVERSOS)
- [x] Sub-seção vazia aparece imediatamente ao criar (sem precisar adicionar pedido primeiro)
- [x] Cabeçalhos agrupados: "O que pagou" (verde) e "O que falta pagar" (vermelho) acima das colunas
- [x] Alinhamento numérico perfeito: tabular-nums, font-mono, backgrounds coloridos nas colunas de grupo
- [x] Formatação monetária: $ com non-breaking space para não quebrar linha
- [x] AddPaymentForm inclui seções vazias no dropdown de seleção de sub-seção
- [x] Sub-seção header: visual bonito com ícone + nome bold + badge categoria (igual ao card principal do fornecedor)
- [x] Criar sub-seção: campo Título (Fornecedor) editável (ex: BETTY 1, BETTY 2)
- [x] Adicionar Pedido: abrir nova linha editável inline na tabela em vez de card separado
- [x] Botão conversão USD ↔ BRL no canto superior direito da aba Importação com cotação do dia visível
- [x] Ao clicar no botão, converter todos os valores monetários da tela instantaneamente
- [x] Mostrar valor da cotação atual explicitamente junto ao botão
- [x] Botão Exportar PDF na aba Importação com todas as informações de fornecedores e pedidos
- [x] Importação: unificar header da sub-seção (título = nome fornecedor, subtítulo = categoria) sem duplicação
- [x] Importação: permitir edição manual dos títulos e subtítulos das sub-seções diretamente no header
- [x] BUG: Linha azul da sub-seção WINNIE-HARBIN ainda aparece (deveria ser ocultada quando há apenas 1 seção)
- [x] BUG: Texto "Sub-se\u00e7\u00e3o" aparece com unicode escapado em vez de "Sub-seção"

## REGRA FUNDAMENTAL (a partir de 28/05/2026)
> Os dados da aba Importação são SAGRADOS e NUNCA devem ser apagados ou resetados.
> Isso inclui: import_suppliers, import_payments e qualquer dado adicionado pela Larissa.
> Nenhuma operação do sistema (sync, reset, migração, publicação, teste) pode deletar ou sobrescrever esses dados.
> Após uma nova publicação ou sincronização, JAMAIS remover informações que a Larissa adicionou na aba Importação.
> Em caso de dúvida, PERGUNTAR ao usuário antes de qualquer operação destrutiva.
- [x] BUG: Status de inadimplência desmarcados - restaurar ação de cobrança (contatado, promessa de pagamento, fundo perdido), observações e históricos
- [x] BUG: Card verde "Pagos/Resolvidos" - CONFIRMADO: lógica já estava correta (filtra 3+ dias de atraso). Valor é legítimo.
- [x] FIX: Proteção contra reset de status na sincronização automática (herdar status manual de registros existentes da mesma empresa)
- [x] Importação: buscar cotação USD/BRL em tempo real (BCB PTAX, cache 30min, fallback AwesomeAPI)
- [x] Importação: corrigir layout mobile - tabela com colunas sobrepostas e texto ilegível no celular (scroll horizontal + whitespace-nowrap + min-widths)
- [x] REGRA: TODOS os campos da aba Importação devem ser manuais - NENHUM preenchimento automático
- [x] FIX: Separar campos Brasil/Paraguai como campos independentes editáveis (sem auto-cálculo)
- [x] FIX: Separar campos Brasil/Paraguai como campos independentes editáveis em TODAS as seções (Total a pagar, O que pagou, O que falta pagar) — sem auto-cálculo
- [x] Adicionar colunas total_brasil_usd e total_paraguai_usd no banco (seção azul independente)
- [x] Atualizar backend router para aceitar todos os campos independentes
- [x] Atualizar frontend: cada campo é editável individualmente, sem nenhum auto-cálculo
- [x] PDF Export: reescrever para ficar fielmente igual à tabela do frontend (3 seções coloridas: Total a pagar azul, O que pagou verde, O que falta pagar vermelho)
- [x] PDF Export: exportar em USD ou BRL dependendo da configuração selecionada, com indicação clara da moeda no cabeçalho
- [x] PDF Export: nunca dividir um fornecedor entre duas páginas (forçar page break se seção não couber inteira)
- [x] Layout: Reorganizar header - logo Fox à esquerda do texto "Dashboard" (maior), data/horário e modo noturno à direita, tudo descido do topo para liberar espaço para as abas
- [x] Logo: Trocar para logo colorida (verde/laranja) com fundo transparente, sem contraste com fundo da página
- [x] Importação: Adicionar coluna "Data de Chegada" ao lado de "Pedido" apenas para a Winnie

## Relatório de Vendas (Aba na Gestão Comercial / Vendedores)
- [x] Criar tabela sales_visit_reports no banco (vendedor, cliente, data, resultado, motivos, observações)
- [x] Criar backend router (salesVisitRouter) com CRUD de relatórios de visita
- [x] Adicionar aba "Relatório de Vendas" no VendedorDetalhe.tsx (entre Pedidos e Métricas)
- [x] Formulário de registro de visita: data, cliente, resultado (Pedido/Sem Pedido/Agendou Retorno/Cliente Ausente)
- [x] Sistema de tags/motivos de não-compra: Estoque Alto, Preço Alto, Sem Verba, Preferência Concorrente, etc.
- [x] Listagem de visitas registradas com filtros (período, cliente, resultado)
- [x] Métricas por cliente: % de cada motivo de não-compra sobre total de visitas
- [x] Métricas gerais: total visitas, taxa conversão, motivos mais frequentes
- [x] Testes automatizados para salesVisitRouter

## Alerta de Pagamento Winnie - Harbin (Data de Chegada)

- [x] Adicionar campos no banco: alert_days_before (dias de antecedência) e alert_dismissed (se foi dispensado manualmente)
- [x] Backend: endpoint para configurar dias de antecedência do alerta
- [x] Backend: endpoint para dispensar/desativar o alerta manualmente
- [x] Backend: lógica para calcular se o alerta deve ser exibido (data_chegada - alert_days_before <= hoje)
- [x] Frontend: seletor de dias de antecedência ao lado da data de chegada
- [x] Frontend: card vermelho de alerta de pagamento quando ativado
- [x] Frontend: botão para Larissa dispensar o card manualmente
- [x] Garantir que nenhuma informação é apagada ao dispensar o alerta
- [x] Frontend: botão para reativar alerta dispensado
- [x] Testes automatizados para lógica de alerta (14 testes)

## Rastreamento de Containers em Tempo Real (Logcomex)
- [x] Backend: endpoint para buscar dados de rastreamento da Logcomex via API pública
- [x] Backend: salvar UUID do workflow-item da Logcomex na tabela import_payments (coluna tracking_uuid)
- [x] Frontend: modal de rastreamento com mapa, timeline de eventos, status e ETA
- [x] Frontend: botão de rastreamento na coluna RASTREIO de cada linha (clicável)
- [x] Frontend: campo para colar link/UUID da Logcomex ao editar linha
- [x] Funcionar para todos os fornecedores chineses (cada pedido rastreável individualmente)
- [x] Melhorar TrackingModal: substituir mapa SVG por Google Maps real com rota do navio (Polyline), marcadores de origem/destino/posição atual, e layout profissional
- [x] Adicionar campo BL number (bl_number) na tabela import_payments e UI de edição
- [x] Criar backend scraper para consultar tracking da ONE Line (ecomm.one-line.com) por número de BL
- [x] Atualizar TrackingModal para usar dados reais da ONE Line com mapa Google Maps, rota real, posição do navio e timeline de eventos
- [x] Botão "Rastrear" funcionar com BL number (sem depender de UUID da Logcomex)
- [x] Criar tabela tracking_cache no banco para armazenar dados de rastreamento atualizados
- [x] Implementar scraper Puppeteer para ONE Line (ecomm.one-line.com) que extrai dados reais
- [x] Implementar job agendado (AGENT cron) diário às 06:00 AM Brasília para atualizar rastreamento dos 2 BLs
- [x] TrackingModal usar dados do cache (banco) em vez de dados hardcoded
- [x] Bug: Produção lançada pela Maria não está somando no estoque PA (ex: 00195 deveria ter 32 cx, mostra 28) — usuário ajusta manualmente, próximo lançamento soma corretamente
- [x] Bug: Faturamento de variação não dá baixa no estoque do produto mãe (ex: faturar 00541 deveria subtrair do estoque do 00086) — corrigido: lookup child→parent via product_variants
- [x] Bug: Barras de vendas diárias não aparecem no PDF exportado (apenas linhas cumulativas visíveis) — problema com CSS animation no SVG clone
- [x] Produto 00556 (unidade MIL): converter para caixas dividindo por 10.002 nos cards de pedidos e atualizar fator de conversão na product_variants (00808→00556)
- [x] Produto 00556: corrigir estoque/pedidos/disponível na tabela de madeira (stockProcessor) - dividir totalCx por 10.002, estoque virtual = pedidosCx, unidadeVenda = CX

## Vinculação de Tabela de Preços por Vendedor
- [x] Adicionar campo price_table_code na tabela seller_permissions (ALTER TABLE + Drizzle schema)
- [x] Vincular RENATO ALEIXO (id=250000) à tabela 006 (RLA AGRONEGOCIOS LTDA) via price_table_code
- [x] Atualizar getPriceTableItems: priorizar mapeamento direto via priceTableCode, fallback para matching por nome
- [x] Marcar 48 produtos da tabela 006 como visíveis para RENATO ALEIXO em seller_product_visibility
- [x] Gerar migration Drizzle (0141_burly_the_leader.sql) para o campo price_table_code

## UX: Facilitar reserva de PO no Novo Pedido de Venda
- [x] Quando vendedor clica no produto com PO chegando (na lista de produtos, etapa 2), mostrar automaticamente a seção de PO com botão "Reservar Caixas desta PO" sem precisar expandir com a seta

## Bug Fix: Histórico de Dias na Inadimplência
- [x] Recuperar histórico de dias (bolinha verde) de cada cliente nas etapas de cobrança da inadimplência
- [x] Corrigir auto-sync para herdar etapas de cobrança ao criar novos registros da mesma empresa
- [x] Corrigir syncFromInadimplencia para herdar semAcao1/semAcao2/semAcao3 (antes só herdava as datas principais)
- [x] Corrigir herança de etapas: só herdar se primeira_cobranca >= vencimento do título (evita misturar etapas de títulos antigos com títulos novos da mesma empresa)
- [x] Limpar 5 registros que tinham etapas herdadas incorretamente (primeira cobrança anterior ao vencimento)

## Cheques: Cards de Factoring
- [x] Adicionar cards separados para CHEQUE DESCONTADO FACTORING CIFRAS, FINANZA e SAMONEY na aba de cheques/recebíveis do financeiro

## Inadimplência: Rastreabilidade de Etapas Herdadas
- [x] Adicionar indicador visual ou tooltip mostrando de qual título a etapa de cobrança foi herdada

## Cheques Factoring: Detalhe ao clicar no card
- [x] Ao clicar no card de factoring (FINANZA, SAMONEY, CIFRAS), abrir tabela detalhada com nome do cliente, descrição, valor, vencimento de cada cheque

## Inadimplência: Correções Múltiplas (03/06/2026)
- [x] Puxar nomes dos vendedores do Maxiprod para cada cliente na inadimplência; quando não conseguir, dar opção de editar manualmente
- [x] Corrigir contagem de Pagos/Resolvidos: só considerar quem tinha 3+ dias de inadimplência (já estava correto no backend — filtro diasAtrasoNaResolucao >= 3)
- [x] Remover observações de teste vitest do histórico (24 registros removidos)
- [x] Corrigir duplicatas no histórico de observações (deduplicação de 60s adicionada ao addEtapaObs)
- [x] Quando tem ação final registrada, preencher automaticamente que etapas anteriores (1ª, 2ª, 3ª cobrança) foram cumpridas — SEM desmarcar status
- [x] Corrigir truncamento do nome do vendedor na tabela (max-w-[80px] → max-w-[120px] break-words)
- [x] Adicionar edição manual do vendedor no detalhe expandido (ícone lápis + input inline)
- [x] Limpar scripts temporários (fix_vendedor.ts, check_vendedor.ts, backfill_etapas.ts)

## Bug: Card "Factoring Outros" não deveria existir (03/06/2026)
- [x] Remover card "FACTORING OUTROS" da aba de cheques — só existem 3 factorings: CIFRAS, FINANZA e SAMONEY
- [x] Investigar qual cheque está caindo em "Outros" e reclassificar ou remover (era 1 cheque com situacaoTitulo="BOLETO DESCONTADO FACTORING" sem empresa — corrigido no Maxiprod + filtro no backend)

## Todos os Cheques: Descrição completa e Dados do Cheque (03/06/2026)
- [x] Puxar descrição completa do Maxiprod (com nome do cliente ref, ex: "TROPICAL PALITOS ref. Parcelamento de s/nº...") para TODOS os títulos
- [x] Puxar campo "DADOS DOS CHEQUES" do Maxiprod (banco, número, titular) e exibir na coluna Cheque em TODAS as tabelas que mostram cheques
- [x] Corrigir tag extractDadosCheque: 'DadosDosCheques' (com s) em vez de 'DadosDoCheque'
- [x] Adicionar coluna clienteApelido ao schema e sync GraphQL (campo 'apelido' do cliente)
- [x] Backfill: 4737 registros com apelido preenchido, 80 com dados do cheque
- [x] Renomear header da coluna para "Dados do Cheque" na tabela factoring

## Bugs Inadimplência (03/06/2026)
- [x] Corrigir barra de pesquisa da inadimplência — não está filtrando pelo nome do cliente (causa raiz: campo empresa continha nome do banco em vez do cliente para títulos PIX; após correção, busca por descricao já encontra)
- [x] Corrigir cliente invertido com banco — "BANCO COOPERATIVO SICREDI S.A." aparecendo como nome do cliente quando deveria ser "BOTICA BELADONA - J L FORMULAS" (função extractRealClientFromPix extrai nome real do referenteA; backfill de 6 registros corrigidos)
- [x] Limpar scripts temporários de investigação (check_banco.mjs, check_pix_issue.mjs, fix_banco_empresa.mjs + 20 outros)

## Bug: Card "A FATURAR MÊS ATUAL" com valor incorreto (04/06/2026)
- [x] Card "A FATURAR MÊS ATUAL" (card de baixo) mostrava R$ 514.678,58 com 27 pedidos porque getOrders incluía pedidos com dataEntrega no mês (de meses anteriores). Corrigido para usar apenas dataEmissao, consistente com card KPI laranja (R$ 225.738,58)

## Bug: Card "A FATURAR (ANTERIOR)" com valor incorreto (04/06/2026)
- [x] Card "A FATURAR (ANTERIOR)" mostra R$ 485.784,72 — valor está correto (acumula todos os meses anteriores não faturados, não apenas maio). Usuário confirmou que pode deixar como está.

## Feature: Estoque E-Commerce separado (04/06/2026)
- [x] Remover produtos com grupo "Outros" da tabela principal de estoque de importação
- [x] Criar card separado "Estoque E-Commerce" para exibir produtos com grupo "Outros"
- [x] Adicionar "Outros" como opção de grupo no dropdown da página Configurações > Produto Importado (para controle de visibilidade)

## Fix: Estoque E-Commerce em unidades (04/06/2026)
- [x] KPIs do card Estoque E-Commerce devem mostrar "un" em vez de "cx" (produtos são contados em unidades)

## Fix: Filtro "Outros" na Config Produto Importado (04/06/2026)
- [x] Filtro "Outros" não encontrava produtos E-Commerce — settingsRouter.getProductSegments não classificava produtos sem grupoCodigo como "outros". Corrigido com fallback usando superGrupoCodigo/grupoCodigo (mesma lógica do stockProcessor)

## Bug URGENTE: Baixas automáticas de estoque em 03/06 às 16:31 (04/06/2026)
- [x] Investigar o que causou baixas automáticas de caixas em 03/06 às 16:31 — causa: snapshot perdido no deploy, reprocessou 33 faturamentos antigos
- [x] Restaurar os valores corretos de estoque (retomar caixas) — 11 produtos restaurados, 33 baixas revertidas
- [x] Prevenir que baixas automáticas ocorram novamente — trava >10 faturamentos/sync + billing_history populado com 527 registros
- [x] Conversão kg→caixa no faturamento: produto 00808 (11,6 kg/cx) — exibir em caixas e abater estoque em caixas
- [x] Criar senha "Renato" para vendedor Renato Aleixo (acesso versão vendedor) — já existia com senha "Renato", authorized=1 ativado
- [x] Liberar acesso do Juvenal Teixeira à aba Gestão Comercial (apenas seus vendedores, com todos os direitos: ticar produtos, catálogos, autorização de acesso)
- [x] Custo da Mercadoria: criar schema de banco (import_pos, import_po_products)
- [x] Custo da Mercadoria: popular banco com 41 POs da Betty extraídas da planilha (1069 produtos, 906 com valores CI)
- [x] Custo da Mercadoria: criar endpoints tRPC (listar fornecedores, POs, produtos)
- [x] Custo da Mercadoria: frontend com cards por fornecedor, POs expandíveis, tabela de produtos
- [x] Custo da Mercadoria: coluna código do produto (editável) que puxa nome do estoque
- [x] Custo da Mercadoria: coluna NCM (editável) que calcula impostos automaticamente
- [x] Custo da Mercadoria: colunas valor PO cheia e valor PO menor (PO01-PO27 só cheia, PO29+ ambas)

## Custo da Mercadoria: Configurações e Funcionalidades Completas (08/06/2026)
- [x] Criar tabela DB import_icms_config (UF, alíquota ICMS sugerida, alíquota editável)
- [x] Criar tabela DB import_ncm_taxes (NCM, alíquota II, alíquota IPI, editável)
- [x] Aba/seção Configurações no Custo da Mercadoria: seletor de estado com ICMS sugerido + editável
- [x] Aba/seção Configurações no Custo da Mercadoria: tabela NCM com alíquotas II e IPI editáveis
- [x] Backend: endpoints tRPC para CRUD de ICMS por estado
- [x] Backend: endpoints tRPC para CRUD de NCM/alíquotas
- [x] Backend: endpoint para criar novo fornecedor
- [x] Backend: endpoint para criar nova PO (nome, fornecedor)
- [x] Backend: endpoint para buscar produtos do estoque (seletor de código)
- [x] Frontend: botão "Novo Fornecedor" com modal de criação
- [x] Frontend: botão "Nova PO" dentro do card do fornecedor
- [x] Frontend: seletor de código de produto (dropdown/search do estoque)
- [x] Frontend: auto-preenchimento de descrição ao selecionar código
- [x] Frontend: campo NCM que dispara cálculo automático de impostos
- [x] Frontend: exibição dos impostos calculados (II, IPI, PIS, COFINS, ICMS) baseados no Valor Menor
- [x] Colunas de impostos na tabela import_po_products (ii_valor, ipi_valor, pis_valor, cofins_valor, icms_valor)

## Custo da Mercadoria: Correções e Melhorias (08/06/2026 - parte 2)
- [x] Alterar fluxo "Adicionar Produto": primeiro campo = seletor de código (busca no estoque), ao selecionar puxa descrição automaticamente
- [x] Depois do código: campo NCM
- [x] Corrigir valores PO Cheia/Menor: extrair valores da meia nota dos PDFs das Commercial Invoices
- [x] Para POs sem valor menor explícito: calcular como 50% do valor cheio (CI)
- [x] Upload e anexar PDFs das Commercial Invoices em cada PO correspondente (27 POs)
- [x] Adicionar coluna pdf_url na tabela import_pos
- [x] Botão de visualizar PDF da meia nota no card de cada PO
- [x] Botão excluir PO (para POs criadas pelo usuário)
- [x] Botão excluir produto dentro de uma PO
- [x] Botão excluir fornecedor (com confirmação, exclui POs e produtos associados)

## Custo da Mercadoria: Frete e Impostos por NCM (08/06/2026)
- [x] Adicionar coluna "Frete Marítimo" (preenchimento manual) na tabela de produtos da PO
- [x] Adicionar coluna "Frete Terrestre" (preenchimento manual) na tabela de produtos da PO
- [x] Coluna "Frete Total" = soma automática (marítimo + terrestre)
- [x] NCM: ao digitar, puxar impostos em tempo real da tabela de configurações
- [x] Card expandível ao clicar em "Impostos" mostrando detalhamento (II, IPI, PIS, COFINS, ICMS)

## Custo da Mercadoria: Tipo de Frete / Incoterm (08/06/2026)
- [x] Adicionar seletor de tipo de frete (Incoterm) no cadastro de produto: DXW, FOB, CIF
- [x] Coluna na tabela de produtos mostrando o tipo de frete selecionado
- [x] Campo editável no modo edição
- [x] Coluna Frete/Cx = PO Cheia (CI) - Valor USD (calculado automaticamente)
- [x] Coluna Frete Total = Frete/Cx × Quantidade (calculado automaticamente)

## Custo da Mercadoria: Painel de Custos Logísticos por PO (08/06/2026)
- [ ] Criar colunas no banco para custos logísticos da PO (rota, pagamentos, informações)
- [ ] Seletores de rota por PO: Porto de Chegada, Cidade de Desembaraço, Local Final de Chegada
- [ ] Campos de Pagamentos Realizados: 1ª/2ª/3ª Remessa, Taxas Remessa, Despesas Liberação
- [ ] Frete Terrestre + DIFAL separados (com breakdown ao clicar)
- [ ] Comissão do Silvério (antigo Custos S.C.O)
- [ ] Total Custos Importação (soma automática)
- [ ] Informações Importantes: Valor Total Produtos $, Frete Marítimo CN/BR, Total CI
- [ ] Informações Importantes: Valor Dólar 1ª/2ª/3ª Remessa, Valor Médio Dólar, Valor do Fator
- [ ] Painel expandível dentro de cada PO (acima da tabela de produtos)
- [ ] Backend: endpoint para salvar/carregar custos logísticos da PO
- [x] Barra de cotação USD/BRL com Exportar PDF e conversor de moeda na aba Custo da Mercadoria (igual à aba Pagamentos)
- [x] Filtro de ordenação de POs (setinha) - mais recentes para mais antigas e vice-versa
- [x] Barra de cotação sticky (fixa no topo ao rolar)
- [x] Conversor USD/BRL converte todos os valores simultaneamente (cards recolhidos + tabela expandida)
- [x] Incluir campos de custos logísticos (opcionais) no formulário de criação de nova PO
- [x] Corrigir gráfico byDay para usar valorTotalPedido (distribuído proporcionalmente) em vez de soma bruta de itens
- [x] Ocultar valores monetários dos cards recolhidos das POs na aba Custo da Mercadoria
- [x] Preencher dados de custos logísticos das POs existentes baseado na planilha PREÇOSPRODUTOSPORIMPORTAÇÃO.xlsx
- [x] Remover botão "Ver" da coluna Impostos - mostrar valor calculado diretamente
- [x] Preencher Incoterm como CIF para todos os produtos das POs já cadastradas
- [x] Preencher NCM 44219100 para todos os produtos das POs antigas que não têm NCM
- [x] Preencher código do produto puxando do estoque para produtos das POs antigas
- [x] Remover coluna "Impostos" da tabela de produtos das POs antigas (está vazia)
- [x] Destacar ícone do documento PDF no card recolhido da PO (mais visível/colorido)
- [x] Destacar ícone da lixeira no card recolhido da PO
- [x] Adicionar texto "PO Meia Nota" acima do ícone de documento existente
- [x] Preparar novo ícone de documento com texto "PO Nota Cheia" para quando os documentos forem enviados
- [x] Adicionar opção de editar nome do fornecedor na lista de fornecedores
- [x] Dar mais destaque visual ao número de POs na lista de fornecedores
- [x] Diferenciar cards de fornecedores por cor baseado na categoria (Bambu, Madeira, Máquinas)
- [x] Conversor dólar/real deve funcionar no painel de Custos Logísticos (Pagamentos, Custos Adicionais, Total)
- [x] Filtrar produtos das POs para mostrar apenas os preenchidos (com QTD CX ou dados relevantes)
- [x] Editar nome do fornecedor na aba Custo da Mercadoria não deve alterar o nome na aba Importação (usar campo alias separado)
- [x] Adicionar opção de reordenar os cards de fornecedores na aba Importação
- [x] Eliminar scroll horizontal na tabela de produtos das POs - tudo deve caber em uma tela
- [x] Garantir que conversão dólar/real funciona nos Custos Logísticos & Informações (botão visível)
- [x] Faturamento: adicionar filtro de status de coleta (Todos / Coletados / Não Coletados) baseado no checkbox "Coletado"
- [x] Bug: filtros "Bonif. Import. Revenda" e "Bonif. Industrializados" estão invertidos na aba Faturamento (PALITO=revenda/bambu, VARETA/ESPETO=industrializado/madeira)
- [x] Importação/Custo Mercadoria: adicionar ícone de documento "PO Nota Cheia" ao lado do campo Meia Nota na tabela de produtos
- [x] Bug: fornecedores criados em Custo de Mercadoria não devem aparecer em Pagamento aos Fornecedores Chineses e vice-versa (separar dados por aba)
- [x] Importação/Custo Mercadoria: botões PO Meia Nota e PO Nota Cheia devem ter opção de visualizar (olho) sem sair da página e baixar sem sair da página
- [x] Botão de rastreamento em tempo real nas POs da aba Estoque (puxar link de rastreio da aba Importação para quem não tem acesso à Importação)
- [x] Alinhar botões Rastrear um embaixo do outro com tamanho uniforme nas POs do Estoque
- [x] Corrigir nome do fornecedor da PO 01PH202603 (fallback para nome do supplier da Importação quando Maxiprod retorna vazio)
- [x] Importação/Custo Mercadoria: verificar e puxar dados de produtos faltantes da planilha para POs que têm informações completas
- [x] Cadastro de NCMs na aba Configurações (Custo da Mercadoria) - tabela no banco (com campo grupo)
- [x] Endpoints tRPC para CRUD de NCMs (listar, criar, editar, excluir) com campo grupo
- [x] Interface de gerenciamento de NCMs na aba Configurações (tabela 7 colunas com grupo)
- [x] Seletor de NCM ao cadastrar/editar produtos em POs (dropdown mostra NCMs cadastrados com grupo e descrição)

## Custo da Mercadoria: Reformular fluxo de cadastro de produto em PO (10/06/2026)
- [x] Código do produto: ao digitar, puxa descrição automaticamente do estoque
- [x] NCM: ao clicar, abre card expansivo para seleção visual (mostra grupo, código NCM e descrição)
- [x] Tipo de Frete: seletor com os 3 tipos combinados (CIF, FOB, EXW)

## Custo da Mercadoria: Nova estrutura de colunas e custos (10/06/2026)
- [x] Coluna 1: "Valor Pago ao Fornecedor" (editável, por caixa USD)
- [x] Coluna 2: "Valor Pago na Ordem de Pagamento" (editável, por caixa USD)
- [x] Coluna 3: Diferença automática (col2 - col1)
- [x] Coluna 4: Quantidade de Caixas (editável)
- [x] Coluna 5: "Frete Calculado pelo Fornecedor" (diferença × qtd, automático)
- [x] Coluna 6: "Frete com Rateio Correto" (% representatividade × frete total, automático)
- [x] Coluna 7: "Valor de Referência" (col1 × qtd caixas, automático)
- [x] Totalizador: "Valor Total da Ordem de Pagamento" (soma valores referência)
- [x] Totalizador: "Valor Total do Frete" (soma frete calculado)
- [x] Totalizador: Total Geral (ordem + frete)
- [x] Remessas: 1ª Remessa (valor total default), 2ª e 3ª Remessa (em branco, abate da 1ª)
- [x] Campo: Valor da CI (preenchido manualmente)
- [x] Campo: "Despesas de Liberação - Valor Vilela" (37% do valor da CI, automático)
- [x] Campo: Frete Terrestre SP/MG (editável)
- [x] Campo: DIFAL (editável)
- [x] Campo: "Comissão Silvério" (editável)
- [x] Custos Totais da Importação = Total Ordem + Total Frete + Despesas Liberação + Frete Terrestre + DIFAL + Comissão Silvério
- [x] Conversor USD/BRL fixo no topo sempre visível
- [x] Nomes completos sem abreviações em todas as colunas

## Custo da Mercadoria: Porcentagem representatividade e Valor da Caixa (10/06/2026)
- [x] Coluna: "Porcentagem que o produto representa no valor do total da ordem de pagamento" (Valor Ref / (Total Ordem + Total Frete))
- [x] Coluna: "Valor da Caixa" = (Custos Totais × porcentagem / 100) / Quantidade de Caixas

## Bug Fix: Produto 00046 não aparece no estoque de importação (10/06/2026)
- [x] Investigar por que 00046 não aparece (era marcado como isChild pelo e-commerce grouping)
- [x] Corrigir lógica: itens que são pais no product_variants e têm estoque não devem ser engolidos como variação e-commerce
- [x] Reprocessar dados e confirmar que 00046 agora aparece com isChild: false
- [x] Card roxo (Custos Totais da Importação) com números maiores e mais destacados
- [x] Prefixo R$ ou $ nos campos de input de valor monetário na tabela de produtos
- [x] Sufixo % na coluna de porcentagem
- [x] 2 casas decimais com arredondamento correto (3ª casa > 5 arredonda pra cima)
- [x] Remover card "Custos Logísticos & Informações" das POs na aba Custo da Mercadoria
- [x] Autorizar Flavio para descontos de títulos no Financeiro (Recebíveis) - client e server
- [x] Liberar aba Importação para a senha Gilson
- [x] Contrair card da PO ao clicar em "Salvar Custos"
- [x] Criar seletor de porcentagem editável para Despesas de Liberação - Valor Vilela (salva no banco)
- [x] Reorganizar aba Custo da Mercadoria com 3 sub-abas: 1) Custo da Mercadoria em Tempo Real, 2) POs (existente), 3) Configurações
- [x] Trocar operador Marcos por Danubia (nome, senha, mesmos acessos) no banco e código
- [x] Desativar senha Thiago e transferir todos os acessos/responsabilidades dele para Thalita
- [x] Esconder card "Custos Logísticos & Informações" para novas POs (manter para POs antigas que já têm dados)

## Importação Excel Betty - Custo Final Exato da Planilha (11/06/2026)
- [x] Extrair dados exatos da planilha Betty Guangzhou (41 POs, 250+ produtos)
- [x] Alterar precisão de valor_caixa_brl e preco_mil_unid para DECIMAL(12,6) no banco
- [x] Atualizar headers de todas as 41 POs com dados logísticos da planilha
- [x] Atualizar todos os 250 produtos com valores exatos (unid_caixa, valor_usd, ci_value_usd, total_freight_usd, quantidade, valor_referencia, perc_representatividade, valor_caixa_brl, preco_mil_unid)
- [x] Adicionar colunas "Unid. Caixa" e "Preço Mil/Unid." na tabela de produtos das POs
- [x] Coluna "Valor da Caixa" agora mostra valor exato do banco (planilha) quando disponível, com indicador "(planilha)"
- [x] Teste vitest para verificar que getPoProducts retorna campos valorCaixaBrl, precoMilUnid e unidCaixa com precisão correta

## Fix: POs antigas da planilha devem exibir valores fixos sem recalcular (11/06/2026)
- [x] Para POs que já têm valorCaixaBrl preenchido (planilha), exibir valor direto do banco sem NENHUM cálculo
- [x] Não aplicar % Vilela, não recalcular custos totais — tudo já está cravado na planilha
- [x] Totalizadores das POs antigas devem usar os valores do banco (despesasLiberacaoRemessa já salvo)
- [x] Cálculo dinâmico (% Vilela, custos totais) só se aplica a POs novas sem valorCaixaBrl

## Fix: POs antigas - valores de custo estão em BRL, não USD (11/06/2026)
- [x] Para POs legacy, freteTermestreRemessa, comissaoSilverio, difalValor e despesasLiberacaoRemessa já estão em BRL no banco
- [x] Exibir esses campos com prefixo R$ sem conversão de câmbio para POs antigas
- [x] Custos Totais da Importação deve bater com a planilha (ex: PO65 = R$ 183.451,33)
- [x] Fórmula correta: usa total_custos_importacao fixo do banco (não recalcula)
- [x] Sub-itens (Ordem Pgto, Desp.Lib, Frete SP/MG, DIFAL, Com.Silvério) exibem valores fixos em R$ para POs antigas
- [x] pagamento_1_remessa salvo no banco com valor exato da planilha para Ordem Pgto
- [x] Frete sub-item oculto para POs legacy (já incluso na Ordem Pgto/CI)
- [x] Todas as 41 POs com total_custos_importacao salvo direto da planilha no banco

## Custo em Tempo Real - Média Ponderada por Produto Importado (11/06/2026)
- [x] Criar endpoint tRPC que calcula custo em tempo real para cada produto importado
- [x] Lógica: buscar todas as POs com valor_caixa_brl para cada produto, cruzar com estoque atual
- [x] Média ponderada LIFO: usa POs mais recentes primeiro até cobrir estoque atual
- [x] Se produto sem estoque: usar valor da última PO recebida
- [x] Criar aba/seção "Custo em Tempo Real" na página de Importação
- [x] Lista de todos os produtos importados com custo atualizado por caixa
- [x] Card expandível mostrando detalhamento: X caixas da POy a R$ Z cada
- [x] Apenas produtos de importação (grupo 20/21), madeira/industrializado não entra
- [x] Testes automatizados (3 testes passando)

## Conversor BRL/USD em tempo real fixo no topo (11/06/2026)
- [x] Criar widget conversor Real/Dólar em tempo real
- [x] Widget fica fixado (sticky) no topo ao fazer scroll vertical
- [x] Usar câmbio em tempo real para conversão

## POs novas: UNID. CAIXA editável e PREÇO MIL/UNID. calculado (11/06/2026)
- [x] Coluna UNID. CAIXA editável antes de "Valor Pago ao Fornecedor" para POs novas
- [x] Coluna PREÇO MIL/UNID. calculada (Valor da Caixa / UNID. CAIXA) como última coluna antes de Ações
- [x] Salvar UNID. CAIXA no banco ao editar
- [x] Campo UNID. CAIXA no formulário "Adicionar Produto"
- [x] POs legacy: UNID. CAIXA e PREÇO MIL/UNID. exibem valores fixos do banco (planilha)

## Atualização planilha importação (11/06/2026)
- [x] Comparar planilha atualizada com dados no banco e identificar diferenças
- [x] Incluir PO57 (nova) no banco de dados (35 produtos, total custos R$149.864)
- [x] Atualizar valores alterados nos produtos existentes (291 updates em 33 POs)

## Conversor Custo em Tempo Real (11/06/2026)
- [x] Substituir conversor atual (input+dropdown) por botões estilo POs (DÓLAR/USD indicator + toggle USD→BRL/BRL→USD)
- [x] Toggle deve converter os valores de Custo Médio/Caixa na tabela entre USD e BRL

## Conversão USD/BRL nas POs legacy (11/06/2026)
- [x] POs legacy (planilha/Ghangzou): converter Valor da Caixa e Preço Mil/Unid usando fator fixo 5,5 quando toggle USD ativo
- [x] POs novas: continuar usando dólar em tempo real para conversão

## Barra de pesquisa no Estoque do Vendedor (Gestão Comercial)
- [x] Adicionar barra de pesquisa na aba Estoque de cada vendedor para buscar por nome ou código do produto

## Rastreio de navio na view do vendedor (Gestão Comercial)
- [x] Quando produto tiver PO com rastreio ativo (tracking_uuid/bl_number), mostrar botão de rastreio na coluna PO
- [x] Ao clicar, abrir mapa do navio em tempo real (mesmo que aba Importação) - responsivo para tablet/celular

## Inadimplência - Cards Fundo Perdido e Especial s/ Cobrança
- [x] Remover os 3 cards de segmento (Madeira, Bambu, Sem Classificação) da Planilha de Cobrança
- [x] Filtrar clientes com status "Fundo perdido" da lista principal de inadimplência
- [x] Filtrar clientes com status "Especial s/ cobrança" da lista principal de inadimplência
- [x] Criar card "Fundo Perdido" que ao clicar expande e mostra todos os títulos desses clientes
- [x] Criar card "Especial s/ Cobrança" que ao clicar expande e mostra todos os títulos desses clientes
- [x] Dentro do card, permitir alterar status - se mudar de "Fundo perdido" para outro (exceto "Especial s/ cobrança"), volta pra lista
- [x] Dentro do card, permitir alterar status - se mudar de "Especial s/ cobrança" para outro (exceto "Fundo perdido"), volta pra lista

## Correção porcentagem de progresso da viagem
- [x] Corrigir cálculo da porcentagem da viagem: usar distância geográfica percorrida ao longo da rota em vez de tempo decorrido

## Fundo Perdido - Popular com dados reais do Maxiprod
- [x] Inserir os 4 clientes do Fundo Perdido (conta destino 571, Contas a Pagar Maxiprod) no card da Planilha de Cobrança

## Fundo Perdido - Puxar automaticamente via API Maxiprod
- [x] Implementar busca automática de títulos Fundo Perdido via GraphQL Maxiprod (Contas a Pagar, referenteA contém "FUNDO PERDIDO", estado PAGO)
- [x] Sincronizar dados no scheduler para manter card atualizado automaticamente (roda a cada 5 min junto com syncCobrancaPlanilhaAuto)
- [x] Proteger itens Fundo Perdido de serem desativados pelo sync normal de inadimplência
- [x] Desativar registros antigos marcados manualmente (apenas os da conta 571 ficam ativos)

## Correção filtro bonificações em todos os cards do Faturamento
- [x] Corrigir filtro "Bonif. Industrializados" nos cards Autorizado a Faturar, Pedidos em Aberto, Aceite de Produção, Aguardando Autorização (estava invertido - ESPETO é bambu/revenda, VARETA é industrializado)

## Upload de documentos no cadastro de PO
- [x] Adicionar campos de upload de Ordem de Pagamento e CI no formulário de criação de PO (aba Importação)
- [x] Aceitar qualquer tipo de arquivo (PDF, Excel, foto, etc.)
- [x] Salvar arquivos no S3 e vincular URLs ao registro da PO no banco
- [x] Endpoint uploadPoDocument (base64 -> S3 -> atualiza PO)
- [x] Endpoint removePoDocument (limpa URL da PO)
- [x] 5 testes passando (upload CI, upload OP, remove CI, remove OP, cleanup)

## Registrar usuário nas marcações de coleta
- [x] Salvar o nome do usuário (baseado na senha digitada) no campo updatedBy ao marcar Ped. Coleta ou Coletado
- [x] Restaurar painel "Custos Logísticos & Informações" (Comissão Silvério, Frete Terrestre, DIFAL, Despesas de Liberação) na expansão das POs
- [x] Mostrar seção Remessas + Custos Adicionais + Card Roxo em TODAS as POs (novas e antigas), não apenas nas que já têm dados preenchidos
- [x] PoLogisticsPanel (Custos Logísticos & Informações) só aparece nas POs legacy de Guangzhou (com valorFator), não nas POs novas
- [x] Bug: saveCosts sobrescrevia Comissão Silvério e Frete Terrestre com valores originais em POs legacy - agora salva exatamente o que o usuário digitou
- [x] Layout: coluna Diferença e outras colunas monetárias com whitespace-nowrap para R$ e valor ficarem sempre na mesma linha
- [x] Bug: saveCosts convertia valores para USD mas banco armazena em BRL - agora converte de volta para BRL antes de salvar (Comissão Silvério, Frete Terrestre, DIFAL)
- [x] Permitir editar nome/número da PO e nome do contêiner após cadastro
- [x] Regra Johnson: excluir frete do valor de vendas para clientes Johnson (Egito e Brasil) - usar valor total dos produtos, não valor total do pedido
- [x] Faturamento: quando observações do pedido mencionam quantidade de caixas, usar esse valor em vez do cálculo kg÷fator
- [ ] Criar aba "Rastreio em Conjunto" na Importação com mapa mostrando todos os navios em trânsito, posição, % viagem, e card hover com detalhes (fornecedor, produtos, peso, volume)

## Rastreio em Conjunto (18/06/2026)
- [x] Criar procedimento tRPC getActiveContainers no importRouter (busca payments com blNumber ou trackingUuid, cruza com suppliers, POs e tracking_cache)
- [x] Criar componente RastreioEmConjunto com mapa Google Maps mostrando todos os navios em trânsito simultaneamente
- [x] Adicionar aba "Rastreio em Conjunto" na página Importação (terceira sub-tab com ícone Navigation)
- [x] Marcadores de navio no mapa com cores diferentes por container, animação pulse, e label com nome do fornecedor + % progresso
- [x] Hover card overlay mostrando: fornecedor, container, progresso, navio, ETA, status, produtos
- [x] Lista de containers abaixo do mapa com cards clicáveis que centralizam o mapa na posição do navio
- [x] Busca de dados live via fetchTracking (Logcomex) e fetchOneTracking (ONE Line) para cada container
- [x] Rotas desenhadas no mapa como polylines coloridas
- [x] Testes vitest para o procedimento getActiveContainers (4 testes passando)
- [x] Fix: Remover animação pulse que fica piscando nos marcadores do mapa
- [x] Fix: Marcadores sobrepostos quando containers compartilham mesmo BL (WINNIE e BETTY-JIDAXIANG na mesma posição) - offset aplicado
- [x] Adicionar marcadores de origem (porto de partida) para cada container no mapa
- [x] Fix: Cor roxa/indigo trocada por laranja (#ff6b35) para não confundir com o mar
- [x] Revertido: manter TODOS os containers no mapa até confirmação manual de chegada (não filtrar por status)
- [x] Mostrar produtos de cada PO nos cards do Rastreio em Conjunto (puxar da tabela purchase_order_items vinculado pelo campo referencia)
- [x] Fix: Matching de produtos WINNIE corrigido (pedido ZY2026-018 agora encontra ZYZ2026-018 via padrão numérico)
- [x] Reduzir altura do mapa para facilitar scroll (380px mobile / 450px desktop)
- [x] Containers com status 'Entregue' aparecem no mapa parado em Santos (porto destino) com visual diferenciado (verde, ícone check, label 'Em Santos'), até confirmação manual
- [x] Adicionar campo navigation_status ('navegando' | 'recebida') na tabela import_pos
- [x] Criar procedimento tRPC para atualizar navigation_status de uma PO
- [x] Adicionar checkboxes 'PO Recebida' e 'PO Navegando' ao lado de cada PO na aba Importação
- [x] Filtrar containers no mapa: POs com status 'recebida' saem do rastreio em conjunto
- [x] Puxar produtos da tabela import_po_products (POs da aba Importação) para os cards do Rastreio em Conjunto quando não houver match no purchase_order_items
- [x] Fix: Matching de PO por nome do fornecedor (fallback para IDs duplicados como BETTY-JIDAXIANG)
- [x] Adicionar seção de Rastreio em Conjunto dentro do card de Pedidos de Compra (POs) na aba Estoque

## Previsão de Entrega nas POs (19/06/2026)
- [x] Adicionar coluna previsao_entrega na tabela import_pos
- [x] Criar endpoint para buscar entregaPrevistaData de TODOS os pedidos de compra do Maxiprod
- [x] Mapear referencia do Maxiprod para po_number da import_pos
- [x] Exibir data de previsão de entrega nos cards das POs na aba Importação
- [x] Ordenar POs por data de chegada (mais próxima primeiro)
- [x] Incluir POs antigas (já recebidas) no mapeamento de datas
- [x] Permitir preenchimento manual da previsão de entrega para POs sem data do Maxiprod

## Custo em Tempo Real - FIFO (19/06/2026)
- [x] Refazer lógica de média ponderada usando FIFO (abater vendas dos contêineres mais antigos)
- [x] Coluna verde: custo real calculado com POs já recebidas que ainda estão no estoque
- [x] Coluna laranja: custo projetado incluindo POs navegando/chegando
- [x] Usar data de chegada (previsaoEntrega) para ordenar contêineres cronologicamente
- [x] Usar quantidade atual do estoque (stock_items) vs quantidade por PO para determinar quais lotes ainda existem

- [x] Checklist de Desperdício: Criar tabelas no banco (checklist_rounds, checklist_items, checklist_responses)
- [x] Checklist de Desperdício: Seed dos 18 itens (3 setores x 6 itens)
- [x] Checklist de Desperdício: Backend - getRound (buscar/criar ronda do dia)
- [x] Checklist de Desperdício: Backend - getItems (listar itens ativos por setor)
- [x] Checklist de Desperdício: Backend - submitResponse (salvar resposta Verde/Vermelho + obs + foto)
- [x] Checklist de Desperdício: Backend - completeRound (concluir ronda)
- [x] Checklist de Desperdício: Backend - lockExpiredRounds (travar às 17h)
- [x] Checklist de Desperdício: Backend - getHistory (histórico paginado)
- [x] Checklist de Desperdício: Backend - getAnalytics (itens que mais reprovam)
- [x] Checklist de Desperdício: Frontend - Nova aba dentro de Produção
- [x] Checklist de Desperdício: Frontend - 3 cards de setor com 6 itens cada
- [x] Checklist de Desperdício: Frontend - Botões Verde/Vermelho por item
- [x] Checklist de Desperdício: Frontend - Modal observação + foto quando Vermelho
- [x] Checklist de Desperdício: Frontend - Botão "Concluir Ronda" (só habilita quando todos respondidos)
- [x] Checklist de Desperdício: Frontend - Indicador visual Verde/Vermelho na aba
- [x] Checklist de Desperdício: Frontend - Histórico com log (Data | Setor | Líder | Status)
- [x] Checklist de Desperdício: Frontend - Analytics (itens que mais reprovam no mês)
- [x] Checklist de Desperdício: Scheduler - Gerar ronda Seg/Qua/Sex às 07h
- [x] Checklist de Desperdício: Scheduler - Travar ronda às 17h
- [x] Checklist de Desperdício: Testes vitest
- [x] Checklist: Modal de senha ao clicar "Concluir Ronda" para identificar quem concluiu
- [x] Checklist: Salvar nome do operador (completedBy) na ronda ao concluir
- [x] Checklist: Histórico com ícone de relógio mostrando quem concluiu cada ronda (data + nome)
- [x] Fix: Autocomplete de Código do Produto na PO agora busca também em pedidos de compra (produtos novos que ainda não têm estoque)
- [x] Fix: Busca case-insensitive no autocomplete de produtos
- [x] Criar tabela product_catalog persistente que acumula todos os produtos (nunca deleta)
- [x] Atualizar sync para inserir/atualizar no product_catalog (INSERT ON DUPLICATE KEY UPDATE)
- [x] Atualizar searchStockProducts para buscar no product_catalog em vez de stock_items + purchase_order_items
- [x] PO: Permitir casas decimais ilimitadas nos campos de valor da ordem de pagamento
- [x] PO: Frete editável manualmente (mantém cálculo automático mas permite override)
- [x] Checklist: Permitir múltiplas fotos por item (quantas quiser, não apenas uma)
- [x] Importação PO: Adicionar campo verde "Valor Real Vilela" ao lado do campo alaranjado de estimativa; quando preenchido, substitui a estimativa no cálculo do custo da mercadoria
- [x] Importação PO: Renomear status de navegação para: "Navegando", "Chegou no Pátio", "Processo 100% concluído" (substituir "recebida" por duas novas opções)
- [x] Custo Mercadoria Tempo Real: Reestruturar - Custo Real = POs "100% Concluído", Custo Projetado = POs "Chegou no Pátio", nova coluna Estimativa = POs "Navegando"
- [x] PO 100% Concluída: Travar câmbio (não variar com dólar em tempo real) quando processo está fechado e pagamentos quitados
- [x] Custo Mercadoria: Corrigir diferença de centavos entre valor na aba POs e valor na aba Custo da Mercadoria em Tempo Real
- [x] Custo Mercadoria Tempo Real: Adicionar spread de R$ 0,20 na conversão USD→BRL do custo (Real, Projetado e Estimativa) e mostrar visualmente que o spread está sendo aplicado
- [x] POs Legacy (42 antigas): Corrigir bug do frete que zera ao salvar - permitir preenchimento manual do frete que persista
- [x] POs Legacy (42 antigas): Adicionar opção de upload de CI e Ordem de Pagamento (como nas POs novas)
- [x] Inadimplência: Criar card retangular para PROTESTADOS (como Fundo Perdido e Especial s/ Cobrança) e retirar da lista de cobrança
- [x] Custo Mercadoria: Mover badge SPREAD para ao lado da cotação/conversão (mais acima, ao lado esquerdo)
- [x] Financeiro Descontos: Autorizar senha "Flavio" para fazer descontos de títulos (quando operador é autorizador, PDF sai como autorizado automaticamente)
- [x] Bug Inadimplência: Observações mostrando nome "Thiago" em clientes recentes - corrigido: obs agora são por planilhaId específico, não por empresa
- [x] Bug Inadimplência: Clientes novos entrando como "Contatado" ao invés de "Pendente" - removida herança de status
- [x] Pedidos de Venda: Modal de confirmação quando vendedor tenta enviar pedido com preço abaixo do mínimo ("Editar Pedido" / "Sim, enviar mesmo assim")
- [x] Pedidos de Venda: Gestor recebe TODOS os pedidos — verdes (preço OK) e vermelhos (abaixo do mínimo) — com detalhes de % e R$ abaixo
- [x] Pedidos de Venda: Pedido sem problema de preço vai direto para Vitória + aparece verde no painel do gestor
- [x] Pedidos de Venda: Gestor pode recusar pedido vermelho → volta pro vendedor com aviso de rejeição
- [x] Pedidos de Venda: Gestor autoriza pedido → segue para Vitória processar
- [x] Pedidos de Venda: Painel bonito e intuitivo da Vitória — pedidos aprovados prontos para digitar no Maxiprod
- [x] Pedidos de Venda: Notificação pro vendedor quando gestor recusa (pedido volta com motivo)
- [x] Pedidos de Venda: Adicionar campo gestorName na tabela sales_order_requests para vincular ao gestor correto
- [x] Métrica de Vendas: Schema DB para metas mensais (valor R$ ou qtd pedidos) por vendedor
- [x] Métrica de Vendas: Gestor define meta mensal individual por vendedor (toggle valor/quantidade)
- [x] Métrica de Vendas: Cálculo de comissão proporcional ao atingimento da meta (% configurável)
- [x] Métrica de Vendas: Avaliação mensal — mostra % atingido, valor vendido vs meta, comissão calculada
- [x] Métrica de Vendas: Avaliação semestral — média dos últimos 6 meses corridos
- [x] Métrica de Vendas: Visualização com gráficos mês a mês e semestral
- [x] Bug Estoque: Produto 00020S deve puxar estoque do 00020 (caso isolado, substituição direta)
- [x] Cheques: Separar card "Cheque em Factoring" em dois: "Cheque Factoring Samoney" e "Cheque Factoring Finanza"
- [x] Bug Fix: Cadastro de NCM na aba Importação → Custo da Mercadoria → Configurações não está funcionando
- [x] Adicionar status "Produção Encerrada" em todas as máquinas da aba Produção (frontend + backend + testes)

## Módulo: Solicitação de Baixa Manual no Estoque
- [x] Criar sub-aba "Movimentação de Estoque" dentro da aba Produção
- [x] Schema DB: tabela stock_withdrawal_requests (id, produto, quantidade, motivo, motivo_descricao, produto_destino, quantidade_destino, solicitante, status, fiscal_aprovador, data_solicitacao, data_aprovacao, data_conclusao, justificativa_recusa)
- [x] Formulário de solicitação: Produto (lista estoque), Quantidade, Motivo (Amostra/Reembalagem/Complemento de Pedido/Outro)
- [x] Campo condicional Reembalagem: produto destino + quantidade que entra
- [x] Campo condicional Outro: campo texto justificativa
- [x] Campo automático: nome do líder (login) + data/hora
- [x] Tela Fiscal: fila de solicitações pendentes (Quem pediu | Produto | Quantidade | Motivo | Data/Hora)
- [x] Botão Aprovar → status "Aprovada — Aguardando baixa no sistema"
- [x] Botão Recusar → status "Recusada" + campo justificativa opcional
- [x] Botão Baixa Realizada → status "Concluída"
- [x] Ciclo de vida: Pendente → Aprovada → Concluída (ou Pendente → Recusada)
- [x] Histórico/log completo: Data | Líder | Produto | Quantidade | Motivo | Status | Fiscal | Hora aprovação | Hora conclusão
- [x] Indicador gestor: total movimentações do mês + motivos mais frequentes
- [x] Notificação visual para Fiscal: contador de pendências
- [x] Alerta visual: solicitação "Aprovada" há mais de 24h sem conclusão
- [x] Controle de acesso: só líder cria solicitação, só fiscal aprova/confirma (permissões granulares prod.mov_solicitar e prod.mov_aprovar)
- [x] Movimentação de Estoque: pedir senha do operador ao enviar solicitação (registrar quem fez)
- [x] Movimentação de Estoque: botão de apagar solicitação (pendentes)
- [x] Importação: contêineres com status "Entregue" devem sumir do mapa
- [x] Movimentação de Estoque: visível apenas para Bruno, Fernando e Guilherme (restringir botão)
- [x] Importação Custo da Mercadoria: adicionar tooltip/explicação ao clicar nos cabeçalhos Custo Real, Projetado e Estimativa
- [x] Rastreio em Conjunto: card do navio no mapa tampa toda a visão no mobile - reduzir tamanho/posição
- [x] Resumo Financeiro: mudar modal de "Origem da Divergência" para "Diferença Explicada" - valor Manus é o correto, diferença é por regra de negócio (bonificação, excluídos, outros, e-commerce)
- [x] Importação Custo da Mercadoria: travar valor fixo para POs importadas da planilha Excel (não recalcular em tempo real)
- [x] Importação: corrigir valores divergentes de valorCaixaBrl - re-extrair VALOR CAIXA correto da planilha Excel para todas as POs
- [x] Bug: Tooltip/explicação não aparece ao passar mouse nos ícones ℹ️ de Custo Real, Projetado e Estimativa na aba Custo em Tempo Real
- [x] Movimentação de Estoque: apenas Larissa pode aprovar/recusar solicitações (validar pela senha dela)
- [x] Movimentação de Estoque: Manus NÃO faz baixa automática - é só controle visual, baixa é manual no Maxiprod
- [x] Movimentação de Estoque: status Concluída = Larissa confirma que fez baixa no Maxiprod e sync já leu atualização
- [x] Movimentação de Estoque: piscar aba Produção para Larissa quando houver solicitações pendentes de aprovação
- [x] Movimentação de Estoque: botão Apagar em todos os cards para limpar testes
- [x] Gráfico Evolução Mensal profissional com Recharts (barras agrupadas + linha de tendência total)
- [x] Gráficos separados por segmento (Industrializado e Revenda) com área gradiente e linha de média
- [x] Unificar cards A Faturar (Mês Atual + Anterior) em card único combinado
- [x] Endpoint getMonthlyBySegmento no backend (dados por segmento alto-nível com trimestral/semestral)
- [x] Sistema de alertas: aba Gestão Comercial pisca quando novo pedido criado (para gestores) ou aprovado (para Vitória)
- [x] Fluxo de status Pedidos Vitória: Pendente → Recebido → Lançado no Maxiprod
- [x] Vitória com senha própria acessa apenas a parte de Pedidos para Processamento
- [x] Bug fix: Valor Total do Frete não salva ao editar manualmente (deve salvar automaticamente ao sair do campo)
- [x] Implementar Custo Médio Ponderado Móvel: preço fixo entre POs, recalcula só quando chega nova PO (estoque restante × preço médio antigo + caixas novas × preço novo) / total
- [x] Usar taxa efetiva (cotação + R$0,20 spread) em TODAS as conversões USD→BRL na página de Importação
- [x] Coluna Estimativa no dashboard: mostrar Valor da Caixa calculado na PO para produtos em POs com status "Navegando" (atualização em tempo real)
- [x] Fix: Estimativa deve puxar exatamente o valorCaixaBrl salvo na PO (não recalcular no backend) para evitar divergências
- [x] Bug: Estimativa fica variando - valor deve ser FIXO após salvo na PO (R$ 73,30 não pode virar R$ 76)
- [x] Bug: Frete terrestre não deve variar após salvo manualmente pelo usuário
- [ ] Custo Tempo Real: mostrar TODOS os produtos das POs (incubadora, prateleira, etc.) mesmo que não estejam no estoque - puxar nome do Maxiprod e custo da PO
- [x] Bug: Cheques descontados Factoring Finanza divergem do Maxiprod (dashboard mostra 3 cheques R$ 22.091,19 mas Maxiprod tem 4 cheques diferentes)
- [x] Cheques: Criar seção separada "Cheques Descontados" (situacaoTitulo LIKE '%CHEQUE DESCONTADO FACTORING%' + estado RECEBIDO) com cards por factoring e lista ao clicar
- [x] Custo Tempo Real: mostrar TODOS os produtos de POs (incubadora, prateleira, etc.) mesmo sem estoque
- [x] Custo Tempo Real: buscar nome dos produtos no product_catalog e fallback para import_po_products.description
- [x] Custo Tempo Real: remover produto 00808 (VARETA GLADE REEDS) da tabela
- [ ] Vendas: card de evolução anual (gráfico comparando anos)
- [ ] Vendas: card de evolução trimestral (gráfico comparando trimestres)
- [ ] Vendas: card de evolução semestral (gráfico comparando semestres)
- [ ] Vendas: card de evolucao anual (mesmo layout do diario + exportar PDF)
- [ ] Vendas: card de evolucao trimestral (mesmo layout do diario + exportar PDF)
- [ ] Vendas: card de evolucao semestral (mesmo layout do diario + exportar PDF)
- [x] Filtro por produto (Revenda, Industrializados, Materia Prima) dentro dos cards de evolucao anual/semestral/trimestral
- [x] Graficos evolucao: barras finas como evolucao diaria
- [x] Graficos evolucao: mostrar apenas ano vigente (2026)
- [x] Graficos evolucao: mostrar total vendas, faturado e a faturar em cada card
- [x] Card A FATURAR: reduzir espessura para ficar igual aos outros
- [x] Graficos evolucao: mostrar meses envolvidos no grafico (barras por mes)
- [x] Graficos evolucao: trimestre mostra apenas meses do trimestre, semestre mostra meses do semestre
- [x] Graficos evolucao: barras mais proximas no trimestre
- [x] Graficos evolucao: cards resumo com layout igual ao terceiro print (borda lateral colorida, titulo, valor grande, linha inferior)
- [x] Graficos evolucao: cor das barras sempre igual a evolucao diaria (teal)
- [x] Graficos evolucao: mostrar valores exatos nas barras (nao aproximado)
- [x] Graficos evolucao: cards na base com trimestres (1-4) e semestres (1-2) igual semanas na diaria
- [ ] Graficos evolucao: substituir cards resumo por cards de media (atual, anterior, melhor) igual evolucao diaria
- [ ] Graficos evolucao: adicionar linhas de comparacao (atual, anterior, melhor) igual evolucao diaria
- [x] Abreviar valores nas barras com tooltip no hover mostrando valor completo
- [ ] Corrigir linhas de comparacao (anterior/melhor) que estao no zero
- [x] Reordenar cards: Diaria > Trimestral > Semestral > Anual
- [x] Fix bar colors in PeriodEvolutionChart: change from blue to teal (#14b8a6)
- [x] Fix quarter bars spacing: show all months of the year so quarters appear side by side
- [x] Fix card closed value: show current quarter/semester value, not sum of all periods
- [x] Fix comparison lines rendering to work with all-months display
- [x] Remover linhas de comparação (atual/anterior/melhor) dos gráficos Trimestral, Semestral e Anual - manter apenas no Diário
- [x] Afinar barras do Trimestral/Semestral/Anual para mesma espessura do gráfico Diário
- [x] Fix timezone bug: server in UTC was computing currentQuarter=3/currentSemester=2 instead of Q2/S1 (Brazil timezone)
- [x] Implementar PDF sofisticado para Trimestral, Semestral e Anual idêntico ao relatório diário
- [x] Reestruturar Gestão Comercial: criar aba GESTORES com painel de cada gestor (Jordão, Ana Paula, Juvenal)
- [x] Aba GESTORES: cada gestor configura tabela de preço, estoque, senha, catálogos, meta de venda dos seus vendedores
- [x] Hierarquia: Juvenal vê Renato (sub-gestor) e todos os vendedores do Renato
- [x] Criar aba VENDEDORES: visão do vendedor (estoque, cadastro clientes, tabela preço, pedidos, métricas, catálogos)
- [x] Ana Paula tratada como gestora no novo layout
- [x] Aba Gestores: 4 cards separados (Jordão-Gestor, Ana Paula-Gestora, Juvenal-Gestor, Renato-Sub-gestor) com cargo na frente
- [x] Aba Gestores: ao expandir gestor, mostrar painel de configuração (não lista de vendedores)
- [x] Aba Gestores: botões Estoque/Tabela de Preço/Catálogos/Senha → ao clicar mostra vendedores para configurar individualmente
- [x] Aba Vendedores: incluir gestores (Jordão, Ana Paula, Juvenal) como vendedores também
- [x] Painel dos Gestores como card colapsável contendo os 4 cards dentro
- [x] Cada gestor inclui a si mesmo como vendedor na lista de configuração
- [x] Renato aparece como vendedor dentro do card do Juvenal (subordinado)
- [x] Botão "Cadastrar Vendedor" nos cards de todos os gestores para adicionar novos vendedores
- [x] Sub-gestor Renato não inclui a si mesmo como vendedor no próprio card
- [x] Adicionar botões "Pedidos de Venda" e "Métricas de Venda" no painel de configurações do gestor
- [x] Ao clicar no vendedor dentro de cada configuração, navegar para a aba correspondente no VendedorDetalhe
- [x] Fix: Estoque/Tabela/Catálogos/Senhas devem navegar para seções específicas, não para aba Configurações genérica
- [x] Refatorar visão Estoque no painel gestor: substituir lista de vendedores por tabela matricial (produtos x vendedores)
- [x] Tabela matricial: linhas = produtos do estoque, colunas = vendedores do gestor
- [x] Checkmarks (✓) read-only baseados na tabela de preços do Maxiprod (se produto está na tabela do vendedor = ✓)
- [x] Remover edição manual de checkboxes (gestor altera no Maxiprod, sync puxa automaticamente)
- [x] Separar estoque em 2 cards: Estoque Madeira (cor marrom/amarelado) e Estoque Bambu (cor azul)
- [x] Adicionar checkboxes clicáveis para ticar/desticar manualmente produtos por vendedor
- [x] Destacar mais os nomes dos vendedores no header da tabela
- [x] Mostrar nome completo dos produtos (não cortar com truncate)
- [x] Tabela de Preço no painel gestor: visão matricial com cards Bambu e Madeira
- [x] Tabela de Preço: linhas = produtos, colunas = vendedores, células = valor de venda
- [x] Tabela de Preço: botão "Desconto Máximo" editável (% de desconto)
- [x] Tabela de Preço: botão de conversão para mostrar preço mínimo (preço × (1 - desconto%))
- [x] Catálogos no painel gestor: visão matricial (catálogos x vendedores) com checkboxes clicáveis
- [x] Senhas no painel gestor: visão com todos os vendedores, campo de senha editável e ícone de cadeado
- [x] Tabela de Preço: card "Margem de Negociação" editável (%) - preço vendedor = preço tabela / (1 - margem%)
- [x] Bug: Catálogos no painel gestor deve mostrar TODOS os vendedores do gestor como colunas (não apenas 1)
- [x] Bug: Senhas no painel gestor deve mostrar TODOS os vendedores do gestor (não apenas 1)
- [x] Catálogos: sistema de gerenciamento de arquivos completo
- [x] Catálogos: botão "Nova Pasta" para criar pastas com nome personalizado
- [x] Catálogos: upload de arquivos (qualquer tipo: planilha, catálogo, foto, documento)
- [x] Catálogos: upload funciona dentro e fora de pastas
- [x] Catálogos: navegação por pastas (clicar abre a pasta e mostra conteúdo)
- [x] Catálogos: manter matriz de visibilidade (checkboxes por vendedor) para cada arquivo
- [x] Renomear "Configurar Catálogos" para "Documentos/Catálogos"
- [x] Criar pasta "Catálogos" e mover os 2 catálogos Bambusa para dentro dela
- [x] Adicionar opção de mover arquivo para dentro de uma pasta (migrar documento)
- [x] Métricas de Venda (gestor): mostrar vendas do dia com total e ranking dos vendedores
- [x] Métricas de Venda (gestor): mostrar mês atual com total e ranking dos vendedores
- [x] Métricas de Venda (gestor): mostrar mês anterior com total e ranking dos vendedores
- [x] Métricas de Venda (gestor): drill-down ao clicar no vendedor (clientes, valores, informações completas)
- [x] Métricas: adicionar card "Vendas da Semana" entre "Vendas do Dia" e "Mês Atual"
- [x] Métricas: adicionar card "Vendas Personalizado" com seletor de período (data início e fim)
- [x] Remover seção Meta Mensal & Comissão das métricas de venda do vendedor
- [x] Remover aba Configurações do painel do vendedor (tudo configurado pelo gestor)
- [x] Melhorar visual da Tabela de Preços (remover coluna Comissão, design sofisticado com zebra stripes)
- [x] Fix: busca de clientes no Novo Pedido não encontra clientes existentes (ex: Box 81 do Daniel)
- [x] Novo Pedido: card "Informações do Cliente" com histórico completo (compras, débitos, boletos vencidos, inadimplência)
- [x] Preparar estrutura para futura integração com API do Serasa (alerta nome sujo/limpo)
- [x] Faturamento: usar quantidade em caixas da OBS do pedido quando disponível (ex: pedido #1414 = 175 caixas, não 1750.35 mil)
- [x] Card Informações do Cliente: começar recolhido com resumo compacto
- [x] Card Informações do Cliente: destacar inadimplência (borda vermelha) vs em dia (verde)
- [x] Novo Pedido: puxar CNPJ/CPF e cadastro completo ao selecionar cliente (preenche todos os campos disponíveis; CNPJ opcional para clientes Maxiprod sem cadastro)
- [x] Novo Pedido - Produtos: mostrar valor da caixa baseado na margem do gestor (tabela de preço)
- [x] Novo Pedido - Produtos: card de desconto por % (vendedor digita %, calcula valor final)
- [x] Novo Pedido - Produtos: card de valor final (vendedor digita valor, calcula % de desconto)
- [x] Novo Pedido - Produtos: botão "Adicionar ao Carrinho" em cada produto
- [x] Novo Pedido - Produtos: seletor de quantidade com setinhas (+ e -) E campo para digitar direto
- [x] Novo Pedido - Produtos: estoque em caixas como primeira info destacada (antes do nome)
- [x] Novo Pedido - Produtos: remover seção "Detalhes técnicos" expandida
- [x] Novo Pedido - Produtos: remover badge de grupo (ESPETO/PALITO em azul)
- [x] Novo Pedido - Produtos: destacar código, dimensões da caixa e peso da caixa
- [x] Novo Pedido - Produtos: botão Adicionar ao Carrinho com ícone de carrinho, ao clicar abre seletor de quantidade (setinhas + input)
- [x] Novo Pedido - Carrinho: corrigir para usar o novo formato com preço preenchido automaticamente
- [x] Novo Pedido - Carrinho: itens confirmados ficam sticky (travados no topo) ao rolar
- [x] Novo Pedido - Carrinho: mostrar valor unitário (margem+desconto), qtd caixas, e valor total por item
- [x] Novo Pedido - Carrinho: botão Salvar para confirmar/travar o item
- [x] Novo Pedido - Carrinho: opção de excluir item confirmado
- [x] Novo Pedido - Carrinho: opção de editar quantidade/preço de item confirmado
- [x] Novo Pedido - Produtos: estoque à direita do nome (não à esquerda)
- [x] Novo Pedido - Produtos: permitir quantidade 0 (zerar caixas)
- [x] Novo Pedido - Produtos: tudo inline (preço, desconto, valor final, carrinho) sem precisar expandir
- [x] Estoque mobile: adicionar legenda clara explicando cada cor/ícone (carrinho=disponível, fábrica=PO, verde=projetado)
- [x] Estoque mobile: garantir que nada fique sobreposto ou confuso (labels Disp:/PO:/Proj: + nota sobre negativo)
- [x] Novo Pedido - Produtos: layout em linha única com labels acima (Caixas disponíveis → Valor da Caixa → Desconto % → Valor com desconto → Qtd. pedido)
- [x] Novo Pedido - Produtos: corrigir input de desconto (type="text" + inputMode="decimal" em vez de type="number")
- [x] Novo Pedido - Produtos: botão OK para travar desconto escolhido (locked state com barra verde)
- [x] Novo Pedido - Produtos: legendas acima de cada elemento (Caixas disponíveis, Valor da Caixa, Desconto %, Valor com desconto, Qtd. pedido)
- [x] Novo Pedido - Produtos: soma automática em tempo real (subtotal = qtd × preço com desconto) ao lado do seletor de quantidade
- [x] Desktop/Tablet: botão Atualizar (RefreshCw) no header igual ao mobile - limpa cache e recarrega
- [x] Mobile: botão Atualizar com efeito "afundar" (active:scale-75 + active:shadow-inner) para feedback tátil
- [x] Tabela de Preços do Vendedor: adicionar coluna "Preço Sugerido" (Preço Tabelado ÷ (1 - margem%))
- [x] Tabela de Preços do Vendedor: renomear "Preço Unit." para "Preço Tabelado"
- [x] Tabela de Preços do Vendedor: Preço Mínimo calculado dinamicamente (Preço Tabelado × (1 - desconto máximo%))
- [x] Tabela de Preços do Vendedor: busca margem de negociação do gestor para calcular Preço Sugerido
- [x] Tabela de Preços do Vendedor: renomear colunas abreviadas para nomes completos (P. Acréscimo → Preço com Acréscimo, P. Ideal → Preço Ideal, Desc.Máx → Desconto Máximo, P. Mínimo → Preço Mínimo)
- [x] BUG FIX: Desconto máximo do gestor não sincronizava na tabela do vendedor (usava campo do Maxiprod em vez do valor configurado pelo gestor)
- [x] Tabela de Preços do Vendedor: agora busca desconto máximo do gestor via getMaxDiscount e usa como prioridade sobre o campo do Maxiprod
- [x] GestaoComercial: renomear "Desc. Máx" para "Desconto Máximo" no botão do painel do gestor
- [x] Novo Pedido: adicionar legenda "Código" acima do número do produto (ex: 00034) para o vendedor entender
- [x] Novo Pedido: após selecionar quantidade de caixas, mostrar Peso Total (peso da caixa × qtd caixas) e Volume/Cubagem Total (dimensões da caixa multiplicadas × qtd caixas)
- [x] Novo Pedido: ao travar preço (OK), NÃO mudar layout — manter mesma tela, apenas travar campos de desconto/valor e mostrar seletor de quantidade
- [x] Novo Pedido: após OK, destacar valor final da venda, peso total e cubagem total
- [x] Novo Pedido: no card salvo no carrinho, mostrar peso total e cubagem total
- [x] Novo Pedido: editar item do carrinho volta pro mesmo layout inicial (mesma tela)
- [x] Novo Pedido: lápis azul (editar item do carrinho) deve voltar pro layout completo do produto (com Caixas disponíveis, Valor da Caixa, Desconto %, Valor Final, Qtd. pedido) em vez da tela simplificada
- [x] Novo Pedido: no card salvo no carrinho, legendas "Peso Total:" e "Cubagem:" bem visíveis e grandes antes dos valores
- [x] Novo Pedido: botão "Cancelar" ao lado do "Salvar" que zera tudo (desconto, valor, quantidade) e volta pro estado inicial com "Adicionar ao Carrinho"
- [x] Novo Pedido: botão "Pedido Concluído" quando tem itens no carrinho
- [x] Novo Pedido: tela de resumo completo do pedido ao clicar em "Pedido Concluído" (itens, quantidades, preços, descontos, peso total, cubagem total, valor total)
- [x] Novo Pedido: ao confirmar pedido, enviar notificação para Juvenal e Vitória com detalhes do pedido
- [x] Novo Pedido: mover botão "Pedido Concluído" para a etapa de produtos (após adicionar itens ao carrinho), antes do pagamento/frete
- [x] Novo Pedido: opção de apagar pedido (para testes) - botão na tela de resumo e na lista de pedidos do vendedor
- [x] Gestão Comercial: novo card "Comissão" na aba de configurações dos vendedores, onde o gestor pode ver todos os vendedores e editar a porcentagem de comissão de cada um
- [x] Pedidos: número sequencial atômico (contador no banco) que é travado no momento do "Pedido Concluído", sem conflito entre tablets. Resetar para 1 já que todos foram apagados.
- [ ] Gestão Comercial: novo card "Margens de Lucro" para gestor editar as faixas de porcentagem (vermelho=prejuízo, laranja=0.1-10%, amarelo=10-15%, verde=15-20%, azul=25%+)
- [ ] Novo Pedido: barra de cores com marcador mostrando em tempo real a faixa de margem de lucro do pedido conforme vendedor preenche desconto/preço

## Cadastro de Cliente: Card Contribuinte de ICMS (03/07/2026)
- [x] Quando vendedor preencher CNPJ no cadastro de novo cliente, exibir card/pergunta "Cliente é Contribuinte de ICMS?"
- [x] Salvar campo contribuinte (sim/não) no banco (vendor_clients)
- [x] Lógica: Contribuinte = cliente paga DIFAL; Não Contribuinte = Grupo Fox paga DIFAL (desconta do lucro)
- [x] Persistir campo tipoContribuinte no pedido de venda para cálculos futuros de margem

## LEMBRETE: Voltar na parte de IMPOSTOS
- [ ] Confirmar carga efetiva de ICMS com TTS + Corredor de Importação nas saídas interestaduais
- [ ] Confirmar se vendas dentro de MG mantêm 18% ou têm redução
- [ ] Confirmar se benefício se aplica a todos os produtos ou só importados
- [ ] Confirmar impostos federais (PIS 0,65% + COFINS 3% + IRPJ 1,2% + CSLL 1,08% = ~5,93%)
- [x] Implementar barra de margem de lucro com cálculo automático de impostos

## Cadastro de Cliente Expandido - Campos do Maxiprod (03/07/2026)
- [x] Adicionar campos fiscais: Regime Tributário, Inscrição Municipal, SUFRAMA, Situação Fiscal Especial, CNAE Fiscal, Email NF-e
- [x] Adicionar campos de venda: Limite de Crédito, Forma de Cobrança, Tabela de Preços, Condição de Pagamento
- [x] Adicionar campos CRM: Região, Perfil, Forma de Pedido, Produtos, Probabilidade de Negócio, Tamanho, Atenção, Fornecedor Atual
- [x] Adicionar campo Cobrança: SITUAÇÃO (Com Protesto / Sem Protesto)
- [x] Organizar formulário em seções como no Maxiprod

## Barra de Margem de Lucro com Impostos (03/07/2026)
- [x] Criar lógica de cálculo de impostos no backend (ICMS, PIS, COFINS, IRPJ, CSLL)
- [x] Implementar cálculo de DIFAL por UF (simples e por dentro) para não contribuinte
- [x] Puxar faturamento trimestral para calcular IRPJ variável (1,20% a 2,28%)
- [x] Criar UI da barra de margem no fluxo de pedido de venda
- [x] Mostrar breakdown de impostos (ICMS + PIS + COFINS + IRPJ + CSLL + DIFAL)
- [x] Considerar tipo do produto (importado/industrializado) e destino (MG/interestadual)
- [x] Considerar contribuinte vs não contribuinte para DIFAL

## Integração de Frete — Transportadoras (03/07/2026)
- [x] Integrar API Braspress (cotação + tracking) com 3 CNPJs
- [ ] Integrar API SSW/Camilo dos Santos (cotação + ocorrências)
- [x] Opção de cotar pelos 3 CNPJs em qualquer transportadora
- [x] UI de cotação de frete no pedido de venda
- [ ] Exibir comparativo de fretes entre transportadoras

## Card "Lucro" na Tela do Gestor (03/07/2026)
- [x] Criar card "Lucro" no painel do gestor mostrando cálculo completo de margem/lucro do pedido
- [x] Mostrar breakdown: impostos (ICMS, PIS, COFINS, IRPJ, CSLL, DIFAL), frete, comissão, custo mercadoria
- [x] Integrar cotação Braspress no card de Lucro

## Bug Fix: razaoSocial vazio no createOrder (03/07/2026)
- [x] Corrigir validação: forçar preenchimento de Razão Social com mensagem clara + botão disabled no frontend

## Integração Camilo dos Santos (SSW) - Cotação de Frete (03/07/2026)
- [ ] Criar módulo de integração SSW (API SOAP de cotação)
- [ ] Adicionar cotação SSW ao backend (router salesOrderRouter)
- [ ] Atualizar MarginBar para exibir comparativo Braspress vs Camilo dos Santos

## Integração Alfa Transportes - Cotação de Frete (03/07/2026)
- [x] Pesquisar documentação API Alfa Transportes (cotação + rastreamento)
- [x] Criar módulo de integração Alfa Transportes
- [x] Adicionar cotação Alfa ao backend (router salesOrderRouter)
- [x] Atualizar MarginBar para exibir comparativo Braspress vs Alfa vs Camilo

## Dados do Cliente no Pedido Concluído (03/07/2026)
- [x] Garantir que TODOS os campos do cadastro do cliente são salvos no pedido (backend já faz spread de todos os campos)
- [x] Exibir dados completos do cliente na view da Vitória (operação) — 4 seções: Dados do Cliente, Endereço, Contato, Dados Comerciais
- [x] Campos: razão social, nome fantasia, CNPJ/CPF, inscrição estadual, tipo contribuinte (badge), regime tributário, email NF-e, CNAE fiscal, CEP, endereço completo, bairro, município/UF, telefone1, telefone2, email contato, segmento, condição de pagamento, tipo frete, observações
- [x] Pedidos persistem (já funciona - banco de dados)
- [x] Opção de apagar pedidos — botão "Apagar Pedido (teste)" adicionado na view da Vitória com confirmação

## Correções Pedido de Venda - Cadastro Cliente (03/07/2026)
- [x] Cadastro de novo cliente deve aparecer SEMPRE, mesmo para vendedores sem histórico de vendas (ex: Renato) — botão agora aparece no estado vazio + lista clientes cadastrados manualmente
- [x] Campo "Inscrição Estadual" já existia no formulário de cadastro E no formulário de novo pedido (confirmado)
- [x] Clientes cadastrados manualmente devem aparecer na busca/autocomplete do formulário de Novo Pedido de Venda — já funciona: searchClients busca vendor_clients (prioridade 1), depois pedidos manuais, depois Maxiprod
- [x] Botão de atualização na tela do vendedor para forçar reload e puxar última publicação — ícone RefreshCw ao lado do badge Autorizado (só aparece no sellerMode)
- [x] Lixeira no card de cliente cadastrado (estado vazio) para vendedor poder apagar cliente — usa ManualClientRow com botão Excluir + confirmação
- [x] Lixeira no card de pedido via App para vendedor poder excluir pedido mesmo depois de concluído — OrderDeleteButton com ícone Trash2 + confirmação Sim/Não
- [x] Campo "Observação" no formulário de pedido (antes do botão Pedido Concluído) — já existia no step Pagamento/Frete (textarea) e aparece na revisão
- [x] Observação aparece integralmente no pedido concluído (view da Vitória com whitespace-pre-wrap + view do gestor)
- [x] Número do pedido recomeçado do zero — resetado order_number_counter para 1 e apagados pedidos de teste anteriores
- [x] Botão "Resetar Número de Pedidos" na página Aprovação de Pedidos (gestor) — botão vermelho com confirmação, apaga todos pedidos + reseta contador para #1
- [x] Ícone de lixeira ao lado do pedido na view da Vitória (VitoriaOrders) para excluir pedido — Trash2 ao lado do valor, usa confirmDelete existente
- [x] Ícone de lixeira ao lado do pedido na view do Juvenal (GestorAprovacoes) para excluir pedido — Trash2 ao lado do valor + modal de confirmação
- [x] Margem de Lucro (tipo produto, comissão, frete, detalhamento impostos) aparece APENAS na senha Guilherme (gestor) — removido MarginBar da VitoriaOrders; vendedores já não tinham
- [x] Campo Observações agora visível na tela de produtos (acima dos botões Pagamento/Frete e Pedido Concluído) — textarea com placeholder "Observações adicionais para o gestor/operação..."
- [x] Campos obrigatórios no Cadastro de Novo Cliente com asterisco vermelho: CNPJ/CPF, Inscrição Estadual, Razão Social, CEP, Logradouro, Número, Bairro, Cidade, UF, E-mail, Telefone 1
- [x] Bloquear finalização do cadastro se campos obrigatórios não estiverem preenchidos — mensagem lista campos faltantes, borda vermelha nos campos vazios
- [x] Campo "Possui redespacho?" (Sim/Não) após e-mail, antes de Dados Fiscais. Se Sim, exibe seção "Endereço Redespacho" (CEP, Logradouro, Número, Complemento, Bairro, Cidade, UF) — salvo no banco

## Produção - Motivos de Baixa no Estoque
- [x] Adicionar campo "Motivo" obrigatório no formulário de baixa manual com 8 opções fixas (Consumo em pedido, Amostra para cliente, Reembalagem/Transformação, Ajuste de inventário, Avaria/Perda, Uso interno, Devolução/Retrabalho, Outros)
- [x] Se motivo = "Outros", exibir campo de texto obrigatório para descrever o motivo (não pode salvar sem preencher)
- [x] Histórico de movimentação: adicionar filtro por motivo para gestão ver quantas caixas por motivo, período e líder

## Cálculo de Frete e Ocultação de Dados (06/07/2026)
- [x] Renomear botão/step "Pagamento/Frete" para "Cálculo de Frete" no formulário de pedido do vendedor
- [x] Listar transportadoras cadastradas com API separadas por nome no step de Cálculo de Frete
- [x] Ocultar informações de margem nos pedidos concluídos para Vitória e Juvenal (em fase de teste)
- [x] Ocultar informações de transportadora/frete nos pedidos concluídos para Vitória e Juvenal (em fase de teste)

## Cadastro de Cliente - Remover pergunta Contribuinte ICMS (06/07/2026)
- [x] Remover a pergunta "Este cliente é Contribuinte de ICMS?" do formulário de cadastro de novo cliente
- [x] Determinar automaticamente se é contribuinte com base na Inscrição Estadual (IE preenchida = Contribuinte, IE vazia = Não Contribuinte)

## Redesenhar Step "Cálculo de Frete" com 3 Transportadoras (06/07/2026)
- [x] Redesenhar UI do step "Cálculo de Frete" para mostrar cards das 3 transportadoras (Camilo dos Santos, Braspress, Alfa Transportes)
- [x] Cada transportadora deve mostrar seus CNPJs disponíveis e status da API
- [x] Botão "Simular Frete" que consulta as 3 APIs em paralelo e mostra valor + prazo por transportadora
- [x] Integrar SSW (Camilo dos Santos) no quoteAllCarriers para comparação completa
- [x] Mostrar todas as informações necessárias: valor total, prazo, CNPJ remetente, detalhes do cálculo

## Transformar "Cálculo de Frete" em "Custos de Venda" (06/07/2026)
- [x] Renomear botão/step de "Cálculo de Frete" para "Custos de Venda"
- [x] Seção 1: Custo da Mercadoria (puxar custo em tempo real da aba importação)
- [x] Seção 2: Impostos discriminados com todas as porcentagens (ICMS, PIS, COFINS, IRPJ, CSLL, DIFAL)
- [x] Seção 3: Comissão do Vendedor (campo para estipular %)
- [x] Seção 4: Transportadora/Frete (simulação com 3 APIs)
- [x] Seção 5: Gastos Adicionais (campo manual)
- [x] Barra de margem de lucro líquido consolidando todos os custos
- [x] Procedure calculateSalesCosts no backend com cálculo completo

## Validação de Campos Obrigatórios para Clientes Antigos no Pedido de Venda
- [x] Exigir mesmos campos obrigatórios do cadastro de novo cliente quando selecionar cliente antigo do histórico
- [x] Se cliente antigo tiver campos faltando (CEP, telefone, endereço, etc.), exibir formulário para completar antes de avançar — campos com borda vermelha + mensagem listando campos faltantes
- [x] Garantir que todas as informações obrigatórias cheguem para a Vitória
- [x] Salvar dados completados de volta no cadastro do cliente (vendor_clients) automaticamente ao avançar
- [x] Backend: searchClients agora retorna vendorClientId para clientes do cadastro local
- [x] Frontend: OrderFormInput com suporte a required/error (asterisco vermelho + borda vermelha quando vazio)

## Produção - Reorganizar Nova Solicitação em Baixa e Acréscimo (06/07/2026)
- [x] Separar "Nova Solicitação" em duas sub-abas: "Nova Solicitação de Baixa" e "Nova Solicitação de Acréscimo"
- [x] Mover card "Devolução/Retrabalho" para a aba "Nova Solicitação de Acréscimo"
- [x] Na aba Acréscimo com Devolução/Retrabalho selecionado: busca de produto, quantidade de caixas, campo de observação detalhada
- [x] Manter os demais motivos (Consumo em pedido, Amostra, Reembalagem, Ajuste, Avaria, Uso interno, Outros) na aba "Nova Solicitação de Baixa"

## Inadimplência - Restaurar histórico de cobrança perdido (06/07/2026)
- [x] Investigar perda de etapas de cobrança após sync de sexta-feira (03/Jul)
- [x] Restaurar etapas herdando do registro mais recente da mesma empresa (152 registros corrigidos)
- [x] Corrigir sync automático (cobrancaPlanilhaSync.ts) para herdar etapas ao criar novos títulos
- [x] Prevenir regressão futura: novos títulos agora herdam etapas automaticamente

## Gestão Comercial - Validação CNPJ duplicado no cadastro de clientes (06/07/2026)
- [x] Impedir cadastro de cliente com CNPJ já existente
- [x] Exibir aviso "CNPJ já cadastrado" com nome do cliente que já possui aquele CNPJ
- [x] Validação tanto no backend (procedure) quanto no frontend (feedback visual)

## Gestores - Botão "Adicionar Vendedor" na seção de senhas (06/07/2026)
- [x] Adicionar botão "Adicionar Vendedor" na seção de senhas do gestor
- [x] Formulário com nome do vendedor e senha
- [x] Opção "Autorizado" que libera acesso imediato com aquela senha
- [x] Backend: criar procedure para adicionar vendedor manualmente (seller_permissions)

## Gestores - Vendedor adicionado em Senhas aparece em Acesso ao Aplicativo (06/07/2026)
- [x] Garantir que vendedor adicionado em "Senhas" aparece automaticamente em "Acesso ao Aplicativo" (já funciona pois ambos usam seller_permissions)
- [x] Renomear "Renato Aleixo" para "Renato Ledesma" em todo o aplicativo (código + banco + GESTOR_NAME_MAP para Maxiprod)

## Exportação de Clientes no Formato Maxiprod (.xls) (06/07/2026)
- [x] Backend: criar endpoint que gera arquivo Excel no formato Maxiprod (44 colunas) a partir dos clientes cadastrados
- [x] Frontend: botão para Vitória baixar planilha de clientes novos no formato Maxiprod
- [x] Mapear campos do vendor_clients para as colunas do modelo Maxiprod (Apelido, CNPJ, Razão Social, IE, CEP, Endereço, etc.)

## CNPJ Duplicado - Perguntar se quer alterar cliente existente (06/07/2026)
- [x] Ao digitar CNPJ já existente no cadastro, em vez de só bloquear, perguntar: "CNPJ já cadastrado. Deseja fazer alterações cadastrais nesse cliente?"
- [x] Se sim, abrir formulário preenchido com dados atuais para o vendedor atualizar
- [x] Salvar alterações no vendor_clients com lastModifiedBy rastreando quem alterou

## Exportar Maxiprod - Botão no Faturamento para Vitória (06/07/2026)
- [x] Adicionar botão "Exportar Maxiprod" no painel da Vitória ao visualizar pedidos com clientes novos/atualizados
- [x] Gerar Excel .xlsx no formato Maxiprod (modelo de empresas) com os dados do cliente do pedido
- [x] Banner de notificação quando dados do cliente foram modificados por vendedor
- [x] Campo lastModifiedBy adicionado à tabela vendor_clients para rastreamento

## Integração API Rodonaves (RTE/Paulineris) (07/07/2026)
- [x] Backend: módulo rodonavesApi.ts com autenticação, busca cidade por CEP, cotação de frete e prazo de entrega
- [x] Backend: integrar Rodonaves no quoteAllCarriers (4 transportadoras em paralelo)
- [x] Frontend: adicionar Rodonaves na lista de transportadoras (FreightStep + CustosDeVendaStep)
- [x] Frontend: cor verde para resultados da Rodonaves nos agrupamentos
- [x] Secrets: RODONAVES_USERNAME e RODONAVES_PASSWORD configurados
- [x] Atualizar textos dos botões de "3 transportadoras" para "4 transportadoras"

## Reformulação Filtros de Preço - 5 Abas com Descontos Editáveis (07/07/2026)
- [x] Substituir 3 abas (Preço com Acréscimo, Preço Ideal, Preço Mínimo) por 5 abas:
  - Preço Mostrado (Sem Desconto - 0%)
  - Preço Alto (Com 20% de Desconto)
  - Preço Médio-Alto (Com 23% de Desconto)
  - Preço Médio (Com 27% de Desconto)
  - Preço Baixo (Com 32% de Desconto)
- [x] Criar configuração editável das porcentagens de desconto (botão Editar Porcentagens)
- [x] Salvar porcentagens no banco (app_settings) para persistência
- [x] Aplicar desconto sobre o preço base (Preço Mostrado) para calcular cada nível
- [x] Abaixo do Preço Baixo, vendedor não pode vender (regra de mínimo)
- [x] Atualizar tabela de preços do vendedor (VendedorDetalhe) com as 5 colunas

## Ajuste Lógica de Preços - Preço Mostrado = Preço Maxiprod Direto (07/07/2026)
- [x] Preço Mostrado = preço da tabela do Maxiprod direto (sem aplicar margem de negociação)
- [x] Não puxar valor de desconto do Maxiprod - usar apenas coluna Preço
- [x] Demais colunas (Alto, M-Alto, Médio, Baixo) derivam do Preço Mostrado com desconto configurado
- [x] Tabela do Rafael visível tanto para Juvenal (gestor) quanto para Renato (sub-gestor)
- [x] Removido card "Margem de Negociação" (não mais necessário)
- [x] Sub-gestores: vendedores de sub-gestores aparecem para o gestor principal (getPriceMatrix + getEstoqueMatrix)

## Reformulação Comissão dos Vendedores (07/07/2026)
- [x] Criar tabela commission_matrix (faixa de preço x % meta → % comissão, editável)
- [x] Backend: endpoints CRUD para metas (saveSellerGoal) e tabela de comissão (saveCommissionMatrix)
- [x] Frontend: layout planilha com todos vendedores + meta editável por mês/ano
- [x] Frontend: tabela de comissão cruzada (faixa preço x % meta) editável
- [x] Substituir layout antigo de comissão individual por novo layout planilha

## Comissão Per-Seller (07/07/2026)
- [x] Adicionar coluna sellerId na tabela commission_matrix (migração SQL)
- [x] Backend: saveCommissionMatrix aceita sellerId para salvar tabela individual por vendedor
- [x] Backend: getCommissions retorna sellerId no array matrix para filtrar por vendedor
- [x] Frontend: chips de vendedor no topo — clicar expande tabela de comissão individual
- [x] Frontend: cada vendedor tem tabela independente editável (5 faixas meta × 4 faixas preço)
- [x] TypeScript compila sem erros

## Variação 00035 como filho do 00036 (07/07/2026)
- [x] Produto 00035 adicionado como variação do 00036 (fator 2.0: 1 cx 00035 = 2 cx 00036)
- [x] 00036 agora é produto-mãe com duas variações: 00034 (fator 1.0) e 00035 (fator 2.0)

## Comissão - Redesign UI: meta dentro do card expandido (07/07/2026)
- [x] Remover tabela separada de metas (Vendedor | Meta R$ | Editar)
- [x] Ao clicar no nome do vendedor, expandir card com meta editável + tabela de comissão juntos
- [x] Layout mais limpo: lista de vendedores clicáveis → card expandido com tudo junto

## Comissão - Fix encoding + transpor tabela (07/07/2026)
- [x] Fix encoding: COMISS\U00E3O → COMISSÃO (e outros textos com unicode escapado)
- [x] Transpor tabela: vendedores viram linhas, colunas = Meta em R$ | % da Meta x Preço
- [x] Renomear colunas: 1ª = Meta em R$, grupos = 80%/90%/100%/110%/120% da Meta com sub-colunas Preço
- [x] Edição individual por vendedor na tabela transposta
- [x] Visão única sem cards recolhidos - todos vendedores visíveis numa tabela só

## Fix: Não herdar etapas de cobrança antiga (07/07/2026)
- [x] Corrigir cobrancaPlanilhaSync.ts: validar que primeiraCobranca do doador >= vencimento do título novo antes de herdar
- [x] Evitar que cliente que saiu e voltou à inadimplência herde datas de cobrança do ciclo anterior

## Fix: Faturamento Parcial - Reservar apenas qtd pendente (07/07/2026)
- [x] Adicionar campo quantidadeFaturada na tabela order_items (schema + migration)
- [x] Atualizar transformOrderItems no GraphQL sync para preencher quantidadeFaturada
- [x] Ajustar stockProcessor: reservar apenas (quantidade - quantidadeFaturada) para pedidos com faturamento parcial
- [x] Aplicar mesma lógica em: orderByCode, aggregateOrdersByClient, ecommerceByCode
- [x] Incluir FATURADO_PARCIAL e PARCIALMENTE_FATURADO_COM_ENTREGA_FUTURA na query GraphQL de pedidos abertos (fetchOpenSalesOrderItems)
- [x] Estoque: mostrar info completa de faturamento parcial no card (pedido original X cx - faturado Y cx - a faturar Z cx)
- [x] Liberar abas Gestão Comercial e Importação para senha "Luis" (operador Luís Eduardo)
- [x] Vincular tabela de preços 007 (B.S.B. Representações) ao vendedor Wellington Branco como Preço Mostrado
- [x] Simular Pedido: permitir Guilherme e Luis simular pedido de venda sem preencher cadastro de cliente
- [x] Exportar Maxiprod: botão gera CSV compatível com importação de clientes do Maxiprod (dados do cliente cadastrado no pedido)
- [x] Sincronizar dados completos de clientes do Maxiprod (CNPJ, IE, endereço, telefone, email) para vendor_clients, permitindo autocomplete no pedido de venda
- [x] Cadastro cliente: CNPJ, Email e Telefone 1 obrigatórios (vermelho, bloqueiam avanço) - exceto para Guilherme
- [x] Cadastro cliente: Redespacho "Sim" deve pedir também o CNPJ no card azul
- [x] Cadastro cliente: Pergunta "Endereço de entrega é o mesmo do cadastro?" - Sim=não abre nada, Não=abre card para preencher endereço de entrega
- [x] Cadastro cliente: Ajustar campos obrigatórios para apenas CNPJ, CEP, Telefone 1 e Email (remover Razão Social, IE, endereço)
- [x] Vincular tabela de preços 008 (Rafael Londrina) ao gestor Juvenal e subgestor Renato - produtos visíveis no estoque + preços
- [x] Cadastro cliente: Redespacho exige Razão Social obrigatória além do CNPJ
- [x] Cadastro cliente: Endereço de entrega diferente exige CEP e Telefone obrigatórios
- [x] Card de cliente cadastrado: mostrar TODAS as informações (razão social, CNPJ, IE, CEP, endereço, telefone, email, contato, segmento, regime, cobrança, pagamento, fornecedor, obs, redespacho, entrega)
- [x] Card de cliente cadastrado: botão de lápis (Editar) para abrir formulário em modo edição
- [x] Pedido de venda: ao selecionar cliente (novo ou Maxiprod), puxar 100% das informações (redespacho, endereço entrega, todos os campos)
- [x] Pedido de venda: gerar exportação CSV/XLS no formato Maxiprod para importação com todas as informações do cliente e pedido
- [ ] Pedido de venda (detalhe gestor): mostrar se possui redespacho (Sim/Não) + dados do redespacho
- [ ] Pedido de venda (detalhe gestor): mostrar se endereço entrega é o mesmo (Sim/Não) + endereço alternativo
- [ ] Pedido de venda (detalhe gestor): remover Contribuinte ICMS e IE da visualização
- [ ] Card Clientes Cadastrados: mostrar redespacho (Sim/Não + dados) e endereço de entrega (Mesmo/Diferente + dados)
- [ ] Pedido de Venda (puxar cliente): mostrar perguntas redespacho e endereço de entrega com botões Sim/Não (mesmo layout do cadastro novo)
- [x] Corrigir label "M-ALTO" para "MÉDIO-ALTO" no painel de estoque
- [x] Vendedor Rafael não aparece no Painel dos Vendedores - corrigir (incluir sellers de seller_permissions que não estão no Maxiprod)
- [x] Adicionar lixeira (excluir) ao lado dos vendedores criados com senhas (com confirmação)
- [x] Pedido de venda: enviar dados de redespacho e endereço de entrega ao backend (createOrder mutation)
- [x] Variação 00511 como filho do 00112 (fator 1.0: mesma embalagem 5.000 un)
- [x] Variação 00507 como filho do 00106 (fator 1.0: mesma embalagem 50x100)
- [x] Variação 00089M já existia como filho do 00089 (fator 1.0)
- [x] Variação 00546 como filho do 00547 (fator 1.0: espeto queijo coalho 3.9mm vs 4.0mm)
## Cadastro Completo de Clientes - Cópia Fiel (08/07/2026)
- [x] Formulário pedido de venda: adicionar TODOS os campos do cadastro (Dados Fiscais, Dados de Venda, Dados CRM, Cobrança)
- [x] Campos faltantes: Inscrição Municipal, Inscrição SUFRAMA, Situação Fiscal Especial, CNAE Fiscal, Email NF-e, Website, Limite de Crédito, Forma de Cobrança, Tabela de Preços, Condição de Pagamento, Região, Perfil, Forma de Pedido, Produtos, Probabilidade de Negócio, Tamanho, Atenção, Fornecedor Atual, Situação Cobrança, Observações
- [x] Card Clientes Cadastrados: exibir e salvar TODOS os campos preenchidos (incluindo os novos)
- [x] Backend: adicionar campos faltantes na tabela vendor_clients e nos endpoints de save/update (já existiam)
- [x] Garantir que createOrder e exportação CSV incluam todos os campos do cliente
- [x] VitoriaOrders: exibir Dados Fiscais, Dados de Venda, CRM, Cobrança do pedido
- [x] GestorAprovacoes: exibir campos relevantes do pedido (segmento, cobrança, região, perfil)

## Produto-Mãe "Estoque E-commerce" (08/07/2026)
- [x] Criar produto-mãe virtual "Estoque E-commerce" no sistema de variações (código ECOM, virtual parent no stockProcessor)
- [x] Adicionar 11 variações: 00482, 00483, 00488, 00489, 00490, 00491, 00492, 00493, 00494, 00495, 00501

## Bug Fix - Dados do Cliente no Pedido de Venda (08/07/2026)
- [x] Ao selecionar cliente cadastrado no pedido de venda, puxar TODOS os campos (incluindo situação cobrança, observações, dados fiscais, CRM, etc.) - corrigido searchClients para retornar todos os campos do vendor_clients e salesOrderRequests

## Integração Logcomex AI - Rastreio de Contêiner (08/07/2026)
- [x] Salvar API key Logcomex como secret
- [x] Criar endpoint backend para rastreio via Logcomex AI (POST + polling async com cache)
- [x] Criar helper server/logcomexAiTracking.ts com ARMADORES e fetchLogcomexAiTracking
- [x] Adicionar coluna armador na tabela import_payments
- [x] Adicionar campo armador nos formulários de criação/edição de pagamento
- [x] Integrar rastreio individual na aba Importação (TrackingModal com modo AI)
- [x] Botão roxo "Rastrear via AI" para containers com rastreio mas sem BL/UUID
- [x] TrackingModal: executive summary, risco operacional, timeline de eventos, dados de booking/BL/vessel
- [x] Integrar rastreio em conjunto na aba Importação (RastreioEmConjunto com AI)
- [x] getActiveContainers: incluir containers com rastreio (sem BL/UUID) e campo armador
- [x] ContainerTracker: terceira fonte de dados (aiQuery) para containers AI-only
- [ ] Integrar rastreio no card de PO (Estoque)

## Logcomex - Exibir dados completos no painel de rastreio (08/07/2026)
- [x] Garantir que ETA atualizada da Logcomex seja exibida no RastreioEmConjunto
- [x] Garantir que status atual (ex: "Container vazio devolvido") apareça nos cards
- [x] Garantir que navio e rota (origem → destino) apareçam corretamente
- [x] Atualizar cache de tracking com dados frescos da Logcomex (ETA, status, navio)
- [x] Exibir dados da Logcomex no card de PO (aba Estoque)
- [x] getPoTrackingLinks retorna dados do cache (ETA, vessel, status, origin, destination, progress)
- [x] Botão Rastrear no PO card funciona para containers com rastreio+armador (AI)
- [x] AI tracking prioritário: quando container tem rastreio+armador, AI é usado em vez de BL/UUID
- [x] Cache lookup prefere entrada mais recente (AI > ONE Line > UUID) em getPoTrackingLinks e getActiveContainers
- [x] TrackingModal enriquece dados AI com posição do navio da ONE Line (BL passado junto)
- [x] RastreioEmConjunto combina AI (ETA/status) + ONE Line (posição no mapa)
- [x] onTrackAi passa BL para enriquecimento de posição no modal

## Melhorias Rastreio Logcomex (08/07/2026 - Parte 2)
- [ ] Cron diário às 06:00 para consultar Logcomex AI e salvar cache de todos containers ativos
- [ ] Trocar losango por ícone de navio no mapa (RastreioEmConjunto)
- [ ] Mostrar número/nome da PO no painel de rastreio
- [ ] Mostrar nome do chinês (Winnie, Hank, Betty) no painel de rastreio
- [ ] Mostrar produtos contidos no container no painel de rastreio
- [ ] Calcular porcentagem correta da viagem baseado em ETD→ETA reais

## Fix: Rastreio instantâneo (cache-first) - 08/07/2026
- [x] Criar endpoint getTrackingCache que retorna dados do cache instantaneamente
- [x] TrackingModal: usar cache-first (exibir dados do cache imediatamente)
- [x] Disparar refresh da Logcomex AI em background (fire-and-forget) sem bloquear UI
- [x] Remover dependência do fetchLogcomexAiTracking síncrono no modal

## Bug Fix: Erro ao salvar cliente na Gestão Comercial (08/07/2026)
- [x] Sanitizar limiteCredito: converter "R$ 20.000,00" para "20000.00" antes de salvar no DB (decimal)
- [x] Corrigido em createVendorClient e updateVendorClient

## Ícone do navio menor no mapa (09/07/2026)
- [x] Reduzir tamanho do marcador do navio em RastreioEmConjunto (36→20px circle, 40→26px pulse)
- [x] Reduzir tamanho do marcador do navio em TrackingModal (48→28px)
- [x] Reduzir labels de texto abaixo do navio (font-size 9→8px, max-width 140→120px)

## Inadimplência: Puxar telefones dos clientes (09/07/2026)
- [x] Buscar telefones do cliente via API GraphQL do Maxiprod (Telefone 1-4 do endereço + Fone 1-3 dos contatos)
- [x] Exibir telefones na interface de inadimplência para cada cliente
- [x] Incluir nome do contato junto com o telefone (ex: "Roberio - COMPRAS: 88992540638")
- [x] Atualizar sync da planilha de cobrança para incluir endereço principal + contatos (Ocultar Contatos)
- [x] Deduplicar contatos repetidos na resposta

## Fix: Posição do navio no RastreioEmConjunto (09/07/2026)

- [x] Usar vesselPosition calculada pelo backend ONE Line (interpolação temporal) ao invés de re-interpolar no frontend
- [x] Garantir consistência entre TrackingModal e RastreioEmConjunto (ambos usam mesma posição do backend)

## Fix: ETA mostrando 10/07 em vez de 11/07 no card da Home (09/07/2026)

- [x] Corrigir bug de timezone: `new Date(cachedEta).toLocaleDateString('pt-BR')` em BRT (UTC-3) converte midnight UTC para dia anterior
- [x] Usar regex para extrair data diretamente da string (DD/MM/YYYY) sem passar por Date object

## Ajuste: Rastreio automático 2x ao dia (09/07/2026)

- [x] Alterar frequência do cron de rastreamento de 1x/dia para 2x/dia (06:00 e 18:00 Brasília)
- [x] Economizar créditos Logcomex: não rastrear toda hora, apenas 2 vezes ao dia

## Feature: Pedido de Venda com exportação Maxiprod (09/07/2026)

- [x] Adicionar campos Maxiprod ao formulário (Operação Fiscal, Estado Configurável, Forma Pagamento, Data Entrega, Previsão Entrega)
- [x] Criar server/maxiprodOrderExport.ts com geração de XLS no formato exato da planilha modelo Maxiprod (29 colunas)
- [x] Adicionar endpoint exportOrderMaxiprod no salesOrderRouter
- [x] Atualizar schema com novos campos (operacao_fiscal, estado_configuravel, forma_pagamento, data_entrega_pedido, previsao_entrega_pedido)
- [x] Atualizar botão de exportação de CSV para XLS Maxiprod
- [x] Testes unitários passando (2 testes)

## Fix: Lixeira para excluir vendedores + RAFAEL duplicado na tabela de preços
- [x] Botão de lixeira ao lado de cada vendedor na lista de senhas (PasswordManagerView)
- [x] Confirmação "Sim, excluir / Cancelar" antes de deletar
- [x] Removido RAFAEL duplicado (id 430000) da tabela seller_permissions - mantido RAFAEL LEONEL PEREIRA (id 460000)

## Feature: Natureza da Operação no Pedido de Venda
- [x] Adicionar campo naturezaOperacao à interface CustosDeVendaStepProps
- [x] Adicionar campo naturezaOperacao ao function destructuring
- [x] Adicionar dropdown Natureza da Operação no formulário (Venda de produção do estabelecimento, Venda de mercadoria adquirida, etc.)
- [x] Adicionar state naturezaOperacao em VendedorDetalhe.tsx
- [x] Passar naturezaOperacao como prop ao CustosDeVendaStep
- [x] Adicionar naturezaOperacao ao payload do createOrder mutation
- [x] Adicionar naturezaOperacao ao input schema do createOrder (salesOrderRouter.ts)
- [x] Adicionar naturezaOperacao ao DB insert
- [x] Adicionar coluna natureza_operacao ao schema (drizzle/schema.ts)
- [x] Executar migration (ALTER TABLE)
- [x] Testes passando (2/2)

## Feature: Botões separados na tela da Vitória
- [x] Separar botão "Exportar Maxiprod" em dois: "Exportar Cliente" (verde) e "Exportar Pedido" (azul)
- [x] Botão "Exportar Cliente" gera planilha Empresas .xlsx (cadastro do cliente)
- [x] Botão "Exportar Pedido" gera planilha Pedido de Venda .xlsx (modelo importação Maxiprod)
- [x] Ambos os botões com loading state independente

## Fix: Pedido de Venda - Gestores e Forma de Pagamento
- [ ] Garantir que gestores consigam puxar clientes cadastrados na busca ao fazer pedido
- [x] Tornar "Forma de pagamento" campo obrigatório no pedido de venda
- [x] Remover opção "Cartão" das formas de pagamento

## Exportar Cliente Maxiprod direto da lista de clientes
- [x] Adicionar botão "Exportar Maxiprod (Planilha Empresas .xlsx)" na visualização de detalhes de cada cliente cadastrado pelo vendedor
- [x] Permitir exportação mesmo sem pedido de venda associado (cliente apenas cadastrado)
- [x] Exibir clientes cadastrados (sem pedido) na tela da Vitória com opção de exportar
- [x] Marcar cliente como exportado após download da planilha (some da lista da Vitória)
- [x] Incluir contagem de novos clientes no badge de pendentes da Vitória

## Condição de Pagamento obrigatória quando Forma = Boleto/Cheque
- [x] Quando forma de pagamento for "A prazo" (boleto/cheque), tornar campo "Condição de Pagamento" obrigatório
- [x] Exibir indicação visual (borda vermelha + mensagem) quando campo obrigatório não preenchido
- [x] Bloquear submit do pedido se condição de pagamento estiver vazia nesse cenário

## Barra de Margem de Lucro por Produto (Seleção de Itens)
- [x] Calcular margem de lucro por produto: preço vendido - custo projetado - impostos - frete(13%) - comissão(5,85%)
- [x] Buscar custo projetado em tempo real da aba importação
- [x] Calcular impostos sobre cada produto (ICMS, PIS, COFINS conforme regras já implementadas)
- [x] Criar componente visual barra de cores com indicador de margem
- [x] Faixas: vermelho (0-14,99%), laranja (15-19,99%), amarelo (20-24,99%), verde (25-28,99%), azul (29%+)
- [x] Parâmetros editáveis: comissão (5,85%) e frete (13%)
- [x] Exibir barra somente para Guilherme (inicialmente)
- [x] Barra aparece ao ticar/selecionar cada produto na lista

## Barra de Margem Comparativa (Custo Real)
- [x] Criar segunda barra de margem (método custo real) ao lado da barra de interpolação existente
- [x] Calcular: Preço vendido - Custo projetado - Impostos - Frete - Comissão - Custos adicionais
- [x] Mostrar detalhes dos impostos por produto (PIS, COFINS, ICMS, IRPJ, CSLL)
- [x] Indicar se produto é industrializado ou importado
- [x] Seletor de estado de destino para simular impostos
- [x] Custos adicionais editáveis (pode zerar)
- [x] Exibir as duas barras lado a lado para comparação

## Diário de Cobrança (Inadimplência)
- [x] Criar tabelas no banco: collection_diary_entries (histórico diário), collection_stage_history (etapas)
- [x] Criar endpoint para registrar entrada no diário (observações, mudanças de etapa)
- [x] Criar endpoint para listar histórico por cliente com filtros (data, etapa)
- [x] Criar endpoint para backup diário (snapshot do estado atual)
- [x] Implementar job automático às 17:15 para salvar snapshot diário
- [x] Criar interface do Diário de Cobrança (timeline por cliente, filtros)
- [x] Adicionar botão "Diário de Cobrança" na tela de Inadimplência
- [x] Permitir visualizar snapshots/backups anteriores por data

## Fix Caixas/Volumes na Aba Faturamento
- [x] Corrigir lógica de conversão: prioridade é quantidade lançada no Maxiprod
- [x] Só usar observações para conversão quando unidade é KG (conversão real de unidade)
- [x] Aplicar correção tanto para pedidos abertos quanto faturados

## Limpeza de Títulos Quitados (Especial s/ Cobrança)
- [x] Identificar clientes "Especial s/ cobrança" cujos títulos já foram pagos (saíram da inadimplência)
- [x] Remover/desativar esses títulos da planilha de cobrança automaticamente

## Fix Layout Cobrança - Cards Sobrepostos
- [x] Corrigir layout dos cards na planilha de cobrança: textos cortados, sobrepostos e encavalados
- [x] Garantir que nome do cliente, CNPJ, valor, vencimento, vendedor e dias fiquem todos visíveis sem sobreposição

## Custo de Importação - Produtos sem Preço
- [x] Buscar custos dos produtos 00051, 00406, 00407, 00408 nas POs de importação
- [x] Atualizar custo real/projetado no sistema para gestão comercial

## Fix Product Codes nas POs
- [x] Setar product_code='00406' no item id=90008 da PO57
- [x] Setar product_code='00407' no item id=90009 da PO57
- [x] Setar product_code='00408' no item id=90010 da PO57
- [x] Corrigir items PONTA/CHANFRO 5,0x140 nas PO22/PO29/PO34 de '00037' para '00051'

## Fix Recálculo Dinâmico no Pedido de Venda
- [x] Frete, comissão e impostos devem recalcular ao mudar quantidade de caixas no pedido de venda
- [x] Valores não podem ficar fixos quando a quantidade muda

## Diário de Cobrança - Ajustes
- [x] Remover aba "Nova Entrada" do Diário de Cobrança (entradas devem ser automáticas)
- [ ] Gerar snapshot manual agora com dados de hoje para validação

## Gestão Comercial - Barras de Progresso
- [x] Tornar barra de progresso mais grossa
- [x] Trocar indicador de bolinha para setinha
- [x] Aumentar tamanho das porcentagens

## Diário de Cobrança - Correções Visuais
- [x] Remover sobreposição de informações no layout do diário
- [x] Filtrar para mostrar apenas a partir de 08/07/2026 (não puxar histórico antigo)
- [x] Cards de etapas sempre abaixo do nome do cliente
- [x] Corrigir erros de português nos nomes das etapas (semAcao → Sem Ação, segundaCobranca → 2ª Cobrança, etc.)

## CSV Export Maxiprod - Representante/Vendedor
- [x] Fix: campo Representante/Vendedor no CSV de exportação Maxiprod deixado em branco (Maxiprod rejeita se valor não bater exatamente com cadastro)
- [x] Fix: cliente não deve sumir da lista ao clicar "Exportar Maxiprod" (removido markExported automático)

## Diário de Cobrança - Busca e Layout
- [x] Fix: busca por cliente no Diário de Cobrança agora é case-insensitive (UPPER/LIKE)
- [x] Fix: campos "De" e "Até" agora ficam na mesma linha (segunda linha dos filtros)
- [x] Fix: backup do Diário de Cobrança não estava sendo gerado - heartbeat job não existia, criado "diary-snapshot-daily" (20:15 UTC = 17:15 BRT)

## Refatoração ProductMarginBar
- [x] Cores sólidas (sem degradê) - vermelho, laranja, amarelo, verde, azul
- [x] Barra menor (mais compacta em altura)
- [x] Barra ao lado do nome do produto (não embaixo)
- [x] Números maiores
- [x] Lógica de desconto: 32%=vermelho/laranja, 27%=laranja/amarelo, 23%=amarelo/verde, 20%=verde/azul, <20%=azul proporcional
- [x] Opção de ocultar valores numéricos por vendedor (gestor controla quem vê)
- [x] Sistema débito/crédito acumulado: cada produto calcula diferença (preço venda - preço alto) × quantidade
- [x] Coluna de saldo acumulado em tempo real ao lado de cada produto no pedido
- [x] Crédito acumula de produto em produto (se vendeu acima do preço alto, sobra para compensar próximo)

## Barra de Reputação do PEDIDO (RealCostMarginBar)
- [x] Barra do PEDIDO com média ponderada das margens reais (PV×Margem / soma PVs)
- [x] Cores: vermelho(<15%), laranja(15-20%), amarelo(20-25%), verde(25-29%), azul(>29%)
- [x] Visível apenas para Fernando e Guilherme (oculta dos vendedores)
- [x] Barra individual por produto simbólica (oculta dos vendedores, só serve pro cálculo)
- [x] Fórmula margem: (Lucro ÷ Preço de Venda) × 100, onde Lucro = PV - Custo - Impostos - Frete - Comissão - Gastos Adicionais
- [x] Fix: inadimplência status inheritance bug - novos títulos não devem herdar status de outros títulos do mesmo cliente
- [x] Fix: reset Mogilandi NF 2457 (3/4) para Pendente (não foi contatado sobre esse título)
- [x] Atualizar credenciais SSW/Camilo dos Santos (foxapi/14lt27ca + senhaPagador 251038)
- [x] Adicionar campo senhaPagador ao SOAP da SSW
- [x] Adicionar timeouts (AbortSignal.timeout) nas chamadas fetch da Rodonaves
- [ ] SSW: "Cliente não possui tabela de frete negociada" - problema comercial com a Camilo dos Santos
- [x] Implementar comissão automática baseada na margem de lucro do pedido (faixas: <20% baixo, 20-25% médio, 25-29% médio-alto, >=29% projetado)
- [x] Usar sempre 120% da meta para calcular comissão até novo comando
- [x] Mostrar detalhes da comissão automática no frontend (faixa, margem sem comissão, tier)
- [x] Permitir override manual da comissão com botão "Usar automático" para voltar
- [x] Passar sellerId do VendedorDetalhe para CustosDeVendaStep
- [x] Corrigir faixas de comissão: Baixo = 15-20%, Médio = 20-25%, Médio-Alto = 25-29%, Projetado >= 29%
- [x] Debug: comissão mostrando 0 no frontend (sellerId não chegando ou tabela sem dados)
- [x] Auto-detectar UF do cliente selecionado e preencher automaticamente no pedido
- [x] Botão "Recalcular Margem Real" visível apenas para gestores (Guilherme, Fernando) no step 2
- [x] Quando clicado, atualiza a barra de Reputação do Pedido com comissão real (da tabela) e frete real (cotado)
- [x] Vendedor continua vendo a barra com valores fixos (5.85% comissão, 13% frete) por padrão
- [x] Botão "Restaurar Simulação" para voltar aos valores fixos (5.85% / 13%)
- [x] CustosDeVendaStep emite dados reais (comissão %, frete %, margem %) via callback onRealCostsCalculated
- [x] Backend: procedure getSellerMonthlyMargin - calcula média ponderada (valor × margem) de todos os pedidos do vendedor no mês
- [x] Backend: verificar se incluindo o novo pedido a média ponderada mensal cai abaixo de 15% (bloqueio)
- [x] Backend: determinar faixa de comissão mensal (Nível 3) baseada na média ponderada mensal do vendedor (tabela 120% meta)
- [x] Frontend: barra "Reputação do Mês" mostrando a média ponderada mensal do vendedor
- [x] Frontend: bloqueio de fechamento do pedido quando média ponderada mensal < 15% com o novo pedido incluído
- [x] Frontend: mostrar comissão mensal (Nível 3) como a definitiva para pagamento

## Reputação do Mês - Melhorias
- [x] Painel de Reputação do Mês na tela inicial do vendedor (sem precisar abrir pedido)
- [x] Aprovação por senha do gerente para liberar fechamento de pedido quando média ponderada < 15%
- [x] Botão de detalhes na barra de Reputação do Mês que abre modal com lista de pedidos que compõem a média ponderada

## Bug Fix - Acesso ao Aplicativo
- [x] Vendedor criado via "Configurar Senhas" pelo sub-gestor deve aparecer na aba "Acesso ao Aplicativo" desse sub-gestor

## Tabela de Preço - Ordenação
- [x] Ordenar itens da tabela de preço por código em ordem crescente (igual Maxiprod)

## Bug Fix - Botão Autorizar
- [x] Patrick Lucio e Renato Aleixo estão sem botão de autorizar na aba Acesso ao Aplicativo

## Bug Fix - Status Visual Vendedores
- [x] Bolinha verde e nome laranja para vendedores autorizados na aba Vendedores (atualmente alguns ficam vermelha/cinza mesmo autorizados)

## Bug Fix: React error #310 em SellerOrdersView (Vendedor login crash)
- [x] Fix React error #310 "Rendered more hooks than during the previous render" in SellerOrdersView — monthlyRepQuery useQuery hook was declared AFTER the `if (isLoading) return ...` early return, violating React Rules of Hooks. Moved hook declaration to before the early return.

## Simplificação do Fluxo de Pedido para Vendedores + Notificação
- [x] Barra de margem/cores (ProductMarginBar) + cálculo de custos (CustosDeVendaStep) visível APENAS para Guilherme, Fernando e Juvenal
- [x] Vendedores veem apenas botão "Concluir Pedido" sem barras de margem e sem step de custos
- [x] Notificar imediatamente Vitória, Juvenal e Guilherme quando um pedido for concluído por vendedor

## Bug: Estoque do Rafael não aparece quando ele loga com a senha dele
- [x] Investigar e corrigir por que o estoque não carrega na view do vendedor quando ele loga
  Causa: getSellerProducts e sellerLogin só consultavam seller_product_visibility (manual overrides).
  Rafael não tinha overrides manuais - seus 38 produtos vinham da tabela de preços.
  Fix: ambos endpoints agora incluem produtos da tabela de preços do vendedor (mesma lógica do getEstoqueMatrix).

## Bug: Forma de pagamento preenchida mas sistema bloqueia conclusão do pedido
- [x] Investigar validação de forma de pagamento no fluxo de conclusão de pedido do vendedor
- [x] Corrigir para que "Dinheiro - À Vista" (e outras formas) sejam aceitas corretamente
  Causa: O step "Custos de Venda" (onde fica o seletor de Forma de Pagamento) era oculto para vendedores.
  Fix: Adicionado seletor simples de Forma de Pagamento diretamente no step de produtos para vendedores.
  Auto-preenche a partir da formaCobranca do cliente (Boleto -> A prazo, Dinheiro/PIX/etc -> À vista).

## Notificação detalhada ao concluir pedido
- [x] Ao concluir pedido, notificação para Vitória/Juvenal/Guilherme deve incluir cadastro completo do cliente
- [x] Notificação deve incluir pedido detalhado (todos os itens, quantidades, preços, forma de pagamento)
  Fix: Notificação agora mostra: razão social, CNPJ, IE, endereço, telefone, email, segmento +
  pedido detalhado com todos os itens, qtd, preços unitários, totais, forma pagamento, frete, obs.

## Bug: Estoque e tabela de preços não puxam para muitos vendedores (só Daniel funciona)
- [x] Investigar por que apenas Daniel tem estoque/tabela de preços corretos
- [x] Garantir que todos os vendedores puxem seus produtos da tabela de preços vinculada
- [x] Verificar matching de nome da tabela de preços para cada vendedor
  Resultado: O matching já funciona corretamente. Vendedores sem produtos não têm tabela de preços vinculada no Maxiprod.
  Correção: Renato Ledesma trocado de tabela 008 (RAFAEL LONDRINA) para 007 (B.S.B. REPRESENTACOES).

## Bug: Produtos sem estoque e sem preço na tela de adicionar ao pedido
- [x] Investigar por que alguns produtos mostram apenas código/dimensões/peso mas sem estoque e sem preço
- [x] Produtos afetados: 00199, 00044, 00070, 00058, 00274Z, 00008, 00016, 00007Z, 00023
- [x] Corrigir para que todos os produtos exibam estoque disponível e preço da tabela
  Causa: getProductsForSeller usava apenas seller_product_visibility para filtrar.
  Vendedores sem overrides manuais mostravam TODOS os itens do estoque (incluindo os sem preço na tabela).
  Fix: Agora filtra também pela tabela de preços do vendedor. Só mostra produtos que têm preço configurado.

## Feature: Botão baixar PDF do cadastro do cliente
- [x] Adicionar botão "Baixar PDF" na seção "Clientes Cadastrados (sem pedido)" para Vitória, Juvenal e Guilherme
- [x] PDF deve conter todas as informações do cliente (razão social, fantasia, CNPJ, CEP, endereço, telefone, email, contato, segmento, regime tributário, forma cobrança, cond. pagamento, região, perfil, produtos, probabilidade, tamanho, fornecedor atual, redespacho)
  Implementado via window.print() com layout HTML formatado. Botão azul "Baixar PDF" ao lado do "Exportar Maxiprod".

## Feature: Painel de clientes cadastrados e pedidos de venda para Juvenal e Guilherme
- [x] Dar acesso ao Juvenal e Guilherme ao mesmo painel que a Vitória tem (clientes cadastrados sem pedido + pedidos de venda)
- [x] Permitir que Juvenal e Guilherme vejam e acompanhem o andamento dos pedidos e cadastros
  REVISADO: Em vez de auto-redirecionar, criar tela com 4 painéis de navegação.

## Feature: Tela de navegação com 4 painéis para Juvenal e Guilherme
- [x] Reverter auto-redirect do GestaoComercial.tsx para Juvenal e Guilherme
- [x] Criar tela com 4 cards de navegação: Painel dos Gestores, Painel dos Vendedores, Painel de Cadastro de Clientes, Painel de Pedidos de Vendas
- [x] Painel dos Gestores: link para /gestao-comercial/painel-gestores (gestão comercial completa com botão voltar)
- [x] Painel dos Vendedores: link para /vendedor-gestor (app de vendas completo)
- [x] Painel de Cadastro de Clientes: link para /gestao-comercial/pedidos-operador
- [x] Painel de Pedidos de Vendas: link para /gestao-comercial/pedidos-operador

## Fix: Hub de 4 painéis - correções
- [x] Fix 404 no "Painel dos Vendedores" (link /vendedor-gestor não funciona como rota wouter) - corrigido usando <a> em vez de <Link> para forçar navegação full-page
- [x] Mover aba "Vendedores" (lista de vendedores com configurações) do Painel dos Gestores para o Painel dos Vendedores - mantido no GestaoComercialFull com abas Gestores/Vendedores
- [x] Mostrar hub de 4 painéis também para Bruno e Fernando (não apenas Juvenal e Guilherme) - adicionado isBruno e isFernando ao showNavigationHub

## Feature: Baixar pedido de venda em PDF quando concluído
- [x] Adicionar botão de download PDF no pedido de venda concluído (similar ao PDF de cadastro de cliente)
- [x] Gerar PDF com dados do pedido: cliente, itens, quantidades, valores, data, vendedor

## Feature: Legendas nos botões de Atualizar e Sair do aplicativo
- [x] Adicionar legenda "Atualizar última Versão" no botão verde de refresh em todas as telas
- [x] Adicionar legenda "Sair do Aplicativo" no botão vermelho de seta em todas as telas
- [x] Deixar legendas bem visíveis e aparentes para fácil detecção
  Implementado em: TopNav.tsx (mobile + desktop) e VendedorDetalhe.tsx (app vendedores)

## Bug: Comissão real puxando 7% quando deveria ser 5% para margem 24,9%
- [ ] Verificar tabela de faixas de comissão e corrigir o cálculo para margem de 24,9% (Médio)
- [ ] Confirmar que a faixa 20-25% usa comissão "média" (5%) e não 7%

## Feature: Barra de reputação mensal do vendedor para gestores
- [ ] Quando logado como Juvenal, Fernando, Bruno ou Guilherme, mostrar barra de reputação do MÊS do vendedor
- [ ] Barra deve mostrar média ponderada de todos os pedidos do mês do vendedor
- [ ] Atualizar em tempo real enquanto o gestor está fechando/visualizando pedido
## Feature: Fluxo de aprovação - pedidos pendentes não aparecem até gestor aprovar
- [x] TODO pedido começa como "pendente" (mudar createOrder para não auto-aprovar)
- [x] Gestor responsável precisa aprovar antes de aparecer para Vitória
- [x] Vitória só vê pedidos com status "aprovado" (aprovado_por preenchido)
- [x] Juvenal vê pedidos dos SEUS vendedores (pendentes para aprovar + aprovados)
- [x] Guilherme pode ver TODOS os pedidos (incluindo pendentes) - supervisão geral
- [x] Reverter os 2 pedidos do Rafael para status "pendente" (foram auto-aprovados incorretamente)
- [x] Não perder nenhuma informação existente
  Implementado: createOrder sempre seta 'pendente', getOrdersForOperator filtra por viewer, VitoriaOrders mostra botão Aprovar para Guilherme/Juvenal, barra de progresso com 4 etapas (Pendente→Aprovado→Recebido→Lançado)


## Feature: Edição de pedido pendente pelo vendedor
- [x] Vendedor pode editar pedido enquanto status = "pendente" (aguardando gestor)
- [x] Após aprovação do gestor, edição bloqueada
- [x] Botão de editar visível na lista de pedidos do vendedor para pedidos pendentes

## Feature: Notificação ao gestor quando chega pedido de vendedor
- [x] Ao criar pedido real (não simulação), notificar o gestor responsável
- [x] Notificação deve informar: vendedor, cliente, valor do pedido
- [x] Renato adicionado a PEDIDO_VENDEDOR_OPERATORS para receber notificações

## Feature: Renato e Juvenal com acesso a painel de gestor + vendedor
- [x] Renato precisa ter acesso ao painel de gestor E ao painel de vendedor (ele também vende)
- [x] Juvenal precisa ter acesso ao painel de gestor E ao painel de vendedor (ele também vende)
- [x] Ajustar navegação/hub para mostrar ambos os painéis quando logado como Renato ou Juvenal
- [x] Renato adicionado a hasAccess('gestao-comercial') em OperatorContext.tsx
- [x] Renato adicionado ao showNavigationHub em GestaoComercial.tsx
- [x] Renato adicionado ao showRealCostBar em VendedorDetalhe.tsx

## Fix: Separar Cadastro de Clientes e Pedidos de Vendas
- [x] Remover seção "Clientes Cadastrados (sem pedido)" da tela de Pedidos para Processamento (VitoriaOrders.tsx)
- [x] Garantir que o painel "Cadastro de Clientes" no hub mostra APENAS clientes cadastrados sem pedido
- [x] Garantir que o painel "Pedidos de Vendas" mostra APENAS pedidos de venda (sem lista de clientes)

## Feature: Painel duplo para Renato e Juvenal (gestor + vendedor)
- [x] Renato e Juvenal devem ver no hub: Painel de Gestor (com aprovações pendentes dos vendedores deles) + Painel de Vendedor (deles próprios)
- [x] No painel de gestor, "Aprovações de Pedidos" filtra por gestorName para mostrar apenas os pedidos dos vendedores subordinados
- [x] No painel de vendedor, link direto para /vendedor (app de vendedor deles próprios)
- [x] Renato precisa aprovar pedidos do Rafael (e outros vendedores dele) - filtro por gestorName implementado
- [x] Backend listOrders agora aceita filtro gestorName para filtrar pedidos por gestor

## Feature: Hub de seleção para Renato/Juvenal no app de vendedor
- [x] Quando Renato ou Juvenal logam no /vendedor, mostrar hub com 2 cards: "Painel do Gestor" e "Painel do Vendedor"
- [x] "Painel do Gestor" abre configuração dos vendedores (estoque, tabela, catálogos, comissão) + pedidos para aprovação
- [x] "Painel do Vendedor" abre o app de vendedor normal deles (para vender)

## Fix: Painel do Gestor para Renato/Juvenal - usar mesmo painel da Gestão Comercial
- [x] Quando Renato/Juvenal escolhem "Painel do Gestor", abrir o mesmo painel expandido da Gestão Comercial (cards: Estoque, Tabela, Catálogos, Senhas, Métricas, Acesso ao App, Comissão, Cadastrar Vendedor)
- [x] Renomear "Pedidos de Venda" para "Aprovações de Pedidos" no painel do gestor deles

## Fix: Numeração dos pedidos de venda
- [x] Recomeçar numeração dos pedidos a partir de #01, #02, #03... em ordem crescente
- [x] Atualizar os pedidos existentes para a nova numeração

## Fix: Detalhes completos nos pedidos de aprovação
- [x] Renato/Juvenal devem ver nos pedidos de aprovação TODOS os detalhes que a Vitória vê (máximo de informações)

## Fix: Painel do Gestor no SellerApp deve mostrar APENAS o card do gestor logado
- [x] Renato vê apenas o card "RENATO LEDESMA" já expandido (sem Jordão, Ana Paula, Juvenal)
- [x] Juvenal vê apenas o card "JUVENAL TEIXEIRA" já expandido
- [x] Aprovações de Pedidos deve filtrar por gestorName do gestor logado (Renato vê pedidos do Rafael)

## Fix: Bugs no Painel do Gestor (Renato)
- [x] Corrigir erro de português: "Ver Aprova\u00e7\u00f5es" mostrando unicode escapado em vez de "Ver Aprovações"
- [x] Pedidos do Rafael não aparecem na tela de aprovações do Renato (fix: GestorAprovacoes inline rendering - remover TopNav/min-h-screen wrapper quando usado como componente)
- [x] Mostrar descrição COMPLETA dos pedidos nas aprovações (cadastro do cliente + todos os detalhes do pedido)
- [x] Vitória também precisa ver todas as informações completas após aprovação do gestor

## Fix: Remover aprovação automática de pedidos
- [x] Pedidos NÃO devem ser aprovados automaticamente (mesmo com preço OK)
- [x] Todos os pedidos devem ficar como "pendente" até aprovação manual do gestor
- [x] Gestor deve ter opção de Aprovar ou Recusar (com campo de motivo na recusa)
- [x] Mostrar código do item (codigoItem) ao lado da descrição nos itens do pedido

## Barra de Desconto visível para todos
- [x] Barra de desconto (faixas: azul até 20%, verde 20-23%, amarelo 23-27%, laranja 27-32%, vermelho >32%) deve aparecer para todos os vendedores e gestores

## Super-admin: Guilherme, Fernando e Bruno veem TODOS os vendedores
- [x] Guilherme, Fernando e Bruno devem ver TODOS os vendedores no Painel dos Vendedores (não apenas os de seu gestor)
- [x] Ao clicar em qualquer vendedor, devem ver todas as informações completas
- [x] Remover a aba "Vendedores" de dentro do Painel dos Gestores (cada painel separado)

## Card "Aprovações de Pedidos" piscar quando há pendentes
- [x] Card de Aprovações de Pedidos deve piscar/alertar quando há pedidos pendentes para o gestor

## Liberar card "Movimentação de Estoque" para mais usuários
- [x] Adicionar Maria, Erica e Larissa ao array de acesso do card Movimentação de Estoque (Bruno, Guilherme, Fernando já têm)

## Reformulação Gráficos de Produção (ProductionCharts)
- [x] Remover gráfico de pizza "Distribuição por Setor"
- [x] Remover gráfico de barras empilhadas "Produção Diária por Setor"
- [x] Remover blocos de texto explicativo dos gráficos
- [x] Remover "Produção Não Necessária" da visualização principal de paradas
- [x] Criar Semáforo Geral (tabela com setores, produção do dia, média mês, status cor, vs mês anterior)
- [x] Criar Gráfico de Barras por Setor (drill-down ao clicar no semáforo)
- [x] Criar Tabela de Paradas simplificada (Manutenção + Pontual + Falta Mad.)

## Reformulação Aba Pirografia
- [x] Remover barras coloridas, numeração, "registros", formato ranking
- [x] Criar Tabela "Clientes Pirografados" (2 colunas: Cliente + Caixas, com TOTAL)
- [x] Criar Tabela "Produtos Utilizados" (3 colunas: Produto + Tipo + Caixas, com TOTAL)

## Módulo Controle de Lote (NOVO)
- [x] Criar tabelas no banco (lotes + movimentações de lote)
- [x] Criar aba "Lançamento de Lote" (formulário: SKU + Nota + Caixas, gera código automático)
- [x] Criar aba "Lotes" (Estoque de Lotes + Histórico por lote/cliente)
- [x] Criar seleção de lote no pedido (campo estruturado substitui texto livre) — implementado no Faturamento e Pedidos Internos

## Fix: Inadimplência - Recuperar status e proteger diário
- [x] Recuperar status dos 4 clientes que foram erroneamente para "Pendente" (BR DISTRIBUIDORA, EVAFEST x2, DR. ESPETO)
- [x] Verificar se outros clientes perderam status na sexta e recuperá-los (A.J COMERCIAL, ACOUGUE L P DA SILVA, PAULYNELLE SILVA)
- [x] Registrar recuperação no diário de cobrança (6 entradas registradas)
- [x] Proteger diário: status só pode ser alterado após 17:15 do dia (proteção no auto-sync)
- [x] Proteger diário: registros NUNCA podem ser perdidos por sincronização com Maxiprod (herança de status forte + bloqueio de delete)
- [x] Melhorar herança de status: novos títulos herdam status forte (Protestado/Com Protesto/Fundo Perdido/Jurídico) de títulos inativos da mesma empresa

## Fix: Inadimplência - Recuperar status dos 12 clientes ainda pendentes
- [x] Identificar os 11 clientes pendentes na planilha de cobrança
- [x] Restaurar 4 clientes com histórico: J LEAL → Em negociação, MC COMERCIO → Contatado, VALVES → Contatado, WENDER → Promessa de Pgto
- [x] Criar collection_actions e diary entries para os 4 restaurados
- [x] Verificar 3 restantes (BRASILIENSE, LIVRIERI, RAIANE) - genuinamente novos, sem histórico anterior
- [x] Adicionar retry logic no login (3 tentativas com backoff) para resolver timeout no tablet

## Feature: Diário de Cobrança - Registro Imutável Completo
- [x] Gravar snapshot completo às 17:15: status, etapas de cobrança (1ª, 2ª, 3ª Cob, Ação Final), observações, collection_actions e histórico completo
- [x] Diário nunca é alterado/deletado por sincronizações - apenas adiciona novos registros (verificado: nenhum sync toca nas tabelas diary)
- [x] Diário apenas puxa e registra atividades diárias às 17:15 (heartbeat job confirmado: 20:15 UTC = 17:15 BRT)
- [x] Garantir que nenhum código de sync toque nos registros do diário (deleteCollectionAction tem 3 verificações de proteção)

## Feature: Card "Aprovações de Pedidos" piscar quando há pendentes
- [x] Card pisca colorido enquanto houver pedidos pendentes para aprovar (animação blink-approval com cores alternando)
- [x] Para de piscar quando todos foram aprovados ou recusados (condicional no pendingCount)
## UI: Etapa Custos de Venda - Melhorias visuais
- [x] Mostrar valor total do pedido destacado na etapa 3 (Custos de Venda)
- [x] Aumentar fonte dos títulos das seções de custo (Custo da Mercadoria, Impostos, Comissão, Transportadora, Gastos Adicionais)
## Feature: Alerta piscante na aba Produção para análises pendentes
- [x] Quando houver análise pendente, aba Produção deve piscar alerta para a Larissa saber
- [x] Card "Movimentação de Estoque" na Produção também deve piscar quando houver análise pendente
- [x] Na lista de pendentes da Movimentação de Estoque, deixar claro se é BAIXA ou ACRÉSCIMO (tipo da solicitação)
- [x] Botão "Pendentes" na Movimentação de Estoque deve piscar quando houver pendências, parar ao Larissa visualizar/executar ação
- [x] Aba Produção + botão Movimentação pisca para todos com acesso (Bruno, Fernando, Guilherme, Larissa, Maria, Erica) quando há pendências
- [x] Para Maria e Erica: piscar quando Larissa aprovar/recusar (para ciência do resultado)
- [x] Piscar para Bruno, Fernando e Guilherme também quando Larissa aprovar/recusar (não só Maria/Erica)
- [x] Parar de piscar tudo quando Larissa concluir (baixa/acréscimo feito no Maxiprod)
- [x] Implementar lógica de comissão real na etapa 3 (Custos de Venda): após calcular margem com 5,85%, identificar faixa e sugerir comissão real (7%/6%/5%/4%)
- [x] Recalcular margem final com comissão real aplicada
- [x] Bloquear fechamento de pedido se margem < 15% e média mensal do vendedor ≤ 15%
- [ ] Tooltip no alerta vermelho de bloqueio mostrando quanto falta para a média mensal atingir 15%
- [ ] Filtro na aba de gestão de pedidos para visualizar pedidos com comissão travada em 4%
- [ ] Painel/barra de progresso no topo da tela exibindo a média de margem mensal atual do vendedor
- [x] Gestão Comercial pisca para gestor/Juvenal/Guilherme/Fernando/Bruno quando há pedidos pendentes, para de piscar ao aprovar/recusar
- [x] Gestão Comercial pisca para Vitória apenas quando há cadastro de cliente novo OU pedido aprovado (não pendente)
- [x] Renomear aba "Catálogos" dos vendedores para "Documentos/Catálogos" e apresentar em pastinhas com ícones, igual gestores
- [ ] Otimizar carregamento do Painel dos Vendedores para abrir imediatamente

- [x] Serasa API: criar tabela serasa_consultas para histórico de consultas
- [x] Serasa API: implementar integração backend (login + consulta relatório GOLD)
- [x] Serasa API: botão vermelho "Consultar Serasa" no pedido de venda (após selecionar cliente, antes dos produtos)
- [x] Serasa API: exigir senha do vendedor antes de executar consulta
- [x] Serasa API: card bonito com resultado (verde = OK, vermelho = pendências)
- [x] Serasa API: exibir todos os dados retornados pela API no card
- [x] Serasa API: salvar histórico completo (quem consultou, quando, qual cliente, resultado)
- [x] Serasa API: restringir acesso ao botão apenas para Fernando, Guilherme e Bruno
- [x] Serasa API: mostrar "última consulta feita há X dias" para Vitória quando vendedor não consultar
- [x] Serasa API: métricas no painel dos gestores (quantas consultas cada vendedor fez)
- [x] Serasa: corrigir visibilidade do botão (não está aparecendo para o usuário)
- [x] Serasa: adicionar animação de carregamento no botão enquanto API é consultada
- [x] Serasa: disponibilizar botão "Consultar Serasa" também para Vitória
- [x] Serasa: adicionar filtro nas métricas dos gestores para visualizar consultas com pendências

## Módulo de Controle de Lote — Tela 2 (Seleção de Lote no Pedido)
- [x] Criar/atualizar tabela de lotes no banco (order_lot_assignments)
- [x] Criar tabela de movimentações de lote (order_lot_assignments com baixa automática)
- [x] Backend: procedure para listar lotes com saldo > 0 (filtro por SKU do produto)
- [x] Backend: procedure para atribuir lotes a um pedido (com validação de saldo)
- [x] Backend: ao enviar para faturamento, baixar saldo dos lotes automaticamente
- [x] Frontend: seção "LOTES DO PEDIDO" com botão [+ Selecionar Lote] na tela de envio para faturamento
- [x] Frontend: modal/lista de lotes disponíveis filtrados por SKU do pedido
- [x] Frontend: campo para informar quantidade de caixas de cada lote
- [x] Frontend: bloquear quantidade maior que saldo disponível
- [x] Frontend: permitir múltiplos lotes no mesmo pedido
- [ ] Frontend: manter campo de observação separado (texto livre para outras informações)
- [x] Frontend: lote NÃO é mais digitado no campo de observação

## Melhorias Lote-Pedido (Tela 2)
- [x] Alerta visual quando qtd lotes atribuída difere da qtd total do produto
- [x] Registro de histórico: quem adicionou/removeu lotes e quando
- [x] Indicador na lista principal de pedidos: lotes completos vs faltando

## Lotes no Faturamento (Billing.tsx)
- [x] Adicionar coluna pedido_numero na tabela order_lot_assignments (para pedidos Maxiprod)
- [x] Tornar orderId nullable (suportar pedidos que não são internos)
- [x] Backend: assignLotsToOrder aceita pedidoNumero como alternativa ao orderId
- [x] Backend: getOrderLotAssignments aceita pedidoNumero como alternativa ao orderId
- [x] LotAssignmentPanel: aceita pedidoNumero como prop alternativa
- [x] LotAssignmentPanel: status editáveis inclui "A faturar", "Autorizado", "Faturado parcial"
- [x] Billing.tsx: importar e renderizar LotAssignmentPanel na seção expandida do pedido
- [x] Billing.tsx: passar pedidoNumero={order.pedido}, items mapeados, orderStatus={order.estadoItem}

## Botão Apagar Lote
- [x] Criar procedure backend para deletar lote (com confirmação, devolve saldo se houver atribuições)
- [x] Adicionar botão de apagar na linha do lote no Estoque de Lotes (Produção)
- [x] Confirmação antes de apagar (modal ou dialog)

## Lotes: Mostrar todos os lotes disponíveis (sem filtro por SKU)
- [x] Backend: getAvailableLotsForItem não filtra mais por codigoItem (mostra todos com saldo > 0)
- [x] Frontend: modal "Selecionar Lote" mostra todos os lotes disponíveis independente do produto

## Integração SintegraWS - Consulta CNPJ no Cadastro de Cliente
- [x] Salvar token SintegraWS como secret (SINTEGRA_API_TOKEN)
- [x] Criar procedure backend consultaCnpj que chama API RF + ST do SintegraWS
- [x] Retornar dados unificados: razão social, fantasia, endereço, IE, contribuinte_icms, regime tributário
- [x] Adicionar botão "Consultar CNPJ" no formulário de cadastro de cliente (Gestão Comercial)
- [x] Auto-preencher campos do formulário com dados retornados da API
- [x] Determinar tipoContribuinte automaticamente (Contribuinte/Não contribuinte/Isento)

## Aumentar fonte nos Pedidos de Venda
- [x] Aumentar fonte dos itens do pedido (nome do produto e qtd x preço)
- [x] Aumentar fonte dos dados do cliente (Razão Social, Nome Fantasia, CNPJ, Regime Tributário)
- [x] Aumentar fonte do endereço (CEP, Endereço, Bairro, Município/UF)
- [x] Mostrar código do produto antes da descrição nos itens do pedido (ex: 00018 - ESPETO DE BAMBU...)

## Restringir botão Apagar movimentações
- [x] Esconder botão Apagar para Maria, Erica e Larissa (só Bruno, Guilherme e Fernando podem ver)
- [x] Exigir senha ao clicar em Apagar para confirmar
- [x] Registrar exclusão em histórico (quem apagou, quando, qual solicitação)

## Serasa: Novo fluxo de confirmação e registro
- [x] Adicionar confirmação "Consultar Serasa?" com botões Sim/Não antes de executar
- [x] Exigir senha (nome do operador) para registrar quem solicitou nas métricas
- [x] Opção de apagar consulta do histórico quando senha for "Guilherme" (modo teste)

## SintegraWS: Suporte a CPF + Regra Contribuinte ICMS
- [x] Adicionar campo de data de nascimento quando CPF (11 dígitos) é digitado no cadastro de cliente
- [x] Disparar consulta SintegraWS com plugin=CPF quando data de nascimento for preenchida
- [x] Garantir que a regra contribuinte/não contribuinte ICMS funciona para CPF e CNPJ

## DIFAL: Card informativo para vendedor quando cliente é Contribuinte
- [x] Mostrar card antes da conclusão do pedido informando que o cliente paga o DIFAL
- [x] Exibir valor exato do DIFAL do pedido para o vendedor informar ao cliente
- [x] DIFAL zerado nos impostos do Grupo Fox mas valor visível para comunicação

## Documentos/Catálogos: Vendedor deve ver mesma estrutura de pastas do gestor
- [x] Vendedor deve ver pastas organizadas igual ao gestor (Catálogos, Documento de Importação, etc.)
- [x] Layout de pastas com nomes corretos e organização impecável para vendedores

## Cards piscando quando há pedidos pendentes de aprovação
- [x] Card "Painel do Gestor" deve piscar quando há pedidos pendentes de aprovação
- [x] Card "Aprovações de Pedidos" (dentro do painel do gestor) deve piscar quando há pedidos pendentes

## Importação: Botão de excluir documento
- [x] Adicionar botão de lixeira (excluir) nos documentos de importação (CI, Ordem de Pagamento)
- [ ] Permitir substituir o arquivo após excluir (upload de novo arquivo no lugar)

## Serasa: Exibir TODAS as informações da API
- [x] Passar rawResponse completo para o frontend (todos os campos da API Serasa)
- [x] Exibir: dataNascimento/fundação da empresa, todos os endereços completos, todos os telefones com DDD, todos os emails, quadro societário com CPF e participação, CNAE completo, capital social, faturamento presumido, renda estimada, limite de crédito, porte, situação cadastral
- [x] Seções expansíveis: Dados Cadastrais (sempre aberto), Endereços, Telefones, Emails, Quadro Societário, Crédito/Pendências

## Autorização de Lotes Retroativos (data anterior a hoje)
- [x] Criar tabela retroactive_lot_requests no banco (solicitante, data_producao, produto, status, aprovador, motivo, timestamps)
- [x] Criar rotas tRPC: solicitar autorização, listar pendentes, aprovar/recusar, histórico
- [x] No frontend de Lançamento de Lotes: detectar data retroativa e mostrar modal "Enviar solicitação para análise"
- [x] No painel de Bruno/Guilherme: alerta piscando com solicitações pendentes para autorizar/recusar
- [x] Após aprovação: permitir que Maria/Erica criem o lote com a data retroativa autorizada
- [x] Aba/seção de histórico de autorizações retroativas

## Pedidos com Faturamento Parcial
- [x] Pedidos com faturamento parcial (saldo restante) devem permanecer em "Pedidos em Aberto" / "Autorizado a Faturar" e NÃO ir para "Faturados últimos 30 dias"
- [x] Pedidos parcialmente faturados (estadoItem = "Faturado parcial") têm autorização removida automaticamente e voltam para "Pedidos em Aberto"

## Alertas Piscando para Solicitações de Lote Retroativo
- [x] Piscar aba "Produção" no TopNav quando houver solicitações pendentes
- [x] Piscar botão "Controle de Lotes" na página de Produção quando houver solicitações pendentes
- [x] Piscar aba "Autorizações" dentro do Controle de Lotes quando houver solicitações pendentes

## Comissão: Somar 1,85% na comissão por pedido (2ª comissão)
- [x] Somar +1,85% na comissão por pedido (2ª comissão) após consultar a tabela/matrix com meta 120%
- [x] Garantir que a comissão mensal (3ª comissão) NÃO soma 1,85% — é avaliação individual do vendedor de rua

## Seletor de % da Nota Fiscal no Custo dos Produtos
- [x] Adicionar seletor de % da nota fiscal (0%, 50%, 100%) na seção de Impostos do CustosDeVendaStep
- [x] Recalcular impostos proporcionalmente ao % escolhido (backend)
- [x] Frete recalculado com base no valor ajustado da nota

## Esconder Simulação Custo Real dos Vendedores
- [ ] Barra "Simulação Custo Real" (UF Destino, Comissão, Frete, Custos Adic.) deve ser visível APENAS para Gestores, Guilherme, Fernando e Bruno — esconder para vendedores

## Visibilidade das Barras de Margem
- [x] Primeira barra dos produtos (desconto - azul/verde/amarelo/laranja/vermelho) = visível para TODOS
- [x] Segunda barra dos produtos (custo real - 15%/20%/25%/29%) = APENAS Gestores, Guilherme, Fernando e Bruno
- [x] Barra do pedido completo e barra de reputação mensal = visível para TODOS (vendedores incluídos)

## Acesso Bruno à Gestão Comercial
- [x] Liberar aba Gestão Comercial para Bruno

## Exportar Pedido de Venda em PDF
- [x] Adicionar botão "Exportar PDF" no pedido de venda
- [x] Gerar PDF com todas as informações do pedido (cliente, itens, valores, observações)

## URGENTE: Gráficos de margem não aparecem para gestores
- [x] Gráficos de margem (produto, pedido, mês) devem aparecer para Guilherme, Fernando, Bruno e gestores nos pedidos do Rafael
- [x] Verificar lógica de visibilidade dos MarginBar nos pedidos de venda
- [x] Implementar RealCostMarginBar por produto no dialog de aprovação
- [x] Implementar barra de Reputação do Pedido (média ponderada) no dialog de aprovação
- [x] Implementar barra de Reputação Mensal do vendedor no dialog de aprovação

## Corrigir Exportação Maxiprod (Empresas + Pedidos)
- [x] Garantir que todos os campos obrigatórios da planilha de Empresas tenham valores padrão quando vazios
- [x] Garantir que todos os campos obrigatórios da planilha de Pedidos de Venda tenham valores padrão quando vazios
- [x] Campos que não podem ficar em branco devem ter fallback válido aceito pelo Maxiprod

## BUG: UF do cliente não preenchida no pedido de venda
- [x] Investigar por que o pedido #240001 (Flavia - Londrina/PR) ficou com UF null
- [x] Corrigir o fluxo de criação de pedido para sempre preencher a UF do cliente
- [x] Corrigir pedido #240001 no banco (UF = PR)
- [x] Garantir que a margem seja recalculada corretamente após correção
- [x] Adicionar validação obrigatória de UF no cadastro de cliente
- [x] Adicionar validação obrigatória de UF antes de fechar pedido de venda

## Barras de margem na aba Pedidos para Processamento (Vitória)
- [x] Adicionar barras de margem (produto, pedido, mês) no detalhe expandido dos pedidos na aba Pedidos para Processamento
- [x] Garantir que gestores vejam as mesmas informações que na aba de Aprovações

## Gestores veem todos os pedidos nas Aprovações
- [x] Verificar se Fernando, Guilherme e Bruno veem todos os pedidos de todos os vendedores subordinados
- [x] Garantir visibilidade completa de informações para gestores
- [x] Fernando e Bruno adicionados como isTopGestor no servidor (veem tudo como Guilherme)
- [x] Fernando e Bruno adicionados ao canSeeAguardandoAprovacao no frontend
- [x] Visão de Pedidos de Vendas agrupada por vendedor para Fernando/Guilherme/Bruno
- [x] Barra mensal no topo de cada vendedor expandido
- [x] Mini barra colorida de margem do pedido no card recolhido (substituindo badge %)
- [x] ProductMarginBar inline em cada produto expandido (usando preço mostrado da tabela)
- [x] Corrigir barra do produto: usar desconto sobre preço mostrado (sem frete/comissão/impostos)
- [x] Corrigir unicode escapes na barra mensal (Reputação do Mês)

## Correção: Comissão R$ 0,00 no CustosDeVendaStep (15/07/2026)
- [x] Investigar causa raiz: commission_matrix só tinha dados para seller_id=1 (Daniel Tavares/Juvenal)
- [x] Rafael (seller_id=490001, gestor Renato Ledesma) não tinha entradas na commission_matrix
- [x] Adicionar fallback na calculateSalesCosts: quando não encontra pelo seller_id nem pelo gestor_name, busca qualquer entrada disponível na tabela com meta_percent=120 e priceTier correspondente
- [x] Adicionar mesmo fallback na getSellerMonthlyMargin para consistência
- [x] Testado via API: comissão agora retorna 8.85% (7% tabela + 1.85% encargos) com fonte "matriz_padrao"

## Regra de Comissão - IMPLEMENTADA (16/07/2026)

**Regra confirmada pelo Fernando:**
- Valores fixos padrão (antes de simular custos reais): 13% frete + 5,85% comissão
- Comissão real = valor da tabela commission_matrix + 1,85% encargos
- Sempre considerar meta de 120% na tabela
- Tier é determinado pela margem calculada COM comissão fixa de 5,85% (Opção A)
- Margem final exibida na barra é recalculada com a comissão real

**Faixas (thresholds corrigidos):**
- < 15% → crítico (4% + 1,85% = 5,85%)
- 15-18% → baixo (4% + 1,85% = 5,85%)
- 18-25% → médio (5% + 1,85% = 6,85%)
- 25-29% → médio-alto (6% + 1,85% = 7,85%)
- ≥ 29% → mostrado_alto (7% + 1,85% = 8,85%)

- [x] Qual é a margem de referência para determinar o tier? → Margem COM comissão fixa 5,85%
- [x] Quais são os limites exatos de cada faixa? → 15, 18, 25, 29
- [x] Confirmar valores de comissão para cada tier na meta 120% → 4%, 5%, 6%, 7%
- [x] Implementar regra correta no calculateSalesCosts
- [x] Atualizar frontend para mostrar margem c/ 5.85% ao lado do tier
- [x] Corrigir thresholds mensais (getSellerMonthlyMargin) de 20 para 18
- [x] Documentar regra completa no REGRA_COMISSAO.md

## Barra de Comissão por Desconto Médio (comparativo)

- [x] Criar procedure backend getSellerMonthlyDiscount (média ponderada de descontos)
- [x] Adicionar segunda barra de comissão no VendedorDetalhe
- [x] Adicionar segunda barra de comissão no PedidosVendedoresTab
- [x] Regra: <20% desc = Alta(7%), 20-23% = Média-Alta(6%), 23-27% = Média(5%), 27-32% = Baixa(4%)

## Correção Thresholds (16/07/2026)

- [x] Thresholds corrigidos de 15/18/25/29 para 15/20/25/29 (confirmado Fernando)
- [x] Labels: Comissão Baixa, Comissão Média, Comissão Média-Alta, Comissão Alta
- [x] Comissão mensal NÃO soma 1,85% (apenas comissão individual do pedido soma)
- [x] Replicar permissões do Guilherme (id=7) para o Luís Eduardo (id=60002): 7 módulos + 26 permissões granulares copiadas
- [x] Produção > Controle de Lotes > Lançamento de novo lote: separar produtos em dois cards (Bambu e Madeira) usando classificação da aba Estoque
- [x] Controle de Lotes > Aba Estoque: conversão de códigos na busca (00077→AR125, 00080→AR15, 00082→AR18, 00095→AR20, 00086→AR218, 00089→AR25, 00091→AR30, 00112→AR35, 00103→EC20, 00147→EC25)
- [x] Controle de Lotes > Histórico: mostrar todas as movimentações (baixas) como lista direta sem exigir busca prévia
- [x] Movimentação de Estoque > Nova Solicitação: remover produtos de madeira, manter apenas bambu (tanto em baixa quanto em acréscimo)
- [x] Sistema de alertas de estoque insuficiente: detectar itens insuficientes em pedidos 'Em Digitação', alertar produção (Maria/Erica) e faturamento (Vitória/Bruno/Guilherme/Fernando), com fluxo de aceite/recusa para conversão de produtos
- [x] Alertas de estoque: filtrar apenas "A aprovar" (remover "Digitação")
- [x] Alertas de estoque: mostrar número de caixas (quantidade pedida) em cada alerta
- [x] Alertas de estoque: criar seção de Histórico com alertas aceitos/recusados
- [x] Alertas de estoque: corrigir subtítulo de "Em Digitação" para "A aprovar"
- [x] Produção Lotes: mover 00141A (AMOSTRA ESPETO DE BAMBU) de Madeira para Bambu
- [x] Produção Lotes: remover itens de importação da lista Bambu (00526 INCUBADORA, 00523 LÂMINA SERRA CIRCULAR, 00522 LÂMINA SERRA FITA)
- [x] Alertas de estoque: usar GraphQL direto do Maxiprod para verificar insuficiência (não mais dados locais)
- [x] Alertas de estoque: só considerar insuficiente itens que TÊM registros de estoque no Maxiprod
- [x] Alertas de estoque: item 00084 VARETA AROMATIZADOR não deve gerar alerta (sem registros de estoque)
- [x] Alertas de estoque: remover debug logs do maxiprodSync.ts

- [x] Importação - Planilhas editáveis estilo Excel (criar/remover colunas, renomear colunas, criar/remover linhas, mover colunas/linhas)
- [ ] Preservar todos os dados já preenchidos na migração para planilha flexível
- [x] Avaria/Perda: mostrar campo de observações quando ticado (igual ao "Outros")
- [x] Avaria/Perda: botão para adicionar observação retroativamente em itens do histórico
- [x] Documentos/Catálogos: permitir renomear pastas e PDFs
- [x] Importação: corrigir Exportar PDF das POs - formato planilha perfeito com todas informações mesmo com card fechado
- [x] Hericles: não pode ver valorização do estoque na aba Estoque
- [x] Hericles: na aba Produção só pode ver "Lançamento" (somente observar) e "Checklist" (liberdade total)
- [x] Importação - Planilha: padrão iniciar em modo "Visualização" (mais bonito)
- [x] Importação: valores digitados devem ser na moeda selecionada (USD/BRL/RMB) - converter de volta para USD ao salvar
- [x] Importação: corrigir salvamento de células na planilha (SpreadsheetTable)
- [x] Moeda: conversão bidirecional correta - valores armazenados em USD, exibidos na moeda selecionada, digitados na moeda selecionada e convertidos de volta para USD ao salvar
- [x] Importação: toolbar (Exportar PDF + conversor moeda) e 3 cards de resumo devem ser sticky (fixos no topo ao fazer scroll)
- [x] PDF Custo Mercadoria: adicionar colunas faltantes (Código, Tipo Frete, Unid. Caixa, Vlr Pago Ordem Pagamento, Diferença, Frete Calculado Fornecedor, Frete Rateio Correto, Valor Referência, Porcentagem %, Valor da Caixa, Preço Mil/Unid.)
- [x] PDF Custo Mercadoria: adicionar resumo por PO (Vlr Total Ordem Pgto, Vlr Total Frete, Total Geral, Remessas 1ª/2ª/3ª, Custos Adicionais: CI, Desp. Liberação, Frete SP/MG, DIFAL, Comissão Silvério, Custos Totais Importação)
- [x] Bug: conversão RMB gera decimal quebrado (1715 RMB vira 1714,988 ao exibir) - aumentada precisão para 6 casas decimais no DB e toUsd + maximumFractionDigits:2 no display
- [x] Bug CRÍTICO: Autorização de pagamentos - implementado optimistic updates para atualização instantânea do cache (total, items, PDF) + rollback em caso de erro + toast de erro
- [x] Faturamento parcial: quando pedido tem estado "Fat parcial", quantidade faturada vai para "Faturado nos últimos 30 dias" e quantidade restante (Qt a faturar) volta para "Pedidos em Aberto"
- [x] Conversão BRL na aba Pagamentos Fornecedores: remover spread (+0,20) - usar cotação pura (spread só se aplica na aba Custo da Mercadoria)
- [x] Cotação em tempo real: reduzir cache TTL de 30min para 5min para manter cotação mais atualizada
- [x] Fix divergência de centavos RMB→BRL: aumentar precisão DB de 6 para 10 casas decimais + remover arredondamento intermediário na conversão + taxa cruzada direta crossRateBrl
- [x] Rastreio em Conjunto: rotas dos navios lado a lado sem sobreposição (offset lateral nas polylines)
- [x] Rastreio em Conjunto: navio azul (MAERSK WALLIS) deve ter rota pela água (Dalian→Busan→Santos), não cortar continentes
- [x] Rastreio em Conjunto: ajustar tamanho dos ícones de navio no mapa
- [x] Rastreio em Conjunto: preencher todos os detalhes corretamente (nome navio, %, ETA)
- [x] Rastreio em Conjunto: rota marítima precisa - contornar Coreia pelo Estreito da Coreia, leste do Vietnã, Estreito de Malaca, leste de Madagascar, Cabo da Boa Esperança
- [x] Rastreio em Conjunto: ícone de navio colorido (não na cor da linha) - navio cargueiro visto de frente
- [x] Espelhar barra de Comissão por Desconto Médio para manter mesma sequência de cores da barra de Reputação
- [x] Rastreio em Conjunto: rota com 85 waypoints precisos (Dalian→Taiwan Strait→Singapore→Malacca→Indian Ocean→East Madagascar→Cape of Good Hope→Santos) - 100% pela água
- [x] Rastreio em Conjunto: reduzir offset lateral de 0.12° para 0.05° para evitar empurrar rotas para terra perto de costas
- [x] Rastreio em Conjunto: aumentar ícone do navio de 24px para 36px para melhor visibilidade
- [x] Rastreio em Conjunto: atualizar todas as rotas (DALIAN_SANTOS, SHANGHAI_SANTOS, NINGBO_SANTOS, XIAMEN_SANTOS) com waypoints precisos pelo Estreito de Taiwan e Estreito de Singapura
- [x] Server oneTracking.ts: criar ROUTE_DALIAN_SANTOS_DIRECT com 85 waypoints e atualizar handlers dos BLs 274102504 e HKGG45910500
- [x] Rastreio em Conjunto: animação do ícone do navio se movendo suavemente ao longo dos waypoints com controles de play/pause
- [x] Rastreio em Conjunto: tooltip interativo ao passar mouse sobre navio ou waypoints principais (nome do local + tempo estimado)
- [x] Rastreio em Conjunto: menu de filtros para alternar visibilidade de cada rota específica no mapa
- [x] Rastreio em Conjunto: corrigir tooltip piscando ao passar cursor sobre o navio (flickering do InfoWindow)
- [x] Rastreio em Conjunto: adicionar animação de balanço (rocking) ao ícone do navio simulando ondas do mar
- [x] Rastreio em Conjunto: ao passar cursor sobre navio, card mostra TODAS informações (fornecedor, PO, armador, progresso, ETA, produtos, status) sem cortar texto
- [x] Rastreio em Conjunto: clique no navio abre modal com histórico da rota e detalhes completos da carga
- [x] Rastreio em Conjunto: efeito visual de rastro de água atrás do navio simulando navegação
- [x] Rastreio em Conjunto: cor do ícone do navio muda dinamicamente com base no status atual da entrega
- [x] Regra Representante 2: quando pedido de venda do Maxiprod tiver representante2 preenchido, esse é o vendedor real e a comissão vai para ele
- [x] Regra Representante 2: atribuir retroativamente os 3 pedidos do Rafael Leonel (1477, 1496, 1503) - 4º pedido (PAULO HENRIQUE) ainda não lançado
- [x] Regra Representante 2: métricas do Rafael Leonel atualizadas automaticamente (dados no banco)
- [x] Inadimplência: remover todos os registros de teste (__TEST_PROPOSTA_EXCLUSION__) do banco de dados
- [x] Inadimplência: garantir regra de 3+ dias para Pagos/Resolvidos (já implementado na linha 5136-5137 do financialRouter)
- [x] Inadimplência: ordenar Pagos/Resolvidos por data mais recente primeiro (default: desc por resolvedAt)
- [x] Inadimplência: garantir que filtros funcionem corretamente na aba Pagos/Resolvidos
- [x] Inadimplência Pagos/Resolvidos: adicionar barra de pesquisa por nome do cliente
- [x] Inadimplência Pagos/Resolvidos: adicionar checkbox em cada registro + calculadora automática mostrando valor total dos itens selecionados
- [x] Inadimplência Pagos/Resolvidos: auditar e corrigir duplicatas no valor total (81 duplicatas removidas + CLIENTE PEDIDO VENDA removido)
- [x] Vendas/Vendedores: adicionar card "Pagos/Resolvidos" (verde) na seção de inadimplência de cada vendedor
- [x] Vendas/Vendedores: mostrar detalhes por cliente (data resolução, valor, títulos resolvidos vs pendentes)
- [x] Vendas/Vendedores: backend endpoint para buscar resolvidos por vendedor com detalhes por cliente
- [x] Inadimplência/Clientes: ao expandir um cliente na tabela, mostrar seção verde "Pagos/Resolvidos" com títulos que saíram da inadimplência (data resolução, valor, dias atraso, documento)
- [x] Container card: corrigir encoding Unicode (HIST\U00F3RICO → Histórico, \u2022 → •)
- [x] Container card: traduzir status "checked"/"pending"/"current" para português
- [x] Container card: corrigir mapeamento de campos do evento (description vs translatedStatus vs h.date vs h.dateTime)
- [x] Container card: hover abre card, click trava, click novamente destrava
- [x] Inadimplência/Clientes: adicionar coluna "Pagos/Resolvidos" na tabela, logo após o nome do cliente, mostrando quantidade de títulos resolvidos por cliente
- [x] Container card: corrigir flicker/piscar ao passar mouse sobre o navio no mapa (debounce no mouseleave)
- [x] Faturamento: card "Histórico de Alertas de Estoque" deve começar recolhido/fechado por padrão
- [x] Faturamento: card "Alertas de Estoque Insuficiente" deve começar recolhido/fechado por padrão
- [x] Faturamento: card de alertas deve piscar quando houver alertas pendentes (sem resposta), parar de piscar quando todos forem respondidos
- [x] Faturamento: ícone de relógio (histórico) ao lado do card recolhido para acesso rápido
- [x] BUG CRÍTICO: Pedido AJ - status "Autorizado a Faturar" reverte para "Pedidos em Aberto" após sync com MaxiProd. O sync NÃO pode sobrescrever status local quando já está em "autorizado_faturar" ou superior
- [x] BUG: "Produto de Destino" na Nova Solicitação de Baixa não mostra o código do produto nos resultados da busca (ex: 00639)
- [x] Inadimplência/Clientes: badge "Pagos" deve ser clicável e abrir modal/card com detalhes completos dos títulos resolvidos (valor, data, documento, dias de atraso, etc.)
- [x] Mobile: suportar rotação de tela (landscape) para aproveitar espaço extra quando o celular é virado na horizontal
- [x] Gestão Comercial/Frete: integrar transportadora Flor de Minas na simulação de frete (cálculo baseado em planilha: valor por faixa de peso + taxa entrega R$95 + pedágio R$12,30 + seguro 0,7% sobre NF, com tabela de cidades atendidas SP/MG)
- [x] BUG Importação: coluna "CRÉDITO" aparece na tabela normal mas não aparece quando clica em "Planilha" (modo planilha não inclui a coluna crédito) - corrigido com propagação automática de colunas custom entre seções
- [x] BUG Faturamento: pedidos de baixa com "Baixa dada no Maxiprod" continuam aparecendo no card de insuficiência - devem ir apenas para o histórico
- [x] BUG Importação: coluna CRÉDITO não aparece no formulário de editar/incluir pedido (modo normal, não planilha)
- [x] Inadimplência: criar card "Rafael - Especial sem cobrança" que puxa automaticamente clientes cujo representante 2 é RAFAEL LEONEL de Londrina
- [x] Inadimplência: mostrar "RAFAEL LEONEL" como vendedor nos títulos do card Rafael
- [x] Inadimplência: excluir títulos do Rafael dos contadores/stats gerais (só aparecem no card próprio)
- [x] CobrancaPlanilhaView: adicionar card "Rafael - Especial s/ Cobrança" (purple, com ícone UserCheck, expandível com lista de títulos)
- [x] CobrancaPlanilhaView: excluir títulos do Rafael da lista principal e dos status cards (summary)
- [x] Backend cobrancaPlanilhaRouter: representante2Map query para detectar RAFAEL LEONEL e setar vendedor automaticamente no sync
- [x] Backend getSummary: excluir Rafael dos contadores byStatus/byCenter (retorna rafaelCount/rafaelValor separados)
- [x] Bug: Fundo Perdido zerou após sync - títulos foram desativados incorretamente (ativo=0)
- [x] Fix: reativados os 6 títulos de Fundo Perdido (IDs: 780010-780013, 1230003, 1320001)
- [x] Fix: proteger status manuais (Fundo Perdido, Especial s/ cobrança, Protestado, Protesto em Análise) de serem desativados pelo sync automático
- [x] Criar status "Rafael - Especial s/ cobrança" no dropdown de status (CobrancaPlanilhaView + InadimplenciaTab + backend STATUS_MAP)
- [x] Adicionar card de status "Rafael - Especial s/ cobrança" na fileira de cards de status no topo (ao lado de Fundo Perdido, Protestado, etc.)
- [x] FIX APAGÕES: Proteção absoluta - títulos com status != Pendente NUNCA são desativados pelo sync (auto e manual)
- [x] FIX APAGÕES: Observações (campo observacoes) agora são herdadas quando novo título é criado
- [x] FIX APAGÕES: Histórico de etapas (cobranca_etapa_obs) migrado para novos registros automaticamente
- [x] FIX APAGÕES: Fundo Perdido manual não é mais desativado pelo sync da conta 571
- [x] FIX APAGÕES: Removida proteção baseada em horário (17:15) - agora proteção é permanente 24h
- [ ] Aba Vendas: Planilha de Cobrança no card inadimplência do vendedor (mesma view da aba financeiro, filtrada por vendedor)
- [ ] Aba Vendas: Proteção contra perda de dados (status, histórico, observações, etapas) na view do vendedor
- [ ] DB: Criar tabela seller_alerts para armazenar acionamentos de vendedor (vendedor, empresa, mensagem, status, timestamps)
- [ ] Backend: Procedure para criar alerta de vendedor (acionar vendedor)
- [ ] Backend: Procedure para listar alertas pendentes de um vendedor
- [ ] Backend: Procedure para marcar alerta como visto/resolvido
- [ ] Aba Financeiro-Inadimplência: Botão "Acionar Vendedor" vermelho em cada cliente inadimplente
- [ ] Aba Financeiro-Inadimplência: Modal/campo para descrever o caso ao acionar vendedor
- [ ] Aba Vendas: Card inadimplência pisca quando há alerta pendente
- [ ] Aba Vendas: Mensagem de intervenção necessária ao clicar no card piscando
- [ ] Aba Vendas: Direcionar vendedor ao cliente específico com histórico completo + observação da cobrança
- [x] Aba Vendas: Planilha de Cobrança completa para vendedores (SellerCobrancaView)
- [x] Botão "Acionar Vendedor" na aba Financeiro-Inadimplência com dialog de mensagem
- [x] Sistema de notificação visual: tab "Cadastro de Cliente" pisca com badge vermelho quando há alertas pendentes
- [x] SellerCobrancaView mostra alertas com mensagem da cobrança, botões "Marcar como Visto" e "Resolvido"
- [x] Proteção de dados: mesma lógica de proteção contra perda de status/histórico/observações aplicada
- [ ] Campo de resposta no alerta para vendedor enviar resultado da negociação ao financeiro
- [ ] Filtro rápido na aba vendas para listar apenas clientes com alertas pendentes
- [ ] Botão Resolvido adiciona nota automática no histórico de cobrança do financeiro
- [x] Acionar Vendedor: mover botão para fora do isOpen (visível sem expandir)
- [x] Acionar Vendedor: auto-preencher vendedor ou permitir digitar se não tiver
- [x] Acionar Vendedor: mostrar etapas (1ª/2ª/3ª) com a atual pré-selecionada
- [x] Acionar Vendedor: puxar histórico completo no dialog
- [x] Acionar Vendedor: botão visível na Planilha de Cobrança (CobrancaPlanilhaView)
- [x] Card do cliente pisca na aba Vendas quando vendedor é acionado
- [x] Vendedor pode responder ao acionamento e marcar intervenção como concluída na aba Vendas
- [x] Filtro na aba financeiro para ver quais clientes já tiveram vendedores acionados
- [x] Backend: Procedure cancelAlertByFinanceiro para Flávio/Thalita/Guilherme cancelarem alertas
- [x] Backend: Procedure getAlertsHistory com histórico completo (solicitações, resoluções, respostas, cancelamentos)
- [x] Frontend: Botão cancelar/remover alerta na CobrancaPlanilhaView (visível para operadores com permissão)
- [x] Frontend: Botão cancelar/remover alerta na InadimplenciaTab
- [x] Frontend: Painel de Histórico de Acionamentos com métricas (total, resolvidos, pendentes, cancelados, respostas)
- [x] Histórico de Acionamentos: filtros por vendedor, status de resolução e data
- [x] Histórico de Acionamentos: exportar para CSV
- [x] Histórico de Acionamentos: exportar para Excel
- [x] Histórico de Acionamentos: exportar para PDF
- [x] Modal de confirmação antes de remover alerta (já implementado - verificar)
- [x] Bug: Alerta não aparece na tela do vendedor - mismatch de nome (JORDAO vs JORDÃO LAINE) - usar matching fuzzy
- [x] Notificação visual (toast/pop-up) na tela do vendedor quando alerta é gerado (polling rápido)
- [x] Opção para vendedor marcar alerta como "visto" ou "em andamento" na sua tela
- [x] Aba Vendas pisca em vermelho quando vendedor tem alertas pendentes (não só aba Clientes)
- [x] Guilherme pode excluir alertas do histórico de acionamentos (botão lixeira exclusivo)
- [x] Bug: Login com senha compartilhada (123456) logava como vendedor errado - implementar seletor de perfil quando múltiplos vendedores têm a mesma senha
- [x] Bug: Alerta deve aparecer na aba VENDAS (piscando vermelho), não na aba Cadastro de Cliente. Ao abrir Vendas, o card INADIMPLÊNCIA deve piscar em vermelho para guiar o vendedor
- [x] Renomear aba "Métrica de Vendas" para "Vendas" no portal do vendedor
- [x] Adicionar ícone/botão "Planilha de Cobrança" no card INADIMPLÊNCIA da aba Vendas do vendedor, puxando dados em tempo real da planilha de cobrança do financeiro
- [x] Bug: Modal de títulos pagos não permite scroll horizontal no tablet - corrigir overflow
- [x] Bug CRÍTICO: Alerta criado na aba Financeiro > Inadimplência > Planilha de Cobrança NÃO faz a aba Vendas do vendedor piscar com bolinha vermelha - CAUSA: senha compartilhada logava como JUVENAL (0 alertas). Fix: seletor multi-vendedor + refetchInterval 10s
- [x] Bug: Aba Vendas do vendedor não enxerga a planilha de cobrança puxada em tempo real da aba Financeiro > Inadimplência - JÁ IMPLEMENTADO: SellerCobrancaView puxa getByVendedor + getSellerAlerts a cada 10s
- [x] Bug URGENTE: Vendedor Rafael não consegue concluir pedido - validação de UF bloqueava com alert() nativo que causava scroll no tablet. Fix: UF agora é opcional para vendedores (pedidos vão para revisão do gestor)
- [x] Bug: Alertas de cobrança não aparecem para Jordão no painel gestor (login OAuth) - aba Vendas não pisca, card inadimplência não mostra alertas. Fix: adicionado mapping operator->seller no TopNav + SellerCobrancaView no Sales.tsx
- [x] Feature: Botão "Planilha de Cobranças" visível no card INADIMPLÊNCIA da aba Vendas do gestor para abrir a planilha filtrada por vendedor
- [x] Bug Faturamento: Alerta de "Estoque Insuficiente" (Pedido #1517, código 00047, PALITO DE MANICURE, 2 CX) volta após dar aceite 4x - não está sendo marcado como resolvido. Fix: cleanupOldAlerts não expira mais alertas "aceito" baseado em baixas concluídas - só expira quando o item não é mais insuficiente (pedido saiu de A aprovar ou estoque reposto)
- [x] Bug Financeiro/Inadimplência: Cliente "BRASILIENSE INDUSTRIA E COMERCIO D..." (PRIMICIA ESPETUS E PETISCOS) aparece na planilha de cobrança com R$ 0,00 e COM PROTESTO, mas no Maxiprod não tem nenhuma pendência (Contas a Receber = "Nenhum registro encontrado"). Fix: sync agora desativa títulos quando valorAReceber chega a 0 (totalmente pago), independente do status. Desativados 4 registros com valor=0 que estavam ativos.
- [x] Feature: Campo de observação na aprovação de pedidos - gestor pode justificar aprovação e preço praticado
- [x] Feature: Observação de aprovação fica registrada e visível para todos com acesso à aba (Vitória, Guilherme, Fernando, Bruno, Gilson, Luis, Juvenal)
- [x] Feature: Permitir editar observação de aprovação após já ter aprovado o pedido (gestor esqueceu de colocar na hora)
- [x] Bug: Card inadimplência na aba Vendas do vendedor pisca apenas o cliente com alerta (removido pulse do container inteiro, destaque per-client com fundo vermelho claro + badge ALERTA + bolinha pulsando)
- [x] Feature: Histórico de trocas de transportadora na aba Faturamento - registrar quem trocou (login), data/hora, transportadora anterior e nova
- [x] Feature: Exibir histórico de trocas de transportadora no pedido (visível para todos) - popover com ícone de relógio ao lado do seletor
- [x] Feature: Restringir visualização do histórico de transportadora apenas para Bruno, Fernando e Guilherme
- [x] Feature: Quando vendedor responder alerta de inadimplência (visto/resolvido/etc), piscar o cliente na aba Financeiro-Inadimplência
- [x] Feature: Piscar até o financeiro clicar no sininho para confirmar que viu a devolutiva
- [x] Bug: Sincronização Maxiprod falhando por JavaScript heap out of memory (252MB/259MB) durante saveAllData com 6141 contas a receber - aumentado heap para 384MB e liberando raw arrays após transform
- [x] Feature: Produtos de madeira não precisam de aceite manual para alerta de estoque insuficiente
- [x] Feature: Para madeira, verificar automaticamente se tem caixas suficientes no estoque - se tiver, não mostra alerta
- [x] Feature: Para madeira, quando estoque for reposto e ficar suficiente, resolver alerta automaticamente (fica só no histórico)
- [x] Feature: Regra vale a partir de hoje (22/07/2026) - alertas existentes de madeira anteriores a esta data mantém comportamento antigo

## Rastreio Alfa Transportes na Gestão Comercial (22/07/2026)
- [x] Backend: criar helper trackAlfaFreight no alfaApi.ts (consulta API rastreamento Alfa v1.3)
- [x] Backend: criar procedure tRPC trackOrder (recebe pedido, busca NF via Maxiprod, consulta Alfa)
- [x] Frontend: botão "Rastrear" ao lado de cada pedido no histórico do vendedor (SellerOrdersView)
- [x] Frontend: modal/dialog de rastreio com status, trechos, ocorrências, comprovante de entrega
- [x] Funcionalidade disponível tanto no painel dos vendedores quanto no painel dos gestores
- [x] NÃO alterar nenhuma outra funcionalidade

## Melhoria PDF Planilha de Cobrança - Histórico Completo (22/07/2026)
- [x] PDF exportado deve incluir histórico completo de cada etapa de cobrança separadamente
- [x] Cada etapa deve mostrar: data, status, texto/observação escrita, quem registrou
- [x] Não perder nenhuma informação - tudo que foi escrito em cada etapa deve aparecer
- [x] Manter formato legível e organizado no PDF

## Fluxo Aprovação Juvenal (22/07/2026)
- [x] Backend: novo status intermediário "aprovado_subgestor" para pedidos aprovados pelo Renato
- [x] Backend: procedure gestorApproveSubgestorOrder para Juvenal aprovar (senha "Juvenal")
- [x] Backend: procedure gestorRejectSubgestorOrder para Juvenal rejeitar
- [x] Backend: filtrar pedidos "aprovado_subgestor" para não aparecerem para Vitória
- [x] Frontend: seção/aba para Juvenal ver e aprovar pedidos pendentes do Renato (GestorAprovacoes)
- [x] Frontend: badge "AGUARDANDO GESTOR" nos cards de pedido com status aprovado_subgestor
- [x] Frontend: vendedor vê status "AGUARDANDO GESTOR" no histórico de pedidos
- [x] Regra: apenas pedidos do Renato (subgestor do Rafael) passam por essa etapa extra

## PDF Decisão Final (Protesto/Não Protesto) - Histórico Completo (22/07/2026)
- [x] PDF de decisão final deve incluir histórico completo de todas as etapas de cobrança
- [x] Cada etapa deve mostrar: data, status, texto/observação, quem registrou
- [x] Documento completo com todas as informações de cada etapa separadamente

## BUG: Cliente novo na cobrança aparece como "Contatado" em vez de "Pendente" (22/07/2026)
- [x] Investigar: Maninho e Família Espetinhos (NF 2598) venceu 21/07, deveria aparecer como PENDENTE na 1ª cobrança
- [x] Porém apareceu direto como "Contatado" - Thalita ajustou manualmente
- [x] Diagnosticado: STRONG_STATUSES incluía "Contatado", "Em negociação", "Promessa de Pgto" como status herdáveis
- [x] Corrigido: removidos status de progresso da herança. Agora só herda: Protestado, Protesto em Análise, Fundo Perdido, Especial s/ cobrança

## Senha Obrigatória + Histórico de Aprovações (23/07/2026)
- [x] Backend: criar tabela order_approval_history (quem aprovou, quando, qual pedido, senha usada)
- [x] Backend: validar senha (primeiro nome com inicial maiúscula) ao aprovar pedido
- [x] Backend: registrar cada aprovação no histórico
- [x] Frontend: input de senha obrigatório no dialog de aprovação (vendedor e gestor)
- [x] Endpoint getApprovalHistory para consultar histórico de aprovações

## BUG: Login vendedor redireciona + Renato Aleixo (23/07/2026)
- [ ] Login do vendedor: ao digitar senha e clicar Entrar, deve entrar direto no sistema sem redirecionar para outra tela
- [ ] Renato deve entrar APENAS como "Renato Ledesma", nunca como "Renato Aleixo"

## BUG: Barra de pesquisa da Planilha de Cobrança não filtra resultados (23/07/2026)
- [x] Fix: Mover check showCobrancaPlanilha ANTES do check isLoading no InadimplenciaTab (evita desmontagem do componente durante refetch)
- [x] Fix: Envolver onClose em useCallback para evitar re-renders desnecessários
- [x] Fix: Envolver CobrancaPlanilhaView em React.memo para estabilidade
- [x] UX: Adicionar botão de limpar busca (X) e contador de resultados
- [x] UX: Adicionar campos documento e centroCustos ao filtro de busca

## Ajuste SKUs na Criação de Lotes - Produção (23/07/2026)
- [x] Adicionar SKU ECP15 para código 00577
- [x] Adicionar SKU ECP20 para código 00547

## BUG: Juvenal não consegue aprovar pedido (23/07/2026)
- [x] Adicionar mutation gestorApproveSubgestorOrder no VitoriaOrders
- [x] Incluir status aprovado_subgestor no filtro "Novos" para Juvenal
- [x] Adicionar botão "Aprovar como Gestor" com senha e observação para pedidos aprovado_subgestor
- [x] Atualizar badge de status para mostrar "AGUARDANDO GESTOR" para pedidos aprovado_subgestor
- [x] Implementar em ambos os caminhos de renderização (agrupado e lista)

## Fix: Exportação Maxiprod - campos em branco em vez de "NAO INFORMADO" (23/07/2026)
- [x] Exportar Cliente (.xlsx): substituir "NAO INFORMADO", "A DEFINIR", "(00)0000-0000", "adefinir@grupofox.com" por campos em branco
- [x] Exportar Pedido (.xlsx): substituir "NAO INFORMADO", "A DEFINIR" por campos em branco
- [x] Manter apenas campos obrigatórios (*) com valores default (Apelido, Ativa, Regime tributário, Sim/Não flags)

## Feature: Gráfico de desconto por produto na visualização do Juvenal (23/07/2026)
- [x] Adicionar ProductMarginBar (barra de desconto) na visualização de itens do pedido no segundo caminho de renderização (lista) do VitoriaOrders
