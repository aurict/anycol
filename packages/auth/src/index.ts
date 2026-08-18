import { SignJWT, jwtVerify } from "jose";
import { createHash } from "node:crypto";
import {
  Id,
  WorkspaceRole,
  type WorkspaceRole as WorkspaceRoleType,
} from "@anycol/contracts";
import {
  ConnectorKey,
  type ConnectorKey as ConnectorKeyType,
} from "@anycol/contracts";

export type Permission =
  | "workspace.manage"
  | "brand.read"
  | "brand.manage"
  | "connection.manage"
  | "analytics.read"
  | "content.write"
  | "content.approve"
  | "content.publish"
  | "report.write"
  | "billing.manage";

const rolePermissions: Record<WorkspaceRoleType, ReadonlySet<Permission>> = {
  owner: new Set([
    "workspace.manage",
    "brand.read",
    "brand.manage",
    "connection.manage",
    "analytics.read",
    "content.write",
    "content.approve",
    "content.publish",
    "report.write",
    "billing.manage",
  ]),
  admin: new Set([
    "workspace.manage",
    "brand.read",
    "brand.manage",
    "connection.manage",
    "analytics.read",
    "content.write",
    "content.approve",
    "content.publish",
    "report.write",
  ]),
  strategist: new Set([
    "brand.read",
    "analytics.read",
    "content.write",
    "content.approve",
    "content.publish",
    "report.write",
  ]),
  editor: new Set(["brand.read", "analytics.read", "content.write"]),
  analyst: new Set(["brand.read", "analytics.read", "report.write"]),
  approver: new Set(["brand.read", "analytics.read", "content.approve"]),
  viewer: new Set(["brand.read", "analytics.read"]),
};

export function can(role: WorkspaceRoleType, permission: Permission): boolean {
  return rolePermissions[role]?.has(permission) ?? false;
}

export type AccessClaims = {
  sub: string;
  workspaceId: string;
  role: WorkspaceRoleType;
  email?: string;
};

export function oidcSubjectId(issuer: string, subject: string): string {
  const digest = createHash("sha256")
    .update(`${issuer.replace(/\/$/, "")}\0${subject}`)
    .digest();
  digest[6] = (digest[6]! & 0x0f) | 0x50;
  digest[8] = (digest[8]! & 0x3f) | 0x80;
  const hex = digest.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function key(secret: string): Uint8Array {
  if (secret.length < 32)
    throw new Error("SESSION_SECRET must be at least 32 characters");
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(
  claims: AccessClaims,
  secret: string,
  audience = "anycol-api",
): Promise<string> {
  Id.parse(claims.sub);
  Id.parse(claims.workspaceId);
  return new SignJWT({
    workspaceId: claims.workspaceId,
    role: claims.role,
    email: claims.email,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(claims.sub)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(key(secret));
}

export async function verifyAccessToken(
  token: string,
  secret: string,
  audience = "anycol-api",
): Promise<AccessClaims> {
  const { payload } = await jwtVerify(token, key(secret), { audience });
  const role = WorkspaceRole.safeParse(payload.role);
  const subject = Id.safeParse(payload.sub);
  const workspaceId = Id.safeParse(payload.workspaceId);
  if (!subject.success || !workspaceId.success || !role.success) {
    throw new Error("Invalid access token claims");
  }
  return {
    sub: subject.data,
    workspaceId: workspaceId.data,
    role: role.data,
    email: typeof payload.email === "string" ? payload.email : undefined,
  };
}

export type OidcState = { returnTo: string; nonce: string; verifier: string };

export async function signOidcState(
  state: OidcState,
  secret: string,
): Promise<string> {
  return new SignJWT(state)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setAudience("anycol-oidc-state")
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(key(secret));
}

export async function verifyOidcState(
  token: string,
  secret: string,
): Promise<OidcState> {
  const { payload } = await jwtVerify(token, key(secret), {
    audience: "anycol-oidc-state",
  });
  if (
    typeof payload.returnTo !== "string" ||
    !payload.returnTo.startsWith("/") ||
    payload.returnTo.startsWith("//") ||
    typeof payload.nonce !== "string" ||
    typeof payload.verifier !== "string"
  ) {
    throw new Error("Invalid OIDC state");
  }
  return {
    returnTo: payload.returnTo,
    nonce: payload.nonce,
    verifier: payload.verifier,
  };
}

export type ConnectionOAuthState = {
  connectionId: string;
  workspaceId: string;
  brandId: string;
  actorId: string;
  connector: ConnectorKeyType;
  returnTo: string;
};

export async function signConnectionOAuthState(
  state: ConnectionOAuthState,
  secret: string,
): Promise<string> {
  Id.parse(state.connectionId);
  Id.parse(state.workspaceId);
  Id.parse(state.brandId);
  Id.parse(state.actorId);
  ConnectorKey.parse(state.connector);
  if (!state.returnTo.startsWith("/") || state.returnTo.startsWith("//"))
    throw new Error("Invalid connection return path");
  return new SignJWT(state)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setAudience("anycol-connection-oauth")
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(key(secret));
}

export async function verifyConnectionOAuthState(
  token: string,
  secret: string,
): Promise<ConnectionOAuthState> {
  const { payload } = await jwtVerify(token, key(secret), {
    audience: "anycol-connection-oauth",
  });
  const value = {
    connectionId: payload.connectionId,
    workspaceId: payload.workspaceId,
    brandId: payload.brandId,
    actorId: payload.actorId,
    connector: payload.connector,
    returnTo: payload.returnTo,
  };
  const ids = [
    value.connectionId,
    value.workspaceId,
    value.brandId,
    value.actorId,
  ].map((item) => Id.safeParse(item));
  const connector = ConnectorKey.safeParse(value.connector);
  if (
    ids.some((item) => !item.success) ||
    !connector.success ||
    typeof value.returnTo !== "string" ||
    !value.returnTo.startsWith("/") ||
    value.returnTo.startsWith("//")
  )
    throw new Error("Invalid connection OAuth state");
  return {
    connectionId: ids[0]!.data!,
    workspaceId: ids[1]!.data!,
    brandId: ids[2]!.data!,
    actorId: ids[3]!.data!,
    connector: connector.data,
    returnTo: value.returnTo,
  };
}
