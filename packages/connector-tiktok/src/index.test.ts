import { describe, expect, it } from "vitest";
import { TikTokConnector } from "./index";

describe("TikTokConnector", () => {
  const connector = new TikTokConnector();

  it("uses TikTok OAuth v2 scopes", () => {
    const url = connector.buildAuthorizationUrl(
      {
        clientId: "client",
        clientSecret: "secret",
        redirectUri: "https://app.example/callback",
      },
      "signed-state",
      ["user.info.basic", "video.list"],
    );
    expect(url.pathname).toBe("/v2/auth/authorize/");
    expect(url.searchParams.get("scope")).toBe("user.info.basic,video.list");
  });

  it("normalizes creator video engagement", async () => {
    const [fact] = await connector.normalize(
      {
        source: "tiktok",
        schemaVersion: 2,
        rows: [
          {
            id: "video-1",
            create_time: 1_786_060_800,
            view_count: 900,
            like_count: 70,
            comment_count: 8,
            share_count: 12,
          },
        ],
      },
      { id: "creator-1", name: "Creator", type: "tiktok_creator" },
    );
    expect(fact.metrics).toMatchObject({
      impressions: 900,
      video_views: 900,
      engagements: 90,
    });
  });
});
