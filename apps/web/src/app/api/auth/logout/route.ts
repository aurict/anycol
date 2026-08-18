import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(
    new URL("/login", request.nextUrl.origin),
    { status: 303 },
  );
  response.cookies.delete("anycol_session");
  return response;
}
