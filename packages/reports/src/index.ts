import { createHash, randomBytes } from "node:crypto";
import { hashOpaqueToken } from "@anycol/security";

export type ReportDefinition = {
  version: 1;
  title: string;
  widgets: Array<{
    id: string;
    type: "metric" | "timeseries" | "table" | "text";
    metric?: string;
    query?: Record<string, unknown>;
  }>;
};
export type ReportSnapshot = {
  definitionVersion: number;
  generatedAt: string;
  range: { from: string; to: string };
  data: Record<string, unknown>;
  contentHash: string;
};

export function createReportSnapshot(
  definition: ReportDefinition,
  data: Record<string, unknown>,
  range: ReportSnapshot["range"],
  generatedAt = new Date(),
): ReportSnapshot {
  const stable = JSON.stringify({ definition, data, range });
  return {
    definitionVersion: definition.version,
    generatedAt: generatedAt.toISOString(),
    range,
    data: structuredClone(data),
    contentHash: createHash("sha256").update(stable).digest("hex"),
  };
}

export function createShareCredential(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashOpaqueToken(token) };
}

export function csvEscape(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
export function renderCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows]
    .map((row) => row.map(csvEscape).join(","))
    .join("\n");
}
