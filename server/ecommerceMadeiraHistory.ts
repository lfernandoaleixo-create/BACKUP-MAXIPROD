/**
 * E-commerce Transfer History (Industrialização/Madeira only)
 * 
 * Uses manual CX mappings taught by the business owner.
 * Only shows products from Industrialização (Madeira).
 * 
 * Same structure as ecommerceHistory.ts but for madeira products.
 */

import { getDb } from "./db";
import { salesOrders } from "../drizzle/schema";
import { and, desc, sql, eq } from "drizzle-orm";
import {
  MADEIRA_CX_DIRECT_PRODUCTS,
  MADEIRA_PC_TO_CX_MAPPINGS,
  convertMadeiraPcToCx,
  isMadeiraDirectCxProduct,
  isMadeiraPcVariant,
  isMadeiraEcommerceProduct,
} from "./ecommerceMadeiraMappings";

/** Normalized history item shape expected by the frontend */
export interface MadeiraEcommerceHistoryItem {
  detectedAt: Date | string;
  codigoItem: string;
  descricaoItem: string;
  quantidadeCx: number;
  quantidadeOriginal: number;
  unidadeOriginal: string; // "CX" or "PC"
  produtoMae: string | null;
  tipoMovimento: string; // 'faturado' | 'faturado_parcial'
  pedidoRelacionado: string | null;
  cliente: string | null;
}

/**
 * Convert a sales order item to CX (Madeira).
 */
function convertMadeiraItemToCx(
  codigoItem: string,
  quantidade: number,
  unidadeMedida: string,
): { quantidadeCx: number; produtoMae: string | null } | null {
  const um = unidadeMedida.toUpperCase();

  if (isMadeiraDirectCxProduct(codigoItem)) {
    return { quantidadeCx: quantidade, produtoMae: null };
  }

  if (isMadeiraPcVariant(codigoItem)) {
    const result = convertMadeiraPcToCx(codigoItem, quantidade);
    if (result) {
      return {
        quantidadeCx: Math.round(result.caixas * 100) / 100,
        produtoMae: result.parentCode,
      };
    }
  }

  // Unknown product - if it's CX, pass through; otherwise skip
  if (um === 'CX') {
    return { quantidadeCx: quantidade, produtoMae: null };
  }

  return null;
}

/**
 * Get E-commerce history for Madeira/Industrialização products.
 * Faturado orders only.
 */
export async function getEcommerceMadeiraHistoryData(filters?: {
  fromDate?: string;
  toDate?: string;
  codigoItem?: string;
  pedido?: string;
  searchText?: string;
}): Promise<MadeiraEcommerceHistoryItem[]> {
  const db = await getDb();
  if (!db) return [];

  const conditions: any[] = [
    // estadoConfiguravel = "E-COMMERCE"
    sql`UPPER(${salesOrders.estadoConfiguravel}) IN ('E-COMMERCE', 'ECOMMERCE')`,
    // Faturado
    sql`(${salesOrders.estadoItem} LIKE '%aturado%' OR ${salesOrders.estadoItem} LIKE '%ATURADO%')`,
  ];

  if (filters?.fromDate) {
    conditions.push(sql`${salesOrders.dataEmissao} >= ${filters.fromDate}`);
  }
  if (filters?.toDate) {
    conditions.push(sql`${salesOrders.dataEmissao} <= ${filters.toDate}`);
  }
  if (filters?.codigoItem) {
    conditions.push(eq(salesOrders.codigoItem, filters.codigoItem));
  }
  if (filters?.pedido) {
    conditions.push(eq(salesOrders.pedido, filters.pedido));
  }

  const rows = await db
    .select()
    .from(salesOrders)
    .where(and(...conditions))
    .orderBy(desc(salesOrders.dataEmissao));

  const results: MadeiraEcommerceHistoryItem[] = [];

  for (const row of rows) {
    const code = row.codigoItem || '';
    
    // Filter: only madeira products
    if (!isMadeiraEcommerceProduct(code)) continue;

    const qtd = parseFloat(row.quantidade || '0');
    const umCodigo = (row.unidadeMedidaCodigo || '').toUpperCase();

    const conversion = convertMadeiraItemToCx(code, qtd, umCodigo);
    if (!conversion) continue;

    // Determine movement type
    let tipoMovimento = 'faturado';
    const estadoItem = (row.estadoItem || '').toLowerCase();
    if (estadoItem.includes('parcial') || estadoItem.includes('parc.')) {
      tipoMovimento = 'faturado_parcial';
    }

    // Apply text search filter
    if (filters?.searchText) {
      const search = filters.searchText.toLowerCase();
      const descItem = (row.descricaoItem || row.descricao || '').toLowerCase();
      const pedido = (row.pedido || '').toLowerCase();
      const cliente = (row.clienteApelido || row.cliente || '').toLowerCase();
      if (!descItem.includes(search) && !code.toLowerCase().includes(search) && !pedido.includes(search) && !cliente.includes(search)) {
        continue;
      }
    }

    results.push({
      detectedAt: row.dataEmissao || row.collectedAt,
      codigoItem: code,
      descricaoItem: row.descricaoItem || row.descricao || '',
      quantidadeCx: conversion.quantidadeCx,
      quantidadeOriginal: qtd,
      unidadeOriginal: umCodigo || 'CX',
      produtoMae: conversion.produtoMae,
      tipoMovimento,
      pedidoRelacionado: row.pedido || null,
      cliente: row.clienteApelido || row.cliente || null,
    });
  }

  // Sort by date descending, then by pedido
  results.sort((a, b) => {
    const dateA = new Date(a.detectedAt).getTime();
    const dateB = new Date(b.detectedAt).getTime();
    if (dateB !== dateA) return dateB - dateA;
    return (a.pedidoRelacionado || '').localeCompare(b.pedidoRelacionado || '');
  });

  return results;
}
