import { describe, it, expect, vi } from "vitest";

// Mock storage
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ key: "decision-pdfs/test.pdf", url: "https://s3.example.com/decision.pdf" }),
  storageGet: vi.fn().mockResolvedValue({ key: "decision-pdfs/test.pdf", url: "https://s3.example.com/decision.pdf?signed" }),
}));

import { appRouter } from "./routers";

describe("Decision PDF History procedures", () => {
  const caller = appRouter.createCaller({ user: null } as any);

  it("listAllDecisionPdfs returns an array", async () => {
    const result = await caller.financial.listAllDecisionPdfs();
    expect(result).toHaveProperty("pdfs");
    expect(Array.isArray(result.pdfs)).toBe(true);
  });

  it("saveDecisionPdf saves a PDF and returns metadata", async () => {
    const base64Content = Buffer.from("fake pdf content").toString("base64");
    const result = await caller.financial.saveDecisionPdf({
      receivableId: 99999,
      cliente: "Cliente Teste",
      vendedor: "Vendedor Teste",
      valorAberto: "R$ 1.500,00",
      diasAtraso: 15,
      decisao: "SEM PROTESTO",
      protocolo: "GF-20260429-0800-1234",
      fileBase64: base64Content,
      generatedBy: "Thiago",
    });

    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("fileUrl");
    expect(result).toHaveProperty("protocolo", "GF-20260429-0800-1234");
    expect(result).toHaveProperty("generatedAt");
    expect(typeof result.generatedAt).toBe("number");
  });

  it("saved PDF appears in listAllDecisionPdfs", async () => {
    const result = await caller.financial.listAllDecisionPdfs();
    const found = result.pdfs.find((p: any) => p.protocolo === "GF-20260429-0800-1234");
    expect(found).toBeTruthy();
    expect(found!.cliente).toBe("Cliente Teste");
    expect(found!.generatedBy).toBe("Thiago");
    expect(found!.decisao).toBe("SEM PROTESTO");
  });

  it("saved PDF appears in listDecisionPdfs for the specific receivable", async () => {
    const result = await caller.financial.listDecisionPdfs({ receivableId: 99999 });
    const found = result.pdfs.find((p: any) => p.protocolo === "GF-20260429-0800-1234");
    expect(found).toBeTruthy();
  });

  it("deleteDecisionPdf removes the PDF from history", async () => {
    const listBefore = await caller.financial.listAllDecisionPdfs();
    const target = listBefore.pdfs.find((p: any) => p.protocolo === "GF-20260429-0800-1234");
    expect(target).toBeTruthy();

    const delResult = await caller.financial.deleteDecisionPdf({ id: target!.id });
    expect(delResult).toEqual({ success: true });

    const listAfter = await caller.financial.listAllDecisionPdfs();
    const found = listAfter.pdfs.find((p: any) => p.id === target!.id);
    expect(found).toBeFalsy();
  });
});
