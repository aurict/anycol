import { describe, expect, it } from "vitest";
import { Ga4Connector } from "./index";

describe("Ga4Connector", () => {
  it("normalizes GA4 date and numeric strings", async () => {
    const connector = new Ga4Connector();
    const [fact] = await connector.normalize(
      {
        source: "ga4",
        schemaVersion: 1,
        rows: [
          {
            dimensionValues: [
              { value: "20260801" },
              { value: "google / organic" },
              { value: "/" },
              { value: "mobile" },
            ],
            metricValues: [
              { value: "100" },
              { value: "120" },
              { value: "80" },
              { value: "4" },
              { value: "525.50" },
            ],
          },
        ],
      },
      { id: "123", name: "Property", type: "ga4_property" },
    );
    expect(fact).toMatchObject({
      date: "2026-08-01",
      metrics: { active_users: 100, conversion_value: 525.5 },
    });
  });
});
