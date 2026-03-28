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
