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

const AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const API = "https://www.googleapis.com/webmasters/v3";
const READONLY = "https://www.googleapis.com/auth/webmasters.readonly";

type SearchRow = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

export class SearchConsoleConnector implements Connector {
  manifest(): ConnectorManifest {
    return {
      key: "search_console",
      name: "Google Search Console",
      capabilities: ["analytics.read", "assets.read"],
      oauth: true,
      status: "available",
    };
  }

  buildAuthorizationUrl(
    config: OAuthConfig,
    state: string,
    scopes = [READONLY],
  ): URL {
    const url = new URL(AUTH);
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

  async exchangeCode(
    config: OAuthConfig,
    code: string,
    signal?: AbortSignal,
  ): Promise<Credential> {
    const response = await checkedFetch(TOKEN, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: "authorization_code",
      }),
      signal,
    });
    const value = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope: string;
    };
    return {
      accessToken: value.access_token,
      refreshToken: value.refresh_token,
      expiresAt: new Date(Date.now() + value.expires_in * 1000),
      scopes: value.scope.split(" "),
    };
  }

  async refreshCredential(
    config: OAuthConfig,
    credential: Credential,
    signal?: AbortSignal,
  ): Promise<Credential> {
    if (!credential.refreshToken)
      throw new Error("Google credential has no refresh token");
    const response = await checkedFetch(TOKEN, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: credential.refreshToken,
        grant_type: "refresh_token",
      }),
      signal,
    });
    const value = (await response.json()) as {
      access_token: string;
      expires_in: number;
      scope?: string;
    };
    return {
      ...credential,
      accessToken: value.access_token,
      expiresAt: new Date(Date.now() + value.expires_in * 1000),
      scopes: value.scope?.split(" ") ?? credential.scopes,
    };
  }

  async discoverAssets(context: ConnectorContext): Promise<ExternalAsset[]> {
    const response = await checkedFetch(`${API}/sites`, {
      headers: auth(context),
      signal: context.signal,
    });
    const body = (await response.json()) as {
      siteEntry?: Array<{ siteUrl: string; permissionLevel: string }>;
    };
    return (body.siteEntry ?? []).map((site) => ({
      id: site.siteUrl,
      name: site.siteUrl,
      type: "search_console_property",
      metadata: { permissionLevel: site.permissionLevel },
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
    let startRow = request.cursor ? Number(request.cursor) : 0;
    const rowLimit = 25_000;
    do {
      const response = await checkedFetch(
        `${API}/sites/${encodeURIComponent(request.externalAssetId)}/searchAnalytics/query`,
        {
          method: "POST",
          headers: { ...auth(context), "content-type": "application/json" },
          body: JSON.stringify({
            startDate: isoDate(request.from),
            endDate: isoDate(request.to),
            dimensions: ["date", "query", "page", "country", "device"],
            dataState: "all",
            rowLimit,
            startRow,
          }),
          signal: context.signal,
        },
      );
      const body = (await response.json()) as {
        rows?: SearchRow[];
        metadata?: { first_incomplete_date?: string };
      };
      const rows = body.rows ?? [];
      const nextCursor =
        rows.length === rowLimit ? String(startRow + rowLimit) : undefined;
      yield {
        source: "search_console",
        schemaVersion: 1,
        rows,
        nextCursor,
        quality: body.metadata?.first_incomplete_date ? "fresh" : "final",
        metadata: {
          ...body.metadata,
          dimensions: ["date", "query", "page", "country", "device"],
        },
      };
      if (!nextCursor) break;
      startRow += rowLimit;
    } while (true);
  }

  async normalize(
    batch: RawBatch,
    asset: ExternalAsset,
  ): Promise<CanonicalFact[]> {
    const rows = batch.rows as SearchRow[];
    return rows.map((row) => ({
      source: "search_console",
      externalAssetId: asset.id,
      date: row.keys?.[0] ?? "",
      dimensions: {
        query: row.keys?.[1] ?? "",
        page: row.keys?.[2] ?? "",
        country: row.keys?.[3] ?? "",
        device: row.keys?.[4] ?? "",
      },
      metrics: {
        clicks: row.clicks ?? 0,
        impressions: row.impressions ?? 0,
        ctr: row.ctr ?? 0,
        average_position: row.position ?? 0,
      },
      quality: batch.quality ?? "final",
    }));
  }

  async health(
    context: ConnectorContext,
  ): Promise<{ ok: boolean; detail?: string }> {
    try {
      await checkedFetch(`${API}/sites`, {
        headers: auth(context),
        signal: context.signal,
      });
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        detail:
          error instanceof Error
            ? error.message
            : "Unknown Search Console error",
      };
    }
  }
}

function auth(context: ConnectorContext): Record<string, string> {
  return {
    authorization: `Bearer ${context.credential.accessToken}`,
    "x-request-id": context.requestId,
  };
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}
