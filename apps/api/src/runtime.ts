import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import IORedis from "ioredis";
import { Queue } from "bullmq";
import type { Config } from "@anycol/config";
import { withTenant } from "@anycol/db";
import {
  defaultJobOptions,
  deterministicJobId,
  queueNames,
  type SyncJob,
} from "@anycol/jobs";
import type { ConnectorKey, OverviewResponse } from "@anycol/contracts";
import type { AppDependencies } from "./app";
import {
  signConnectionOAuthState,
  verifyConnectionOAuthState,
} from "@anycol/auth";
import { encryptSecret } from "@anycol/security";
import { ConnectorRegistry, type OAuthConfig } from "@anycol/connectors-core";
import { SearchConsoleConnector } from "@anycol/connector-search-console";
import { GoogleAdsConnector } from "@anycol/connector-google-ads";
import { Ga4Connector } from "@anycol/connector-ga4";
import { MetaConnector } from "@anycol/connector-meta";
import { TikTokConnector } from "@anycol/connector-tiktok";
import { YouTubeShortsConnector } from "@anycol/connector-youtube";

type MetricRow = {
  source: ConnectorKey;
  metrics: Record<string, number>;
  quality: "final" | "fresh" | "partial" | "sampled" | "limited";
  updated_at: Date;
  currency: string | null;
};

