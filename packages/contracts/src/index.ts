import { z } from "zod";

export const Id = z.string().uuid();
export type Id = z.infer<typeof Id>;

export const WorkspaceRole = z.enum([
  "owner",
  "admin",
  "strategist",
  "editor",
  "analyst",
  "approver",
  "viewer",
]);
export type WorkspaceRole = z.infer<typeof WorkspaceRole>;

export const ConnectorKey = z.enum([
  "google_ads",
  "search_console",
  "ga4",
  "meta",
  "linkedin",
  "tiktok",
  "youtube",
  "google_business",
]);
export type ConnectorKey = z.infer<typeof ConnectorKey>;

export const Capability = z.enum([
  "analytics.read",
  "assets.read",
  "content.publish",
  "content.read",
  "inbox.read",
  "inbox.reply",
  "ads.read",
  "ads.write",
]);
export type Capability = z.infer<typeof Capability>;

export const ConnectionStatus = z.enum([
  "pending",
  "connected",
  "syncing",
  "degraded",
  "reauthorization_required",
  "disabled",
]);

export const DataQuality = z.enum([
  "final",
  "fresh",
  "partial",
  "sampled",
  "limited",
]);

export const MetricPoint = z.object({
  metric: z.string().min(1),
  value: z.number(),
  previousValue: z.number().nullable(),
  unit: z.enum(["count", "percent", "currency", "duration", "position"]),
  currency: z.string().length(3).optional(),
  source: ConnectorKey,
  quality: DataQuality.default("final"),
  updatedAt: z.string().datetime(),
});
export type MetricPoint = z.infer<typeof MetricPoint>;

export const OverviewResponse = z.object({
  workspaceId: Id,
  brandId: Id,
  range: z.object({ from: z.string().date(), to: z.string().date() }),
  metrics: z.array(MetricPoint),
  alerts: z.array(
    z.object({
      id: Id,
      severity: z.enum(["info", "warning", "critical"]),
      title: z.string(),
      detail: z.string(),
    }),
  ),
});
export type OverviewResponse = z.infer<typeof OverviewResponse>;

export const ApiProblem = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string(),
  requestId: z.string(),
  errors: z.record(z.string(), z.array(z.string())).optional(),
});

export const JobEnvelope = z.object({
  version: z.literal(1),
  id: Id,
  workspaceId: Id,
  brandId: Id.optional(),
  correlationId: z.string().min(1),
  createdAt: z.string().datetime(),
  payload: z.unknown(),
});
export type JobEnvelope = z.infer<typeof JobEnvelope>;

export const ContentStatus = z.enum([
  "draft",
  "in_review",
  "approved",
  "scheduled",
  "publishing",
  "published",
  "failed",
  "cancelled",
]);

export const PublishRequest = z.object({
  contentId: Id,
  connectionId: Id,
  scheduledFor: z.string().datetime(),
  idempotencyKey: z.string().min(16).max(200),
});
export type PublishRequest = z.infer<typeof PublishRequest>;
