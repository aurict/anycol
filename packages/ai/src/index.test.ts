import { describe, expect, it } from "vitest";
import { buildGroundedPrompt, deterministicInsights } from "./index";

describe("ai guardrails", () => {
  it("creates evidence-backed deterministic insights", () => {
    const [insight] = deterministicInsights([
      {
        metric: "cpa",
        current: 120,
        previous: 90,
        source: "google_ads",
        from: "2026-07-01",
        to: "2026-07-31",
      },
    ]);
    expect(insight.severity).toBe("warning");
    expect(buildGroundedPrompt(insight)).toContain('"current":120');
  });
});
