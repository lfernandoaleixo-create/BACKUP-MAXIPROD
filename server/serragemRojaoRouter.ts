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

// Contas de destino dos sócios (Retirada)
// Serragem: 458=Gilson, 459=Fernando, 460=Bruno
// Rojão:    454=Gilson, 455=Fernando, 456=Bruno
const SOCIOS_CONTAS: Record<string, { nome: string; conta: string }> = {
  "458": { nome: "Gilson", conta: "458" },
  "459": { nome: "Fernando", conta: "459" },
  "460": { nome: "Bruno", conta: "460" },
  "454": { nome: "Gilson", conta: "454" },
  "455": { nome: "Fernando", conta: "455" },
  "456": { nome: "Bruno", conta: "456" },
};

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
  sociosDetalhado: Array<{ nome: string; conta: string; total: number; items: Array<{ data: string; valor: number; referenteA: string }> }>;
  contasPagasDetalhado: Array<{ data: string; valor: number; fornecedor: string; referenteA: string; descricao: string; contaDestino: string; isSocio: boolean }>;
  items: Array<{ data: string; valor: number; fornecedor: string; referenteA: string; descricao: string; contaDestino: string; isSocio: boolean }>;
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
            contaDeDestino { codigo descricao }
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
    const items: Array<{ data: string; valor: number; fornecedor: string; referenteA: string; descricao: string; contaDestino: string; isSocio: boolean }> = [];
    // Detalhamento por sócio: Gilson-458, Fernando-459, Bruno-460
    const sociosMap: Record<string, { nome: string; conta: string; total: number; items: Array<{ data: string; valor: number; referenteA: string }> }> = {
      "458": { nome: 'Gilson', conta: '458', total: 0, items: [] },
      "459": { nome: 'Fernando', conta: '459', total: 0, items: [] },
      "460": { nome: 'Bruno', conta: '460', total: 0, items: [] },
    };

    for (const item of allItems) {
      const valor = item.valorPagoLiquido || 0;
      totalContasPagas += valor;

      // Classificar como sócio pela conta de destino (454-460)
      const contaCodigo = item.contaDeDestino?.codigo || '';
      const isSocio = contaCodigo in SOCIOS_CONTAS;

      if (isSocio) {
        totalRetiradaSocios += valor;
        countSocios++;
        // Identificar qual sócio pela conta
        if (sociosMap[contaCodigo]) {
          sociosMap[contaCodigo].total += valor;
          sociosMap[contaCodigo].items.push({
            data: item.liquidacaoData?.slice(0, 10) || '-',
            valor: Math.round(valor * 100) / 100,
            referenteA: item.referenteA || '-',
          });
        }
      }

      items.push({
        data: item.liquidacaoData?.slice(0, 10) || '-',
        valor: Math.round(valor * 100) / 100,
        fornecedor: item.fornecedor?.apelido || item.fornecedor?.razaoSocial || '-',
        referenteA: item.referenteA || '-',
        descricao: item.referenteA || '-',
        contaDestino: item.contaDeDestino?.descricao || '-',
        isSocio,
      });
    }

    const totalBruto = Math.round(totalContasPagas * 100) / 100;
    const retiradaSocios = Math.round(totalRetiradaSocios * 100) / 100;
    // Contas Pagas = total bruto - retirada sócios (o menor valor)
    const contasPagas = Math.round((totalBruto - retiradaSocios) * 100) / 100;
    // Saídas Total = total bruto completo (o maior valor)
    const saidasTotal = totalBruto;

    console.log(`[Serragem/Rojão] ${tipo} Contas Pagas: R$ ${contasPagas.toFixed(2)} | Retirada Sócios: R$ ${retiradaSocios.toFixed(2)} | ${allItems.length} itens`);

    // Arredondar totais dos sócios
    const sociosDetalhado = Object.values(sociosMap).map(s => ({
      ...s,
      total: Math.round(s.total * 100) / 100,
    }));

    // Filtrar items não-sócios para detalhamento de Contas Pagas
    const contasPagasDetalhado = items.filter(i => !i.isSocio);

    return {
      contasPagas,
      retiradaSocios,
      saidasTotal,
      countTotal: allItems.length,
      countSocios,
      sociosDetalhado,
      contasPagasDetalhado,
      items,
    };
  } catch (error: any) {
    console.error(`[Serragem/Rojão] Error fetching contas a pagar ${tipo}:`, error.message);
    return { contasPagas: 0, retiradaSocios: 0, saidasTotal: 0, countTotal: 0, countSocios: 0, sociosDetalhado: [], contasPagasDetalhado: [], items: [] };
  }
}

