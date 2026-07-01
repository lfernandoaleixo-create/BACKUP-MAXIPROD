import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "./db";
import { catalogs, sellerPermissions, sellerCatalogVisibility } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

describe("Catalog File Manager", () => {
  let db: any;

  beforeAll(async () => {
    db = await getDb();
  });

  it("should create a folder at root level", async () => {
    const result = await db.insert(catalogs).values({
      name: "Test Folder",
      parentId: null,
      isFolder: true,
      url: "",
      active: true,
    });
    const id = Number(result[0].insertId);
    expect(id).toBeGreaterThan(0);

    // Verify the folder was created
    const [folder] = await db.select().from(catalogs).where(eq(catalogs.id, id));
    expect(folder.name).toBe("Test Folder");
    expect(folder.isFolder).toBe(true);
    expect(folder.parentId).toBeNull();

    // Cleanup
    await db.delete(catalogs).where(eq(catalogs.id, id));
  });

  it("should create a file inside a folder", async () => {
    // Create folder first
    const folderResult = await db.insert(catalogs).values({
      name: "Parent Folder",
      parentId: null,
      isFolder: true,
      url: "",
      active: true,
    });
    const folderId = Number(folderResult[0].insertId);

    // Create file inside folder
    const fileResult = await db.insert(catalogs).values({
      name: "test-file.pdf",
      parentId: folderId,
      isFolder: false,
      url: "https://example.com/test.pdf",
      mimeType: "application/pdf",
      fileSize: 1024,
      active: true,
    });
    const fileId = Number(fileResult[0].insertId);

    // Verify file is inside folder
    const [file] = await db.select().from(catalogs).where(eq(catalogs.id, fileId));
    expect(file.name).toBe("test-file.pdf");
    expect(file.parentId).toBe(folderId);
    expect(file.isFolder).toBe(false);
    expect(file.mimeType).toBe("application/pdf");
    expect(file.fileSize).toBe(1024);

    // Cleanup
    await db.delete(catalogs).where(eq(catalogs.id, fileId));
    await db.delete(catalogs).where(eq(catalogs.id, folderId));
  });

  it("should list items at root level (parentId = null)", async () => {
    // Create a root folder and a root file
    const folderResult = await db.insert(catalogs).values({
      name: "Root Folder",
      parentId: null,
      isFolder: true,
      url: "",
      active: true,
    });
    const folderId = Number(folderResult[0].insertId);

    const fileResult = await db.insert(catalogs).values({
      name: "root-file.xlsx",
      parentId: null,
      isFolder: false,
      url: "https://example.com/root.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fileSize: 2048,
      active: true,
    });
    const fileId = Number(fileResult[0].insertId);

    // Query root level items
    const allActive = await db.select().from(catalogs).where(eq(catalogs.active, true));
    const rootItems = allActive.filter((c: any) => c.parentId === null);
    
    expect(rootItems.length).toBeGreaterThanOrEqual(2);
    const rootFolders = rootItems.filter((c: any) => c.isFolder);
    const rootFiles = rootItems.filter((c: any) => !c.isFolder);
    expect(rootFolders.some((f: any) => f.id === folderId)).toBe(true);
    expect(rootFiles.some((f: any) => f.id === fileId)).toBe(true);

    // Cleanup
    await db.delete(catalogs).where(eq(catalogs.id, fileId));
    await db.delete(catalogs).where(eq(catalogs.id, folderId));
  });

  it("should soft-delete a folder and its children", async () => {
    // Create folder with a file inside
    const folderResult = await db.insert(catalogs).values({
      name: "Delete Test Folder",
      parentId: null,
      isFolder: true,
      url: "",
      active: true,
    });
    const folderId = Number(folderResult[0].insertId);

    const fileResult = await db.insert(catalogs).values({
      name: "child-file.jpg",
      parentId: folderId,
      isFolder: false,
      url: "https://example.com/child.jpg",
      mimeType: "image/jpeg",
      fileSize: 5000,
      active: true,
    });
    const fileId = Number(fileResult[0].insertId);

    // Soft delete the folder
    await db.update(catalogs).set({ active: false }).where(eq(catalogs.id, folderId));
    await db.update(catalogs).set({ active: false }).where(eq(catalogs.parentId, folderId));

    // Verify both are inactive
    const [folder] = await db.select().from(catalogs).where(eq(catalogs.id, folderId));
    const [file] = await db.select().from(catalogs).where(eq(catalogs.id, fileId));
    expect(folder.active).toBe(false);
    expect(file.active).toBe(false);

    // Cleanup
    await db.delete(catalogs).where(eq(catalogs.id, fileId));
    await db.delete(catalogs).where(eq(catalogs.id, folderId));
  });

  it("should handle catalog visibility per seller", async () => {
    // Get a seller
    const sellers = await db.select().from(sellerPermissions).limit(1);
    if (sellers.length === 0) return; // Skip if no sellers

    const sellerId = sellers[0].id;

    // Create a file
    const fileResult = await db.insert(catalogs).values({
      name: "visibility-test.pdf",
      parentId: null,
      isFolder: false,
      url: "https://example.com/vis.pdf",
      mimeType: "application/pdf",
      fileSize: 100,
      active: true,
    });
    const fileId = Number(fileResult[0].insertId);

    // Add visibility
    await db.insert(sellerCatalogVisibility).values({
      sellerId,
      catalogId: fileId,
    });

    // Verify visibility
    const visRows = await db.select().from(sellerCatalogVisibility)
      .where(and(
        eq(sellerCatalogVisibility.sellerId, sellerId),
        eq(sellerCatalogVisibility.catalogId, fileId)
      ));
    expect(visRows.length).toBe(1);

    // Remove visibility
    await db.delete(sellerCatalogVisibility)
      .where(and(
        eq(sellerCatalogVisibility.sellerId, sellerId),
        eq(sellerCatalogVisibility.catalogId, fileId)
      ));

    // Verify removed
    const visRowsAfter = await db.select().from(sellerCatalogVisibility)
      .where(and(
        eq(sellerCatalogVisibility.sellerId, sellerId),
        eq(sellerCatalogVisibility.catalogId, fileId)
      ));
    expect(visRowsAfter.length).toBe(0);

    // Cleanup
    await db.delete(catalogs).where(eq(catalogs.id, fileId));
  });

  it("should get all sellers for a gestor (not just authorized)", async () => {
    const allPerms = await db.select().from(sellerPermissions);
    const juvenalSellers = allPerms.filter((p: any) => p.gestorName === "JUVENAL TEIXEIRA");
    
    // Juvenal has 9 sellers total (most unauthorized)
    expect(juvenalSellers.length).toBeGreaterThanOrEqual(2);
    
    // Should include both authorized and unauthorized
    const authorized = juvenalSellers.filter((s: any) => s.authorized);
    const unauthorized = juvenalSellers.filter((s: any) => !s.authorized);
    expect(authorized.length).toBeGreaterThanOrEqual(1); // At least Daniel
    expect(unauthorized.length).toBeGreaterThanOrEqual(1); // Others
  });
});
