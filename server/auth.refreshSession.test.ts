import { describe, it, expect, vi } from "vitest";
import { router, publicProcedure } from "./_core/trpc";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import type { TrpcContext } from "./_core/context";

// Import the appRouter to test the actual implementation
import { appRouter } from "./routers";

describe("auth.refreshSession", () => {
  const createMockContext = (user: any = null): TrpcContext => {
    const cookies: Record<string, any> = {};
    return {
      req: {
        headers: { cookie: "" },
        protocol: "https",
        hostname: "localhost",
      } as any,
      res: {
        cookie: vi.fn((name, value, options) => {
          cookies[name] = { value, options };
        }),
        clearCookie: vi.fn(),
      } as any,
      user,
    };
  };

  it("should return success:false when user is not authenticated", async () => {
    const ctx = createMockContext(null);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.refreshSession();

    expect(result.success).toBe(false);
    expect(result.reason).toBe("not_authenticated");
    expect(ctx.res.cookie).not.toHaveBeenCalled();
  });

  it("should refresh token and set new cookie when user is authenticated", async () => {
    const mockUser = {
      id: 1,
      openId: "test-open-id-123",
      name: "Luiz Fernando",
      email: "luiz@grupofox.com",
      role: "user",
      loginMethod: "email",
      lastSignedIn: new Date(),
      createdAt: new Date(),
    };

    const ctx = createMockContext(mockUser);
    const caller = appRouter.createCaller(ctx);

    // Mock the sdk.createSessionToken
    const originalCreateSessionToken = sdk.createSessionToken.bind(sdk);
    vi.spyOn(sdk, "createSessionToken").mockResolvedValue("new-jwt-token-abc123");

    const result = await caller.auth.refreshSession();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.expiresIn).toBe(ONE_YEAR_MS);
    }

    // Verify cookie was set with new token
    expect(ctx.res.cookie).toHaveBeenCalledWith(
      COOKIE_NAME,
      "new-jwt-token-abc123",
      expect.objectContaining({
        maxAge: ONE_YEAR_MS,
        httpOnly: true,
        path: "/",
        sameSite: "none",
      })
    );

    // Verify createSessionToken was called with correct params
    expect(sdk.createSessionToken).toHaveBeenCalledWith("test-open-id-123", {
      name: "Luiz Fernando",
      expiresInMs: ONE_YEAR_MS,
    });

    vi.restoreAllMocks();
  });

  it("should return success:false when token creation fails", async () => {
    const mockUser = {
      id: 1,
      openId: "test-open-id-456",
      name: "Thiago",
      email: "thiago@grupofox.com",
      role: "user",
      loginMethod: "email",
      lastSignedIn: new Date(),
      createdAt: new Date(),
    };

    const ctx = createMockContext(mockUser);
    const caller = appRouter.createCaller(ctx);

    // Mock createSessionToken to throw error
    vi.spyOn(sdk, "createSessionToken").mockRejectedValue(new Error("JWT signing failed"));

    const result = await caller.auth.refreshSession();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe("refresh_failed");
    }

    vi.restoreAllMocks();
  });

  it("should use user name in token creation (empty string if null)", async () => {
    const mockUser = {
      id: 2,
      openId: "test-open-id-789",
      name: null, // User without name
      email: "test@test.com",
      role: "user",
      loginMethod: "email",
      lastSignedIn: new Date(),
      createdAt: new Date(),
    };

    const ctx = createMockContext(mockUser);
    const caller = appRouter.createCaller(ctx);

    vi.spyOn(sdk, "createSessionToken").mockResolvedValue("token-no-name");

    await caller.auth.refreshSession();

    expect(sdk.createSessionToken).toHaveBeenCalledWith("test-open-id-789", {
      name: "",
      expiresInMs: ONE_YEAR_MS,
    });

    vi.restoreAllMocks();
  });
});