/**
 * Fetch Contas a Receber RECEBIDO from Maxiprod for Serragem or Rojão
 * Serragem: cruzamento por NFs de estadoConfiguravel SERRAGEM + liquidação >= 2026-02-01
 * Rojão: será definido depois
 */
async function fetchRecebido(
  tipo: "SERRAGEM" | "ROJÃO",
  startDate: string | null,
  endDate: string
): Promise<{ total: number; count: number }> {
  try {
    const endISO = `${endDate}T23:59:59.999-03:00`;
    // Data fixa de início para Serragem: 2026-02-01
    const defaultStart = tipo === "SERRAGEM" ? "2026-02-01" : "2026-02-01";
    const effectiveStart = startDate || defaultStart;
    const startISO = `${effectiveStart}T00:00:00.000-03:00`;

    // Step 1: Get all NF numbers for this tipo
    let nfNumbers = new Set<string>();
    let skip = 0;
    const take = 1000;

    while (true) {
      const data = await gql<any>(`{
        notasFiscais(
          skip: ${skip}, take: ${take},
          where: {
            estado: { eq: EMITIDA }
            entradaOuSaida: { eq: SAIDA }
            estadoConfiguravel: { descricao: { eq: "${tipo}" } }
          }
        ) {
          totalCount
          items { numero }
        }
      }`);
      if (!data?.notasFiscais) break;
      data.notasFiscais.items.forEach((i: any) => nfNumbers.add(String(i.numero)));
      skip += take;
      if (skip >= data.notasFiscais.totalCount) break;
    }

    // Step 2: Get all recebidos within the date range
    let allRecebidos: any[] = [];
    skip = 0;

    while (true) {
      const data = await gql<any>(`{
        contaAReceber(
          skip: ${skip}, take: ${take},
          where: {
            estado: { eq: RECEBIDO },
            liquidacaoData: { gte: "${startISO}", lte: "${endISO}" }
          }
        ) {
          totalCount
          items {
            valorRecebidoLiquido
            documentoVinculadoNumero
          }
        }
      }`);
      if (!data?.contaAReceber) break;
      allRecebidos.push(...data.contaAReceber.items);
      skip += take;
      if (skip >= data.contaAReceber.totalCount) break;
    }

    // Step 3: Cross-reference - only keep items whose documentoVinculadoNumero matches NFs
    const matched = allRecebidos.filter(r => nfNumbers.has(r.documentoVinculadoNumero));
    const total = Math.round(matched.reduce((sum: number, i: any) => sum + (i.valorRecebidoLiquido || 0), 0) * 100) / 100;

    console.log(`[Serragem/Rojão] ${tipo} Recebido: R$ ${total.toFixed(2)} (${matched.length} itens, período: ${effectiveStart} a ${endDate})`);

    return { total, count: matched.length };
  } catch (error: any) {
    console.error(`[Serragem/Rojão] Error fetching recebido ${tipo}:`, error.message);
    return { total: 0, count: 0 };
  }
}

/**
 * Fetch "Total para Divisão à Receber" - Contas a Receber pendentes
 * Abordagem: cruzamento de NF IDs (notaFiscalId) do estadoConfiguravel com Contas a Receber EMITIDO
 * Usa notaFiscalId (ID único) ao invés de documentoVinculadoNumero (número da NF) para evitar
 * falsos positivos quando NFs de empresas diferentes compartilham o mesmo número.
 * ReceberEstado enum: EMITIDO = "A receber" na UI do Maxiprod
 * Sem filtro de data (todas as pendentes)
 */
