/**
 * proposalRouter - CRUD para Propostas de Venda
 * Salvar, listar, editar, duplicar e converter em pedido
 */
import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { proposals } from "../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";

export const proposalRouter = router({
  // Listar propostas de um vendedor
  list: publicProcedure
    .input(z.object({ sellerId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select()
        .from(proposals)
        .where(eq(proposals.sellerId, input.sellerId))
        .orderBy(desc(proposals.createdAt));
      return rows;
    }),

  // Buscar uma proposta pelo ID
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [row] = await db
        .select()
        .from(proposals)
        .where(eq(proposals.id, input.id));
      return row || null;
    }),

  // Criar nova proposta
  create: publicProcedure
    .input(z.object({
      sellerId: z.number(),
      sellerName: z.string(),
      cnpjCpf: z.string().optional(),
      razaoSocial: z.string(),
      nomeFantasia: z.string().optional(),
      inscricaoEstadual: z.string().optional(),
      cep: z.string().optional(),
      endereco: z.string().optional(),
      numero: z.string().optional(),
      bairro: z.string().optional(),
      municipio: z.string().optional(),
      uf: z.string().optional(),
      telefone: z.string().optional(),
      emailContato: z.string().optional(),
      enderecoEntregaDiferente: z.boolean().optional(),
      entregaCep: z.string().optional(),
      entregaLogradouro: z.string().optional(),
      entregaNumero: z.string().optional(),
      entregaBairro: z.string().optional(),
      entregaCidade: z.string().optional(),
      entregaUf: z.string().optional(),
      formaPagamento: z.string().optional(),
      meioPagamento: z.string().optional(),
      condicaoPagamento: z.string().optional(),
      valorFrete: z.string().optional(),
      tipoFrete: z.string().optional(),
      transportadora: z.string().optional(),
      observacoes: z.string().optional(),
      validadeDias: z.number().optional(),
      dataValidade: z.string().optional(),
      items: z.array(z.any()),
      totalProdutos: z.number(),
      totalPedido: z.number(),
      pdfUrl: z.string().optional(),
      operatorId: z.number().optional(),
      operatorName: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [result] = await db.insert(proposals).values({
        sellerId: input.sellerId,
        sellerName: input.sellerName,
        status: "rascunho",
        cnpjCpf: input.cnpjCpf || null,
        razaoSocial: input.razaoSocial,
        nomeFantasia: input.nomeFantasia || null,
        inscricaoEstadual: input.inscricaoEstadual || null,
        cep: input.cep || null,
        endereco: input.endereco || null,
        numero: input.numero || null,
        bairro: input.bairro || null,
        municipio: input.municipio || null,
        uf: input.uf || null,
        telefone: input.telefone || null,
        emailContato: input.emailContato || null,
        enderecoEntregaDiferente: input.enderecoEntregaDiferente || false,
        entregaCep: input.entregaCep || null,
        entregaLogradouro: input.entregaLogradouro || null,
        entregaNumero: input.entregaNumero || null,
        entregaBairro: input.entregaBairro || null,
        entregaCidade: input.entregaCidade || null,
        entregaUf: input.entregaUf || null,
        formaPagamento: input.formaPagamento || null,
        meioPagamento: input.meioPagamento || null,
        condicaoPagamento: input.condicaoPagamento || null,
        valorFrete: input.valorFrete || null,
        tipoFrete: input.tipoFrete || null,
        transportadora: input.transportadora || null,
        observacoes: input.observacoes || null,
        validadeDias: input.validadeDias || 30,
        dataValidade: input.dataValidade || null,
        items: input.items,
        totalProdutos: String(input.totalProdutos),
        totalPedido: String(input.totalPedido),
        pdfUrl: input.pdfUrl || null,
        operatorId: input.operatorId || null,
        operatorName: input.operatorName || null,
      });
      return { success: true, id: result.insertId };
    }),

  // Atualizar proposta existente
  update: publicProcedure
    .input(z.object({
      id: z.number(),
      cnpjCpf: z.string().optional(),
      razaoSocial: z.string().optional(),
      nomeFantasia: z.string().optional(),
      inscricaoEstadual: z.string().optional(),
      cep: z.string().optional(),
      endereco: z.string().optional(),
      numero: z.string().optional(),
      bairro: z.string().optional(),
      municipio: z.string().optional(),
      uf: z.string().optional(),
      telefone: z.string().optional(),
      emailContato: z.string().optional(),
      enderecoEntregaDiferente: z.boolean().optional(),
      entregaCep: z.string().optional(),
      entregaLogradouro: z.string().optional(),
      entregaNumero: z.string().optional(),
      entregaBairro: z.string().optional(),
      entregaCidade: z.string().optional(),
      entregaUf: z.string().optional(),
      formaPagamento: z.string().optional(),
      meioPagamento: z.string().optional(),
      condicaoPagamento: z.string().optional(),
      valorFrete: z.string().optional(),
      tipoFrete: z.string().optional(),
      transportadora: z.string().optional(),
      observacoes: z.string().optional(),
      validadeDias: z.number().optional(),
      dataValidade: z.string().optional(),
      items: z.array(z.any()).optional(),
      totalProdutos: z.number().optional(),
      totalPedido: z.number().optional(),
      pdfUrl: z.string().optional(),
      status: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { id, ...data } = input;
      const updateData: any = {};
      if (data.razaoSocial !== undefined) updateData.razaoSocial = data.razaoSocial;
      if (data.cnpjCpf !== undefined) updateData.cnpjCpf = data.cnpjCpf || null;
      if (data.nomeFantasia !== undefined) updateData.nomeFantasia = data.nomeFantasia || null;
      if (data.inscricaoEstadual !== undefined) updateData.inscricaoEstadual = data.inscricaoEstadual || null;
      if (data.cep !== undefined) updateData.cep = data.cep || null;
      if (data.endereco !== undefined) updateData.endereco = data.endereco || null;
      if (data.numero !== undefined) updateData.numero = data.numero || null;
      if (data.bairro !== undefined) updateData.bairro = data.bairro || null;
      if (data.municipio !== undefined) updateData.municipio = data.municipio || null;
      if (data.uf !== undefined) updateData.uf = data.uf || null;
      if (data.telefone !== undefined) updateData.telefone = data.telefone || null;
      if (data.emailContato !== undefined) updateData.emailContato = data.emailContato || null;
      if (data.enderecoEntregaDiferente !== undefined) updateData.enderecoEntregaDiferente = data.enderecoEntregaDiferente;
      if (data.entregaCep !== undefined) updateData.entregaCep = data.entregaCep || null;
      if (data.entregaLogradouro !== undefined) updateData.entregaLogradouro = data.entregaLogradouro || null;
      if (data.entregaNumero !== undefined) updateData.entregaNumero = data.entregaNumero || null;
      if (data.entregaBairro !== undefined) updateData.entregaBairro = data.entregaBairro || null;
      if (data.entregaCidade !== undefined) updateData.entregaCidade = data.entregaCidade || null;
      if (data.entregaUf !== undefined) updateData.entregaUf = data.entregaUf || null;
      if (data.formaPagamento !== undefined) updateData.formaPagamento = data.formaPagamento || null;
      if (data.meioPagamento !== undefined) updateData.meioPagamento = data.meioPagamento || null;
      if (data.condicaoPagamento !== undefined) updateData.condicaoPagamento = data.condicaoPagamento || null;
      if (data.valorFrete !== undefined) updateData.valorFrete = data.valorFrete || null;
      if (data.tipoFrete !== undefined) updateData.tipoFrete = data.tipoFrete || null;
      if (data.transportadora !== undefined) updateData.transportadora = data.transportadora || null;
      if (data.observacoes !== undefined) updateData.observacoes = data.observacoes || null;
      if (data.validadeDias !== undefined) updateData.validadeDias = data.validadeDias;
      if (data.dataValidade !== undefined) updateData.dataValidade = data.dataValidade || null;
      if (data.items !== undefined) updateData.items = data.items;
      if (data.totalProdutos !== undefined) updateData.totalProdutos = String(data.totalProdutos);
      if (data.totalPedido !== undefined) updateData.totalPedido = String(data.totalPedido);
      if (data.pdfUrl !== undefined) updateData.pdfUrl = data.pdfUrl || null;
      if (data.status !== undefined) updateData.status = data.status;
      await db.update(proposals).set(updateData).where(eq(proposals.id, id));
      return { success: true };
    }),

  // Marcar como convertida em pedido
  markConverted: publicProcedure
    .input(z.object({
      id: z.number(),
      orderId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.update(proposals).set({
        status: "convertida",
        convertedToOrderId: input.orderId,
        convertedAt: new Date(),
      }).where(eq(proposals.id, input.id));
      return { success: true };
    }),

  // Duplicar proposta
  duplicate: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [original] = await db.select().from(proposals).where(eq(proposals.id, input.id));
      if (!original) throw new Error("Proposta não encontrada");
      const [result] = await db.insert(proposals).values({
        sellerId: original.sellerId,
        sellerName: original.sellerName,
        status: "rascunho",
        cnpjCpf: original.cnpjCpf,
        razaoSocial: original.razaoSocial,
        nomeFantasia: original.nomeFantasia,
        inscricaoEstadual: original.inscricaoEstadual,
        cep: original.cep,
        endereco: original.endereco,
        numero: original.numero,
        bairro: original.bairro,
        municipio: original.municipio,
        uf: original.uf,
        telefone: original.telefone,
        emailContato: original.emailContato,
        enderecoEntregaDiferente: original.enderecoEntregaDiferente,
        entregaCep: original.entregaCep,
        entregaLogradouro: original.entregaLogradouro,
        entregaNumero: original.entregaNumero,
        entregaBairro: original.entregaBairro,
        entregaCidade: original.entregaCidade,
        entregaUf: original.entregaUf,
        formaPagamento: original.formaPagamento,
        meioPagamento: original.meioPagamento,
        condicaoPagamento: original.condicaoPagamento,
        valorFrete: original.valorFrete,
        tipoFrete: original.tipoFrete,
        transportadora: original.transportadora,
        observacoes: original.observacoes,
        validadeDias: original.validadeDias,
        dataValidade: original.dataValidade,
        items: original.items,
        totalProdutos: original.totalProdutos,
        totalPedido: original.totalPedido,
        pdfUrl: null,
        operatorId: original.operatorId,
        operatorName: original.operatorName,
      });
      return { success: true, id: result.insertId };
    }),

  // Deletar proposta
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(proposals).where(eq(proposals.id, input.id));
      return { success: true };
    }),
});
