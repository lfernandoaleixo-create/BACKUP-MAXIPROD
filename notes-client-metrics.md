# Client Metrics Analysis

## Data Available
- 1759 sales order items, 458 distinct clients
- Date range: 2025-06-13 to 2026-05-11 (~11 months)
- Segments (estadoConfiguravel): BAMBU (1077), MADEIRA (537), AMOSTRA (71), E-COMMERCE (29), BONIFICAÇÃO (19), FIBRA (11), MADEIRA IMPORTADA (8)
- Client segments (crmSegmento/segmento): DISTRIBUIDORA, LOJA, INDUSTRIA, LATICÍNIO, FOGOS, SERRAGEM, EXPORTAÇÃO

## Client Distribution
- 242 clients with only 1 order
- 137 clients with 2-3 orders
- 57 clients with 4-6 orders
- 19 clients with 7-12 orders
- 2 clients with 12+ orders

## New Metrics Plan (Group-level, no individual seller)

### 1. Clientes Novos por Mês
- For each month, count clients whose FIRST order ever was in that month
- Also count "reativados": clients whose previous order was 6+ months before
- Show as bar chart or table: month | novos | reativados | total aberturas

### 2. Ranking de Frequência (últimos 12 meses)
- For each client, count distinct orders in last 12 months
- Show ranking: client name | # orders | first order | last order | avg interval
- Filter by segment (BAMBU/MADEIRA/etc.)

### 3. Alerta de Intervalo Vencido
- For clients with 2+ orders, calculate average interval between orders
- If current date - last order > avg interval * 1.5 (or some threshold), flag as "overdue"
- Show list: client name | avg interval (days) | last order | days since last | status (OK/ATRASADO)

### 4. Filtro por Segmento
- estadoConfiguravel = BAMBU, MADEIRA, etc. (product segment)
- segmento/crmSegmento = DISTRIBUIDORA, LOJA, etc. (client segment)
- Both filters available
