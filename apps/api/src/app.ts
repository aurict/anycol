import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { randomUUID } from "node:crypto";
import {
  can,
  verifyAccessToken,
  type AccessClaims,
  type Permission,
} from "@anycol/auth";
import { ApiProblem, ConnectorKey } from "@anycol/contracts";
import { getConfig, type Config } from "@anycol/config";
import { ConnectorRegistry } from "@anycol/connectors-core";
import { SearchConsoleConnector } from "@anycol/connector-search-console";
import { GoogleAdsConnector } from "@anycol/connector-google-ads";
import { Ga4Connector } from "@anycol/connector-ga4";
import { MetaConnector } from "@anycol/connector-meta";
import { TikTokConnector } from "@anycol/connector-tiktok";
import { YouTubeShortsConnector } from "@anycol/connector-youtube";
import {
  CapabilityOnlyConnector,
  providerManifest,
} from "@anycol/connector-stubs";
import { metricRegistry } from "@anycol/metrics";
import { buildUtmUrl, transitionContent } from "@anycol/domain";
import { z } from "zod";
import type { OverviewResponse } from "@anycol/contracts";
import type IORedis from "ioredis";

declare module "fastify" {
  interface FastifyRequest {
    auth?: AccessClaims;
    requestId: string;
  }
}

export type AppDependencies = {
  config?: Config;
  now?: () => Date;
  readiness?: Record<string, () => Promise<void>>;
  overviewStore?: {
    get(
      workspaceId: string,
      brandId: string,
      query: OverviewQuery,
    ): Promise<OverviewResponse | null>;
  };
  syncJobs?: {
    enqueue(
      workspaceId: string,
      actorId: string,
      requestId: string,
      input: SyncRequestInput,
    ): Promise<{
      id: string;
      connector: string;
      status: "queued";
      requestId: string;
    } | null>;
  };
  close?: () => Promise<void>;
  authorizeClaims?: (claims: AccessClaims) => Promise<boolean>;
  connectionOAuth?: {
    authorize(
      workspaceId: string,
      actorId: string,
      input: ConnectionAuthorizeInput,
    ): Promise<string | null>;
    complete(code: string, state: string): Promise<string>;
  };
  workspaceStore?: {
    get(workspaceId: string): Promise<{
      id: string;
      slug: string;
      name: string;
      brands: Array<{ id: string; slug: string; name: string }>;
    } | null>;
  };
  rateLimitRedis?: IORedis;
  connectionStore?: {
    list(workspaceId: string): Promise<
      Array<{
        id: string;
        brandId: string;
        connector: string;
        status: string;
        displayName: string | null;
        lastSyncAt: string | null;
        accounts: Array<{
          id: string;
          externalId: string;
          name: string;
          type: string;
        }>;
      }>
    >;
  };
};

export type OverviewQuery = { from: string; to: string };
export type SyncRequestInput = z.infer<typeof SyncRequestSchema>;

const OverviewQuerySchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});
const SyncRequestSchema = z
  .object({
    connector: ConnectorKey,
    connectionId: z.string().uuid(),
    externalAccountId: z.string().uuid(),
    mode: z.enum(["backfill", "incremental"]),
    from: z.string().datetime(),
    to: z.string().datetime(),
  })
  .refine((value) => Date.parse(value.from) <= Date.parse(value.to), {
    message: "from must be before or equal to to",
  });
const ConnectionAuthorizeSchema = z.object({
  brandId: z.string().uuid(),
  connector: z.enum(["google_ads", "search_console", "ga4"]),
  returnTo: z
    .string()
    .startsWith("/")
    .refine((value) => !value.startsWith("//")),
});
const UtmRequestSchema = z.object({
  destination: z.string().url(),
  source: z.string().min(1).max(100),
  medium: z.string().min(1).max(100),
  campaign: z.string().min(1).max(200),
  content: z.string().max(200).optional(),
  term: z.string().max(200).optional(),
});
const ContentTransitionSchema = z.object({
  current: z.enum([
    "draft",
    "in_review",
    "approved",
    "scheduled",
    "publishing",
    "published",
    "failed",
    "cancelled",
  ]),
  next: z.enum([
    "draft",
    "in_review",
    "approved",
    "scheduled",
    "publishing",
    "published",
    "failed",
    "cancelled",
  ]),
});
export type ConnectionAuthorizeInput = z.infer<
  typeof ConnectionAuthorizeSchema
>;

