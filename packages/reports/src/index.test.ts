import { describe, expect, it } from "vitest";
import {
  createReportSnapshot,
  createShareCredential,
  renderCsv,
} from "./index";

describe("reports", () => {
  it("creates immutable-content snapshots", () => {
    const snapshot = createReportSnapshot(
      { version: 1, title: "Rapor", widgets: [] },
      { total: 12 },
      { from: "2026-08-01", to: "2026-08-06" },
      new Date("2026-08-06T12:00:00Z"),
    );
    expect(snapshot.contentHash).toHaveLength(64);
    expect(snapshot.generatedAt).toBe("2026-08-06T12:00:00.000Z");
  });
  it("hashes share tokens and escapes CSV", () => {
    const value = createShareCredential();
    expect(value.tokenHash).not.toContain(value.token);
    expect(renderCsv(["name"], [["a,b"]])).toBe('name\n"a,b"');
  });
});
