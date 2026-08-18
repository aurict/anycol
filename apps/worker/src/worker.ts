import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { getConfig } from "@anycol/config";
import { createDatabase, withTenant } from "@anycol/db";
import {
  decryptSecret,
  encryptSecret,
  type EncryptedValue,
} from "@anycol/security";
import { PublishJob, queueNames, SyncJob } from "@anycol/jobs";
import {
  ConnectorRegistry,
  type Credential,
  type ExternalAsset,
  type OAuthConfig,
} from "@anycol/connectors-core";
import { SearchConsoleConnector } from "@anycol/connector-search-console";
import { GoogleAdsConnector } from "@anycol/connector-google-ads";
import { Ga4Connector } from "@anycol/connector-ga4";
import { MetaConnector } from "@anycol/connector-meta";
import { TikTokConnector } from "@anycol/connector-tiktok";
import { YouTubeShortsConnector } from "@anycol/connector-youtube";
import type { ConnectorKey } from "@anycol/contracts";

const config = getConfig();
if (!config.DATABASE_URL)
  throw new Error("DATABASE_URL is required by the worker");
if (!config.CREDENTIAL_ENCRYPTION_KEY)
  throw new Error("CREDENTIAL_ENCRYPTION_KEY is required by the worker");
const encryptionKey = config.CREDENTIAL_ENCRYPTION_KEY;
const database = createDatabase(config.DATABASE_URL);
const connection = new IORedis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});
const registry = new ConnectorRegistry()
  .register(new SearchConsoleConnector())
  .register(new GoogleAdsConnector(config.GOOGLE_ADS_DEVELOPER_TOKEN))
  .register(new Ga4Connector())
  .register(new MetaConnector())
  .register(new TikTokConnector())
  .register(new YouTubeShortsConnector());

const syncWorker = new Worker(queueNames.sync, processSync, {
  connection,
  concurrency: 5,
  limiter: { max: 30, duration: 1_000 },
});
const publishWorker = new Worker(queueNames.publish, processPublish, {
  connection,
  concurrency: 10,
  limiter: { max: 20, duration: 1_000 },
});
const healthServer = createServer(async (request, response) => {
  response.setHeader("content-type", "application/json");
  if (request.url === "/health") {
    response.writeHead(200).end(
      JSON.stringify({
        status: "ok",
        service: "worker",
        version: config.APP_VERSION,
      }),
    );
    return;
  }
  if (request.url === "/ready") {
    try {
      await Promise.all([database.pool.query("SELECT 1"), connection.ping()]);
      response.writeHead(200).end(JSON.stringify({ status: "ready" }));
    } catch {
      response.writeHead(503).end(JSON.stringify({ status: "not_ready" }));
    }
    return;
  }
  response.writeHead(404).end(JSON.stringify({ status: "not_found" }));
});
healthServer.listen(config.WORKER_HEALTH_PORT, "0.0.0.0");

