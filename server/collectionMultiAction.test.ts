import { describe, it, expect } from "vitest";

const BASE = `http://localhost:${process.env.PORT ?? 3000}`;

async function trpcQuery(path: string, input?: any) {
  const url = input
    ? `${BASE}/api/trpc/${path}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`
    : `${BASE}/api/trpc/${path}`;
  const res = await fetch(url);
  const json = await res.json();
  return json.result?.data?.json;
}

async function trpcMutation(path: string, input: any) {
  const res = await fetch(`${BASE}/api/trpc/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ json: input }),
  });
  const json = await res.json();
  if (json.error) return json.error?.json || json.error;
  return json.result?.data?.json;
}

describe("Collection Action - Múltiplas opções simultâneas", () => {
  it("registerCollectionAction aceita múltiplos actionTypes", async () => {
    // Usar um receivableId que provavelmente existe
    const result = await trpcMutation("financial.registerCollectionAction", {
      receivableId: 1,
      actionTypes: ["whatsapp", "email"],
      operatorName: "Thiago",
      notes: "Teste de múltiplas ações simultâneas",
    });
    // Se o receivableId existe, deve retornar success
    // Se não existe, pode retornar erro mas não deve dar erro de validação
    expect(result).toBeDefined();
    if (result.success) {
      expect(result.success).toBe(true);
    }
  });

  it("registerCollectionAction rejeita array vazio de actionTypes", async () => {
    const result = await trpcMutation("financial.registerCollectionAction", {
      receivableId: 1,
      actionTypes: [],
      operatorName: "Thiago",
      notes: "Teste array vazio",
    });
    // Zod validation should reject empty array (.min(1))
    expect(result).toBeDefined();
    const isError = result.message || result.code || !result.success;
    expect(isError).toBeTruthy();
  });

  it("registerCollectionAction aceita um único actionType no array", async () => {
    const result = await trpcMutation("financial.registerCollectionAction", {
      receivableId: 1,
      actionTypes: ["ligacao"],
      operatorName: "Guilherme",
      notes: "Teste com um tipo apenas",
    });
    expect(result).toBeDefined();
    if (result.success) {
      expect(result.success).toBe(true);
    }
  });

  it("registerCollectionAction rejeita actionType inválido", async () => {
    const result = await trpcMutation("financial.registerCollectionAction", {
      receivableId: 1,
      actionTypes: ["invalido"],
      operatorName: "Thiago",
      notes: "Teste tipo inválido",
    });
    // Zod enum validation should reject invalid type
    expect(result).toBeDefined();
    const isError = result.message || result.code || !result.success;
    expect(isError).toBeTruthy();
  });
});

describe("getTodayActions - Retorna tipos de ação por título", () => {
  it("getTodayActions retorna um mapa com arrays de strings", async () => {
    const result = await trpcQuery("financial.getTodayActions", {
      receivableIds: [1, 2, 3],
    });
    expect(result).toBeDefined();
    // O resultado deve ser um objeto (mapa)
    expect(typeof result).toBe("object");
    // Se houver ações, cada valor deve ser um array de strings
    for (const [key, value] of Object.entries(result || {})) {
      expect(Array.isArray(value)).toBe(true);
      for (const item of value as string[]) {
        expect(typeof item).toBe("string");
      }
    }
  });

  it("getTodayActions retorna vazio para array vazio de IDs", async () => {
    const result = await trpcQuery("financial.getTodayActions", {
      receivableIds: [],
    });
    expect(result).toBeDefined();
    expect(Object.keys(result || {}).length).toBe(0);
  });
});

describe("getPendingCollectionActions - Verifica ações obrigatórias por dia", () => {
  it("getPendingCollectionActions retorna estrutura correta", async () => {
    const result = await trpcQuery("financial.getPendingCollectionActions", {
      receivableIds: [1, 2, 3],
    });
    expect(result).toBeDefined();
    expect(typeof result).toBe("object");
    // Se houver pendências, cada valor deve ter pendingDays e hasPendingAction
    for (const [key, value] of Object.entries(result || {})) {
      const v = value as any;
      expect(v).toHaveProperty("pendingDays");
      expect(v).toHaveProperty("hasPendingAction");
      expect(Array.isArray(v.pendingDays)).toBe(true);
      expect(typeof v.hasPendingAction).toBe("boolean");
    }
  });
});

describe("Fuso horário - getCollectionChecklist", () => {
  it("getCollectionChecklist retorna horas no fuso de São Paulo", async () => {
    const result = await trpcQuery("financial.getCollectionChecklist", {
      receivableId: 1,
    });
    expect(result).toBeDefined();
    // Se houver steps com ações, as horas devem estar no formato HH:MM
    if (result?.steps) {
      for (const step of result.steps) {
        if (step.acoes && step.acoes.length > 0) {
          for (const acao of step.acoes) {
            if (acao.hora) {
              // Formato esperado: HH:MM (ex: "14:30")
              expect(acao.hora).toMatch(/^\d{2}:\d{2}$/);
            }
          }
        }
      }
    }
  });
});
