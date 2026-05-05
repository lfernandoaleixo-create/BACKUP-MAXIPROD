import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("PWA Configuration", () => {
  const publicDir = path.resolve(import.meta.dirname, "../client/public");

  it("manifest.json exists and is valid JSON", () => {
    const manifestPath = path.join(publicDir, "manifest.json");
    expect(fs.existsSync(manifestPath)).toBe(true);
    const content = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    expect(content.name).toBe("Grupo Fox - Dashboard");
    expect(content.short_name).toBe("Grupo Fox");
    expect(content.display).toBe("standalone");
    expect(content.start_url).toBe("/");
  });

  it("manifest has required icon sizes (192 and 512)", () => {
    const manifestPath = path.join(publicDir, "manifest.json");
    const content = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    const sizes = content.icons.map((i: any) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
  });

  it("manifest icons have valid URLs", () => {
    const manifestPath = path.join(publicDir, "manifest.json");
    const content = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    for (const icon of content.icons) {
      expect(icon.src).toMatch(/^https:\/\//);
      expect(icon.type).toBe("image/png");
    }
  });

  it("service worker file exists", () => {
    const swPath = path.join(publicDir, "sw.js");
    expect(fs.existsSync(swPath)).toBe(true);
  });

  it("service worker has network-first fetch strategy", () => {
    const swPath = path.join(publicDir, "sw.js");
    const content = fs.readFileSync(swPath, "utf-8");
    expect(content).toContain("addEventListener('fetch'");
    expect(content).toContain("fetch(event.request)");
    expect(content).toContain("/api/");
  });

  it("index.html references manifest and apple-touch-icon", () => {
    const htmlPath = path.resolve(import.meta.dirname, "../client/index.html");
    const content = fs.readFileSync(htmlPath, "utf-8");
    expect(content).toContain('rel="manifest"');
    expect(content).toContain('href="/manifest.json"');
    expect(content).toContain('rel="apple-touch-icon"');
    expect(content).toContain("apple-mobile-web-app-capable");
    expect(content).toContain("apple-mobile-web-app-title");
  });

  it("index.html registers service worker", () => {
    const htmlPath = path.resolve(import.meta.dirname, "../client/index.html");
    const content = fs.readFileSync(htmlPath, "utf-8");
    expect(content).toContain("serviceWorker.register");
    expect(content).toContain("/sw.js");
  });
});