async function processSync(
  job: Job,
): Promise<{ synced: number; connector: string }> {
  const envelope = SyncJob.parse(job.data);
  const { workspaceId } = envelope;
  try {
    await updateSyncJob(workspaceId, envelope.id, "running");
    const stored = await withTenant(
      database.pool,
      workspaceId,
      async (client) => {
        const result = await client.query<{
          credential_ciphertext: EncryptedValue | null;
          expires_at: Date | null;
          brand_id: string;
          connector: string;
          external_id: string;
          external_account_id: string;
          name: string;
          type: string;
          currency: string | null;
          time_zone: string | null;
          metadata: Record<string, unknown>;
        }>(
          "SELECT c.credential_ciphertext, c.expires_at, c.brand_id, c.connector, ea.external_id, ea.id AS external_account_id, ea.name, ea.type, ea.currency, ea.time_zone, ea.metadata FROM connections c JOIN external_accounts ea ON ea.connection_id=c.id AND ea.workspace_id=c.workspace_id WHERE c.workspace_id=$1 AND c.id=$2 AND ea.id=$3",
          [
            workspaceId,
            envelope.payload.connectionId,
            envelope.payload.externalAccountId,
          ],
        );
        return result.rows[0] ?? null;
      },
    );
    if (!stored?.credential_ciphertext)
      throw new Error("Connection credential is unavailable");
    if (stored.connector !== envelope.payload.connector)
      throw new Error("Connector does not match the stored connection");
    const connector = registry.get(envelope.payload.connector);
    let credential = parseCredential(
      decryptSecret(stored.credential_ciphertext, encryptionKey),
    );
    if (
      credential.expiresAt &&
      credential.expiresAt.getTime() <= Date.now() + 5 * 60_000
    ) {
      credential = await connector.refreshCredential(
        connectorOAuthConfig(envelope.payload.connector),
        credential,
      );
      await withTenant(database.pool, workspaceId, async (client) => {
        await client.query(
          "UPDATE connections SET credential_ciphertext=$3, expires_at=$4, updated_at=now() WHERE workspace_id=$1 AND id=$2",
          [
            workspaceId,
            envelope.payload.connectionId,
            encryptSecret(
              JSON.stringify(serializeCredential(credential)),
              encryptionKey,
            ),
            credential.expiresAt ?? null,
          ],
        );
      });
    }
    const context = { credential, requestId: envelope.correlationId };
    const asset: ExternalAsset = {
      id: stored.external_id,
      name: stored.name,
      type: stored.type,
      currency: stored.currency ?? undefined,
      timeZone: stored.time_zone ?? undefined,
      metadata: stored.metadata,
    };
    const request = {
      workspaceId,
      brandId: stored.brand_id,
      connectionId: envelope.payload.connectionId,
      externalAssetId: stored.external_id,
      from: new Date(envelope.payload.from),
      to: new Date(envelope.payload.to),
      cursor: envelope.payload.cursor,
    };
    const batches =
      envelope.payload.mode === "backfill"
        ? connector.backfill(context, request)
        : connector.incrementalSync(context, request);
    let synced = 0;
    for await (const batch of batches) {
      const facts = await connector.normalize(batch, asset);
      await withTenant(database.pool, workspaceId, async (client) => {
        for (const fact of facts) {
          const dimensions = stableObject(fact.dimensions);
          const dimensionsHash = createHash("sha256")
            .update(JSON.stringify(dimensions))
            .digest("hex");
          await client.query(
            "INSERT INTO metric_facts_daily (workspace_id,brand_id,connection_id,external_account_id,source,metric_date,dimensions_hash,dimensions,metrics,currency,quality,source_version) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (workspace_id,connection_id,external_account_id,metric_date,dimensions_hash) DO UPDATE SET dimensions=EXCLUDED.dimensions,metrics=EXCLUDED.metrics,currency=EXCLUDED.currency,quality=EXCLUDED.quality,source_version=EXCLUDED.source_version,updated_at=now()",
            [
              workspaceId,
              stored.brand_id,
              envelope.payload.connectionId,
              stored.external_account_id,
              fact.source,
              fact.date,
              dimensionsHash,
              dimensions,
              fact.metrics,
              fact.currency ?? null,
              fact.quality,
              String(batch.schemaVersion),
            ],
          );
        }
        await client.query(
          "UPDATE sync_jobs SET cursor=$3 WHERE workspace_id=$1 AND id=$2",
          [workspaceId, envelope.id, batch.nextCursor ?? null],
        );
      });
      synced += facts.length;
    }
    await withTenant(database.pool, workspaceId, async (client) => {
      await client.query(
        "UPDATE sync_jobs SET status='succeeded',completed_at=now(),error=NULL WHERE workspace_id=$1 AND id=$2",
        [workspaceId, envelope.id],
      );
      await client.query(
        "UPDATE connections SET status='connected',last_sync_at=now(),last_error=NULL,updated_at=now() WHERE workspace_id=$1 AND id=$2",
        [workspaceId, envelope.payload.connectionId],
      );
    });
    return { synced, connector: envelope.payload.connector };
  } catch (error) {
    await withTenant(database.pool, workspaceId, async (client) => {
      const message =
        error instanceof Error
          ? error.message.slice(0, 2_000)
          : "Unknown sync failure";
      await client.query(
        "UPDATE sync_jobs SET status='failed',completed_at=now(),error=$3 WHERE workspace_id=$1 AND id=$2",
        [workspaceId, envelope.id, message],
      );
      await client.query(
        "UPDATE connections SET status='degraded',last_error=$3,updated_at=now() WHERE workspace_id=$1 AND id=$2",
        [workspaceId, envelope.payload.connectionId, message],
      );
    }).catch(() => undefined);
    throw error;
  }
}

async function processPublish(job: Job): Promise<never> {
  const envelope = PublishJob.parse(job.data);
  const error =
    "No approved publisher adapter is configured for this connection";
  await withTenant(database.pool, envelope.workspaceId, async (client) => {
    await client.query(
      "UPDATE publish_jobs SET status='failed',error=$3,updated_at=now() WHERE workspace_id=$1 AND id=$2",
      [envelope.workspaceId, envelope.id, error],
    );
  });
  throw new Error(error);
}

async function updateSyncJob(
  workspaceId: string,
  id: string,
  status: "running",
) {
  await withTenant(database.pool, workspaceId, async (client) => {
    await client.query(
      "UPDATE sync_jobs SET status=$3,started_at=now(),attempts=attempts+1,error=NULL WHERE workspace_id=$1 AND id=$2",
      [workspaceId, id, status],
    );
  });
}

function googleOAuthConfig(): OAuthConfig {
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

function connectorOAuthConfig(connector: ConnectorKey): OAuthConfig {
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
  return googleOAuthConfig();
}

function parseCredential(value: string): Credential {
  const parsed = JSON.parse(value) as Omit<Credential, "expiresAt"> & {
    expiresAt?: string;
  };
  if (!parsed.accessToken || !Array.isArray(parsed.scopes))
    throw new Error("Stored credential is invalid");
  return {
    ...parsed,
    expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : undefined,
  };
}

function serializeCredential(value: Credential) {
  return { ...value, expiresAt: value.expiresAt?.toISOString() };
}

function stableObject(value: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(value).sort(([left], [right]) => left.localeCompare(right)),
  );
}

for (const worker of [syncWorker, publishWorker]) {
  worker.on("failed", (job, error) =>
    console.error(
      JSON.stringify({
        level: "error",
        queue: worker.name,
        jobId: job?.id,
        error: error.message,
      }),
    ),
  );
  worker.on("completed", (job) =>
    console.info(
      JSON.stringify({
        level: "info",
        queue: worker.name,
        jobId: job.id,
        message: "job completed",
      }),
    ),
  );
}

export async function shutdown(signal: string) {
  console.info(
    JSON.stringify({ level: "info", signal, message: "worker shutdown" }),
  );
  await Promise.all([syncWorker.close(), publishWorker.close()]);
  await new Promise<void>((resolve, reject) =>
    healthServer.close((error) => (error ? reject(error) : resolve())),
  );
  await connection.quit();
  await database.close();
}
