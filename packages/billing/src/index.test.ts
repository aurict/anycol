import { describe, expect, it } from "vitest";
import { entitlement, withinUsage } from "./index";
describe("billing entitlements", () => {
  it("enforces plan limits", () => {
    expect(withinUsage("starter", "brands", 1)).toBe(false);
    expect(entitlement("enterprise", "sso")).toBe(true);
  });
});
