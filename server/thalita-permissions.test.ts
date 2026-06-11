import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { operators } from "../drizzle/schema";
import { eq } from "drizzle-orm";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

const caller = appRouter.createCaller(createPublicContext());

describe("Thalita permissions for Planilha de Cobrança", () => {
  it("Thalita operator exists and is active", async () => {
    const db = await getDb();
    if (!db) return;
    const rows = await db.select().from(operators).where(eq(operators.name, "Thalita"));
    expect(rows.length).toBe(1);
    expect(rows[0].active).toBe(true);
    expect(rows[0].accessFinanceiro).toBe(true);
  });

  it("Thalita can login and has financeiro access", async () => {
    const db = await getDb();
    if (!db) return;
    // Get Thalita's password
    const rows = await db.select().from(operators).where(eq(operators.name, "Thalita"));
    if (rows.length === 0) return;
    const thalita = rows[0];
    
    // Validate operator login
    const result = await caller.settings.validateOperator({ password: thalita.password });
    expect(result.success).toBe(true);
    expect(result.operator).toBeDefined();
    expect(result.operator!.name).toBe("Thalita");
    expect(result.operator!.accessFinanceiro).toBe(true);
  });

  it("Thalita has same granular permissions as Thalita for financeiro", async () => {
    const db = await getDb();
    if (!db) return;
    
    // Get both operators
    const thalitaRows = await db.select().from(operators).where(eq(operators.name, "Thalita"));
    const thiagoRows = await db.select().from(operators).where(eq(operators.name, "Thalita"));
    if (thalitaRows.length === 0 || thiagoRows.length === 0) return;
    
    // Both should have accessFinanceiro
    expect(thalitaRows[0].accessFinanceiro).toBe(true);
    expect(thiagoRows[0].accessFinanceiro).toBe(true);
  });

  it("canEdit list in CobrancaPlanilhaView includes Thalita", async () => {
    // This test verifies the frontend permission logic by checking the source code
    const fs = await import("fs");
    const content = fs.readFileSync(
      "/home/ubuntu/grupo-fox-dashboard/client/src/components/CobrancaPlanilhaView.tsx",
      "utf-8"
    );
    
    // Check that canEdit includes Thalita
    const canEditMatch = content.match(/const canEdit = operator && \[(.*?)\]\.includes\(operator\.name\)/);
    expect(canEditMatch).toBeDefined();
    expect(canEditMatch![1]).toContain('"Thalita"');
    
    // Also verify Thalita is in the same list
    expect(canEditMatch![1]).toContain('"Thalita"');
  });

  it("COBRANCA_GUIDE_OPERATORS includes Thalita in both InadimplenciaTab and CobrancaPlanilhaView", async () => {
    const fs = await import("fs");
    
    // Check InadimplenciaTab
    const inadContent = fs.readFileSync(
      "/home/ubuntu/grupo-fox-dashboard/client/src/components/InadimplenciaTab.tsx",
      "utf-8"
    );
    const inadMatch = inadContent.match(/COBRANCA_GUIDE_OPERATORS = \[(.*?)\]/);
    expect(inadMatch).toBeDefined();
    expect(inadMatch![1]).toContain('"Thalita"');
    
    // Check CobrancaPlanilhaView
    const planilhaContent = fs.readFileSync(
      "/home/ubuntu/grupo-fox-dashboard/client/src/components/CobrancaPlanilhaView.tsx",
      "utf-8"
    );
    const planilhaMatch = planilhaContent.match(/COBRANCA_GUIDE_OPERATORS = \[(.*?)\]/);
    expect(planilhaMatch).toBeDefined();
    expect(planilhaMatch![1]).toContain('"Thalita"');
  });
});
