import { NextRequest, NextResponse } from "next/server";
import { beginLogin } from "../../../../lib/oidc";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { authorizationUrl, stateCookie } = await beginLogin(
      request.nextUrl.origin,
      request.nextUrl.searchParams.get("returnTo") ?? "/",
    );
    const response = NextResponse.redirect(authorizationUrl);
    response.cookies.set("anycol_oidc_state", stateCookie, {
      httpOnly: true,
      secure: request.nextUrl.protocol === "https:",
      sameSite: "lax",
      path: "/api/auth/callback",
      maxAge: 600,
    });
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error: "authentication_unavailable",
        detail: error instanceof Error ? error.message : "OIDC is unavailable",
      },
      { status: 503 },
    );
  }
}
