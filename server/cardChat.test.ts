import { describe, it, expect } from "vitest";

const BASE = `http://localhost:${process.env.PORT ?? 3000}`;

function url(path: string, input: Record<string, any>) {
  return `${BASE}/api/trpc/${path}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`;
}

async function mutate(path: string, input: Record<string, any>) {
  const res = await fetch(`${BASE}/api/trpc/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ json: input }),
  });
  return res.json();
}

describe("Card Chat - getCardMessages & sendCardMessage", () => {
  const cardKey = `test_card_${Date.now()}`;

  it("returns empty array for new card", async () => {
    const res = await fetch(url("settings.getCardMessages", { cardKey, limit: 50 }));
    const json = await res.json();
    expect(json.result.data.json).toEqual([]);
  });

  it("sends a message successfully", async () => {
    const json = await mutate("settings.sendCardMessage", {
      cardKey,
      operatorName: "Flavio",
      message: "Teste de observação",
    });
    expect(json.result.data.json.success).toBe(true);
    expect(json.result.data.json.id).toBeGreaterThan(0);
  });

  it("retrieves sent messages", async () => {
    const res = await fetch(url("settings.getCardMessages", { cardKey, limit: 50 }));
    const json = await res.json();
    const messages = json.result.data.json;
    expect(messages.length).toBeGreaterThanOrEqual(1);
    expect(messages[0].operatorName).toBe("Flavio");
    expect(messages[0].message).toBe("Teste de observação");
    expect(messages[0].cardKey).toBe(cardKey);
    expect(messages[0].createdAt).toBeGreaterThan(0);
  });

  it("multiple operators can send messages", async () => {
    await mutate("settings.sendCardMessage", {
      cardKey,
      operatorName: "Thiago",
      message: "Resposta do Thiago",
    });
    const res = await fetch(url("settings.getCardMessages", { cardKey, limit: 50 }));
    const json = await res.json();
    const messages = json.result.data.json;
    expect(messages.length).toBeGreaterThanOrEqual(2);
    const names = messages.map((m: any) => m.operatorName);
    expect(names).toContain("Flavio");
    expect(names).toContain("Thiago");
  });

  it("messages are ordered oldest first", async () => {
    const res = await fetch(url("settings.getCardMessages", { cardKey, limit: 50 }));
    const json = await res.json();
    const messages = json.result.data.json;
    for (let i = 1; i < messages.length; i++) {
      expect(messages[i].createdAt).toBeGreaterThanOrEqual(messages[i - 1].createdAt);
    }
  });

  it("rejects empty message", async () => {
    const json = await mutate("settings.sendCardMessage", {
      cardKey,
      operatorName: "Flavio",
      message: "",
    });
    expect(json.error).toBeDefined();
  });

  it("different cardKeys have separate messages", async () => {
    const otherKey = `other_card_${Date.now()}`;
    const res = await fetch(url("settings.getCardMessages", { cardKey: otherKey, limit: 50 }));
    const json = await res.json();
    expect(json.result.data.json).toEqual([]);
  });
});
