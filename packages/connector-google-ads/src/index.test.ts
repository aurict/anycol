import { describe, expect, it } from "vitest";
import { GoogleAdsConnector } from "./index";

describe("GoogleAdsConnector", () => {
  it("normalizes micros and preserves currency", async () => {
    const connector = new GoogleAdsConnector("developer-token");
    const [fact] = await connector.normalize(
      {
        source: "google_ads",
        schemaVersion: 25,
        rows: [
          {
            segments: { date: "2026-08-01" },
            campaign: { id: "1", name: "Brand", status: "ENABLED" },
            customer: { currencyCode: "TRY" },
            metrics: {
              impressions: "100",
              clicks: "4",
              costMicros: "12500000",
              conversions: 2,
              conversionsValue: 50,
            },
          },
        ],
      },
      { id: "123", name: "Account", type: "google_ads_customer" },
    );
    expect(fact).toMatchObject({
      currency: "TRY",
      metrics: { cost: 12.5, conversions: 2 },
    });
  });
});
