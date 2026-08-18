import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const pkg = (name: string) =>
  fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@anycol/ai": pkg("ai"),
      "@anycol/auth": pkg("auth"),
      "@anycol/billing": pkg("billing"),
      "@anycol/config": pkg("config"),
      "@anycol/contracts": pkg("contracts"),
      "@anycol/connectors-core": pkg("connectors-core"),
      "@anycol/connector-ga4": pkg("connector-ga4"),
      "@anycol/connector-google-ads": pkg("connector-google-ads"),
      "@anycol/connector-search-console": pkg("connector-search-console"),
      "@anycol/connector-meta": pkg("connector-meta"),
      "@anycol/connector-tiktok": pkg("connector-tiktok"),
      "@anycol/connector-youtube": pkg("connector-youtube"),
      "@anycol/connector-stubs": pkg("connector-stubs"),
      "@anycol/domain": pkg("domain"),
      "@anycol/jobs": pkg("jobs"),
      "@anycol/media": pkg("media"),
      "@anycol/metrics": pkg("metrics"),
      "@anycol/reports": pkg("reports"),
      "@anycol/security": pkg("security"),
    },
  },
  test: {
    environment: "node",
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: [
        "packages/{ai,auth,billing,config,domain,media,metrics,reports,security}/src/index.ts",
        "apps/api/src/app.ts",
      ],
      thresholds: { lines: 60, functions: 60, statements: 60, branches: 55 },
    },
  },
});
