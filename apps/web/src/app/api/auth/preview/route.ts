import { NextRequest, NextResponse } from "next/server";
import { signAccessToken } from "@anycol/auth";

export async function GET(request: NextRequest) {
  const localHost =
    request.nextUrl.hostname === "127.0.0.1" ||
    request.nextUrl.hostname === "localhost";
  if (
    process.env.ALLOW_PREVIEW_AUTH !== "true" ||
    !localHost ||
    !process.env.SESSION_SECRET
  )
    return new NextResponse("Not found", { status: 404 });
  const token = await signAccessToken(
    {
      sub: "9b852878-bf8d-53d4-b93a-1c2f297ea86a",
      workspaceId: "11111111-1111-4111-8111-111111111111",
      role: "owner",
      email: "preview@anycol.local",
    },
    process.env.SESSION_SECRET,
    process.env.INTERNAL_API_AUDIENCE ?? "anycol-api",
  );
  const response = NextResponse.redirect(
    new URL("/preview/overview", request.url),
  );
  response.cookies.set("anycol_session", token, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
    maxAge: 3_600,
  });
  return response;
}