export async function buildApp(
  dependencies: AppDependencies = {},
): Promise<FastifyInstance> {
  const config = dependencies.config ?? getConfig();
  const now = dependencies.now ?? (() => new Date());
  const app = Fastify({
    logger: {
      level: config.NODE_ENV === "test" ? "silent" : "info",
      redact: [
        "req.headers.authorization",
        "req.headers.cookie",
        "body.accessToken",
        "body.refreshToken",
      ],
    },
    requestIdHeader: "x-request-id",
    genReqId: (request) =>
      String(request.headers["x-request-id"] ?? randomUUID()),
    bodyLimit: 1_000_000,
  });
  await app.register(cors, {
    origin: config.NODE_ENV === "production" ? config.ALLOWED_ORIGINS : true,
    credentials: true,
  });
  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: "1 minute",
    ban: 3,
    redis: dependencies.rateLimitRedis,
  });
  if (dependencies.close) app.addHook("onClose", dependencies.close);

  app.addHook("onRequest", async (request, reply) => {
    request.requestId = request.id;
    reply.header("x-request-id", request.id);
    reply.header("x-content-type-options", "nosniff");
    reply.header("x-frame-options", "DENY");
    reply.header("referrer-policy", "strict-origin-when-cross-origin");
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, "request failed");
    const safeError =
      error instanceof Error ? error : new Error("Unknown request error");
    const errorWithStatus = safeError as Error & { statusCode?: number };
    const status =
      error instanceof z.ZodError
        ? 400
        : typeof errorWithStatus.statusCode === "number" &&
            errorWithStatus.statusCode >= 400
          ? errorWithStatus.statusCode
          : 500;
    const problem = ApiProblem.parse({
      type:
        status === 500
          ? "https://anycol.app/problems/internal"
          : "https://anycol.app/problems/request",
      title: status === 500 ? "Internal server error" : safeError.name,
      status,
      detail:
        status === 500
          ? "The request could not be completed."
          : safeError.message,
      requestId: request.id,
    });
    return reply.status(status).type("application/problem+json").send(problem);
  });

  const registry = createRegistry(config);

  app.get("/health", async () => ({
    status: "ok",
    service: "api",
    version: config.APP_VERSION,
    time: now().toISOString(),
  }));
  app.get("/ready", async (_request, reply) => {
    const entries = await Promise.all(
      Object.entries(dependencies.readiness ?? {}).map(
        async ([name, check]) => {
          try {
            await check();
            return [name, { ok: true }] as const;
          } catch (error) {
            return [
              name,
              {
                ok: false,
                ...(config.NODE_ENV === "production"
                  ? {}
                  : {
                      detail:
                        error instanceof Error ? error.message : "unavailable",
                    }),
              },
            ] as const;
          }
        },
      ),
    );
    const checks = Object.fromEntries(entries);
    const ready = entries.length > 0 && entries.every(([, value]) => value.ok);
    return reply
      .status(ready ? 200 : 503)
      .send({ status: ready ? "ready" : "not_ready", checks });
  });
  app.get("/v1/platform", async () => ({
    name: "Anycol",
    version: "1.0.0",
    modules: [
      "analytics",
      "campaigns",
      "content",
      "reports",
      "inbox",
      "automations",
      "billing",
    ],
    connectors: registry.manifests(),
  }));

  app.addHook("preHandler", async (request) => {
    if (
      request.url === "/health" ||
      request.url === "/ready" ||
      request.url === "/v1/platform" ||
      request.url.startsWith("/v1/connections/oauth/callback")
    )
      return;
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer "))
      throw new HttpError(401, "Authentication required");
    try {
      request.auth = await verifyAccessToken(
        header.slice(7),
        config.SESSION_SECRET,
        config.INTERNAL_API_AUDIENCE,
      );
      if (
        dependencies.authorizeClaims &&
        !(await dependencies.authorizeClaims(request.auth))
      )
        throw new HttpError(403, "Workspace membership is not active");
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(401, "Invalid or expired access token");
    }
  });

  app.get(
    "/v1/connectors",
    { preHandler: requirePermission("connection.manage") },
    async () => registry.manifests(),
  );
  app.get(
    "/v1/metrics/definitions",
    { preHandler: requirePermission("analytics.read") },
    async () => Object.values(metricRegistry),
  );
  app.get(
    "/v1/connections",
    { preHandler: requirePermission("connection.manage") },
    async (request) => {
      if (!dependencies.connectionStore)
        throw new HttpError(503, "Connection storage is unavailable");
      return dependencies.connectionStore.list(request.auth!.workspaceId);
    },
  );
  app.get(
    "/v1/workspace",
    { preHandler: requirePermission("brand.read") },
    async (request) => {
      if (!dependencies.workspaceStore)
        throw new HttpError(503, "Workspace storage is unavailable");
      const workspace = await dependencies.workspaceStore.get(
        request.auth!.workspaceId,
      );
      if (!workspace) throw new HttpError(404, "Workspace not found");
      return workspace;
    },
  );

  app.post<{ Body: ConnectionAuthorizeInput }>(
    "/v1/connections/oauth/authorize",
    { preHandler: requirePermission("connection.manage") },
    async (request) => {
      if (!dependencies.connectionOAuth)
        throw new HttpError(503, "Connection OAuth is unavailable");
      const input = ConnectionAuthorizeSchema.parse(request.body);
      const authorizationUrl = await dependencies.connectionOAuth.authorize(
        request.auth!.workspaceId,
        request.auth!.sub,
        input,
      );
      if (!authorizationUrl) throw new HttpError(404, "Brand not found");
      return { authorizationUrl };
    },
  );

  app.get<{ Querystring: { code?: string; state?: string; error?: string } }>(
    "/v1/connections/oauth/callback",
    async (request, reply) => {
      if (request.query.error)
        throw new HttpError(400, "Provider rejected authorization");
      if (!request.query.code || !request.query.state)
        throw new HttpError(400, "Missing OAuth callback parameters");
      if (!dependencies.connectionOAuth)
        throw new HttpError(503, "Connection OAuth is unavailable");
      return reply.redirect(
        await dependencies.connectionOAuth.complete(
          request.query.code,
          request.query.state,
        ),
      );
    },
  );

  app.get<{
    Params: { brandId: string };
    Querystring: { from?: string; to?: string };
  }>(
    "/v1/brands/:brandId/overview",
    { preHandler: requirePermission("analytics.read") },
    async (request) => {
      if (!dependencies.overviewStore)
        throw new HttpError(503, "Overview storage is unavailable");
      const parsed = OverviewQuerySchema.parse(request.query);
      const to = parsed.to ?? now().toISOString().slice(0, 10);
      const from =
        parsed.from ??
        new Date(Date.parse(`${to}T00:00:00Z`) - 29 * 86_400_000)
          .toISOString()
          .slice(0, 10);
      if (from > to)
        throw new HttpError(400, "from must be before or equal to to");
      const overview = await dependencies.overviewStore.get(
        request.auth!.workspaceId,
        request.params.brandId,
        { from, to },
      );
      if (!overview) throw new HttpError(404, "Brand not found");
      return overview;
    },
  );

  app.post<{ Body: z.infer<typeof UtmRequestSchema> }>(
    "/v1/campaigns/utm",
    { preHandler: requirePermission("content.write") },
    async (request) => ({
      url: buildUtmUrl(UtmRequestSchema.parse(request.body)),
    }),
  );
  app.post<{
    Params: { id: string };
    Body: z.infer<typeof ContentTransitionSchema>;
  }>(
    "/v1/content/:id/transition",
    { preHandler: requirePermission("content.write") },
    async (request) => {
      const body = ContentTransitionSchema.parse(request.body);
      return {
        id: request.params.id,
        status: transitionContent(body.current, body.next, request.auth!.role),
        audit: { actor: request.auth!.sub, requestId: request.id },
      };
    },
  );

  app.post<{ Body: SyncRequestInput }>(
    "/v1/sync-jobs",
    { preHandler: requirePermission("connection.manage") },
    async (request, reply) => {
      if (!dependencies.syncJobs)
        throw new HttpError(503, "Sync queue is unavailable");
      const input = SyncRequestSchema.parse(request.body);
      registry.get(input.connector);
      const result = await dependencies.syncJobs.enqueue(
        request.auth!.workspaceId,
        request.auth!.sub,
        request.id,
        input,
      );
      if (!result)
        throw new HttpError(404, "Connection or external account not found");
      return reply.status(202).send(result);
    },
  );

  app.get(
    "/v1/admin/health",
    { preHandler: requirePermission("workspace.manage") },
    async () => ({
      connectors: registry
        .manifests()
        .map((item) => ({ key: item.key, status: item.status })),
      services: Object.keys(dependencies.readiness ?? {}),
      queues: {
        sync: dependencies.syncJobs ? "configured" : "unavailable",
        publish: "unavailable",
        reports: "unavailable",
      },
    }),
  );

  return app;
}

