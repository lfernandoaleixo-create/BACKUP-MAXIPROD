import 'dotenv/config';
import mysql from 'mysql2/promise';

const dbUrl = process.env.DATABASE_URL;
const url = new URL(dbUrl);

const conn = await mysql.createConnection({
  host: url.hostname,
  port: parseInt(url.port) || 3306,
  user: url.username,
  password: decodeURIComponent(url.password),
  database: url.pathname.slice(1),
  ssl: { rejectUnauthorized: false }
});

// 1. Monthly totals
const [monthlyTotals] = await conn.execute(`
  SELECT 
    DATE_FORMAT(dataEmissao, '%Y-%m') as mes,
    COUNT(DISTINCT pedido) as total_pedidos,
    COUNT(DISTINCT cliente) as total_clientes,
    SUM(valorTotal) as valor_total,
    SUM(CASE WHEN estadoItem = 'Faturado' OR estadoItem = 'Atendido' THEN valorTotal ELSE 0 END) as valor_faturado,
    SUM(CASE WHEN estadoItem NOT IN ('Faturado', 'Atendido', 'Cancelado') THEN valorTotal ELSE 0 END) as valor_a_faturar
  FROM sales_orders
  WHERE dataEmissao >= '2026-01-01' AND dataEmissao < '2026-07-01'
    AND estadoItem != 'Cancelado'
  GROUP BY DATE_FORMAT(dataEmissao, '%Y-%m')
  ORDER BY mes
`);

// 2. By segment
const [bySegment] = await conn.execute(`
  SELECT 
    DATE_FORMAT(dataEmissao, '%Y-%m') as mes,
    CASE 
      WHEN codigoGrupo IN ('20', '21') THEN 'Importação (Bambu)'
      WHEN codigoGrupo IN ('06', '07', '08', '18', '24') THEN 'Industrializado'
      ELSE 'Outros'
    END as segmento,
    SUM(valorTotal) as valor_total,
    COUNT(DISTINCT pedido) as pedidos
  FROM sales_orders
  WHERE dataEmissao >= '2026-01-01' AND dataEmissao < '2026-07-01'
    AND estadoItem != 'Cancelado'
  GROUP BY mes, CASE 
      WHEN codigoGrupo IN ('20', '21') THEN 'Importação (Bambu)'
      WHEN codigoGrupo IN ('06', '07', '08', '18', '24') THEN 'Industrializado'
      ELSE 'Outros'
    END
  ORDER BY mes, segmento
`);

// 3. Top 20 products
const [topProducts] = await conn.execute(`
  SELECT 
    descricao,
    SUM(valorTotal) as valor_total,
    SUM(quantidade) as qtd_total,
    COUNT(DISTINCT pedido) as pedidos
  FROM sales_orders
  WHERE dataEmissao >= '2026-01-01' AND dataEmissao < '2026-07-01'
    AND estadoItem != 'Cancelado'
  GROUP BY descricao
  ORDER BY valor_total DESC
  LIMIT 20
`);

// 4. Top 20 clients
const [topClients] = await conn.execute(`
  SELECT 
    cliente,
    clienteApelido,
    uf,
    SUM(valorTotal) as valor_total,
    COUNT(DISTINCT pedido) as pedidos
  FROM sales_orders
  WHERE dataEmissao >= '2026-01-01' AND dataEmissao < '2026-07-01'
    AND estadoItem != 'Cancelado'
  GROUP BY cliente, clienteApelido, uf
  ORDER BY valor_total DESC
  LIMIT 20
`);

// 5. By UF
const [byUf] = await conn.execute(`
  SELECT 
    uf,
    SUM(valorTotal) as valor_total,
    COUNT(DISTINCT pedido) as pedidos,
    COUNT(DISTINCT cliente) as clientes
  FROM sales_orders
  WHERE dataEmissao >= '2026-01-01' AND dataEmissao < '2026-07-01'
    AND estadoItem != 'Cancelado'
  GROUP BY uf
  ORDER BY valor_total DESC
`);

// 6. Daily evolution
const [dailyEvolution] = await conn.execute(`
  SELECT 
    DATE_FORMAT(dataEmissao, '%Y-%m-%d') as dia,
    SUM(valorTotal) as valor_total
  FROM sales_orders
  WHERE dataEmissao >= '2026-01-01' AND dataEmissao < '2026-07-01'
    AND estadoItem != 'Cancelado'
  GROUP BY dia
  ORDER BY dia
`);

// 7. Semester totals
const [semesterTotal] = await conn.execute(`
  SELECT 
    COUNT(DISTINCT pedido) as total_pedidos,
    COUNT(DISTINCT cliente) as total_clientes,
    SUM(valorTotal) as valor_total,
    SUM(CASE WHEN estadoItem = 'Faturado' OR estadoItem = 'Atendido' THEN valorTotal ELSE 0 END) as valor_faturado
  FROM sales_orders
  WHERE dataEmissao >= '2026-01-01' AND dataEmissao < '2026-07-01'
    AND estadoItem != 'Cancelado'
`);

// 8. Segment totals for semester
const [segmentTotals] = await conn.execute(`
  SELECT 
    CASE 
      WHEN codigoGrupo IN ('20', '21') THEN 'Importação (Bambu)'
      WHEN codigoGrupo IN ('06', '07', '08', '18', '24') THEN 'Industrializado'
      ELSE 'Outros'
    END as segmento,
    SUM(valorTotal) as valor_total,
    COUNT(DISTINCT pedido) as pedidos,
    COUNT(DISTINCT cliente) as clientes
  FROM sales_orders
  WHERE dataEmissao >= '2026-01-01' AND dataEmissao < '2026-07-01'
    AND estadoItem != 'Cancelado'
  GROUP BY CASE 
      WHEN codigoGrupo IN ('20', '21') THEN 'Importação (Bambu)'
      WHEN codigoGrupo IN ('06', '07', '08', '18', '24') THEN 'Industrializado'
      ELSE 'Outros'
    END
  ORDER BY valor_total DESC
`);

const { writeFileSync } = await import('fs');

const data = {
  monthlyTotals,
  bySegment,
  topProducts,
  topClients,
  byUf,
  dailyEvolution,
  semesterTotal: semesterTotal[0],
  segmentTotals
};

writeFileSync('/home/ubuntu/sales_data.json', JSON.stringify(data, null, 2));
console.log('Data extracted successfully!');
console.log('Semester total:', JSON.stringify(semesterTotal[0]));
console.log('Monthly:', monthlyTotals.length, 'months');
console.log('Top products:', topProducts.length);
console.log('Top clients:', topClients.length);
console.log('UFs:', byUf.length);

await conn.end();
