/**
 * Suppliers Router - Fornecedores Brasileiros
 * Procedures for listing suppliers, recording contacts, and ranking vendedores
 */
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { suppliers, supplierContacts } from "../drizzle/schema";
import { sql, eq, and, desc } from "drizzle-orm";

export const suppliersRouter = router({
  /**
   * Get distinct segments
   */
  getSegments: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const result = await db
      .selectDistinct({ segmento: suppliers.segmento })
      .from(suppliers)
      .orderBy(suppliers.segmento);
    return result.map(r => r.segmento);
  }),

  /**
   * Get states for a given segment
   */
  getStates: publicProcedure
    .input(z.object({ segmento: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const result = await db
        .selectDistinct({ estado: suppliers.estado })
        .from(suppliers)
        .where(eq(suppliers.segmento, input.segmento))
        .orderBy(suppliers.estado);
      return result.map(r => r.estado);
    }),

  /**
   * Get suppliers for a given segment + state
   */
  getSuppliers: publicProcedure
    .input(z.object({
      segmento: z.string(),
      estado: z.string(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const result = await db
        .select()
        .from(suppliers)
        .where(and(
          eq(suppliers.segmento, input.segmento),
          eq(suppliers.estado, input.estado)
        ))
        .orderBy(suppliers.nome);
      
      // Get contact counts per supplier
      if (result.length === 0) return [];
      
      const supplierIds = result.map(r => sql`${r.id}`);
      const contactCounts = await db
        .select({
          supplierId: supplierContacts.supplierId,
          count: sql<number>`count(*)`.as('count'),
        })
        .from(supplierContacts)
        .where(sql`${supplierContacts.supplierId} IN (${sql.join(supplierIds, sql`, `)})`)
        .groupBy(supplierContacts.supplierId);
      
      // Get contact details (vendedor + date) per supplier
      const contactDetails = await db
        .select({
          supplierId: supplierContacts.supplierId,
          vendedor: supplierContacts.vendedor,
          formaContato: supplierContacts.formaContato,
          createdAt: supplierContacts.createdAt,
        })
        .from(supplierContacts)
        .where(sql`${supplierContacts.supplierId} IN (${sql.join(supplierIds, sql`, `)})`)
        .orderBy(desc(supplierContacts.createdAt));
      
      const countMap = new Map(contactCounts.map(c => [c.supplierId, c.count]));
      const detailsMap = new Map<number, Array<{vendedor: string; formaContato: string; createdAt: Date | number}>>();
      for (const d of contactDetails) {
        if (!detailsMap.has(d.supplierId)) detailsMap.set(d.supplierId, []);
        detailsMap.get(d.supplierId)!.push({ vendedor: d.vendedor, formaContato: d.formaContato, createdAt: d.createdAt });
      }
      
      return result.map(r => ({
        ...r,
        contactCount: countMap.get(r.id) || 0,
        contactHistory: detailsMap.get(r.id) || [],
      }));
    }),

  /**
   * Get contacts for a specific supplier
   */
  getSupplierContacts: publicProcedure
    .input(z.object({ supplierId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const result = await db
        .select()
        .from(supplierContacts)
        .where(eq(supplierContacts.supplierId, input.supplierId))
        .orderBy(desc(supplierContacts.createdAt));
      return result;
    }),

  /**
   * Record a contact with a supplier
   */
  addContact: publicProcedure
    .input(z.object({
      supplierId: z.number(),
      vendedor: z.string(),
      formaContato: z.enum(["ligacao", "email", "whatsapp", "outra"]),
      formaContatoOutra: z.string().optional(),
      observacao: z.string().optional(),
      status: z.enum(["ja_cliente", "possivel_cliente", "novo_cliente", "sem_interesse", "nao_possivel_contato"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.insert(supplierContacts).values({
        supplierId: input.supplierId,
        vendedor: input.vendedor,
        formaContato: input.formaContato,
        formaContatoOutra: input.formaContatoOutra || null,
        observacao: input.observacao || null,
        status: input.status,
      });
      return { success: true };
    }),

  /**
   * Get all contacts grouped by status (for status cards)
   */
  getContactsByStatus: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    // Only show the LATEST contact per supplier (so each supplier appears in only one status card)
    const contacts = await db
      .select({
        id: supplierContacts.id,
        supplierId: supplierContacts.supplierId,
        vendedor: supplierContacts.vendedor,
        formaContato: supplierContacts.formaContato,
        formaContatoOutra: supplierContacts.formaContatoOutra,
        observacao: supplierContacts.observacao,
        status: supplierContacts.status,
        createdAt: supplierContacts.createdAt,
        supplierNome: suppliers.nome,
        supplierEstado: suppliers.estado,
        supplierSegmento: suppliers.segmento,
        supplierCidade: suppliers.cidade,
      })
      .from(supplierContacts)
      .innerJoin(suppliers, eq(supplierContacts.supplierId, suppliers.id))
      .where(
        sql`${supplierContacts.createdAt} = (SELECT MAX(sc2.createdAt) FROM supplier_contacts sc2 WHERE sc2.supplierId = ${supplierContacts.supplierId})`
      )
      .orderBy(desc(supplierContacts.createdAt));
    return contacts;
  }),

  /**
   * Get vendedor ranking with contact counts and efficiency
   */
  getVendedorRanking: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    // Total contacts per vendedor (all contacts, not just latest)
    const result = await db
      .select({
        vendedor: supplierContacts.vendedor,
        totalContatos: sql<number>`COUNT(*)`.as("totalContatos"),
        novosClientes: sql<number>`SUM(CASE WHEN ${supplierContacts.status} = 'novo_cliente' THEN 1 ELSE 0 END)`.as("novosClientes"),
        possiveisClientes: sql<number>`SUM(CASE WHEN ${supplierContacts.status} = 'possivel_cliente' THEN 1 ELSE 0 END)`.as("possiveisClientes"),
        jaClientes: sql<number>`SUM(CASE WHEN ${supplierContacts.status} = 'ja_cliente' THEN 1 ELSE 0 END)`.as("jaClientes"),
        semInteresse: sql<number>`SUM(CASE WHEN ${supplierContacts.status} = 'sem_interesse' THEN 1 ELSE 0 END)`.as("semInteresse"),
        naoPossivelContato: sql<number>`SUM(CASE WHEN ${supplierContacts.status} = 'nao_possivel_contato' THEN 1 ELSE 0 END)`.as("naoPossivelContato"),
        // Conversions: count suppliers where this vendedor made the LATEST contact and that contact converted to novo_cliente
        conversoes: sql<number>`SUM(CASE WHEN ${supplierContacts.status} = 'novo_cliente' AND ${supplierContacts.createdAt} = (SELECT MAX(sc3.createdAt) FROM supplier_contacts sc3 WHERE sc3.supplierId = ${supplierContacts.supplierId}) THEN 1 ELSE 0 END)`.as("conversoes"),
      })
      .from(supplierContacts)
      .groupBy(supplierContacts.vendedor)
      .orderBy(sql`COUNT(*) DESC`);
    return result;
  }),

  /**
   * Get contacts for a specific vendedor (detail view)
   */
  getVendedorContacts: publicProcedure
    .input(z.object({ vendedor: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const contacts = await db
        .select({
          id: supplierContacts.id,
          supplierId: supplierContacts.supplierId,
          vendedor: supplierContacts.vendedor,
          formaContato: supplierContacts.formaContato,
          formaContatoOutra: supplierContacts.formaContatoOutra,
          observacao: supplierContacts.observacao,
          status: supplierContacts.status,
          createdAt: supplierContacts.createdAt,
          supplierNome: suppliers.nome,
          supplierEstado: suppliers.estado,
          supplierSegmento: suppliers.segmento,
          supplierCidade: suppliers.cidade,
        })
        .from(supplierContacts)
        .innerJoin(suppliers, eq(supplierContacts.supplierId, suppliers.id))
        .where(eq(supplierContacts.vendedor, input.vendedor))
        .orderBy(desc(supplierContacts.createdAt));
      return contacts;
    }),

  /**
   * Get overview stats
   */
  getStats: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const [totalSuppliers] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(suppliers);
    const [totalContacts] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(supplierContacts);
    // Count by LATEST status per supplier (each supplier only counts once, in its most recent status)
    const [statusCounts] = await db
      .select({
        jaCliente: sql<number>`SUM(CASE WHEN latest_status = 'ja_cliente' THEN 1 ELSE 0 END)`,
        possivelCliente: sql<number>`SUM(CASE WHEN latest_status = 'possivel_cliente' THEN 1 ELSE 0 END)`,
        novoCliente: sql<number>`SUM(CASE WHEN latest_status = 'novo_cliente' THEN 1 ELSE 0 END)`,
        semInteresse: sql<number>`SUM(CASE WHEN latest_status = 'sem_interesse' THEN 1 ELSE 0 END)`,
        naoPossivelContato: sql<number>`SUM(CASE WHEN latest_status = 'nao_possivel_contato' THEN 1 ELSE 0 END)`,
      })
      .from(
        sql`(SELECT supplierId, status AS latest_status FROM supplier_contacts sc1 WHERE createdAt = (SELECT MAX(createdAt) FROM supplier_contacts sc2 WHERE sc2.supplierId = sc1.supplierId)) AS latest`
      );
    return {
      totalSuppliers: totalSuppliers.count,
      totalContacts: totalContacts.count,
      jaCliente: statusCounts?.jaCliente || 0,
      possivelCliente: statusCounts?.possivelCliente || 0,
      novoCliente: statusCounts?.novoCliente || 0,
      semInteresse: statusCounts?.semInteresse || 0,
      naoPossivelContato: statusCounts?.naoPossivelContato || 0,
    };
  }),

  /**
   * Get migration history - all contacts showing status transitions over time
   * For each supplier with multiple contacts, shows the status change timeline
   */
  getMigrationHistory: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    // Get all contacts ordered by date desc, with supplier info
    const allContacts = await db
      .select({
        id: supplierContacts.id,
        supplierId: supplierContacts.supplierId,
        vendedor: supplierContacts.vendedor,
        formaContato: supplierContacts.formaContato,
        formaContatoOutra: supplierContacts.formaContatoOutra,
        observacao: supplierContacts.observacao,
        status: supplierContacts.status,
        createdAt: supplierContacts.createdAt,
        supplierNome: suppliers.nome,
        supplierEstado: suppliers.estado,
        supplierSegmento: suppliers.segmento,
        supplierCidade: suppliers.cidade,
      })
      .from(supplierContacts)
      .innerJoin(suppliers, eq(supplierContacts.supplierId, suppliers.id))
      .orderBy(desc(supplierContacts.createdAt));
    
    // Group by supplier to detect migrations
    const bySupplier = new Map<number, typeof allContacts>();
    for (const c of allContacts) {
      if (!bySupplier.has(c.supplierId)) bySupplier.set(c.supplierId, []);
      bySupplier.get(c.supplierId)!.push(c);
    }
    
    // Build migration entries: for each contact, if there's a previous contact with different status, it's a migration
    const migrations: Array<{
      id: number;
      supplierId: number;
      supplierNome: string;
      supplierEstado: string;
      supplierSegmento: string;
      vendedor: string;
      statusAnterior: string | null;
      statusNovo: string;
      formaContato: string;
      formaContatoOutra: string | null;
      observacao: string | null;
      createdAt: Date;
    }> = [];
    
    Array.from(bySupplier.values()).forEach((contacts) => {
      // contacts are ordered desc by date
      for (let i = 0; i < contacts.length; i++) {
        const current = contacts[i];
        const previous = contacts[i + 1]; // older contact
        migrations.push({
          id: current.id,
          supplierId: current.supplierId,
          supplierNome: current.supplierNome,
          supplierEstado: current.supplierEstado,
          supplierSegmento: current.supplierSegmento,
          vendedor: current.vendedor,
          statusAnterior: previous ? previous.status : null,
          statusNovo: current.status,
          formaContato: current.formaContato,
          formaContatoOutra: current.formaContatoOutra,
          observacao: current.observacao,
          createdAt: current.createdAt,
        });
      }
    });
    
    // Sort by date desc
    migrations.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return migrations;
  }),
});
