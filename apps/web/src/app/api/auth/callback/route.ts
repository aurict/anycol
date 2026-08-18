import { NextRequest, NextResponse } from "next/server";
import { completeLogin } from "../../../../lib/oidc";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const stateCookie = request.cookies.get("anycol_oidc_state")?.value;
  if (!code || !state || !stateCookie)
    return NextResponse.json(
      { error: "invalid_oidc_callback" },
      { status: 400 },
    );
  try {
    const result = await completeLogin(
      request.nextUrl.origin,
      code,
      state,
      stateCookie,
    );
    const response = NextResponse.redirect(
      new URL(result.returnTo, request.nextUrl.origin),
    );
    response.cookies.set("anycol_session", result.token, {
      httpOnly: true,
      secure: request.nextUrl.protocol === "https:",
      sameSite: "lax",
      path: "/",
      maxAge: 900,
    });
    response.cookies.delete("anycol_oidc_state");
    return response;
  } catch {
    const response = NextResponse.redirect(
      new URL("/login?error=oidc", request.nextUrl.origin),
    );
    response.cookies.delete("anycol_oidc_state");
    return response;
  }
}
