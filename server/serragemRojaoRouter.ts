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

// Centro de custo codes in Maxiprod
const CENTRO_CUSTO_CODES: Record<string, string> = {
  "SERRAGEM": "13",
  "ROJÃO": "14",
};

// Sócios fornecedores (apelido)
const SOCIOS_NOMES = ["BRUNO", "FERNANDO", "GILSON"];

/**
 * Fetch Contas a Pagar PAGO from Maxiprod for a given centro de custo
 * Returns total paid (Contas Pagas), Retirada Sócios, and Saídas Total
 */
async function fetchContasPagar(
  tipo: "SERRAGEM" | "ROJÃO",
  startDate: string | null,
  endDate: string
): Promise<{
  contasPagas: number;
  retiradaSocios: number;
  saidasTotal: number;
  countTotal: number;
  countSocios: number;
  items: Array<{ data: string; valor: number; fornecedor: string; referenteA: string; isSocio: boolean }>;
}> {
  try {
    const codigoCentro = CENTRO_CUSTO_CODES[tipo];
    if (!codigoCentro) throw new Error(`Centro de custo não encontrado para ${tipo}`);

    const endISO = `${endDate}T23:59:59.999-03:00`;
    let dateFilter = `liquidacaoData: { lte: "${endISO}" }`;
    if (startDate) {
      const startISO = `${startDate}T00:00:00.000-03:00`;
      dateFilter = `liquidacaoData: { gte: "${startISO}", lte: "${endISO}" }`;
    }

    let allItems: any[] = [];
    let skip = 0;
    const take = 1000;

    while (true) {
      const data = await gql<any>(`{
        contaAPagar(
          skip: ${skip}, take: ${take},
          where: {
            estado: { eq: PAGO },
            centroDeCustos: { codigo: { eq: "${codigoCentro}" } },
            ${dateFilter}
          },
          order: { liquidacaoData: DESC }
        ) {
          totalCount
          items {
            valorPagoLiquido
            liquidacaoData
            referenteA
            fornecedor { apelido razaoSocial }
          }
        }
      }`);

      if (!data?.contaAPagar) break;
      allItems.push(...data.contaAPagar.items);
      skip += take;
      if (skip >= data.contaAPagar.totalCount) break;
    }

    let totalContasPagas = 0;
    let totalRetiradaSocios = 0;
    let countSocios = 0;
    const items: Array<{ data: string; valor: number; fornecedor: string; referenteA: string; isSocio: boolean }> = [];

    for (const item of allItems) {
      const valor = item.valorPagoLiquido || 0;
      totalContasPagas += valor;

      const fornecedor = (item.fornecedor?.apelido || item.fornecedor?.razaoSocial || '').toUpperCase();
      const ref = (item.referenteA || '').toUpperCase();
      const isSocio = SOCIOS_NOMES.some(s => fornecedor.includes(s)) && (ref.includes('RETIRADA') || ref.includes('LUCRO'));

      if (isSocio) {
        totalRetiradaSocios += valor;
        countSocios++;
      }

      items.push({
        data: item.liquidacaoData?.slice(0, 10) || '-',
        valor: Math.round(valor * 100) / 100,
        fornecedor: item.fornecedor?.apelido || item.fornecedor?.razaoSocial || '-',
        referenteA: item.referenteA || '-',
        isSocio,
      });
    }

    const contasPagas = Math.round(totalContasPagas * 100) / 100;
    const retiradaSocios = Math.round(totalRetiradaSocios * 100) / 100;
    // Saídas Total = Contas Pagas - Retirada Sócios
    const saidasTotal = Math.round((contasPagas - retiradaSocios) * 100) / 100;

    console.log(`[Serragem/Rojão] ${tipo} Contas Pagas: R$ ${contasPagas.toFixed(2)} | Retirada Sócios: R$ ${retiradaSocios.toFixed(2)} | ${allItems.length} itens`);

    return {
      contasPagas,
      retiradaSocios,
      saidasTotal,
      countTotal: allItems.length,
      countSocios,
      items,
    };
  } catch (error: any) {
    console.error(`[Serragem/Rojão] Error fetching contas a pagar ${tipo}:`, error.message);
    return { contasPagas: 0, retiradaSocios: 0, saidasTotal: 0, countTotal: 0, countSocios: 0, items: [] };
  }
}

export const serragemRojaoRouter = router({
  /**
   * Get Vendas/Faturamento for Serragem or Rojão
   */
  getVendasFaturamento: publicProcedure
    .input(z.object({
      tipo: z.enum(["SERRAGEM", "ROJÃO"]),
      startDate: z.string().nullable(),
      endDate: z.string(),
    }))
    .query(async ({ input }) => {
      const { tipo, startDate, endDate } = input;
      return fetchSerragemRojaoVendas(tipo, startDate, endDate);
    }),

  /**
   * Get Contas Pagas, Retirada Sócios, and Saídas Total for Serragem or Rojão
   * Source: Maxiprod → Financeiro → Contas a Pagar
   * Filters: estado=PAGO, centroDeCustos.codigo=13(Serragem)/14(Rojão), liquidacaoData
   * Retirada Sócios: fornecedor contains Bruno/Fernando/Gilson + referenteA contains RETIRADA/LUCRO
   */
  getContasPagas: publicProcedure
    .input(z.object({
      tipo: z.enum(["SERRAGEM", "ROJÃO"]),
      startDate: z.string().nullable(),
      endDate: z.string(),
    }))
    .query(async ({ input }) => {
      const { tipo, startDate, endDate } = input;
      return fetchContasPagar(tipo, startDate, endDate);
    }),
});
