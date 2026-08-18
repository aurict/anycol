export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startObservability } = await import("@anycol/observability");
    await startObservability({
      serviceName: "anycol-web",
      version: process.env.APP_VERSION ?? "dev",
      endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    });
  }
}

export async function onRequestError(
  error: unknown,
  request: { path: string },
  context: { routePath: string },
) {
  console.error(
    JSON.stringify({
      level: "error",
      service: "web",
      path: request.path,
      route: context.routePath,
      error: error instanceof Error ? error.message : "unknown",
    }),
  );
}
