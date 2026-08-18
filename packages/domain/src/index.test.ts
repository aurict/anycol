import { describe, expect, it } from "vitest";
import { buildUtmUrl, transitionContent } from "./index";

describe("domain", () => {
  it("enforces approval permissions", () => {
    expect(() => transitionContent("in_review", "approved", "editor")).toThrow(
      "cannot approve",
    );
    expect(transitionContent("in_review", "approved", "approver")).toBe(
      "approved",
    );
  });
  it("builds governed UTM URLs", () => {
    expect(
      buildUtmUrl({
        destination: "https://example.com/x",
        source: "Google Ads",
        medium: "CPC",
        campaign: "Yaz İndirimi",
      }),
    ).toContain("utm_campaign=yaz-indirimi");
  });
});
