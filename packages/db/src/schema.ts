import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").defaultRandom().primaryKey();
const tenant = () => uuid("workspace_id").notNull();
const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).defaultNow().notNull();

export const roleEnum = pgEnum("workspace_role", [
  "owner",
  "admin",
  "strategist",
  "editor",
  "analyst",
  "approver",
  "viewer",
]);
export const connectionStatusEnum = pgEnum("connection_status", [
  "pending",
  "connected",
  "syncing",
  "degraded",
  "reauthorization_required",
  "disabled",
]);
export const campaignStatusEnum = pgEnum("campaign_status", [
  "draft",
  "active",
  "completed",
  "archived",
]);
export const contentStatusEnum = pgEnum("content_status", [
  "draft",
  "in_review",
  "approved",
  "scheduled",
  "publishing",
  "published",
  "failed",
  "cancelled",
]);
export const jobStatusEnum = pgEnum("job_status", [
  "queued",
  "running",
  "succeeded",
  "failed",
  "dead_letter",
]);

export const users = pgTable(
  "users",
  {
    id: id(),
    email: text("email").notNull(),
    name: text("name"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("users_email_uq").on(t.email)],
);
export const workspaces = pgTable(
  "workspaces",
  {
    id: id(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    defaultCurrency: text("default_currency").default("TRY").notNull(),
    timeZone: text("time_zone").default("Europe/Istanbul").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("workspaces_slug_uq").on(t.slug)],
);
export const workspaceMembers = pgTable(
  "workspace_members",
  {
    workspaceId: tenant().references(() => workspaces.id, {
      onDelete: "cascade",
    }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.userId] })],
);
export const clients = pgTable(
  "clients",
  {
    id: id(),
    workspaceId: tenant().references(() => workspaces.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("clients_workspace_idx").on(t.workspaceId)],
);
export const brands = pgTable(
  "brands",
  {
    id: id(),
    workspaceId: tenant().references(() => workspaces.id, {
      onDelete: "cascade",
    }),
    clientId: uuid("client_id").references(() => clients.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    currency: text("currency").default("TRY").notNull(),
    timeZone: text("time_zone").default("Europe/Istanbul").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("brands_workspace_slug_uq").on(t.workspaceId, t.slug)],
);
export const invitations = pgTable("invitations", {
  id: id(),
  workspaceId: tenant().references(() => workspaces.id, {
    onDelete: "cascade",
  }),
  email: text("email").notNull(),
  role: roleEnum("role").notNull(),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: createdAt(),
});
export const auditEvents = pgTable(
  "audit_events",
  {
    id: id(),
    workspaceId: tenant().references(() => workspaces.id, {
      onDelete: "cascade",
    }),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    requestId: text("request_id").notNull(),
    ipHash: text("ip_hash"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("audit_workspace_created_idx").on(t.workspaceId, t.createdAt)],
);

export const connections = pgTable(
  "connections",
  {
    id: id(),
    workspaceId: tenant().references(() => workspaces.id, {
      onDelete: "cascade",
    }),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    connector: text("connector").notNull(),
    status: connectionStatusEnum("status").default("pending").notNull(),
    displayName: text("display_name"),
    scopes: text("scopes").array().default([]).notNull(),
    credentialCiphertext: jsonb("credential_ciphertext"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("connections_workspace_brand_idx").on(t.workspaceId, t.brandId),
  ],
);
export const externalAccounts = pgTable(
  "external_accounts",
  {
    id: id(),
    workspaceId: tenant(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => connections.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    name: text("name").notNull(),
    type: text("type").notNull(),
    currency: text("currency"),
    timeZone: text("time_zone"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("external_account_connection_id_uq").on(
      t.connectionId,
      t.externalId,
    ),
  ],
);
export const syncJobs = pgTable(
  "sync_jobs",
  {
    id: id(),
    workspaceId: tenant(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => connections.id, { onDelete: "cascade" }),
    externalAccountId: uuid("external_account_id").references(
      () => externalAccounts.id,
      { onDelete: "cascade" },
    ),
    mode: text("mode").notNull(),
    status: jobStatusEnum("status").default("queued").notNull(),
    cursor: text("cursor"),
    attempts: integer("attempts").default(0).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    error: text("error"),
    createdAt: createdAt(),
  },
  (t) => [
    index("sync_jobs_connection_created_idx").on(t.connectionId, t.createdAt),
  ],
);
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: id(),
    workspaceId: uuid("workspace_id"),
    provider: text("provider").notNull(),
    externalEventId: text("external_event_id").notNull(),
    payload: jsonb("payload").notNull(),
    receivedAt: createdAt(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("webhook_provider_event_uq").on(t.provider, t.externalEventId),
  ],
);

export const metricFactsDaily = pgTable(
  "metric_facts_daily",
  {
    id: bigint("id", { mode: "number" })
      .generatedAlwaysAsIdentity()
      .primaryKey(),
    workspaceId: tenant(),
    brandId: uuid("brand_id").notNull(),
    connectionId: uuid("connection_id").notNull(),
    externalAccountId: uuid("external_account_id").notNull(),
    source: text("source").notNull(),
    metricDate: date("metric_date").notNull(),
    dimensionsHash: text("dimensions_hash").notNull(),
    dimensions: jsonb("dimensions")
      .$type<Record<string, string>>()
      .default({})
      .notNull(),
    metrics: jsonb("metrics")
      .$type<Record<string, number>>()
      .default({})
      .notNull(),
    currency: text("currency"),
    quality: text("quality").default("final").notNull(),
    sourceVersion: text("source_version").notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("metric_fact_identity_uq").on(
      t.workspaceId,
      t.connectionId,
      t.externalAccountId,
      t.metricDate,
      t.dimensionsHash,
    ),
    index("metric_fact_brand_date_idx").on(
      t.workspaceId,
      t.brandId,
      t.metricDate,
    ),
  ],
);

export const campaigns = pgTable(
  "campaigns",
  {
    id: id(),
    workspaceId: tenant(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    status: campaignStatusEnum("status").default("draft").notNull(),
    objective: text("objective"),
    budgetMinor: bigint("budget_minor", { mode: "number" }),
    currency: text("currency"),
    startsOn: date("starts_on"),
    endsOn: date("ends_on"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("campaigns_brand_idx").on(t.workspaceId, t.brandId)],
);
export const campaignAssets = pgTable("campaign_assets", {
  id: id(),
  workspaceId: tenant(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  assetType: text("asset_type").notNull(),
  externalId: text("external_id").notNull(),
  metadata: jsonb("metadata").default({}).notNull(),
  createdAt: createdAt(),
});
export const utmLinks = pgTable("utm_links", {
  id: id(),
  workspaceId: tenant(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  destination: text("destination").notNull(),
  source: text("source").notNull(),
  medium: text("medium").notNull(),
  campaign: text("campaign").notNull(),
  content: text("content"),
  term: text("term"),
  finalUrl: text("final_url").notNull(),
  createdAt: createdAt(),
});

export const contentItems = pgTable(
  "content_items",
  {
    id: id(),
    workspaceId: tenant(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id").references(() => campaigns.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    status: contentStatusEnum("status").default("draft").notNull(),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("content_brand_schedule_idx").on(
      t.workspaceId,
      t.brandId,
      t.scheduledFor,
    ),
  ],
);
export const contentVariants = pgTable("content_variants", {
  id: id(),
  workspaceId: tenant(),
  contentId: uuid("content_id")
    .notNull()
    .references(() => contentItems.id, { onDelete: "cascade" }),
  connector: text("connector").notNull(),
  text: text("text").notNull(),
  options: jsonb("options").default({}).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
export const mediaAssets = pgTable("media_assets", {
  id: id(),
  workspaceId: tenant(),
  brandId: uuid("brand_id").notNull(),
  objectKey: text("object_key").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  byteSize: bigint("byte_size", { mode: "number" }).notNull(),
  checksum: text("checksum").notNull(),
  scanStatus: text("scan_status").default("pending").notNull(),
  metadata: jsonb("metadata").default({}).notNull(),
  createdAt: createdAt(),
});
export const publishJobs = pgTable(
  "publish_jobs",
  {
    id: id(),
    workspaceId: tenant(),
    contentId: uuid("content_id")
      .notNull()
      .references(() => contentItems.id, { onDelete: "cascade" }),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => connections.id),
    idempotencyKey: text("idempotency_key").notNull(),
    status: jobStatusEnum("status").default("queued").notNull(),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    externalId: text("external_id"),
    externalUrl: text("external_url"),
    error: text("error"),
    attempts: integer("attempts").default(0).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("publish_idempotency_uq").on(t.connectionId, t.idempotencyKey),
  ],
);

export const reports = pgTable("reports", {
  id: id(),
  workspaceId: tenant(),
  brandId: uuid("brand_id").notNull(),
  name: text("name").notNull(),
  schemaVersion: integer("schema_version").default(1).notNull(),
  definition: jsonb("definition").notNull(),
  theme: jsonb("theme").default({}).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
export const reportSnapshots = pgTable("report_snapshots", {
  id: id(),
  workspaceId: tenant(),
  reportId: uuid("report_id")
    .notNull()
    .references(() => reports.id, { onDelete: "cascade" }),
  data: jsonb("data").notNull(),
  objectKey: text("object_key"),
  createdAt: createdAt(),
});
export const sharedLinks = pgTable(
  "shared_links",
  {
    id: id(),
    workspaceId: tenant(),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => reportSnapshots.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("shared_token_uq").on(t.tokenHash)],
);

export const alerts = pgTable("alerts", {
  id: id(),
  workspaceId: tenant(),
  brandId: uuid("brand_id").notNull(),
  severity: text("severity").notNull(),
  ruleKey: text("rule_key").notNull(),
  title: text("title").notNull(),
  detail: text("detail").notNull(),
  evidence: jsonb("evidence").default([]).notNull(),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  createdAt: createdAt(),
});
export const recommendations = pgTable("recommendations", {
  id: id(),
  workspaceId: tenant(),
  brandId: uuid("brand_id").notNull(),
  title: text("title").notNull(),
  rationale: text("rationale").notNull(),
  confidence: numeric("confidence", { precision: 4, scale: 3 }).notNull(),
  evidence: jsonb("evidence").default([]).notNull(),
  status: text("status").default("proposed").notNull(),
  approvedBy: uuid("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const inboxThreads = pgTable(
  "inbox_threads",
  {
    id: id(),
    workspaceId: tenant(),
    brandId: uuid("brand_id").notNull(),
    connectionId: uuid("connection_id").notNull(),
    externalId: text("external_id").notNull(),
    status: text("status").default("open").notNull(),
    assignedTo: uuid("assigned_to").references(() => users.id),
    contact: jsonb("contact").default({}).notNull(),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("thread_connection_external_uq").on(
      t.connectionId,
      t.externalId,
    ),
  ],
);
export const inboxMessages = pgTable(
  "inbox_messages",
  {
    id: id(),
    workspaceId: tenant(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => inboxThreads.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    direction: text("direction").notNull(),
    body: text("body").notNull(),
    metadata: jsonb("metadata").default({}).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("message_thread_external_uq").on(t.threadId, t.externalId),
  ],
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: id(),
    workspaceId: tenant(),
    providerCustomerId: text("provider_customer_id"),
    providerSubscriptionId: text("provider_subscription_id"),
    plan: text("plan").notNull(),
    status: text("status").notNull(),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    entitlements: jsonb("entitlements").default({}).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("subscription_workspace_uq").on(t.workspaceId)],
);
export const usageCounters = pgTable(
  "usage_counters",
  {
    workspaceId: tenant(),
    period: text("period").notNull(),
    key: text("key").notNull(),
    value: bigint("value", { mode: "number" }).default(0).notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.period, t.key] })],
);
export const featureFlags = pgTable("feature_flags", {
  key: text("key").primaryKey(),
  enabled: boolean("enabled").default(false).notNull(),
  rules: jsonb("rules").default({}).notNull(),
  updatedAt: updatedAt(),
});
