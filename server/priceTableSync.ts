/**
 * Price Table Sync Service
 * 
 * Syncs price tables (Tabelas de Preço) from Maxiprod GraphQL API.
 * Each price table belongs to a vendor/seller and contains products with:
 * - preço (sale price)
 * - desconto máximo em percentual (max discount %)
 * - comissão em percentual (commission %)
 * 
 * The "preço mínimo de venda" is calculated: preco * (1 - descontoMaximo / 100)
 * 
 * Also auto-updates seller_product_visibility based on price table contents:
 * If a product is in a seller's price table, it becomes visible in their stock view.
 * 
 * Runs automatically every 5 minutes alongside the main sync.
 */
import { getDb } from "./db";
import { priceTables, priceTableItems, sellerPermissions, sellerProductVisibility } from "../drizzle/schema";
import { eq, sql, and, inArray } from "drizzle-orm";
import { gql } from "./maxiprodGraphQL";

/**
 * Mapping from price table description (Maxiprod) to seller_permissions.seller_name
 * This links the Maxiprod price table to the correct seller in our system
 */
const PRICE_TABLE_TO_SELLER: Record<string, string> = {
  "DANIEL DA CONCEIÇÃO TAVARES": "DANIEL TAVARES",
  "ROMERA REPRESENTACAO COMERCIAL DE PRODUTOS DESCARTAVEIS LTDA": "ROMERA REPRESENTACOES",
  "RAFAEL LONDRINA": "RAFAEL",
};

/**
 * Tabelas de preço que devem ser compartilhadas com gestores/subgestores.
 * Quando a tabela 008 (RAFAEL LONDRINA) é sincronizada, os produtos também
 * ficam visíveis para Juvenal (gestor) e Renato (subgestor).
 */
const PRICE_TABLE_SHARED_VISIBILITY: Record<string, string[]> = {
  "RAFAEL LONDRINA": ["JUVENAL TEIXEIRA", "RENATO LEDESMA"],
};

/**
 * Fetch all price tables from Maxiprod
 */
async function fetchPriceTables(): Promise<any[]> {
  const data = await gql(`{
    tabelaDePrecos(take: 100) {
      totalCount
      items {
        id
        codigo
        descricao
      }
    }
  }`);
  return data.tabelaDePrecos?.items || [];
}

/**
 * Fetch all price table items from Maxiprod
 */
