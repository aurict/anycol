import { describe, expect, it } from "vitest";
import { SearchConsoleConnector } from "./index";

describe("SearchConsoleConnector", () => {
  const connector = new SearchConsoleConnector();

  it("requests only readonly scope by default", () => {
    const url = connector.buildAuthorizationUrl(
      {
        clientId: "client",
        clientSecret: "secret",
        redirectUri: "https://app.example/callback",
      },
      "state",
    );
    expect(url.searchParams.get("scope")).toBe(
      "https://www.googleapis.com/auth/webmasters.readonly",
    );
    expect(url.searchParams.get("state")).toBe("state");
  });

  it("normalizes dimensions and quality", async () => {
    const facts = await connector.normalize(
      {
        source: "search_console",
        schemaVersion: 1,
        quality: "fresh",
        rows: [
          {
            keys: [
              "2026-08-01",
              "query",
              "https://example.com/",
              "tur",
              "MOBILE",
            ],
            clicks: 4,
            impressions: 100,
            ctr: 0.04,
            position: 3.2,
          },
        ],
      },
      { id: "sc-domain:example.com", name: "example.com", type: "property" },
    );
    expect(facts[0]).toMatchObject({
      date: "2026-08-01",
      quality: "fresh",
      metrics: { clicks: 4, impressions: 100 },
      dimensions: { device: "MOBILE" },
    });
  });
});
