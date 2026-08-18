import { z } from "zod";

const optionalUrl = z.string().url().optional();
const base64Key = z.string().refine((value) => {
  try {
    return Buffer.from(value, "base64").length === 32;
  } catch {
    return false;
  }
}, "must be a base64-encoded 32-byte key");

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_VERSION: z.string().min(1).default("dev"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WORKER_HEALTH_PORT: z.coerce.number().int().positive().default(4001),
  API_BASE_URL: z.string().url().default("http://127.0.0.1:4000"),
  DATABASE_URL: optionalUrl,
  REDIS_URL: z.string().url().default("redis://127.0.0.1:6379"),
  SESSION_SECRET: z.string().min(32).optional(),
  CREDENTIAL_ENCRYPTION_KEY: base64Key.optional(),
  INTERNAL_API_AUDIENCE: z.string().default("anycol-api"),
  PUBLIC_APP_URL: optionalUrl,
  OIDC_ISSUER_URL: optionalUrl,
  OIDC_CLIENT_ID: z.string().min(1).optional(),
  OIDC_CLIENT_SECRET: z.string().min(1).optional(),
  OIDC_REDIRECT_URI: optionalUrl,
  OIDC_WORKSPACE_ID_CLAIM: z.string().default("workspace_id"),
  OIDC_WORKSPACE_ROLE_CLAIM: z.string().default("workspace_role"),
  ALLOWED_ORIGINS: z
    .string()
    .default("")
    .transform((value) =>
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  OTEL_EXPORTER_OTLP_ENDPOINT: optionalUrl,
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: optionalUrl,
  GOOGLE_ADS_DEVELOPER_TOKEN: z.string().optional(),
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_REDIRECT_URI: optionalUrl,
  TIKTOK_CLIENT_KEY: z.string().optional(),
  TIKTOK_CLIENT_SECRET: z.string().optional(),
  TIKTOK_REDIRECT_URI: optionalUrl,
  AI_API_BASE_URL: optionalUrl,
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),
  BILLING_WEBHOOK_SECRET: z.string().optional(),
});

export type Config = Omit<z.infer<typeof schema>, "SESSION_SECRET"> & {
  SESSION_SECRET: string;
};

let cached: Config | undefined;

export function getConfig(
  environment: NodeJS.ProcessEnv = process.env,
): Config {
  if (environment === process.env && cached) return cached;
  const parsed = schema.safeParse(environment);
  if (!parsed.success) {
    throw new Error(
      `Invalid application configuration: ${z.prettifyError(parsed.error)}`,
    );
  }
  if (parsed.data.NODE_ENV === "production") {
    const missing = [
      "APP_VERSION",
      "DATABASE_URL",
      "SESSION_SECRET",
      "CREDENTIAL_ENCRYPTION_KEY",
      "OTEL_EXPORTER_OTLP_ENDPOINT",
    ].filter((key) => !environment[key]);
    if (missing.length)
      throw new Error(
        `Missing production configuration: ${missing.join(", ")}`,
      );
    const databaseUser = new URL(
      parsed.data.DATABASE_URL!,
    ).username.toLowerCase();
    if (["postgres", "anycol", "root"].includes(databaseUser))
      throw new Error(
        "Production DATABASE_URL must use a dedicated non-superuser application role",
      );
  }
  const config: Config = {
    ...parsed.data,
    SESSION_SECRET:
      parsed.data.SESSION_SECRET ?? "local-development-secret-change-me-now",
  };
  if (environment === process.env) cached = config;
  return config;
}
