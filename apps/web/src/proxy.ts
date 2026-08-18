import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@anycol/auth";

export async function proxy(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") return NextResponse.next();
  const protectedPath =
    /^\/[^/]+\/(overview|campaigns|calendar|ads|seo|analytics|reports|inbox|automations|integrations|settings)/.test(
      request.nextUrl.pathname,
    );
  if (!protectedPath) return NextResponse.next();
  const session = request.cookies.get("anycol_session")?.value;
  const secret = process.env.SESSION_SECRET;
  let authenticated = false;
  if (session && secret) {
    try {
      await verifyAccessToken(
        session,
        secret,
        process.env.INTERNAL_API_AUDIENCE ?? "anycol-api",
      );
      authenticated = true;
    } catch {
      authenticated = false;
    }
  }
  if (!authenticated) {
    const login = new URL("/login", request.url);
    login.searchParams.set("returnTo", request.nextUrl.pathname);
    const response = NextResponse.redirect(login);
    response.cookies.delete("anycol_session");
    return response;
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
