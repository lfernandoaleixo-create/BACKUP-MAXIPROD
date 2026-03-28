import { describe, it, expect } from "vitest";

describe("Maxiprod GraphQL Token", () => {
  it("should have MAXIPROD_GRAPHQL_TOKEN set", () => {
    const token = process.env.MAXIPROD_GRAPHQL_TOKEN;
    expect(token).toBeDefined();
    expect(token!.length).toBeGreaterThan(10);
  });

  it("should successfully connect to GraphQL API with the token", async () => {
    const token = process.env.MAXIPROD_GRAPHQL_TOKEN;
    if (!token) {
      throw new Error("MAXIPROD_GRAPHQL_TOKEN not set");
    }

    // Simple introspection query to test connection
    const query = `{ __schema { queryType { name } } }`;

    const response = await fetch("https://api.maxiprod.com.br/graphql/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${token}`,
      },
      body: JSON.stringify({ query }),
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    // If token is valid, we should get schema data (not an auth error)
    expect(data.data).toBeDefined();
    expect(data.data.__schema).toBeDefined();
    expect(data.data.__schema.queryType.name).toBe("GraphQLQuery");
  }, 15000);
});
