import type { Capability, ConnectorKey } from "@anycol/contracts";
import type {
  CanonicalFact,
  Connector,
  ConnectorContext,
  ConnectorManifest,
  Credential,
  ExternalAsset,
  OAuthConfig,
  RawBatch,
  SyncRequest,
} from "@anycol/connectors-core";

export class CapabilityOnlyConnector implements Connector {
  constructor(private readonly definition: ConnectorManifest) {}
  manifest(): ConnectorManifest {
    return this.definition;
  }
  buildAuthorizationUrl(
    _config: OAuthConfig,
    _state: string,
    _scopes: string[],
  ): URL {
    throw new Error(
      `${this.definition.name} OAuth implementation requires provider approval`,
    );
  }
  async exchangeCode(_config: OAuthConfig, _code: string): Promise<Credential> {
    throw new Error(`${this.definition.name} is not configured`);
  }
  async refreshCredential(
    _config: OAuthConfig,
    _credential: Credential,
  ): Promise<Credential> {
    throw new Error(`${this.definition.name} is not configured`);
  }
  async discoverAssets(_context: ConnectorContext): Promise<ExternalAsset[]> {
    return [];
  }
  async *backfill(
    _context: ConnectorContext,
    _request: SyncRequest,
  ): AsyncIterable<RawBatch> {
    yield* [] as RawBatch[];
  }
  async *incrementalSync(
    _context: ConnectorContext,
    _request: SyncRequest,
  ): AsyncIterable<RawBatch> {
    yield* [] as RawBatch[];
  }
  async normalize(
    _batch: RawBatch,
    _asset: ExternalAsset,
  ): Promise<CanonicalFact[]> {
    return [];
  }
  async health(
    _context: ConnectorContext,
  ): Promise<{ ok: boolean; detail?: string }> {
    return {
      ok: false,
      detail: "Provider credentials or approval are not configured",
    };
  }
}

export function providerManifest(
  key: ConnectorKey,
  name: string,
  capabilities: Capability[],
  status: ConnectorManifest["status"] = "approval_required",
): ConnectorManifest {
  return { key, name, capabilities, oauth: true, status };
}
