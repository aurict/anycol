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

const API = "https://open.tiktokapis.com/v2";

export class TikTokConnector implements Connector {
  constructor(private readonly configured = true) {}

  manifest(): ConnectorManifest {
    return {
      key: "tiktok",
      name: "TikTok Organic",
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
    const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
    url.search = new URLSearchParams({
      client_key: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      scope: scopes.join(","),
      state,
    }).toString();
    return url;
  }

  exchangeCode(
    config: OAuthConfig,
    code: string,
    signal?: AbortSignal,
  ): Promise<Credential> {
    return token(
      config,
      new URLSearchParams({
        client_key: config.clientId,
        client_secret: config.clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: config.redirectUri,
      }),
      undefined,
      signal,
    );
  }

  refreshCredential(
    config: OAuthConfig,
    credential: Credential,
    signal?: AbortSignal,
  ): Promise<Credential> {
    if (!credential.refreshToken)
      throw new Error("TikTok credential has no refresh token");
    return token(
      config,
      new URLSearchParams({
        client_key: config.clientId,
        client_secret: config.clientSecret,
        grant_type: "refresh_token",
        refresh_token: credential.refreshToken,
      }),
      credential,
      signal,
    );
  }

  async discoverAssets(context: ConnectorContext): Promise<ExternalAsset[]> {
    const response = await checkedFetch(
      `${API}/user/info/?fields=open_id,union_id,avatar_url,display_name`,
      { headers: authHeaders(context), signal: context.signal },
    );
    const value = (await response.json()) as TikTokResponse<{
      user?: {
        open_id?: string;
        union_id?: string;
        display_name?: string;
        avatar_url?: string;
      };
    }>;
    assertTikTok(value);
    const user = value.data?.user;
    if (!user?.open_id) throw new Error("TikTok account identifier is missing");
    return [
      {
        id: user.open_id,
        name: user.display_name ?? "TikTok hesabı",
        type: "tiktok_creator",
        metadata: {
          unionId: user.union_id,
          avatarUrl: user.avatar_url,
        },
      },
    ];
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
    let cursor = request.cursor ? Number(request.cursor) : 0;
    for (let page = 0; page < 20; page += 1) {
      const response = await checkedFetch(
        `${API}/video/list/?fields=id,title,video_description,duration,cover_image_url,embed_link,like_count,comment_count,share_count,view_count,create_time`,
        {
          method: "POST",
          headers: {
            ...authHeaders(context),
            "content-type": "application/json",
          },
          body: JSON.stringify({ max_count: 20, cursor }),
          signal: context.signal,
        },
      );
      const value = (await response.json()) as TikTokResponse<{
        videos?: TikTokVideo[];
        cursor?: number;
        has_more?: boolean;
      }>;
      assertTikTok(value);
      const videos = (value.data?.videos ?? []).filter((video) => {
        const created = new Date(video.create_time * 1000);
        return created >= request.from && created <= request.to;
      });
      const nextCursor = value.data?.cursor;
      yield {
        source: "tiktok",
        schemaVersion: 2,
        rows: videos,
        nextCursor:
          value.data?.has_more && nextCursor !== undefined
            ? String(nextCursor)
            : undefined,
        quality: "fresh",
        metadata: { dataset: "creator_videos" },
      };
      if (!value.data?.has_more || nextCursor === undefined) break;
      cursor = nextCursor;
    }
  }

  async normalize(
    batch: RawBatch,
    asset: ExternalAsset,
  ): Promise<CanonicalFact[]> {
    return (batch.rows as TikTokVideo[]).map((video) => ({
      source: "tiktok",
      externalAssetId: asset.id,
      date: new Date(video.create_time * 1000).toISOString().slice(0, 10),
      dimensions: {
        channel: "tiktok",
        video_id: video.id,
      },
      metrics: {
        impressions: number(video.view_count),
        video_views: number(video.view_count),
        engagements:
          number(video.like_count) +
          number(video.comment_count) +
          number(video.share_count),
        likes: number(video.like_count),
        comments: number(video.comment_count),
        shares: number(video.share_count),
        content_published: 1,
      },
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
        detail: error instanceof Error ? error.message : "Unknown TikTok error",
      };
    }
  }
}

type TikTokResponse<T> = {
  data?: T;
  error?: { code?: string; message?: string; log_id?: string };
};

type TikTokVideo = {
  id: string;
  create_time: number;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
};

function authHeaders(context: ConnectorContext) {
  return {
    authorization: `Bearer ${context.credential.accessToken}`,
    "x-request-id": context.requestId,
  };
}

async function token(
  _config: OAuthConfig,
  body: URLSearchParams,
  previous?: Credential,
  signal?: AbortSignal,
): Promise<Credential> {
  const response = await checkedFetch(`${API}/oauth/token/`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    signal,
  });
  const value = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
    error_description?: string;
  };
  if (!value.access_token)
    throw new Error(
      value.error_description ?? value.error ?? "TikTok token exchange failed",
    );
  return {
    accessToken: value.access_token,
    refreshToken: value.refresh_token ?? previous?.refreshToken,
    expiresAt: value.expires_in
      ? new Date(Date.now() + value.expires_in * 1000)
      : undefined,
    scopes: value.scope?.split(",").filter(Boolean) ?? previous?.scopes ?? [],
  };
}

function assertTikTok(value: { error?: { code?: string; message?: string } }) {
  if (value.error?.code && value.error.code !== "ok")
    throw new Error(
      value.error.message ?? `TikTok API error: ${value.error.code}`,
    );
}

function number(value: number | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
}
