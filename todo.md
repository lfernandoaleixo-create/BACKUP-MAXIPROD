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
