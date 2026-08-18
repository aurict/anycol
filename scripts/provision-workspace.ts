import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { oidcSubjectId } from "@anycol/auth";

const input = z
  .object({
    ADMIN_DATABASE_URL: z.string().url(),
    OIDC_ISSUER_URL: z.string().url(),
    OIDC_SUBJECT: z.string().min(1),
    USER_EMAIL: z.string().email(),
    USER_NAME: z.string().min(1),
    WORKSPACE_NAME: z.string().min(1),
    WORKSPACE_SLUG: z.string().regex(/^[a-z0-9-]+$/),
    BRAND_NAME: z.string().min(1),
    BRAND_SLUG: z.string().regex(/^[a-z0-9-]+$/),
    DEFAULT_CURRENCY: z.string().length(3).default("TRY"),
    TIME_ZONE: z.string().default("Europe/Istanbul"),
  })
  .parse(process.env);

const pool = new Pool({ connectionString: input.ADMIN_DATABASE_URL, max: 1 });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  const userId = oidcSubjectId(input.OIDC_ISSUER_URL, input.OIDC_SUBJECT);
  const workspaceId = randomUUID();
  const brandId = randomUUID();
  await client.query(
    "INSERT INTO users (id,email,name) VALUES ($1,$2,$3) ON CONFLICT (id) DO UPDATE SET email=EXCLUDED.email,name=EXCLUDED.name,updated_at=now()",
    [userId, input.USER_EMAIL.toLowerCase(), input.USER_NAME],
  );
  await client.query(
    "INSERT INTO workspaces (id,name,slug,default_currency,time_zone) VALUES ($1,$2,$3,$4,$5)",
    [
      workspaceId,
      input.WORKSPACE_NAME,
      input.WORKSPACE_SLUG,
      input.DEFAULT_CURRENCY,
      input.TIME_ZONE,
    ],
  );
  await client.query(
    "INSERT INTO workspace_members (workspace_id,user_id,role) VALUES ($1,$2,'owner')",
    [workspaceId, userId],
  );
  await client.query(
    "INSERT INTO brands (id,workspace_id,name,slug,currency,time_zone) VALUES ($1,$2,$3,$4,$5,$6)",
    [
      brandId,
      workspaceId,
      input.BRAND_NAME,
      input.BRAND_SLUG,
      input.DEFAULT_CURRENCY,
      input.TIME_ZONE,
    ],
  );
  await client.query("COMMIT");
  console.info(
    JSON.stringify({
      workspaceId,
      workspaceSlug: input.WORKSPACE_SLUG,
      brandId,
      userId,
    }),
  );
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
