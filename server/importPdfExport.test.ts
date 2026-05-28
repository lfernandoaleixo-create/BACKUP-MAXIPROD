import { describe, expect, it } from "vitest";
import { importPdfExportHandler } from "./importPdfExport";
import type { Request, Response } from "express";

describe("importPdfExportHandler", () => {
  it("returns a PDF with correct content-type and content-disposition headers", async () => {
    const chunks: Buffer[] = [];
    let statusCode = 200;
    const headers: Record<string, string> = {};
    let headersSent = false;

    const mockReq = {} as Request;
    const mockRes = {
      setHeader: (key: string, value: string) => {
        headers[key] = value;
      },
      status: (code: number) => {
        statusCode = code;
        return mockRes;
      },
      json: () => mockRes,
      headersSent,
      write: (chunk: Buffer) => {
        chunks.push(chunk);
        return true;
      },
      end: () => {
        headersSent = true;
      },
      on: () => mockRes,
      once: () => mockRes,
      emit: () => false,
    } as unknown as Response;

    // Mock the pipe method - pdfkit pipes to response
    // We need to actually handle the stream
    const originalPipe = Object.getPrototypeOf(mockRes);

    await new Promise<void>((resolve, reject) => {
      // Override the response to capture the piped data
      const pipeableRes = {
        ...mockRes,
        write: (chunk: Buffer) => {
          chunks.push(Buffer.from(chunk));
          return true;
        },
        end: (chunk?: Buffer) => {
          if (chunk) chunks.push(Buffer.from(chunk));
          resolve();
        },
        on: () => pipeableRes,
        once: () => pipeableRes,
        emit: () => false,
      } as unknown as Response;

      // Copy setHeader and status
      pipeableRes.setHeader = (key: string, value: string) => {
        headers[key] = value;
      };
      pipeableRes.status = (code: number) => {
        statusCode = code;
        return pipeableRes;
      };
      pipeableRes.json = () => pipeableRes;
      (pipeableRes as any).headersSent = false;

      importPdfExportHandler(mockReq, pipeableRes).catch(reject);
    });

    // Verify headers
    expect(headers["Content-Type"]).toBe("application/pdf");
    expect(headers["Content-Disposition"]).toMatch(/^attachment; filename="Importacao_Grupo_Fox_.*\.pdf"$/);

    // Verify PDF content starts with %PDF
    const fullBuffer = Buffer.concat(chunks);
    expect(fullBuffer.length).toBeGreaterThan(0);
    expect(fullBuffer.toString("utf-8", 0, 5)).toBe("%PDF-");
  });

  it("generates a valid PDF document", async () => {
    const chunks: Buffer[] = [];
    const headers: Record<string, string> = {};

    await new Promise<void>((resolve, reject) => {
      const mockRes = {
        setHeader: (key: string, value: string) => {
          headers[key] = value;
        },
        status: (code: number) => mockRes,
        json: () => mockRes,
        headersSent: false,
        write: (chunk: Buffer) => {
          chunks.push(Buffer.from(chunk));
          return true;
        },
        end: (chunk?: Buffer) => {
          if (chunk) chunks.push(Buffer.from(chunk));
          resolve();
        },
        on: () => mockRes,
        once: () => mockRes,
        emit: () => false,
      } as unknown as Response;

      importPdfExportHandler({} as Request, mockRes).catch(reject);
    });

    const fullBuffer = Buffer.concat(chunks);
    // PDF should end with %%EOF
    const pdfStr = fullBuffer.toString("latin1");
    expect(pdfStr).toContain("%%EOF");
    // PDF should contain text streams (the title is encoded in PDF streams)
    expect(fullBuffer.length).toBeGreaterThan(1000);
  });
});
