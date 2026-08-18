import {
  checkedFetch,
  type CanonicalFact,
  type Connector,
  type ConnectorContext,
  type ConnectorManifest,
  type Credential,
  type ExternalAsset,
  type OAuthConfig,
  type RawBatch,
  type SyncRequest,
} from "@anycol/connectors-core";

const API = "https://googleads.googleapis.com/v25";
const SCOPE = "https://www.googleapis.com/auth/adwords";

export class GoogleAdsConnector implements Connector {
  constructor(
    private readonly developerToken?: string,
    private readonly loginCustomerId?: string,
  ) {}

  manifest(): ConnectorManifest {
    return {
      key: "google_ads",
      name: "Google Ads",
      capabilities: ["assets.read", "ads.read"],
      oauth: true,
      status: this.developerToken ? "available" : "approval_required",
    };
  }
  buildAuthorizationUrl(
    config: OAuthConfig,
    state: string,
    scopes = [SCOPE],
  ): URL {
    return googleAuthUrl(config, state, scopes);
  }
  exchangeCode(
    config: OAuthConfig,
    code: string,
    signal?: AbortSignal,
  ): Promise<Credential> {
    return exchangeGoogleCode(config, code, signal);
  }
  refreshCredential(
    config: OAuthConfig,
    credential: Credential,
    signal?: AbortSignal,
  ): Promise<Credential> {
    return refreshGoogleCredential(config, credential, signal);
  }

  async discoverAssets(context: ConnectorContext): Promise<ExternalAsset[]> {
    this.assertConfigured();
    const response = await checkedFetch(
      `${API}/customers:listAccessibleCustomers`,
      { headers: this.headers(context), signal: context.signal },
    );
    const body = (await response.json()) as { resourceNames?: string[] };
    return (body.resourceNames ?? []).map((resourceName) => ({
      id: resourceName.replace("customers/", ""),
      name: resourceName,
      type: "google_ads_customer",
    }));
  }

  async *backfill(
    context: ConnectorContext,
    request: SyncRequest,
  ): AsyncIterable<RawBatch> {
    yield* this.query(context, request);
  }
  async *incrementalSync(
    context: ConnectorContext,
    request: SyncRequest,
  ): AsyncIterable<RawBatch> {
    yield* this.query(context, request);
  }

  private async *query(
    context: ConnectorContext,
    request: SyncRequest,
  ): AsyncIterable<RawBatch> {
    this.assertConfigured();
    const query = `SELECT segments.date, campaign.id, campaign.name, campaign.status, customer.currency_code, customer.time_zone, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value FROM campaign WHERE segments.date BETWEEN '${isoDate(request.from)}' AND '${isoDate(request.to)}'`;
    const response = await checkedFetch(
      `${API}/customers/${request.externalAssetId}/googleAds:searchStream`,
      {
        method: "POST",
        headers: {
          ...this.headers(context),
          "content-type": "application/json",
        },
        body: JSON.stringify({ query }),
        signal: context.signal,
      },
    );
    const batches = (await response.json()) as Array<{
      results?: unknown[];
      requestId?: string;
    }>;
    for (const batch of batches)
      yield {
        source: "google_ads",
        schemaVersion: 25,
        rows: batch.results ?? [],
        quality: "fresh",
        metadata: { providerRequestId: batch.requestId },
      };
  }

  async normalize(
    batch: RawBatch,
    asset: ExternalAsset,
  ): Promise<CanonicalFact[]> {
    return (batch.rows as GoogleAdsRow[]).map((row) => ({
      source: "google_ads",
      externalAssetId: asset.id,
      date: row.segments?.date ?? "",
      dimensions: {
        campaign_id: row.campaign?.id ?? "",
        campaign_name: row.campaign?.name ?? "",
        campaign_status: row.campaign?.status ?? "",
      },
      metrics: {
        impressions: Number(row.metrics?.impressions ?? 0),
        clicks: Number(row.metrics?.clicks ?? 0),
        cost: Number(row.metrics?.costMicros ?? 0) / 1_000_000,
        conversions: Number(row.metrics?.conversions ?? 0),
        conversion_value: Number(row.metrics?.conversionsValue ?? 0),
      },
      currency: row.customer?.currencyCode,
      quality: batch.quality ?? "fresh",
    }));
  }

  async health(
    context: ConnectorContext,
  ): Promise<{ ok: boolean; detail?: string }> {
    try {
      await this.discoverAssets(context);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        detail:
          error instanceof Error ? error.message : "Unknown Google Ads error",
      };
    }
  }
  private assertConfigured() {
    if (!this.developerToken)
      throw new Error("GOOGLE_ADS_DEVELOPER_TOKEN is not configured");
  }
  private headers(context: ConnectorContext): Record<string, string> {
    return {
      authorization: `Bearer ${context.credential.accessToken}`,
      "developer-token": this.developerToken ?? "",
      ...(this.loginCustomerId
        ? { "login-customer-id": this.loginCustomerId }
        : {}),
      "x-request-id": context.requestId,
    };
  }
}

type GoogleAdsRow = {
  segments?: { date?: string };
  campaign?: { id?: string; name?: string; status?: string };
  customer?: { currencyCode?: string; timeZone?: string };
  metrics?: {
    impressions?: string;
    clicks?: string;
    costMicros?: string;
    conversions?: number;
    conversionsValue?: number;
  };
};

export function googleAuthUrl(
  config: OAuthConfig,
  state: string,
  scopes: string[],
): URL {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    state,
    scope: scopes.join(" "),
  }).toString();
  return url;
}
export async function exchangeGoogleCode(
  config: OAuthConfig,
  code: string,
  signal?: AbortSignal,
): Promise<Credential> {
  return googleToken(
    config,
    new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }),
    undefined,
    signal,
  );
}
export async function refreshGoogleCredential(
  config: OAuthConfig,
  credential: Credential,
  signal?: AbortSignal,
): Promise<Credential> {
  if (!credential.refreshToken)
    throw new Error("Google credential has no refresh token");
  return googleToken(
    config,
    new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: credential.refreshToken,
      grant_type: "refresh_token",
    }),
    credential,
    signal,
  );
}
async function googleToken(
  _config: OAuthConfig,
  body: URLSearchParams,
  previous?: Credential,
  signal?: AbortSignal,
): Promise<Credential> {
  const response = await checkedFetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    signal,
  });
  const value = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
  };
  return {
    accessToken: value.access_token,
    refreshToken: value.refresh_token ?? previous?.refreshToken,
    expiresAt: new Date(Date.now() + value.expires_in * 1000),
    scopes: value.scope?.split(" ") ?? previous?.scopes ?? [],
  };
}
function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}
