import { z } from "zod";
import {
  ConnectorKey,
  Id,
  JobEnvelope,
  PublishRequest,
} from "@anycol/contracts";

export const queueNames = {
  sync: "anycol.sync.v1",
  publish: "anycol.publish.v1",
  reports: "anycol.reports.v1",
  maintenance: "anycol.maintenance.v1",
} as const;

export const SyncJob = JobEnvelope.extend({
  payload: z.object({
    connector: ConnectorKey,
    connectionId: Id,
    externalAccountId: Id,
    externalAssetId: z.string().min(1),
    mode: z.enum(["backfill", "incremental"]),
    from: z.string().datetime(),
    to: z.string().datetime(),
    cursor: z.string().optional(),
  }),
});
export type SyncJob = z.infer<typeof SyncJob>;

export const PublishJob = JobEnvelope.extend({ payload: PublishRequest });
export type PublishJob = z.infer<typeof PublishJob>;

export const defaultJobOptions = {
  attempts: 6,
  backoff: { type: "exponential", delay: 2_000 },
  removeOnComplete: { age: 86_400, count: 10_000 },
  removeOnFail: false,
} as const;

export function deterministicJobId(kind: string, ...parts: string[]): string {
  return [kind, ...parts]
    .map((part) => part.replace(/[^a-zA-Z0-9_-]/g, "_"))
    .join(":");
}
