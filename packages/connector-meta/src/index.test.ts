import { describe, expect, it } from "vitest";
import { MetaConnector } from "./index";

describe("MetaConnector", () => {
  const connector = new MetaConnector();

  it("uses a state-bound Meta OAuth URL", () => {
    const url = connector.buildAuthorizationUrl(
      {
        clientId: "client",
        clientSecret: "secret",
        redirectUri: "https://app.example/callback",
      },
      "signed-state",
      ["instagram_basic", "ads_read"],
    );
    expect(url.hostname).toBe("www.facebook.com");
    expect(url.searchParams.get("state")).toBe("signed-state");
    expect(url.searchParams.get("scope")).toContain("instagram_basic");
  });

  it("normalizes Meta Ads reporting rows", async () => {
    const [fact] = await connector.normalize(
      {
        source: "meta",
        schemaVersion: 25,
        metadata: { dataset: "meta_ads" },
        rows: [
          {
            date_start: "2026-08-01",
            impressions: "1200",
            clicks: "48",
            spend: "92.5",
            actions: [{ action_type: "purchase", value: "6" }],
          },
        ],
      },
      { id: "act_1", name: "Ads", type: "meta_ad_account", currency: "TRY" },
    );
    expect(fact).toMatchObject({
      date: "2026-08-01",
      metrics: { impressions: 1200, clicks: 48, cost: 92.5, conversions: 6 },
    });
  });
});
