/**
 * Sync all client data from Maxiprod GraphQL into vendor_clients table.
 * Fetches: CNPJ, IE, endereço, telefone, email, representante, etc.
 * Links each client to the correct seller via representanteOuVendedor1Preferencial.
 */
import { gql, normalizeVendedorName } from "./maxiprodGraphQL";
import { getDb } from "./db";
import { vendorClients, sellerPermissions } from "../drizzle/schema";
import { sql, eq } from "drizzle-orm";

const PAGE_SIZE = 200;

interface MaxiprodEmpresa {
  id: number;
  nomeFantasia: string | null;
  razaoSocial: string | null;
  apelido: string | null;
  cnpjOuCpf: string | null;
  inscricaoEstadual: string | null;
  inscricaoEstadualTipo: string | null;
  regimeTributario: string | null;
  inscricaoMunicipal: string | null;
  inscricaoSuframa: string | null;
  emailParaEnvioDeDocumentosFiscais: string | null;
  website: string | null;
  limiteDeCredito: number | null;
  crmSegmento: { descricao: string } | null;
  endereco: {
    logradouro: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cep: string | null;
    telefone1: string | null;
    telefone2: string | null;
    email: string | null;
    municipio: {
      descricao: string | null;
      uf: { sigla: string } | null;
    } | null;
  } | null;
  formaDeCobrancaPreferencial: {
    boletoProtestarOuNegativar: string | null;
    meioDePagamento: string | null;
  } | null;
  condicaoDePagamentoPreferencial: string | null;
  representanteOuVendedor1Preferencial: {
    nomeFantasia: string | null;
    razaoSocial: string | null;
  } | null;
  enderecoDeEntrega: {
    logradouro: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cep: string | null;
    telefone1: string | null;
    municipio: {
      descricao: string | null;
      uf: { sigla: string } | null;
    } | null;
  } | null;
  representanteOuVendedor2Preferencial: {
    nomeFantasia: string | null;
    razaoSocial: string | null;
  } | null;
}

const EMPRESAS_QUERY = (skip: number) => `{
  empresas(skip: ${skip}, take: ${PAGE_SIZE}, where: { cliente: { eq: true } }) {
    totalCount
    items {
      id
      nomeFantasia
      razaoSocial
      apelido
      cnpjOuCpf
      inscricaoEstadual
      inscricaoEstadualTipo
      regimeTributario
      inscricaoMunicipal
      inscricaoSuframa
      emailParaEnvioDeDocumentosFiscais
      website
      limiteDeCredito
      crmSegmento { descricao }
      formaDeCobrancaPreferencial { boletoProtestarOuNegativar meioDePagamento }
      condicaoDePagamentoPreferencial
      endereco {
        logradouro
        numero
        complemento
        bairro
        cep
        telefone1
        telefone2
        email
        municipio {
          descricao
          uf { sigla }
        }
      }
      enderecoDeEntrega {
        logradouro
        numero
        complemento
        bairro
        cep
        telefone1
        municipio {
          descricao
          uf { sigla }
        }
      }
      representanteOuVendedor1Preferencial { nomeFantasia razaoSocial }
      representanteOuVendedor2Preferencial { nomeFantasia razaoSocial }
    }
  }
}`;

