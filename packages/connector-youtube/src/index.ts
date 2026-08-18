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
import {
  exchangeGoogleCode,
  googleAuthUrl,
  refreshGoogleCredential,
} from "@anycol/connector-google-ads";

const DATA_API = "https://www.googleapis.com/youtube/v3";
const ANALYTICS_API = "https://youtubeanalytics.googleapis.com/v2";

export class YouTubeShortsConnector implements Connector {
  constructor(private readonly configured = true) {}

  manifest(): ConnectorManifest {
    return {
      key: "youtube",
      name: "YouTube + Shorts",
      capabilities: ["assets.read", "analytics.read", "content.read"],
      oauth: true,
      status: this.configured ? "available" : "approval_required",
    };
  }

  buildAuthorizationUrl(
    config: OAuthConfig,
    state: string,
    scopes: string[],
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
    const response = await checkedFetch(
      `${DATA_API}/channels?part=snippet,statistics&mine=true`,
      { headers: authHeaders(context), signal: context.signal },
    );
    const value = (await response.json()) as {
      items?: Array<{
        id: string;
        snippet?: {
          title?: string;
          customUrl?: string;
          thumbnails?: { default?: { url?: string } };
        };
        statistics?: {
          subscriberCount?: string;
          videoCount?: string;
          viewCount?: string;
        };
      }>;
    };
    return (value.items ?? []).map((channel) => ({
      id: channel.id,
      name: channel.snippet?.title ?? channel.id,
      type: "youtube_channel",
      metadata: {
        customUrl: channel.snippet?.customUrl,
        thumbnail: channel.snippet?.thumbnails?.default?.url,
        subscribers: number(channel.statistics?.subscriberCount),
        videos: number(channel.statistics?.videoCount),
        lifetimeViews: number(channel.statistics?.viewCount),
      },
    }));
  }

  async *backfill(
    context: ConnectorContext,
    request: SyncRequest,
  ): AsyncIterable<RawBatch> {
    yield await this.query(context, request);
  }
  async *incrementalSync(
    context: ConnectorContext,
    request: SyncRequest,
  ): AsyncIterable<RawBatch> {
    yield await this.query(context, request);
  }

  private async query(
    context: ConnectorContext,
    request: SyncRequest,
  ): Promise<RawBatch> {
    const params = new URLSearchParams({
      ids: `channel==${request.externalAssetId}`,
      startDate: isoDate(request.from),
      endDate: isoDate(request.to),
      metrics:
        "views,estimatedMinutesWatched,averageViewDuration,likes,comments,shares,subscribersGained",
      dimensions: "day,creatorContentType",
      filters: "creatorContentType==SHORTS",
      sort: "day",
    });
    const response = await checkedFetch(`${ANALYTICS_API}/reports?${params}`, {
      headers: authHeaders(context),
      signal: context.signal,
    });
    const value = (await response.json()) as YouTubeReport;
    const headers = (value.columnHeaders ?? []).map((item) => item.name);
    const rows = (value.rows ?? []).map((row) =>
      Object.fromEntries(headers.map((name, index) => [name, row[index]])),
    );
    return {
      source: "youtube",
      schemaVersion: 2,
      rows,
      quality: "final",
      metadata: { dataset: "shorts_analytics" },
    };
  }

  async normalize(
    batch: RawBatch,
    asset: ExternalAsset,
  ): Promise<CanonicalFact[]> {
    return (batch.rows as YouTubeAnalyticsRow[]).map((row) => ({
      source: "youtube",
      externalAssetId: asset.id,
      date: String(row.day),
      dimensions: {
        channel: "youtube_shorts",
        content_type: String(row.creatorContentType ?? "SHORTS"),
      },
      metrics: {
        impressions: number(row.views),
        video_views: number(row.views),
        watch_minutes: number(row.estimatedMinutesWatched),
        average_view_duration: number(row.averageViewDuration),
        engagements:
          number(row.likes) + number(row.comments) + number(row.shares),
        likes: number(row.likes),
        comments: number(row.comments),
        shares: number(row.shares),
        followers: number(row.subscribersGained),
      },
      quality: batch.quality ?? "final",
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
          error instanceof Error ? error.message : "Unknown YouTube error",
      };
    }
  }
}

type YouTubeReport = {
  columnHeaders?: Array<{ name: string }>;
  rows?: unknown[][];
};
type YouTubeAnalyticsRow = {
  day?: string;
  creatorContentType?: string;
  views?: string | number;
  estimatedMinutesWatched?: string | number;
  averageViewDuration?: string | number;
  likes?: string | number;
  comments?: string | number;
  shares?: string | number;
  subscribersGained?: string | number;
};

function authHeaders(context: ConnectorContext) {
  return {
    authorization: `Bearer ${context.credential.accessToken}`,
    "x-request-id": context.requestId,
  };
}
function number(value: string | number | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}
