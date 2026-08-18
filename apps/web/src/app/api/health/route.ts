export async function GET() {
  return Response.json(
    { status: "ok", service: "web", version: process.env.APP_VERSION ?? "dev" },
    { headers: { "cache-control": "no-store" } },
  );
}
