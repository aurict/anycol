import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { getConfig } from "./index";

describe("production configuration", () => {
  it("rejects implicit development secrets", () => {
    expect(() =>
      getConfig({
        NODE_ENV: "production",
        APP_VERSION: "test",
        DATABASE_URL: "postgres://app_user@db/app",
        CREDENTIAL_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
        OTEL_EXPORTER_OTLP_ENDPOINT: "https://otel.example",
      }),
    ).toThrow("SESSION_SECRET");
  });

  it("rejects malformed credential encryption keys", () => {
    expect(() =>
      getConfig({
        NODE_ENV: "production",
        APP_VERSION: "test",
        DATABASE_URL: "postgres://app_user@db/app",
        SESSION_SECRET: "x".repeat(32),
        CREDENTIAL_ENCRYPTION_KEY: "not-base64",
        OTEL_EXPORTER_OTLP_ENDPOINT: "https://otel.example",
      }),
    ).toThrow("base64-encoded 32-byte key");
  });

  it("accepts explicit production secrets", () => {
    expect(
      getConfig({
        NODE_ENV: "production",
        APP_VERSION: "test",
        DATABASE_URL: "postgres://app_user@db/app",
        SESSION_SECRET: "x".repeat(32),
        CREDENTIAL_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
        OTEL_EXPORTER_OTLP_ENDPOINT: "https://otel.example",
      }).NODE_ENV,
    ).toBe("production");
  });

  it("rejects privileged production database users that bypass RLS", () => {
    expect(() =>
      getConfig({
        NODE_ENV: "production",
        APP_VERSION: "test",
        DATABASE_URL: "postgres://postgres@db/app",
        SESSION_SECRET: "x".repeat(32),
        CREDENTIAL_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
        OTEL_EXPORTER_OTLP_ENDPOINT: "https://otel.example",
      }),
    ).toThrow("non-superuser");
  });
});
