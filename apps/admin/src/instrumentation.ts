export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startObservability } = await import("@anycol/observability");
    await startObservability({
      serviceName: "anycol-admin",
      version: process.env.APP_VERSION ?? "dev",
      endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    });
  }
}
