import type { Capability, ConnectorKey } from "@anycol/contracts";

export type ConnectorManifest = {
  key: ConnectorKey;
  name: string;
  capabilities: Capability[];
  oauth: boolean;
  status: "available" | "approval_required" | "coming_soon";
};

export type OAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export type Credential = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scopes: string[];
};

export type ExternalAsset = {
  id: string;
  name: string;
  type: string;
  parentId?: string;
  currency?: string;
  timeZone?: string;
  metadata?: Record<string, unknown>;
};

export type SyncRequest = {
  workspaceId: string;
  brandId: string;
  connectionId: string;
  externalAssetId: string;
  from: Date;
  to: Date;
  cursor?: string;
};

export type RawBatch = {
  source: ConnectorKey;
  schemaVersion: number;
  rows: unknown[];
  nextCursor?: string;
  quality?: "final" | "fresh" | "partial" | "sampled" | "limited";
  metadata?: Record<string, unknown>;
};

export type CanonicalFact = {
  source: ConnectorKey;
  externalAssetId: string;
  date: string;
  dimensions: Record<string, string>;
  metrics: Record<string, number>;
  currency?: string;
  quality: "final" | "fresh" | "partial" | "sampled" | "limited";
};

export type ConnectorContext = {
  credential: Credential;
  signal?: AbortSignal;
  requestId: string;
};

export interface Connector {
  manifest(): ConnectorManifest;
  buildAuthorizationUrl(
    config: OAuthConfig,
    state: string,
    scopes: string[],
  ): URL;
  exchangeCode(
    config: OAuthConfig,
    code: string,
    signal?: AbortSignal,
  ): Promise<Credential>;
  refreshCredential(
    config: OAuthConfig,
    credential: Credential,
    signal?: AbortSignal,
  ): Promise<Credential>;
  discoverAssets(context: ConnectorContext): Promise<ExternalAsset[]>;
  backfill(
    context: ConnectorContext,
    request: SyncRequest,
  ): AsyncIterable<RawBatch>;
  incrementalSync(
    context: ConnectorContext,
    request: SyncRequest,
  ): AsyncIterable<RawBatch>;
  normalize(batch: RawBatch, asset: ExternalAsset): Promise<CanonicalFact[]>;
  health(context: ConnectorContext): Promise<{ ok: boolean; detail?: string }>;
}

export type PublishPayload = {
  idempotencyKey: string;
  text: string;
  mediaUrls: string[];
  scheduledFor: Date;
  options: Record<string, unknown>;
};

export interface PublisherConnector extends Connector {
  validatePublish(
    payload: PublishPayload,
  ): Promise<{ valid: boolean; errors: string[] }>;
  publish(
    context: ConnectorContext,
    asset: ExternalAsset,
    payload: PublishPayload,
  ): Promise<{
    externalId: string;
    url?: string;
    status: "processing" | "published";
  }>;
  getPublishStatus(
    context: ConnectorContext,
    externalId: string,
  ): Promise<{
    status: "processing" | "published" | "failed";
    detail?: string;
  }>;
}

export class ConnectorRegistry {
  readonly #connectors = new Map<ConnectorKey, Connector>();

  register(connector: Connector): this {
    const key = connector.manifest().key;
    if (this.#connectors.has(key))
      throw new Error(`Connector already registered: ${key}`);
    this.#connectors.set(key, connector);
    return this;
  }

  get(key: ConnectorKey): Connector {
    const connector = this.#connectors.get(key);
    if (!connector) throw new Error(`Connector is not registered: ${key}`);
    return connector;
  }

  manifests(): ConnectorManifest[] {
    return [...this.#connectors.values()].map((connector) =>
      connector.manifest(),
    );
  }
}

export class ConnectorHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryable: boolean,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

export async function checkedFetch(
  url: string | URL,
  init: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  const signal = init.signal
    ? AbortSignal.any([init.signal, controller.signal])
    : controller.signal;
  try {
    const response = await fetch(url, { ...init, signal });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      const retryAfter = response.headers.get("retry-after");
      throw new ConnectorHttpError(
        `Provider returned ${response.status}: ${detail}`,
        response.status,
        response.status === 429 || response.status >= 500,
        retryAfter ? Number(retryAfter) : undefined,
      );
    }
    return response;
  } finally {
    clearTimeout(timeout);
  }
}
