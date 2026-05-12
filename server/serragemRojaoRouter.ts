/**
 * Router para Análise Serragem/Rojão
 * 
 * Card VENDAS/FATURAMENTO:
 * - Fonte: Maxiprod → Vendas → Notas Fiscais (GraphQL: notasFiscais)
 * - Filtros:
 *   - Estado da NF: EMITIDA
 *   - Entrada/Saída: SAIDA
 *   - Estado configurável: "SERRAGEM" ou "ROJÃO"
 *   - Situação: Autorizada (nfeRetornoCodigo = "100") + Não Enviada (nfeRetornoCodigo = null)
 * - Período: sem limite inferior de data por padrão (todas desde o início), até data fim
 *   Quando o usuário seleciona Mês Anterior ou Personalizado, filtra pelo período
 */

import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { gql } from "./maxiprodGraphQL";

/**
 * Fetch NFs de Serragem ou Rojão do Maxiprod
 * Retorna total de vendas/faturamento
 */
async function fetchSerragemRojaoVendas(
  tipo: "SERRAGEM" | "ROJÃO",
  startDate: string | null,
  endDate: string
): Promise<{ total: number; count: number; nfs: Array<{ numero: number; valorTotal: number; emissaoData: string; situacao: string }> }> {
  try {
    const endISO = `${endDate}T23:59:59.999-03:00`;
    
    // Build where clause - emissaoData filter depends on whether startDate is provided
    let dateFilter = "";
    if (startDate) {
      const startISO = `${startDate}T00:00:00.000-03:00`;
      dateFilter = `emissaoData: { gte: "${startISO}", lte: "${endISO}" }`;
    } else {
      dateFilter = `emissaoData: { lte: "${endISO}" }`;
    }

    let allItems: any[] = [];
    let skip = 0;
    const take = 1000;

    while (true) {
      const data = await gql<any>(`{
        notasFiscais(
          skip: ${skip}
          take: ${take}
          where: {
            ${dateFilter}
            estado: { eq: EMITIDA }
            entradaOuSaida: { eq: SAIDA }
            estadoConfiguravel: { descricao: { eq: "${tipo}" } }
          }
        ) {
          totalCount
          items {
            numero
            valorTotal
            emissaoData
            nfeRetornoCodigo
          }
        }
      }`);

      if (!data?.notasFiscais) break;
      allItems.push(...data.notasFiscais.items);
      skip += take;
      if (skip >= data.notasFiscais.totalCount) break;
    }

    // Filter: only Autorizada (nfeRetornoCodigo = "100") and Não Enviada (nfeRetornoCodigo = null)
    const filtered = allItems.filter(item => {
      const codigo = item.nfeRetornoCodigo;
      return codigo === "100" || codigo === null || codigo === undefined;
    });

    const total = Math.round(filtered.reduce((sum: number, item: any) => sum + (item.valorTotal || 0), 0) * 100) / 100;

    const nfs = filtered.map((item: any) => ({
      numero: item.numero,
      valorTotal: Math.round((item.valorTotal || 0) * 100) / 100,
      emissaoData: item.emissaoData || "",
      situacao: item.nfeRetornoCodigo === "100" ? "Autorizada" : "Não Enviada",
    }));

    console.log(`[Serragem/Rojão] ${tipo}: R$ ${total.toFixed(2)} (${filtered.length} NFs, período: ${startDate || 'início'} a ${endDate})`);

    return { total, count: filtered.length, nfs };
  } catch (error: any) {
    console.error(`[Serragem/Rojão] Error fetching ${tipo}:`, error.message);
    return { total: 0, count: 0, nfs: [] };
  }
}

export const serragemRojaoRouter = router({
  /**
   * Get Vendas/Faturamento for Serragem or Rojão
   * - tipo: "SERRAGEM" or "ROJÃO"
   * - startDate: null = sem limite inferior (todas desde o início)
   * - endDate: data fim (padrão = hoje)
   */
  getVendasFaturamento: publicProcedure
    .input(z.object({
      tipo: z.enum(["SERRAGEM", "ROJÃO"]),
      startDate: z.string().nullable(), // null = sem limite inferior
      endDate: z.string(), // YYYY-MM-DD
    }))
    .query(async ({ input }) => {
      const { tipo, startDate, endDate } = input;
      return fetchSerragemRojaoVendas(tipo, startDate, endDate);
    }),
});