export function createRuntime(
  config: Config,
): AppDependencies & { close: () => Promise<void> } {
  if (!config.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const pool = new Pool({
    connectionString: config.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    application_name: "anycol-api",
  });
  const redis = new IORedis(config.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
  });
  redis.on("error", () => undefined);
  const syncQueue = new Queue<SyncJob>(queueNames.sync, {
    connection: redis,
    defaultJobOptions,
  });
  const connectors = new ConnectorRegistry()
    .register(new SearchConsoleConnector())
    .register(new GoogleAdsConnector(config.GOOGLE_ADS_DEVELOPER_TOKEN))
    .register(new Ga4Connector())
    .register(new MetaConnector())
    .register(new TikTokConnector())
    .register(new YouTubeShortsConnector());

  const ensureRedis = async () => {
    if (redis.status === "wait") await redis.connect();
    await redis.ping();
  };

  return {
    config,
    rateLimitRedis: redis,
    authorizeClaims: async (claims) =>
      withTenant(pool, claims.workspaceId, async (client) => {
        const result = await client.query<{ role: string }>(
          "SELECT role FROM workspace_members WHERE workspace_id=$1 AND user_id=$2",
          [claims.workspaceId, claims.sub],
        );
        return result.rows[0]?.role === claims.role;
      }),
    readiness: {
      database: async () => {
        await pool.query("SELECT 1");
      },
      redis: ensureRedis,
    },
    overviewStore: {
      get: async (workspaceId, brandId, query) =>
        withTenant(pool, workspaceId, async (client) => {
          const brand = await client.query<{ id: string }>(
            "SELECT id FROM brands WHERE id = $1 AND workspace_id = $2",
            [brandId, workspaceId],
          );
          if (!brand.rowCount) return null;
          const current = await client.query<MetricRow>(
            "SELECT source, metrics, quality, updated_at, currency FROM metric_facts_daily WHERE workspace_id = $1 AND brand_id = $2 AND metric_date BETWEEN $3 AND $4",
            [workspaceId, brandId, query.from, query.to],
          );
          const periodDays = Math.max(
            1,
            Math.round(
              (Date.parse(`${query.to}T00:00:00Z`) -
                Date.parse(`${query.from}T00:00:00Z`)) /
                86_400_000,
            ) + 1,
          );
          const previousTo = new Date(
            Date.parse(`${query.from}T00:00:00Z`) - 86_400_000,
          );
          const previousFrom = new Date(
            previousTo.getTime() - (periodDays - 1) * 86_400_000,
          );
          const previous = await client.query<MetricRow>(
            "SELECT source, metrics, quality, updated_at, currency FROM metric_facts_daily WHERE workspace_id = $1 AND brand_id = $2 AND metric_date BETWEEN $3 AND $4",
            [
              workspaceId,
              brandId,
              previousFrom.toISOString().slice(0, 10),
              previousTo.toISOString().slice(0, 10),
            ],
          );
          const currentTotals = totals(current.rows);
          const previousTotals = totals(previous.rows);
          const alerts = await client.query<{
            id: string;
            severity: "info" | "warning" | "critical";
            title: string;
            detail: string;
          }>(
            "SELECT id, severity, title, detail FROM alerts WHERE workspace_id = $1 AND brand_id = $2 AND acknowledged_at IS NULL ORDER BY created_at DESC LIMIT 20",
            [workspaceId, brandId],
          );
          const updatedAt = current.rows
            .reduce(
              (latest, row) =>
                row.updated_at > latest ? row.updated_at : latest,
              new Date(0),
            )
            .toISOString();
          const sourceFor = (name: string): ConnectorKey =>
            current.rows.find((row) => typeof row.metrics[name] === "number")
              ?.source ?? "ga4";
          const metric = (name: string, unit: "count" | "currency") => ({
            metric: name,
            value: currentTotals[name] ?? 0,
            previousValue: previousTotals[name] ?? null,
            unit,
            source: sourceFor(name),
            quality: "final" as const,
            updatedAt,
            ...(name === "cost"
              ? {
                  currency:
                    current.rows.find((row) => row.currency)?.currency ?? "TRY",
                }
              : {}),
          });
          return {
            workspaceId,
            brandId,
            range: query,
            metrics: [
              metric("impressions", "count"),
              metric("clicks", "count"),
              metric("cost", "currency"),
              metric("conversions", "count"),
              metric("video_views", "count"),
              metric("engagements", "count"),
              metric("followers", "count"),
            ],
            alerts: alerts.rows,
          } satisfies OverviewResponse;
        }),
    },
    workspaceStore: {
      get: async (workspaceId) =>
        withTenant(pool, workspaceId, async (client) => {
          const workspace = await client.query<{
            id: string;
            slug: string;
            name: string;
          }>("SELECT id,slug,name FROM workspaces WHERE id=$1", [workspaceId]);
          if (!workspace.rows[0]) return null;
          const brands = await client.query<{
            id: string;
            slug: string;
            name: string;
          }>(
            "SELECT id,slug,name FROM brands WHERE workspace_id=$1 ORDER BY name",
            [workspaceId],
          );
          return { ...workspace.rows[0], brands: brands.rows };
        }),
    },
    connectionStore: {
      list: async (workspaceId) =>
        withTenant(pool, workspaceId, async (client) => {
          const connections = await client.query<{
            id: string;
            brand_id: string;
            connector: string;
            status: string;
            display_name: string | null;
            last_sync_at: Date | null;
          }>(
            "SELECT id,brand_id,connector,status,display_name,last_sync_at FROM connections WHERE workspace_id=$1 ORDER BY created_at DESC",
            [workspaceId],
          );
          const accounts = await client.query<{
            id: string;
            connection_id: string;
            external_id: string;
            name: string;
            type: string;
          }>(
            "SELECT id,connection_id,external_id,name,type FROM external_accounts WHERE workspace_id=$1 ORDER BY name",
            [workspaceId],
          );
          return connections.rows.map((item) => ({
            id: item.id,
            brandId: item.brand_id,
            connector: item.connector,
            status: item.status,
            displayName: item.display_name,
            lastSyncAt: item.last_sync_at?.toISOString() ?? null,
            accounts: accounts.rows
              .filter((account) => account.connection_id === item.id)
              .map((account) => ({
                id: account.id,
                externalId: account.external_id,
                name: account.name,
                type: account.type,
              })),
          }));
        }),
    },
    connectionOAuth: {
      authorize: async (workspaceId, actorId, input) => {
        const exists = await withTenant(
          pool,
          workspaceId,
          async (client) =>
            (
              await client.query(
                "SELECT 1 FROM brands WHERE workspace_id=$1 AND id=$2",
                [workspaceId, input.brandId],
              )
            ).rowCount === 1,
        );
        if (!exists) return null;
        const connectionId = randomUUID();
        const state = await signConnectionOAuthState(
          {
            connectionId,
            workspaceId,
            brandId: input.brandId,
            actorId,
            connector: input.connector,
            returnTo: input.returnTo,
          },
          config.SESSION_SECRET,
        );
        return connectors
          .get(input.connector)
          .buildAuthorizationUrl(
            connectorOAuthConfig(config, input.connector),
            state,
            connectorScopes(input.connector),
          )
          .toString();
      },
      complete: async (code, stateToken) => {
        if (!config.CREDENTIAL_ENCRYPTION_KEY)
          throw new Error("Credential encryption is unavailable");
        const credentialEncryptionKey = config.CREDENTIAL_ENCRYPTION_KEY;
        const state = await verifyConnectionOAuthState(
          stateToken,
          config.SESSION_SECRET,
        );
        const connector = connectors.get(state.connector);
        const credential = await connector.exchangeCode(
          connectorOAuthConfig(config, state.connector),
          code,
        );
        const assets = await connector.discoverAssets({
          credential,
          requestId: state.connectionId,
        });
        await withTenant(pool, state.workspaceId, async (client) => {
          const membership = await client.query(
            "SELECT 1 FROM workspace_members WHERE workspace_id=$1 AND user_id=$2",
            [state.workspaceId, state.actorId],
          );
          if (!membership.rowCount)
            throw new Error("Workspace membership is no longer active");
          await client.query(
            "INSERT INTO connections (id,workspace_id,brand_id,connector,status,display_name,scopes,credential_ciphertext,expires_at) VALUES ($1,$2,$3,$4,'connected',$5,$6,$7,$8)",
            [
              state.connectionId,
              state.workspaceId,
              state.brandId,
              state.connector,
              connector.manifest().name,
              credential.scopes,
              encryptSecret(
                JSON.stringify({
                  ...credential,
                  expiresAt: credential.expiresAt?.toISOString(),
                }),
                credentialEncryptionKey,
              ),
              credential.expiresAt ?? null,
            ],
          );
          for (const asset of assets)
            await client.query(
              "INSERT INTO external_accounts (workspace_id,connection_id,external_id,name,type,currency,time_zone,metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (connection_id,external_id) DO UPDATE SET name=EXCLUDED.name,currency=EXCLUDED.currency,time_zone=EXCLUDED.time_zone,metadata=EXCLUDED.metadata",
              [
                state.workspaceId,
                state.connectionId,
                asset.id,
                asset.name,
                asset.type,
                asset.currency ?? null,
                asset.timeZone ?? null,
                asset.metadata ?? {},
              ],
            );
          await client.query(
            "INSERT INTO audit_events (workspace_id,actor_user_id,action,target_type,target_id,request_id,metadata) VALUES ($1,$2,'connection.created','connection',$3,$3,$4)",
            [
              state.workspaceId,
              state.actorId,
              state.connectionId,
              { connector: state.connector, assetCount: assets.length },
            ],
          );
        });
        if (!config.PUBLIC_APP_URL)
          throw new Error("PUBLIC_APP_URL is required for OAuth redirects");
        return new URL(state.returnTo, config.PUBLIC_APP_URL).toString();
      },
    },
    syncJobs: {
      enqueue: async (workspaceId, actorId, requestId, input) => {
        const id = randomUUID();
        const record = await withTenant(pool, workspaceId, async (client) => {
          const result = await client.query<{
            connector: ConnectorKey;
            brand_id: string;
            external_id: string;
          }>(
            "SELECT c.connector, c.brand_id, ea.external_id FROM connections c JOIN external_accounts ea ON ea.connection_id = c.id AND ea.workspace_id = c.workspace_id WHERE c.workspace_id = $1 AND c.id = $2 AND ea.id = $3 AND c.status IN ('connected','degraded')",
            [workspaceId, input.connectionId, input.externalAccountId],
          );
          const row = result.rows[0];
          if (!row || row.connector !== input.connector) return null;
          await client.query(
            "INSERT INTO sync_jobs (id, workspace_id, connection_id, external_account_id, mode, status) VALUES ($1,$2,$3,$4,$5,'queued')",
            [
              id,
              workspaceId,
              input.connectionId,
              input.externalAccountId,
              input.mode,
            ],
          );
          await client.query(
            "INSERT INTO audit_events (workspace_id, actor_user_id, action, target_type, target_id, request_id, metadata) VALUES ($1,$2,'sync.enqueued','sync_job',$3,$4,$5)",
            [
              workspaceId,
              actorId,
              id,
              requestId,
              { connector: input.connector },
            ],
          );
          return { ...row, id };
        });
        if (!record) return null;
        const envelope: SyncJob = {
          version: 1,
          id,
          workspaceId,
          brandId: record.brand_id,
          correlationId: requestId,
          createdAt: new Date().toISOString(),
          payload: {
            connector: input.connector,
            connectionId: input.connectionId,
            externalAccountId: input.externalAccountId,
            externalAssetId: record.external_id,
            mode: input.mode,
            from: input.from,
            to: input.to,
          },
        };
        try {
          await ensureRedis();
          await syncQueue.add("sync", envelope, {
            jobId: deterministicJobId("sync", id),
          });
        } catch (error) {
          await withTenant(pool, workspaceId, async (client) => {
            await client.query(
              "UPDATE sync_jobs SET status='failed', error=$2 WHERE id=$1",
              [
                id,
                error instanceof Error ? error.message : "Queue unavailable",
              ],
            );
          });
          throw error;
        }
        return {
          id,
          connector: input.connector,
          status: "queued" as const,
          requestId,
        };
      },
    },
    close: async () => {
      await syncQueue.close();
      if (redis.status !== "end") redis.disconnect();
      await pool.end();
    },
  };
}

