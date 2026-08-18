import { getConfig } from "@anycol/config";
import { startObservability } from "@anycol/observability";

const config = getConfig();
const stopObservability = await startObservability({
  serviceName: "anycol-api",
  version: config.APP_VERSION,
  endpoint: config.OTEL_EXPORTER_OTLP_ENDPOINT,
});
const [{ buildApp }, { createRuntime }] = await Promise.all([
  import("./app"),
  import("./runtime"),
]);
const runtime = createRuntime(config);
const app = await buildApp(runtime);

const shutdown = async (signal: string) => {
  app.log.info({ signal }, "shutting down");
  await app.close();
  await stopObservability();
  process.exit(0);
};
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

await app.listen({ port: config.API_PORT, host: "0.0.0.0" });
