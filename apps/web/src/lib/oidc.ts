import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { Id, WorkspaceRole } from "@anycol/contracts";
import {
  oidcSubjectId,
  signAccessToken,
  signOidcState,
  verifyOidcState,
} from "@anycol/auth";

type Discovery = {
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  issuer: string;
};

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing OIDC configuration: ${name}`);
  return value;
}

async function discovery(): Promise<Discovery> {
  const issuer = required("OIDC_ISSUER_URL").replace(/\/$/, "");
  const response = await fetch(`${issuer}/.well-known/openid-configuration`, {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok)
    throw new Error(`OIDC discovery failed with HTTP ${response.status}`);
  const value = (await response.json()) as Partial<Discovery>;
  if (
    !value.authorization_endpoint ||
    !value.token_endpoint ||
    !value.jwks_uri ||
    value.issuer !== issuer
  )
    throw new Error("Invalid OIDC discovery document");
  return value as Discovery;
}

export async function beginLogin(
  origin: string,
  returnTo: string,
): Promise<{ authorizationUrl: URL; stateCookie: string }> {
  const secret = required("SESSION_SECRET");
  const clientId = required("OIDC_CLIENT_ID");
  const metadata = await discovery();
  const verifier = randomBytes(32).toString("base64url");
  const nonce = randomBytes(24).toString("base64url");
  const safeReturnTo =
    returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
  const stateCookie = await signOidcState(
    { returnTo: safeReturnTo, nonce, verifier },
    secret,
  );
  const state = createHash("sha256").update(stateCookie).digest("base64url");
  const redirectUri =
    process.env.OIDC_REDIRECT_URI ?? `${origin}/api/auth/callback`;
  const authorizationUrl = new URL(metadata.authorization_endpoint);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("client_id", clientId);
  authorizationUrl.searchParams.set("redirect_uri", redirectUri);
  authorizationUrl.searchParams.set("scope", "openid profile email");
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("nonce", nonce);
  authorizationUrl.searchParams.set("code_challenge_method", "S256");
  authorizationUrl.searchParams.set(
    "code_challenge",
    createHash("sha256").update(verifier).digest("base64url"),
  );
  return { authorizationUrl, stateCookie };
}

export async function completeLogin(
  origin: string,
  code: string,
  state: string,
  stateCookie: string,
): Promise<{ token: string; returnTo: string }> {
  const secret = required("SESSION_SECRET");
  const clientId = required("OIDC_CLIENT_ID");
  const clientSecret = required("OIDC_CLIENT_SECRET");
  const expectedState = createHash("sha256")
    .update(stateCookie)
    .digest("base64url");
  if (state !== expectedState) throw new Error("OIDC state mismatch");
  const saved = await verifyOidcState(stateCookie, secret);
  const metadata = await discovery();
  const redirectUri =
    process.env.OIDC_REDIRECT_URI ?? `${origin}/api/auth/callback`;
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: saved.verifier,
  });
  const response = await fetch(metadata.token_endpoint, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok)
    throw new Error(`OIDC token exchange failed with HTTP ${response.status}`);
  const tokenSet = (await response.json()) as { id_token?: string };
  if (!tokenSet.id_token)
    throw new Error("OIDC response did not contain an ID token");
  const { payload } = await jwtVerify(
    tokenSet.id_token,
    createRemoteJWKSet(new URL(metadata.jwks_uri)),
    { issuer: metadata.issuer, audience: clientId },
  );
  if (payload.nonce !== saved.nonce || !payload.sub)
    throw new Error("Invalid OIDC nonce or subject");
  const workspaceClaim = process.env.OIDC_WORKSPACE_ID_CLAIM ?? "workspace_id";
  const roleClaim = process.env.OIDC_WORKSPACE_ROLE_CLAIM ?? "workspace_role";
  const workspaceId = Id.parse(payload[workspaceClaim]);
  const role = WorkspaceRole.parse(payload[roleClaim]);
  const subject = oidcSubjectId(metadata.issuer, payload.sub);
  const token = await signAccessToken(
    {
      sub: subject,
      workspaceId,
      role,
      email: typeof payload.email === "string" ? payload.email : undefined,
    },
    secret,
    process.env.INTERNAL_API_AUDIENCE ?? "anycol-api",
  );
  return { token, returnTo: saved.returnTo };
}
