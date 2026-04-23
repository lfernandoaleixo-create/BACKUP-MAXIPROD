/**
 * E-commerce Transfer History (Importação only)
 * 
 * Uses manual PC→CX mappings taught by the business owner.
 * Only shows products from Grupo 12 (Importação).
 * 
 * Two modes:
 * 1. PENDING: Orders with estadoConfiguravel = "E-COMMERCE" that are NOT faturado
 *    → Show warning card on stock page
 * 2. HISTORY: Orders with estadoConfiguravel = "E-COMMERCE" that ARE faturado
 *    → Show in "Histórico E-commerce" dialog
 * 
 * RULE: Client must be the filial (PALITOS E-COMMERCE / PALITOS INDUSTRIA E COMERCIO LTDA)
 */

import { getDb } from "./db";
import { salesOrders, orderItems } from "../drizzle/schema";
import { and, desc, sql, eq } from "drizzle-orm";
import {
  CX_DIRECT_PRODUCTS,
  PC_TO_CX_MAPPINGS,
  convertPcToCx,
  isDirectCxProduct,
  isPcVariant,
  getAllImportEcommerceProductCodes,
  ECOMMERCE_FILIAL_CLIENTS,
} from "./ecommerceManualMappings";

/** Normalized history item shape expected by the frontend */
export interface EcommerceHistoryItem {
  detectedAt: Date | string;
  codigoItem: string;
  descricaoItem: string;
  quantidadeCx: number;
  quantidadeOriginal: number;
  unidadeOriginal: string; // "CX" or "PC"
  produtoMae: string | null; // parent product code (for PC items)
  tipoMovimento: string; // 'faturado' | 'faturado_parcial'
  pedidoRelacionado: string | null;
  cliente: string | null;
}

/** Pending transfer item (not yet faturado) */
export interface EcommercePendingItem {
  codigoItem: string;
  descricaoItem: string;
  quantidadeCx: number;
  quantidadeOriginal: number;
  unidadeOriginal: string;
  produtoMae: string | null;
  pedido: string | null;
  cliente: string | null;
  dataEmissao: string | null;
  estadoItem: string | null;
}

/**
 * All known import product codes (CX direct + PC variants).
 * Used to filter only importação products.
 */
const IMPORT_PRODUCT_CODES = new Set(getAllImportEcommerceProductCodes());

/**
 * Check if a product code is a known importação e-commerce product.
 */
function isImportProduct(codigoItem: string): boolean {
  return IMPORT_PRODUCT_CODES.has(codigoItem);
}

/**
 * Convert a sales order item to CX.
 * - If CX direct: use quantity as-is
 * - If PC variant: use manual mapping to convert
 * - Otherwise: skip (not an import product)
 */
