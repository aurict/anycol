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

const SCOPE = "https://www.googleapis.com/auth/analytics.readonly";

export class Ga4Connector implements Connector {
  manifest(): ConnectorManifest {
    return {
      key: "ga4",
      name: "Google Analytics 4",
      capabilities: ["assets.read", "analytics.read"],
      oauth: true,
      status: "available",
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
    const response = await checkedFetch(
      "https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200",
      { headers: auth(context), signal: context.signal },
    );
    const body = (await response.json()) as {
      accountSummaries?: Array<{
        account?: string;
        displayName?: string;
        propertySummaries?: Array<{
          property: string;
          displayName?: string;
          propertyType?: string;
        }>;
      }>;
    };
    return (body.accountSummaries ?? []).flatMap((account) =>
      (account.propertySummaries ?? []).map((property) => ({
        id: property.property.replace("properties/", ""),
        name: property.displayName ?? property.property,
        type: "ga4_property",
        parentId: account.account,
        metadata: {
          accountName: account.displayName,
          propertyType: property.propertyType,
        },
      })),
    );
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
    let offset = request.cursor ? Number(request.cursor) : 0;
    const limit = 100_000;
    do {
      const response = await checkedFetch(
        `https://analyticsdata.googleapis.com/v1beta/properties/${request.externalAssetId}:runReport`,
        {
          method: "POST",
          headers: { ...auth(context), "content-type": "application/json" },
          body: JSON.stringify({
            dateRanges: [
              {
                startDate: isoDate(request.from),
                endDate: isoDate(request.to),
              },
            ],
            dimensions: [
              { name: "date" },
              { name: "sessionSourceMedium" },
              { name: "landingPagePlusQueryString" },
              { name: "deviceCategory" },
            ],
            metrics: [
              { name: "activeUsers" },
              { name: "sessions" },
              { name: "engagedSessions" },
              { name: "keyEvents" },
              { name: "totalRevenue" },
            ],
            limit,
            offset,
            returnPropertyQuota: true,
          }),
          signal: context.signal,
        },
      );
      const body = (await response.json()) as Ga4Response;
      const next =
        offset + (body.rows?.length ?? 0) < Number(body.rowCount ?? 0)
          ? String(offset + limit)
          : undefined;
      yield {
        source: "ga4",
        schemaVersion: 1,
        rows: body.rows ?? [],
        nextCursor: next,
        quality: body.metadata?.dataLossFromOtherRow
          ? "limited"
          : body.metadata?.samplingMetadatas?.length
            ? "sampled"
            : "final",
        metadata: {
          dimensionHeaders: body.dimensionHeaders,
          metricHeaders: body.metricHeaders,
          propertyQuota: body.propertyQuota,
        },
      };
      if (!next) break;
      offset += limit;
    } while (true);
  }

  async normalize(
    batch: RawBatch,
    asset: ExternalAsset,
  ): Promise<CanonicalFact[]> {
    return (batch.rows as Ga4Row[]).map((row) => ({
      source: "ga4",
      externalAssetId: asset.id,
      date: gaDate(row.dimensionValues?.[0]?.value),
      dimensions: {
        source_medium: row.dimensionValues?.[1]?.value ?? "",
        landing_page: row.dimensionValues?.[2]?.value ?? "",
        device: row.dimensionValues?.[3]?.value ?? "",
      },
      metrics: {
        active_users: num(row.metricValues?.[0]?.value),
        sessions: num(row.metricValues?.[1]?.value),
        engaged_sessions: num(row.metricValues?.[2]?.value),
        conversions: num(row.metricValues?.[3]?.value),
        conversion_value: num(row.metricValues?.[4]?.value),
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
        detail: error instanceof Error ? error.message : "Unknown GA4 error",
      };
    }
  }
}

type Ga4Row = {
  dimensionValues?: Array<{ value?: string }>;
  metricValues?: Array<{ value?: string }>;
};
type Ga4Response = {
  rows?: Ga4Row[];
  rowCount?: number;
  dimensionHeaders?: unknown[];
  metricHeaders?: unknown[];
  propertyQuota?: unknown;
  metadata?: { dataLossFromOtherRow?: boolean; samplingMetadatas?: unknown[] };
};
function auth(context: ConnectorContext): Record<string, string> {
  return {
    authorization: `Bearer ${context.credential.accessToken}`,
    "x-request-id": context.requestId,
  };
}
function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}
function num(value?: string): number {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}
function gaDate(value?: string): string {
  return value?.length === 8
    ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
    : (value ?? "");
}
