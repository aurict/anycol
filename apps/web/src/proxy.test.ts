import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { signAccessToken } from "@anycol/auth";
import { proxy } from "./proxy";

describe("web authentication proxy", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("rejects an arbitrary session cookie", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "a-secure-test-secret-that-is-long-enough");
    const response = await proxy(
      new NextRequest("https://app.example/demo/overview", {
        headers: { cookie: "anycol_session=anything" },
      }),
    );
    expect(response.status).toBe(307);
  });

  it("accepts a signed, unexpired session", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const secret = "a-secure-test-secret-that-is-long-enough";
    vi.stubEnv("SESSION_SECRET", secret);
    const token = await signAccessToken(
      {
        sub: "34a8d607-9123-4e1a-a531-a288e6a0ccbe",
        workspaceId: "3bb0ddf6-cf8a-43e5-8490-099f7c66a069",
        role: "viewer",
      },
      secret,
    );
    const response = await proxy(
      new NextRequest("https://app.example/demo/overview", {
        headers: { cookie: `anycol_session=${token}` },
      }),
    );
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});
