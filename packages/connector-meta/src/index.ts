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

const GRAPH_VERSION = "v25.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

export class MetaConnector implements Connector {
  constructor(private readonly configured = true) {}

  manifest(): ConnectorManifest {
    return {
      key: "meta",
      name: "Instagram + Facebook + Meta Ads",
      capabilities: [
        "assets.read",
        "analytics.read",
        "ads.read",
        "content.read",
      ],
      oauth: true,
      status: this.configured ? "available" : "approval_required",
    };
  }

  buildAuthorizationUrl(
    config: OAuthConfig,
    state: string,
    scopes: string[],
  ): URL {
    const url = new URL(
      `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`,
    );
    url.search = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      state,
      scope: scopes.join(","),
    }).toString();
    return url;
  }

  async exchangeCode(
    config: OAuthConfig,
    code: string,
    signal?: AbortSignal,
  ): Promise<Credential> {
    const shortLived = await metaToken(
      new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        code,
      }),
      signal,
    );
    return exchangeLongLived(config, shortLived, signal);
  }

  refreshCredential(
    config: OAuthConfig,
    credential: Credential,
    signal?: AbortSignal,
  ): Promise<Credential> {
    return exchangeLongLived(config, credential, signal);
  }

  async discoverAssets(context: ConnectorContext): Promise<ExternalAsset[]> {
    const [pagesResponse, adsResponse] = await Promise.all([
      checkedFetch(
        `${GRAPH}/me/accounts?fields=id,name,instagram_business_account{id,username,name}&limit=100`,
        { headers: authHeaders(context), signal: context.signal },
      ),
      checkedFetch(
        `${GRAPH}/me/adaccounts?fields=id,name,currency,timezone_name&limit=100`,
        {
          headers: authHeaders(context),
          signal: context.signal,
        },
      ),
    ]);
    const pages = (await pagesResponse.json()) as MetaCollection<MetaPage>;
    const adAccounts =
      (await adsResponse.json()) as MetaCollection<MetaAdAccount>;
    const assets: ExternalAsset[] = [];
    for (const page of pages.data ?? []) {
      assets.push({
        id: `facebook:${page.id}`,
        name: page.name,
        type: "facebook_page",
        metadata: { providerId: page.id },
      });
      if (page.instagram_business_account)
        assets.push({
          id: `instagram:${page.instagram_business_account.id}`,
          name:
            page.instagram_business_account.username ??
            page.instagram_business_account.name ??
            `${page.name} Instagram`,
          type: "instagram_business_account",
          metadata: {
            providerId: page.instagram_business_account.id,
            pageId: page.id,
          },
        });
    }
    for (const account of adAccounts.data ?? [])
      assets.push({
        id: account.id,
        name: account.name,
        type: "meta_ad_account",
        currency: account.currency,
        timeZone: account.timezone_name,
      });
    return assets;
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
    const { kind, id } = parseAssetId(request.externalAssetId);
    const range = {
      from: isoDate(request.from),
      to: isoDate(request.to),
    };
    if (kind === "ads") {
      const params = new URLSearchParams({
        fields: "date_start,impressions,clicks,spend,actions",
        level: "account",
        time_increment: "1",
        time_range: JSON.stringify({ since: range.from, until: range.to }),
        limit: "500",
      });
      const value = await graphCollection<MetaAdsRow>(
        `${GRAPH}/${id}/insights?${params}`,
        context,
      );
      yield batch("meta_ads", value.data ?? [], value.paging?.next);
      return;
    }
    if (kind === "instagram") {
      const params = new URLSearchParams({
        fields:
          "id,caption,media_type,timestamp,permalink,like_count,comments_count",
        since: String(Math.floor(request.from.getTime() / 1000)),
        until: String(Math.ceil(request.to.getTime() / 1000)),
        limit: "100",
      });
      const value = await graphCollection<InstagramMediaRow>(
        `${GRAPH}/${id}/media?${params}`,
        context,
      );
      yield batch("instagram_media", value.data ?? [], value.paging?.next);
      return;
    }
    const params = new URLSearchParams({
      metric: "page_impressions,page_views_total,page_post_engagements",
      period: "day",
      since: range.from,
      until: range.to,
    });
    const value = await graphCollection<FacebookInsightRow>(
      `${GRAPH}/${id}/insights?${params}`,
      context,
    );
    yield batch("facebook_page", value.data ?? [], value.paging?.next);
  }

  async normalize(
    batchValue: RawBatch,
    asset: ExternalAsset,
  ): Promise<CanonicalFact[]> {
    const dataset = String(batchValue.metadata?.dataset ?? "");
    if (dataset === "meta_ads")
      return (batchValue.rows as MetaAdsRow[]).map((row) => ({
        source: "meta",
        externalAssetId: asset.id,
        date: row.date_start,
        dimensions: { channel: "meta_ads", account: asset.id },
        metrics: {
          impressions: number(row.impressions),
          clicks: number(row.clicks),
          cost: number(row.spend),
          conversions: conversionCount(row.actions),
        },
        currency: asset.currency,
        quality: batchValue.quality ?? "fresh",
      }));
    if (dataset === "instagram_media")
      return (batchValue.rows as InstagramMediaRow[]).map((row) => ({
        source: "meta",
        externalAssetId: asset.id,
        date: row.timestamp.slice(0, 10),
        dimensions: {
          channel: "instagram",
          media_id: row.id,
          media_type: row.media_type,
        },
        metrics: {
          content_published: 1,
          engagements: number(row.like_count) + number(row.comments_count),
        },
        quality: batchValue.quality ?? "fresh",
      }));
    return normalizeFacebookInsights(
      batchValue.rows as FacebookInsightRow[],
      asset,
      batchValue.quality ?? "fresh",
    );
  }

  async health(
    context: ConnectorContext,
  ): Promise<{ ok: boolean; detail?: string }> {
    try {
      await checkedFetch(`${GRAPH}/me?fields=id`, {
        headers: authHeaders(context),
        signal: context.signal,
      });
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        detail: error instanceof Error ? error.message : "Unknown Meta error",
      };
    }
  }
}

