import { describe, expect, it } from "vitest";
import {
  can,
  signAccessToken,
  signConnectionOAuthState,
  signOidcState,
  oidcSubjectId,
  verifyAccessToken,
  verifyConnectionOAuthState,
  verifyOidcState,
} from "./index";

describe("authorization", () => {
  it("maps an OIDC subject to a stable internal UUID", () => {
    expect(oidcSubjectId("https://id.example/", "subject-1")).toBe(
      oidcSubjectId("https://id.example", "subject-1"),
    );
    expect(oidcSubjectId("https://id.example", "subject-1")).toMatch(
      /^[0-9a-f-]{36}$/,
    );
  });
  it("applies least privilege", () => {
    expect(can("owner", "billing.manage")).toBe(true);
    expect(can("viewer", "content.publish")).toBe(false);
  });

  it("signs and verifies scoped access", async () => {
    const secret = "a-secure-test-secret-that-is-long-enough";
    const token = await signAccessToken(
      {
        sub: "34a8d607-9123-4e1a-a531-a288e6a0ccbe",
        workspaceId: "3bb0ddf6-cf8a-43e5-8490-099f7c66a069",
        role: "admin",
      },
      secret,
    );
    await expect(verifyAccessToken(token, secret)).resolves.toMatchObject({
      workspaceId: "3bb0ddf6-cf8a-43e5-8490-099f7c66a069",
      role: "admin",
    });
  });

  it("rejects unrecognized roles instead of crashing authorization", async () => {
    const secret = "a-secure-test-secret-that-is-long-enough";
    const token = await new (await import("jose")).SignJWT({
      workspaceId: "3bb0ddf6-cf8a-43e5-8490-099f7c66a069",
      role: "superadmin",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("34a8d607-9123-4e1a-a531-a288e6a0ccbe")
      .setAudience("anycol-api")
      .sign(new TextEncoder().encode(secret));
    await expect(verifyAccessToken(token, secret)).rejects.toThrow(
      "Invalid access token claims",
    );
  });

  it("round-trips short-lived OIDC state and rejects open redirects", async () => {
    const secret = "a-secure-test-secret-that-is-long-enough";
    const token = await signOidcState(
      { returnTo: "/demo/overview", nonce: "nonce", verifier: "verifier" },
      secret,
    );
    await expect(verifyOidcState(token, secret)).resolves.toMatchObject({
      returnTo: "/demo/overview",
    });
    const unsafe = await signOidcState(
      { returnTo: "//evil.example", nonce: "nonce", verifier: "verifier" },
      secret,
    );
    await expect(verifyOidcState(unsafe, secret)).rejects.toThrow(
      "Invalid OIDC state",
    );
  });

  it("signs connector OAuth state with tenant context", async () => {
    const secret = "a-secure-test-secret-that-is-long-enough";
    const value = {
      connectionId: "ef47f4df-84dc-4f51-8d16-bba25fd9e6ba",
      workspaceId: "3bb0ddf6-cf8a-43e5-8490-099f7c66a069",
      brandId: "d66234e7-6e51-42d0-86a7-02e704e27b69",
      actorId: "34a8d607-9123-4e1a-a531-a288e6a0ccbe",
      connector: "ga4" as const,
      returnTo: "/demo/integrations",
    };
    await expect(
      verifyConnectionOAuthState(
        await signConnectionOAuthState(value, secret),
        secret,
      ),
    ).resolves.toEqual(value);
  });
});