async function fetchPriceTableItems(): Promise<any[]> {
  let allItems: any[] = [];
  let skip = 0;
  const pageSize = 500;
  let hasMore = true;

  while (hasMore) {
    const data = await gql(`{
      tabelaDePrecosItem(skip: ${skip}, take: ${pageSize}) {
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

    const items = data.tabelaDePrecosItem?.items || [];
    allItems = allItems.concat(items);

    if (items.length < pageSize || allItems.length >= data.tabelaDePrecosItem.totalCount) {
      hasMore = false;
    } else {
      skip += pageSize;
    }
  }

  return allItems;
}

/**
 * Auto-update seller_product_visibility based on price table contents.
 * Products in a seller's price table become automatically visible.
 */
async function autoUpdateSellerVisibility(items: any[]): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Get all sellers
  const sellers = await db.select().from(sellerPermissions);
  
  // Group price table items by price table description (seller name)
  const itemsByTable: Record<string, string[]> = {};
  for (const item of items) {
    const tableDesc = item.tabelaDePrecos.descricao;
    if (!itemsByTable[tableDesc]) itemsByTable[tableDesc] = [];
    itemsByTable[tableDesc].push(item.item.codigo);
  }

  // For each price table, find the matching seller and update visibility
  for (const [tableDesc, productCodes] of Object.entries(itemsByTable)) {
    const sellerName = PRICE_TABLE_TO_SELLER[tableDesc];
    if (!sellerName) {
      // Try fuzzy match: check if any seller name is contained in the table description
      const matchedSeller = sellers.find(s => {
        const parts = s.sellerName.split(' ');
        return parts.some(part => part.length > 3 && tableDesc.toUpperCase().includes(part.toUpperCase()));
      });
      if (!matchedSeller) continue;
      // Use the matched seller
      await syncVisibilityForSeller(db, matchedSeller.id, productCodes);
    } else {
      const seller = sellers.find(s => s.sellerName === sellerName);
      if (!seller) continue;
      await syncVisibilityForSeller(db, seller.id, productCodes);
    }

    // Shared visibility: also sync products to gestores/subgestores
    const sharedWith = PRICE_TABLE_SHARED_VISIBILITY[tableDesc];
    if (sharedWith) {
      for (const sharedName of sharedWith) {
        const sharedSeller = sellers.find(s => s.sellerName === sharedName);
        if (sharedSeller) {
          await syncVisibilityForSeller(db, sharedSeller.id, productCodes);
        }
      }
    }
  }
}

/**
 * Sync product visibility for a specific seller based on their price table products
 */
async function syncVisibilityForSeller(db: any, sellerId: number, productCodes: string[]): Promise<void> {
  // Get current visibility entries for this seller
  const currentVisibility = await db.select().from(sellerProductVisibility)
    .where(eq(sellerProductVisibility.sellerId, sellerId));
  
  const currentCodes = new Set(currentVisibility.map((v: any) => v.productCode));
  const targetCodes = new Set(productCodes);

  // Add new products that are in price table but not yet visible
  let added = 0;
  for (const code of Array.from(targetCodes)) {
    if (!currentCodes.has(code)) {
      await db.insert(sellerProductVisibility).values({
        sellerId,
        productCode: code,
        visible: true,
      });
      added++;
    }
  }

  // Remove products that are no longer in the price table
  let removed = 0;
  for (const entry of currentVisibility) {
    if (!targetCodes.has(entry.productCode)) {
      await db.delete(sellerProductVisibility).where(eq(sellerProductVisibility.id, entry.id));
      removed++;
    }
  }

  if (added > 0 || removed > 0) {
    console.log(`[PriceTableSync] Visibility updated for seller ${sellerId}: +${added} -${removed} products`);
  }
}

/**
 * Sync price tables from Maxiprod to local database
 * Uses upsert (INSERT ... ON DUPLICATE KEY UPDATE) to handle updates
 */
export async function syncPriceTables(): Promise<{ tables: number; items: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    // 1. Fetch price tables
    const tables = await fetchPriceTables();
    
    // 2. Upsert price tables
    for (const table of tables) {
      await db.insert(priceTables).values({
        maxiprodId: table.id,
        codigo: table.codigo,
        descricao: table.descricao,
      }).onDuplicateKeyUpdate({
        set: {
          codigo: sql`VALUES(codigo)`,
          descricao: sql`VALUES(descricao)`,
        },
      });
    }

    // 3. Get local table IDs mapped by maxiprodId
    const localTables = await db.select().from(priceTables);
    const tableIdMap: Record<number, number> = {};
    for (const t of localTables) {
      tableIdMap[t.maxiprodId] = t.id;
    }

    // 4. Fetch all price table items
    const items = await fetchPriceTableItems();

    // 5. Upsert price table items
    for (const item of items) {
      const localTableId = tableIdMap[item.tabelaDePrecosId];
      if (!localTableId) continue;

      await db.insert(priceTableItems).values({
        maxiprodId: item.id,
        priceTableId: localTableId,
        priceTableMaxiprodId: item.tabelaDePrecosId,
        itemId: item.itemId,
        itemCodigo: item.item.codigo,
        itemDescricao: item.item.descricao,
        itemUnidade: item.item.unidade?.codigo || null,
        preco: String(item.preco),
        descontoEmPercentual: item.descontoEmPercentual != null ? String(item.descontoEmPercentual) : null,
        descontoMaximoEmPercentual: item.descontoMaximoEmPercentual != null ? String(item.descontoMaximoEmPercentual) : null,
        comissaoEmPercentual: item.comissaoEmPercentual != null ? String(item.comissaoEmPercentual) : null,
        precoTipo: item.precoTipo || null,
      }).onDuplicateKeyUpdate({
        set: {
          priceTableId: sql`VALUES(price_table_id)`,
          priceTableMaxiprodId: sql`VALUES(price_table_maxiprod_id)`,
          itemId: sql`VALUES(item_id)`,
          itemCodigo: sql`VALUES(item_codigo)`,
          itemDescricao: sql`VALUES(item_descricao)`,
          itemUnidade: sql`VALUES(item_unidade)`,
          preco: sql`VALUES(preco)`,
          descontoEmPercentual: sql`VALUES(desconto_em_percentual)`,
          descontoMaximoEmPercentual: sql`VALUES(desconto_maximo_em_percentual)`,
          comissaoEmPercentual: sql`VALUES(comissao_em_percentual)`,
          precoTipo: sql`VALUES(preco_tipo)`,
        },
      });
    }

    // 6. Remove items that no longer exist in Maxiprod
    const remoteItemIds = items.map((i: any) => i.id as number);
    if (remoteItemIds.length > 0) {
      const localItems = await db.select({ id: priceTableItems.id, maxiprodId: priceTableItems.maxiprodId }).from(priceTableItems);
      const toDelete = localItems.filter((li: any) => !remoteItemIds.includes(li.maxiprodId));
      for (const item of toDelete) {
        await db.delete(priceTableItems).where(eq(priceTableItems.id, item.id));
      }
      if (toDelete.length > 0) {
        console.log(`[PriceTableSync] Removed ${toDelete.length} items no longer in Maxiprod`);
      }
    }

    // 7. Remove tables that no longer exist in Maxiprod
    const remoteTableIds = tables.map((t: any) => t.id as number);
    const staleTables = localTables.filter((lt: any) => !remoteTableIds.includes(lt.maxiprodId));
    for (const table of staleTables) {
      await db.delete(priceTableItems).where(eq(priceTableItems.priceTableId, table.id));
      await db.delete(priceTables).where(eq(priceTables.id, table.id));
    }
    if (staleTables.length > 0) {
      console.log(`[PriceTableSync] Removed ${staleTables.length} tables no longer in Maxiprod`);
    }

    // 8. Auto-update seller product visibility based on price table contents
    await autoUpdateSellerVisibility(items);

    console.log(`[PriceTableSync] Synced: ${tables.length} tabelas, ${items.length} itens`);
    return { tables: tables.length, items: items.length };
  } catch (err: any) {
    console.error(`[PriceTableSync] Error: ${err.message}`);
    throw err;
  }
}