type MetaCollection<T> = {
  data?: T[];
  paging?: { next?: string };
};
type MetaPage = {
  id: string;
  name: string;
  instagram_business_account?: { id: string; username?: string; name?: string };
};
type MetaAdAccount = {
  id: string;
  name: string;
  currency?: string;
  timezone_name?: string;
};
type MetaAdsRow = {
  date_start: string;
  impressions?: string;
  clicks?: string;
  spend?: string;
  actions?: Array<{ action_type: string; value: string }>;
};
type InstagramMediaRow = {
  id: string;
  timestamp: string;
  media_type: string;
  like_count?: number;
  comments_count?: number;
};
type FacebookInsightRow = {
  name: string;
  values?: Array<{ value: number; end_time: string }>;
};

function authHeaders(context: ConnectorContext) {
  return {
    authorization: `Bearer ${context.credential.accessToken}`,
    "x-request-id": context.requestId,
  };
}

async function graphCollection<T>(
  url: string,
  context: ConnectorContext,
): Promise<MetaCollection<T>> {
  const response = await checkedFetch(url, {
    headers: authHeaders(context),
    signal: context.signal,
  });
  return (await response.json()) as MetaCollection<T>;
}

function batch(dataset: string, rows: unknown[], next?: string): RawBatch {
  return {
    source: "meta",
    schemaVersion: 25,
    rows,
    nextCursor: next,
    quality: "fresh",
    metadata: { dataset },
  };
}

async function metaToken(
  params: URLSearchParams,
  signal?: AbortSignal,
): Promise<Credential> {
  const response = await checkedFetch(`${GRAPH}/oauth/access_token?${params}`, {
    signal,
  });
  const value = (await response.json()) as {
    access_token: string;
    expires_in?: number;
  };
  return {
    accessToken: value.access_token,
    expiresAt: value.expires_in
      ? new Date(Date.now() + value.expires_in * 1000)
      : undefined,
    scopes: [],
  };
}

async function exchangeLongLived(
  config: OAuthConfig,
  credential: Credential,
  signal?: AbortSignal,
): Promise<Credential> {
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    fb_exchange_token: credential.accessToken,
  });
  const result = await metaToken(params, signal);
  return { ...result, scopes: credential.scopes };
}

function parseAssetId(value: string): {
  kind: "ads" | "instagram" | "facebook";
  id: string;
} {
  if (value.startsWith("act_")) return { kind: "ads", id: value };
  if (value.startsWith("instagram:"))
    return { kind: "instagram", id: value.slice("instagram:".length) };
  if (value.startsWith("facebook:"))
    return { kind: "facebook", id: value.slice("facebook:".length) };
  throw new Error("Unsupported Meta asset identifier");
}

function normalizeFacebookInsights(
  rows: FacebookInsightRow[],
  asset: ExternalAsset,
  quality: CanonicalFact["quality"],
): CanonicalFact[] {
  const dates = new Map<string, Record<string, number>>();
  const names: Record<string, string> = {
    page_impressions: "impressions",
    page_views_total: "page_views",
    page_post_engagements: "engagements",
  };
  for (const row of rows)
    for (const point of row.values ?? []) {
      const date = point.end_time.slice(0, 10);
      const metrics = dates.get(date) ?? {};
      metrics[names[row.name] ?? row.name] = number(point.value);
      dates.set(date, metrics);
    }
  return [...dates].map(([date, metrics]) => ({
    source: "meta",
    externalAssetId: asset.id,
    date,
    dimensions: { channel: "facebook", page: asset.id },
    metrics,
    quality,
  }));
}

function conversionCount(actions: MetaAdsRow["actions"]): number {
  return (actions ?? [])
    .filter((item) =>
      /purchase|lead|complete_registration/.test(item.action_type),
    )
    .reduce((sum, item) => sum + number(item.value), 0);
}
function number(value: string | number | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}