function googleOAuthConfig(config: Config): OAuthConfig {
  if (
    !config.GOOGLE_CLIENT_ID ||
    !config.GOOGLE_CLIENT_SECRET ||
    !config.GOOGLE_REDIRECT_URI
  )
    throw new Error("Google OAuth configuration is incomplete");
  return {
    clientId: config.GOOGLE_CLIENT_ID,
    clientSecret: config.GOOGLE_CLIENT_SECRET,
    redirectUri: config.GOOGLE_REDIRECT_URI,
  };
}

function connectorOAuthConfig(
  config: Config,
  connector: ConnectorKey,
): OAuthConfig {
  if (connector === "meta") {
    if (
      !config.META_APP_ID ||
      !config.META_APP_SECRET ||
      !config.META_REDIRECT_URI
    )
      throw new Error("Meta OAuth configuration is incomplete");
    return {
      clientId: config.META_APP_ID,
      clientSecret: config.META_APP_SECRET,
      redirectUri: config.META_REDIRECT_URI,
    };
  }
  if (connector === "tiktok") {
    if (
      !config.TIKTOK_CLIENT_KEY ||
      !config.TIKTOK_CLIENT_SECRET ||
      !config.TIKTOK_REDIRECT_URI
    )
      throw new Error("TikTok OAuth configuration is incomplete");
    return {
      clientId: config.TIKTOK_CLIENT_KEY,
      clientSecret: config.TIKTOK_CLIENT_SECRET,
      redirectUri: config.TIKTOK_REDIRECT_URI,
    };
  }
  return googleOAuthConfig(config);
}

function connectorScopes(connector: ConnectorKey): string[] {
  if (connector === "google_ads")
    return ["https://www.googleapis.com/auth/adwords"];
  if (connector === "search_console")
    return ["https://www.googleapis.com/auth/webmasters.readonly"];
  if (connector === "ga4")
    return ["https://www.googleapis.com/auth/analytics.readonly"];
  if (connector === "youtube")
    return [
      "https://www.googleapis.com/auth/youtube.readonly",
      "https://www.googleapis.com/auth/yt-analytics.readonly",
    ];
  if (connector === "meta")
    return [
      "pages_show_list",
      "pages_read_engagement",
      "read_insights",
      "instagram_basic",
      "instagram_manage_insights",
      "ads_read",
    ];
  if (connector === "tiktok") return ["user.info.basic", "video.list"];
  throw new Error(`OAuth is not implemented for ${connector}`);
}

function totals(rows: MetricRow[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const row of rows)
    for (const [key, value] of Object.entries(row.metrics))
      result[key] = (result[key] ?? 0) + value;
  return result;
}
