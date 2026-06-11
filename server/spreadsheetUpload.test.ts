import { describe, it, expect, vi } from "vitest";

// Mock storage
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ key: "spreadsheet-uploads/test.xlsx", url: "https://s3.example.com/test.xlsx" }),
  storageGet: vi.fn().mockResolvedValue({ key: "spreadsheet-uploads/test.xlsx", url: "https://s3.example.com/test.xlsx?signed" }),
}));

import { appRouter } from "./routers";

describe("Spreadsheet Upload procedures", () => {
  const caller = appRouter.createCaller({ user: null } as any);

  it("listSpreadsheetUploads returns an array", async () => {
    const result = await caller.financial.listSpreadsheetUploads();
    expect(result).toHaveProperty("uploads");
    expect(Array.isArray(result.uploads)).toBe(true);
  });

  it("uploadSpreadsheet saves a file and returns metadata", async () => {
    const base64Content = Buffer.from("test spreadsheet content").toString("base64");
    const result = await caller.financial.uploadSpreadsheet({
      fileName: "cobranca_abril.xlsx",
      fileBase64: base64Content,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fileSize: 1024,
      uploadedBy: "Thalita",
    });

    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("fileName", "cobranca_abril.xlsx");
    expect(result).toHaveProperty("fileUrl");
    expect(result).toHaveProperty("uploadedAt");
    expect(typeof result.uploadedAt).toBe("number");
  });

  it("uploaded file appears in the list", async () => {
    const result = await caller.financial.listSpreadsheetUploads();
    const found = result.uploads.find((u: any) => u.fileName === "cobranca_abril.xlsx");
    expect(found).toBeTruthy();
    expect(found!.uploadedBy).toBe("Thalita");
  });

  it("deleteSpreadsheetUpload removes the file from history", async () => {
    const listBefore = await caller.financial.listSpreadsheetUploads();
    const target = listBefore.uploads.find((u: any) => u.fileName === "cobranca_abril.xlsx");
    expect(target).toBeTruthy();

    const delResult = await caller.financial.deleteSpreadsheetUpload({ id: target!.id });
    expect(delResult).toEqual({ success: true });

    const listAfter = await caller.financial.listSpreadsheetUploads();
    const found = listAfter.uploads.find((u: any) => u.id === target!.id);
    expect(found).toBeFalsy();
  });
});