function convertItemToCx(
  codigoItem: string,
  quantidade: number,
  unidadeMedida: string,
): { quantidadeCx: number; produtoMae: string | null } | null {
  const um = unidadeMedida.toUpperCase();

  if (isDirectCxProduct(codigoItem)) {
    // Already in CX, no conversion needed
    return { quantidadeCx: quantidade, produtoMae: null };
  }

  if (isPcVariant(codigoItem)) {
    const result = convertPcToCx(codigoItem, quantidade);
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

  return null; // Not an import product we know about
}

/**
 * Get E-commerce history (faturado orders only, importação products only).
 * This is what shows in the "Histórico E-commerce" dialog.
 */
export async function getEcommerceTransferHistoryData(filters?: {
  fromDate?: string;
  toDate?: string;
  codigoItem?: string;
  pedido?: string;
  searchText?: string;
}): Promise<EcommerceHistoryItem[]> {
  const db = await getDb();
  if (!db) return [];

  const conditions: any[] = [
    // estadoConfiguravel = "E-COMMERCE"
    sql`UPPER(${salesOrders.estadoConfiguravel}) IN ('E-COMMERCE', 'ECOMMERCE')`,
    // Faturado (includes "Faturado", "Parc. faturado", etc.)
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

  const results: EcommerceHistoryItem[] = [];

  for (const row of rows) {
    const code = row.codigoItem || '';
    
    // Filter: only import products
    if (!isImportProduct(code)) continue;

    const qtd = parseFloat(row.quantidade || '0');
    const umCodigo = (row.unidadeMedidaCodigo || '').toUpperCase();

    const conversion = convertItemToCx(code, qtd, umCodigo);
    if (!conversion) continue;

    // Determine movement type
    let tipoMovimento = 'faturado';
    const estadoItem = (row.estadoItem || '').toLowerCase();
    if (estadoItem.includes('parcial') || estadoItem.includes('parc.')) {
      tipoMovimento = 'faturado_parcial';
    }

    // Apply text search filter if provided
    if (filters?.searchText) {
      const search = filters.searchText.toLowerCase();
      const desc = (row.descricaoItem || row.descricao || '').toLowerCase();
      const pedido = (row.pedido || '').toLowerCase();
      const cliente = (row.clienteApelido || row.cliente || '').toLowerCase();
      if (!desc.includes(search) && !code.toLowerCase().includes(search) && !pedido.includes(search) && !cliente.includes(search)) {
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

/**
 * Get pending E-commerce transfers (NOT faturado yet).
 * These show as a warning card on the stock page.
 * 
 * Looks at both:
 * - salesOrders (faturamento tab) with E-COMMERCE estado that are NOT faturado
 * - orderItems (pedidos em aberto) with E-COMMERCE estado
 */
export async function getPendingEcommerceTransfers(): Promise<{
  items: EcommercePendingItem[];
  totalCx: number;
  pedidos: string[];
}> {
  const db = await getDb();
  if (!db) return { items: [], totalCx: 0, pedidos: [] };

  // Source 1: salesOrders with E-COMMERCE that are NOT faturado
  const salesConditions = [
    sql`UPPER(${salesOrders.estadoConfiguravel}) IN ('E-COMMERCE', 'ECOMMERCE')`,
    // NOT faturado: exclude items that contain "aturado" (Faturado, Parc. faturado, etc.)
    sql`NOT (${salesOrders.estadoItem} LIKE '%aturado%' OR ${salesOrders.estadoItem} LIKE '%ATURADO%')`,
  ];

  const salesRows = await db
    .select()
    .from(salesOrders)
    .where(and(...salesConditions));

  // Source 2: orderItems (pedidos em aberto) with E-COMMERCE
  const orderConditions = [
    sql`UPPER(${orderItems.estadoConfiguravel}) IN ('E-COMMERCE', 'ECOMMERCE')`,
  ];

  const orderRows = await db
    .select()
    .from(orderItems)
    .where(and(...orderConditions));

  const items: EcommercePendingItem[] = [];
  const pedidoSet = new Set<string>();

  // Process salesOrders (not faturado)
  for (const row of salesRows) {
    const code = row.codigoItem || '';
    if (!isImportProduct(code)) continue;

    const qtd = parseFloat(row.quantidade || '0');
    const umCodigo = (row.unidadeMedidaCodigo || '').toUpperCase();
    const conversion = convertItemToCx(code, qtd, umCodigo);
    if (!conversion) continue;

    if (row.pedido) pedidoSet.add(row.pedido);

    items.push({
      codigoItem: code,
      descricaoItem: row.descricaoItem || row.descricao || '',
      quantidadeCx: conversion.quantidadeCx,
      quantidadeOriginal: qtd,
      unidadeOriginal: umCodigo || 'CX',
      produtoMae: conversion.produtoMae,
      pedido: row.pedido || null,
      cliente: row.clienteApelido || row.cliente || null,
      dataEmissao: row.dataEmissao || null,
      estadoItem: row.estadoItem || null,
    });
  }

  // Process orderItems (pedidos em aberto)
  for (const row of orderRows) {
    const code = row.codigoItem || '';
    if (!isImportProduct(code)) continue;

    // Skip if already counted from salesOrders (same pedido + same code)
    const alreadyCounted = items.some(
      (i) => i.pedido === row.numeroPedido && i.codigoItem === code
    );
    if (alreadyCounted) continue;

    const qtd = parseFloat(row.quantidade || '0');
    const umCodigo = (row.unidadeMedida || '').toUpperCase();
    const conversion = convertItemToCx(code, qtd, umCodigo);
    if (!conversion) continue;

    if (row.numeroPedido) pedidoSet.add(row.numeroPedido);

    items.push({
      codigoItem: code,
      descricaoItem: row.descricao || '',
      quantidadeCx: conversion.quantidadeCx,
      quantidadeOriginal: qtd,
      unidadeOriginal: umCodigo || 'CX',
      produtoMae: conversion.produtoMae,
      pedido: row.numeroPedido || null,
      cliente: row.cliente || null,
      dataEmissao: null,
      estadoItem: row.estadoItem || null,
    });
  }

  const totalCx = items.reduce((sum, i) => sum + i.quantidadeCx, 0);

  return {
    items,
    totalCx: Math.round(totalCx * 100) / 100,
    pedidos: Array.from(pedidoSet),
  };
}

/**
 * Legacy function - kept for backward compatibility with sync process.
 * The snapshot-based detection is no longer the primary source;
 * we now use salesOrders directly.
 */
export async function detectEcommerceTransfers(): Promise<void> {
  console.log('[E-Commerce History] Using salesOrders-based detection (manual mappings)');
  // No-op: history is now derived directly from salesOrders
}
