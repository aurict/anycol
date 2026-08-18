import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@anycol/auth";

export async function proxy(request: NextRequest) {
  if (
    process.env.NODE_ENV !== "production" ||
    request.nextUrl.pathname.startsWith("/api/health")
  )
    return NextResponse.next();
  const token = request.cookies.get("anycol_session")?.value;
  const secret = process.env.SESSION_SECRET;
  if (token && secret) {
    try {
      const claims = await verifyAccessToken(
        token,
        secret,
        process.env.INTERNAL_API_AUDIENCE ?? "anycol-api",
      );
      if (claims.role === "owner" || claims.role === "admin")
        return NextResponse.next();
    } catch {
      /* fail closed */
    }
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
