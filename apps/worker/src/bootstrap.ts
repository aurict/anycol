import { getConfig } from "@anycol/config";
import { startObservability } from "@anycol/observability";

const config = getConfig();
const stopObservability = await startObservability({
  serviceName: "anycol-worker",
  version: config.APP_VERSION,
  endpoint: config.OTEL_EXPORTER_OTLP_ENDPOINT,
});
const { shutdown } = await import("./worker");

async function stop(signal: string) {
  await shutdown(signal);
  await stopObservability();
  process.exit(0);
}
process.on("SIGTERM", () => void stop("SIGTERM"));
process.on("SIGINT", () => void stop("SIGINT"));