async function fetchAReceber(
  tipo: "SERRAGEM" | "ROJÃO"
): Promise<{ total: number; count: number; items: Array<{ vencimento: string; valor: number; nfNumero: string; cliente: string }> }> {
  try {
    // Step 1: Get all NF IDs (unique identifiers) for this tipo
    let nfIds = new Set<string>();
    let skip = 0;
    const take = 1000;

    while (true) {
      const data = await gql<any>(`{
        notasFiscais(
          skip: ${skip}, take: ${take},
          where: {
            estado: { eq: EMITIDA }
            entradaOuSaida: { eq: SAIDA }
            estadoConfiguravel: { descricao: { eq: "${tipo}" } }
          }
        ) {
          totalCount
          items { id numero }
        }
      }`);
      if (!data?.notasFiscais) break;
      data.notasFiscais.items.forEach((i: any) => nfIds.add(String(i.id)));
      skip += take;
      if (skip >= data.notasFiscais.totalCount) break;
    }

    // Step 2: Get all EMITIDO (A receber) contas with notaFiscalId
    let allEmitido: any[] = [];
    skip = 0;

    while (true) {
      const data = await gql<any>(`{
        contaAReceber(
          skip: ${skip}, take: ${take},
          where: {
            estado: { eq: EMITIDO }
          }
        ) {
          totalCount
          items {
            valorLiquido
            notaFiscalId
            documentoVinculadoNumero
            vencimentoData
            cliente { nomeFantasia }
          }
        }
      }`);
      if (!data?.contaAReceber) break;
      allEmitido.push(...data.contaAReceber.items);
      skip += take;
      if (skip >= data.contaAReceber.totalCount) break;
    }

    // Step 3: Cross-reference using notaFiscalId (unique) instead of documentoVinculadoNumero
    const matched = allEmitido.filter(r => r.notaFiscalId && nfIds.has(String(r.notaFiscalId)));
    const total = Math.round(matched.reduce((sum: number, i: any) => sum + (i.valorLiquido || 0), 0) * 100) / 100;
    const items = matched.map((i: any) => ({
      vencimento: i.vencimentoData?.split("T")[0] || "",
      valor: i.valorLiquido || 0,
      nfNumero: i.documentoVinculadoNumero || "",
      cliente: i.cliente?.nomeFantasia || "",
    }));

    console.log(`[Serragem/Rojão] ${tipo} A Receber: R$ ${total.toFixed(2)} (${items.length} itens, ${nfIds.size} NFs)`);

    return { total, count: items.length, items };
  } catch (error: any) {
    console.error(`[Serragem/Rojão] Error fetching a receber ${tipo}:`, error.message);
    return { total: 0, count: 0, items: [] };
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
   * Get Recebido for Serragem or Rojão
   * Source: Maxiprod → Financeiro → Contas a Receber
   * Filters: estado=RECEBIDO, liquidação >= 2026-02-01, cruzamento com NFs do estadoConfiguravel
   */
  getRecebido: publicProcedure
    .input(z.object({
      tipo: z.enum(["SERRAGEM", "ROJÃO"]),
      startDate: z.string().nullable(),
      endDate: z.string(),
    }))
    .query(async ({ input }) => {
      const { tipo, startDate, endDate } = input;
      return fetchRecebido(tipo, startDate, endDate);
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

  /**
   * Get Total para Divisão à Receber
   * Source: Maxiprod → Financeiro → Contas a Receber
   * Filters: estado=A_RECEBER, estadoConfiguravel=SERRAGEM/ROJÃO, sem filtro de data
   */
  getAReceber: publicProcedure
    .input(z.object({
      tipo: z.enum(["SERRAGEM", "ROJÃO"]),
    }))
    .query(async ({ input }) => {
      return fetchAReceber(input.tipo);
    }),
});
