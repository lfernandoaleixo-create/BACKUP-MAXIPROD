import { gql } from "../server/maxiprodGraphQL.ts";

async function explorePriceTables() {
  try {
    // Fetch ALL items from tabelaDePrecosItem
    const data = await gql(`{
      tabelaDePrecosItem(take: 100) {
        totalCount
        items {
          id
          tabelaDePrecosId
          itemId
          precoTipo
          preco
          descontoEmPercentual
          descontoMaximoEmPercentual
          comissaoEmPercentual
          item {
            codigo
            descricao
            unidade { codigo }
          }
          tabelaDePrecos {
            id
            codigo
            descricao
          }
        }
      }
    }`);
    
    console.log(`Total items in price tables: ${data.tabelaDePrecosItem.totalCount}`);
    
    // Group by table
    const byTable = {};
    for (const item of data.tabelaDePrecosItem.items) {
      const tableName = item.tabelaDePrecos.descricao;
      if (!byTable[tableName]) byTable[tableName] = [];
      byTable[tableName].push(item);
    }
    
    for (const [tableName, items] of Object.entries(byTable)) {
      console.log(`\n=== ${tableName} (${items.length} produtos) ===`);
      for (const item of items) {
        const descontoMax = item.descontoMaximoEmPercentual || 0;
        const precoMinimo = item.preco * (1 - descontoMax / 100);
        console.log(`  ${item.item.codigo} | ${item.item.descricao.substring(0, 60)} | R$ ${item.preco} | Desc.Max: ${descontoMax}% | Mín: R$ ${precoMinimo.toFixed(2)}`);
      }
    }

  } catch (err) {
    console.error("Error:", err.message);
  }
}

explorePriceTables();
