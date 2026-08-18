import { describe, expect, it } from "vitest";
import { deriveMetrics, safeRatio } from "./index";

describe("metrics", () => {
  it("derives weighted ratios from raw totals", () => {
    expect(
      deriveMetrics({
        impressions: 1000,
        clicks: 40,
        cost: 20,
        conversion_value: 80,
      }),
    ).toMatchObject({ ctr: 0.04, cpc: 0.5, roas: 4 });
  });
  it("never divides by zero", () => expect(safeRatio(1, 0)).toBeNull());
});