function createRegistry(config: Config): ConnectorRegistry {
  return new ConnectorRegistry()
    .register(new SearchConsoleConnector())
    .register(new GoogleAdsConnector(config.GOOGLE_ADS_DEVELOPER_TOKEN))
    .register(new Ga4Connector())
    .register(
      new MetaConnector(
        Boolean(
          config.META_APP_ID &&
          config.META_APP_SECRET &&
          config.META_REDIRECT_URI,
        ),
      ),
    )
    .register(
      new CapabilityOnlyConnector(
        providerManifest("linkedin", "LinkedIn", [
          "assets.read",
          "analytics.read",
          "content.publish",
        ]),
      ),
    )
    .register(
      new TikTokConnector(
        Boolean(
          config.TIKTOK_CLIENT_KEY &&
          config.TIKTOK_CLIENT_SECRET &&
          config.TIKTOK_REDIRECT_URI,
        ),
      ),
    )
    .register(
      new YouTubeShortsConnector(
        Boolean(
          config.GOOGLE_CLIENT_ID &&
          config.GOOGLE_CLIENT_SECRET &&
          config.GOOGLE_REDIRECT_URI,
        ),
      ),
    )
    .register(
      new CapabilityOnlyConnector(
        providerManifest("google_business", "Google Business Profile", [
          "assets.read",
          "analytics.read",
          "content.publish",
          "inbox.read",
          "inbox.reply",
        ]),
      ),
    );
}

function requirePermission(permission: Permission) {
  return async (request: FastifyRequest) => {
    if (!request.auth || !can(request.auth.role, permission))
      throw new HttpError(403, `Missing permission: ${permission}`);
  };
}

class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name =
      statusCode === 401
        ? "Unauthorized"
        : statusCode === 403
          ? "Forbidden"
          : "RequestError";
  }
}
