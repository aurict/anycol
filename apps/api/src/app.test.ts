import { describe, expect, it } from "vitest";
import { buildApp } from "./app";
import { signAccessToken } from "@anycol/auth";

const config = {
  NODE_ENV: "test" as const,
  APP_VERSION: "test",
  API_PORT: 4000,
  WORKER_HEALTH_PORT: 4001,
  API_BASE_URL: "http://127.0.0.1:4000",
  REDIS_URL: "redis://127.0.0.1:6379",
  SESSION_SECRET: "test-secret-that-is-at-least-32-characters",
  INTERNAL_API_AUDIENCE: "anycol-api",
  OIDC_WORKSPACE_ID_CLAIM: "workspace_id",
  OIDC_WORKSPACE_ROLE_CLAIM: "workspace_role",
  ALLOWED_ORIGINS: [],
};

describe("api", () => {
  it("serves public health", async () => {
    const app = await buildApp({
      config,
      now: () => new Date("2026-08-06T00:00:00Z"),
    });
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "ok",
      time: "2026-08-06T00:00:00.000Z",
    });
    await app.close();
  });

  it("fails readiness when infrastructure checks are missing or unhealthy", async () => {
    const app = await buildApp({
      config,
      readiness: {
        database: async () => {
          throw new Error("offline");
        },
        redis: async () => undefined,
      },
    });
    const response = await app.inject({ method: "GET", url: "/ready" });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      status: "not_ready",
      checks: { database: { ok: false }, redis: { ok: true } },
    });
    await app.close();
  });

  it("enforces permission at the API boundary", async () => {
    const app = await buildApp({ config });
    const token = await signAccessToken(
      {
        sub: "34a8d607-9123-4e1a-a531-a288e6a0ccbe",
        workspaceId: "3bb0ddf6-cf8a-43e5-8490-099f7c66a069",
        role: "viewer",
      },
      config.SESSION_SECRET,
    );
    const response = await app.inject({
      method: "GET",
      url: "/v1/connectors",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it("returns a typed brand overview", async () => {
    const app = await buildApp({
      config,
      overviewStore: {
        get: async (workspaceId, brandId, range) => ({
          workspaceId,
          brandId,
          range,
          metrics: [
            {
              metric: "clicks",
              value: 4,
              previousValue: 3,
              unit: "count",
              source: "search_console",
              quality: "final",
              updatedAt: "2026-08-06T00:00:00.000Z",
            },
          ],
          alerts: [],
        }),
      },
    });
    const token = await signAccessToken(
      {
        sub: "34a8d607-9123-4e1a-a531-a288e6a0ccbe",
        workspaceId: "3bb0ddf6-cf8a-43e5-8490-099f7c66a069",
        role: "analyst",
      },
      config.SESSION_SECRET,
    );
    const response = await app.inject({
      method: "GET",
      url: "/v1/brands/d66234e7-6e51-42d0-86a7-02e704e27b69/overview",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().metrics).toHaveLength(1);
    await app.close();
  });

  it("persists through the injected queue boundary before accepting sync", async () => {
    const token = await signAccessToken(
      {
        sub: "34a8d607-9123-4e1a-a531-a288e6a0ccbe",
        workspaceId: "3bb0ddf6-cf8a-43e5-8490-099f7c66a069",
        role: "admin",
      },
      config.SESSION_SECRET,
    );
    let enqueued = false;
    const app = await buildApp({
      config,
      syncJobs: {
        enqueue: async (_workspaceId, _actorId, requestId, input) => {
          enqueued = true;
          return {
            id: "d66234e7-6e51-42d0-86a7-02e704e27b69",
            connector: input.connector,
            status: "queued",
            requestId,
          };
        },
      },
    });
    const response = await app.inject({
      method: "POST",
      url: "/v1/sync-jobs",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        connector: "ga4",
        connectionId: "b4452240-4b64-4af4-b20b-b3eef6f10215",
        externalAccountId: "eb8190cf-d90d-4ecd-8354-95f8ab74338f",
        mode: "incremental",
        from: "2026-08-01T00:00:00.000Z",
        to: "2026-08-06T00:00:00.000Z",
      },
    });
    expect(response.statusCode).toBe(202);
    expect(enqueued).toBe(true);
    await app.close();
  });
});