export async function syncClientsFromMaxiprod(): Promise<{ synced: number; errors: number; total: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  console.log("[ClientSync] Starting full client sync from Maxiprod...");

  // Build seller name → id map from seller_permissions
  const sellers = await db.select({
    id: sellerPermissions.id,
    sellerName: sellerPermissions.sellerName,
  }).from(sellerPermissions);

  const sellerMap: Record<string, number> = {};
  for (const s of sellers) {
    sellerMap[s.sellerName.toUpperCase()] = s.id;
  }
  // Smart seller lookup: handles partial names (e.g. "LÍVIA PINHEIRO" matches "LÍVIA")
  const findSellerId = (name: string): number => {
    const upper = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    // Exact match first
    for (const [key, id] of Object.entries(sellerMap)) {
      const keyNorm = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
      if (keyNorm === upper) return id;
    }
    // Partial match: first name or starts-with
    for (const [key, id] of Object.entries(sellerMap)) {
      const keyNorm = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
      if (upper.startsWith(keyNorm + " ") || keyNorm.startsWith(upper + " ")) return id;
      const keyFirst = keyNorm.split(" ")[0];
      const nameFirst = upper.split(" ")[0];
      if (keyFirst === nameFirst && keyFirst.length >= 4) return id;
    }
    return 0;
  };

  let skip = 0;
  let totalCount = 0;
  let synced = 0;
  let errors = 0;
  const allEmpresas: MaxiprodEmpresa[] = [];

  // Fetch all pages
  do {
    const data = await gql<{ empresas: { totalCount: number; items: MaxiprodEmpresa[] } }>(EMPRESAS_QUERY(skip));
    if (!data?.empresas) break;
    totalCount = data.empresas.totalCount;
    allEmpresas.push(...data.empresas.items);
    skip += PAGE_SIZE;
    console.log(`[ClientSync] Fetched ${allEmpresas.length}/${totalCount} empresas...`);
  } while (skip < totalCount);

  console.log(`[ClientSync] Total fetched: ${allEmpresas.length} empresas. Processing...`);

  // Process in batches of 50
  const BATCH_SIZE = 50;
  for (let i = 0; i < allEmpresas.length; i += BATCH_SIZE) {
    const batch = allEmpresas.slice(i, i + BATCH_SIZE);
    
    for (const emp of batch) {
      try {
        if (!emp.cnpjOuCpf && !emp.razaoSocial) continue;

        // Resolve seller
        const rep = emp.representanteOuVendedor1Preferencial;
        let sellerName = "";
        let sellerId = 0;

        if (rep) {
          const repName = rep.nomeFantasia || rep.razaoSocial || "";
          if (repName) {
            sellerName = normalizeVendedorName(repName);
            sellerId = findSellerId(sellerName);
          }
        }

        // Also check representante 2 if no match
        if (!sellerId && emp.representanteOuVendedor2Preferencial) {
          const rep2 = emp.representanteOuVendedor2Preferencial;
          const rep2Name = rep2.nomeFantasia || rep2.razaoSocial || "";
          if (rep2Name) {
            const normalized2 = normalizeVendedorName(rep2Name);
            const id2 = findSellerId(normalized2);
            if (id2) {
              sellerName = normalized2;
              sellerId = id2;
            }
          }
        }

        // If no seller found, skip (we only want clients linked to a known seller)
        if (!sellerId) continue;

        const clientData = {
          sellerId,
          sellerName,
          cnpjCpf: emp.cnpjOuCpf || "",
          razaoSocial: emp.razaoSocial || emp.nomeFantasia || "SEM NOME",
          nomeFantasia: emp.nomeFantasia || null,
          inscricaoEstadual: emp.inscricaoEstadual || null,
          tipoContribuinte: emp.inscricaoEstadualTipo || null,
          regimeTributario: emp.regimeTributario || null,
          inscricaoMunicipal: emp.inscricaoMunicipal || null,
          inscricaoSuframa: emp.inscricaoSuframa || null,
          cnaeFiscal: null,
          emailNfe: emp.emailParaEnvioDeDocumentosFiscais || null,
          website: emp.website || null,
          limiteCredito: emp.limiteDeCredito ? String(emp.limiteDeCredito) : null,
          cep: emp.endereco?.cep || null,
          logradouro: emp.endereco?.logradouro || null,
          numero: emp.endereco?.numero || null,
          complemento: emp.endereco?.complemento || null,
          bairro: emp.endereco?.bairro || null,
          cidade: emp.endereco?.municipio?.descricao || null,
          uf: emp.endereco?.municipio?.uf?.sigla || null,
          telefone1: emp.endereco?.telefone1 || null,
          telefone2: emp.endereco?.telefone2 || null,
          email: emp.endereco?.email || null,
          // Endereço de entrega (se diferente do principal)
          enderecoEntregaMesmo: emp.enderecoDeEntrega?.cep ? 0 : 1,
          entregaCep: emp.enderecoDeEntrega?.cep || null,
          entregaLogradouro: emp.enderecoDeEntrega?.logradouro || null,
          entregaNumero: emp.enderecoDeEntrega?.numero || null,
          entregaComplemento: emp.enderecoDeEntrega?.complemento || null,
          entregaBairro: emp.enderecoDeEntrega?.bairro || null,
          entregaCidade: emp.enderecoDeEntrega?.municipio?.descricao || null,
          entregaUf: emp.enderecoDeEntrega?.municipio?.uf?.sigla || null,
          entregaTelefone: emp.enderecoDeEntrega?.telefone1 || null,
          segmento: emp.crmSegmento?.descricao || null,
          // Cobrança - mapear boletoProtestarOuNegativar para situacaoCobranca
          situacaoCobranca: emp.formaDeCobrancaPreferencial?.boletoProtestarOuNegativar
            ? (emp.formaDeCobrancaPreferencial.boletoProtestarOuNegativar === "PROTESTAR" || emp.formaDeCobrancaPreferencial.boletoProtestarOuNegativar === "NEGATIVAR"
              ? "COM PROTESTO" : "SEM PROTESTO")
            : null,
          // Forma de cobrança - mapear meioDePagamento
          formaCobranca: emp.formaDeCobrancaPreferencial?.meioDePagamento
            ? emp.formaDeCobrancaPreferencial.meioDePagamento.replace(/_/g, " ")
            : null,
          // Condição de pagamento preferencial
          condicaoPagamento: emp.condicaoDePagamentoPreferencial || null,
          maxiprodId: emp.id,
          source: "maxiprod" as const,
          lastModifiedBy: "SYNC_MAXIPROD",
        };

        // Check if already exists by maxiprodId
        const [existing] = await db.select({ id: vendorClients.id })
          .from(vendorClients)
          .where(eq(vendorClients.maxiprodId, emp.id))
          .limit(1);

        if (existing) {
          // Update existing - check if manually edited by a vendedor
          const [fullExisting] = await db.select().from(vendorClients)
            .where(eq(vendorClients.id, existing.id)).limit(1);
          if (fullExisting && fullExisting.lastModifiedBy && fullExisting.lastModifiedBy !== "SYNC_MAXIPROD") {
            // Client was manually edited - only fill NULL/empty fields, don't overwrite
            const fillGaps: Record<string, any> = { updatedAt: new Date() };
            for (const [key, value] of Object.entries(clientData)) {
              if (key === 'source' || key === 'lastModifiedBy') continue;
              const existingValue = (fullExisting as any)[key];
              if ((existingValue === null || existingValue === undefined || existingValue === '') && value != null && value !== '') {
                fillGaps[key] = value;
              }
            }
            if (clientData.maxiprodId) fillGaps.maxiprodId = clientData.maxiprodId;
            await db.update(vendorClients).set(fillGaps).where(eq(vendorClients.id, existing.id));
          } else {
            // Not manually edited - safe to overwrite with Maxiprod data
            await db.update(vendorClients)
              .set({ ...clientData, updatedAt: new Date() })
              .where(eq(vendorClients.id, existing.id));
          }
        } else {
          // Also check by CNPJ to avoid duplicates from manual entries
          if (emp.cnpjOuCpf) {
            const cnpjLimpo = emp.cnpjOuCpf.replace(/[^\d]/g, "");
            if (cnpjLimpo.length >= 11) {
              const [existingByCnpj] = await db.select({ id: vendorClients.id, source: vendorClients.source, lastModifiedBy: vendorClients.lastModifiedBy })
                .from(vendorClients)
                .where(sql`REPLACE(REPLACE(REPLACE(${vendorClients.cnpjCpf}, '.', ''), '-', ''), '/', '') = ${cnpjLimpo}`)
                .limit(1);

              if (existingByCnpj) {
                if (existingByCnpj.lastModifiedBy && existingByCnpj.lastModifiedBy !== "SYNC_MAXIPROD") {
                  // Client was manually edited - only fill gaps
                  const [fullExistingCnpj] = await db.select().from(vendorClients)
                    .where(eq(vendorClients.id, existingByCnpj.id)).limit(1);
                  const fillGaps: Record<string, any> = { updatedAt: new Date() };
                  if (fullExistingCnpj) {
                    for (const [key, value] of Object.entries(clientData)) {
                      if (key === 'source' || key === 'lastModifiedBy') continue;
                      const existingValue = (fullExistingCnpj as any)[key];
                      if ((existingValue === null || existingValue === undefined || existingValue === '') && value != null && value !== '') {
                        fillGaps[key] = value;
                      }
                    }
                  }
                  if (clientData.maxiprodId) fillGaps.maxiprodId = clientData.maxiprodId;
                  if (existingByCnpj.source === "manual") fillGaps.source = "manual";
                  await db.update(vendorClients).set(fillGaps).where(eq(vendorClients.id, existingByCnpj.id));
                } else {
                  // Not manually edited - safe to overwrite
                  await db.update(vendorClients)
                    .set({
                      ...clientData,
                      source: existingByCnpj.source === "manual" ? "manual" : "maxiprod",
                      updatedAt: new Date(),
                    })
                    .where(eq(vendorClients.id, existingByCnpj.id));
                }
                synced++;
                continue;
              }
            }
          }

          // Insert new
          await db.insert(vendorClients).values(clientData);
        }
        synced++;
      } catch (err: any) {
        errors++;
        if (errors <= 5) {
          console.error(`[ClientSync] Error processing empresa ${emp.id} (${emp.razaoSocial}):`, err.message?.substring(0, 200), err.cause || err.code || '');
        }
      }
    }
  }

  console.log(`[ClientSync] Done! Synced: ${synced}, Errors: ${errors}, Total fetched: ${allEmpresas.length}`);
  return { synced, errors, total: allEmpresas.length };
}
