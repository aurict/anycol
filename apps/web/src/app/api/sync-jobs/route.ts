import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const token = (await cookies()).get("anycol_session")?.value;
  if (!token || !process.env.API_BASE_URL)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const response = await fetch(
    new URL("/v1/sync-jobs", process.env.API_BASE_URL),
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(await request.json()),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    },
  ).catch(() => null);
  if (!response)
    return NextResponse.json({ error: "api_unavailable" }, { status: 503 });
  return new NextResponse(await response.text(), {
    status: response.status,
    headers: {
      "content-type":
        response.headers.get("content-type") ?? "application/json",
    },
  });
}
