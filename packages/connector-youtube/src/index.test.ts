import { describe, expect, it } from "vitest";
import { YouTubeShortsConnector } from "./index";

describe("YouTubeShortsConnector", () => {
  const connector = new YouTubeShortsConnector();

  it("normalizes Shorts metrics", async () => {
    const [fact] = await connector.normalize(
      {
        source: "youtube",
        schemaVersion: 2,
        rows: [
          {
            day: "2026-08-01",
            creatorContentType: "SHORTS",
            views: 2400,
            likes: 120,
            comments: 20,
            shares: 10,
            subscribersGained: 18,
          },
        ],
      },
      { id: "UC123", name: "Channel", type: "youtube_channel" },
    );
    expect(fact).toMatchObject({
      date: "2026-08-01",
      dimensions: { content_type: "SHORTS" },
      metrics: { video_views: 2400, engagements: 150, followers: 18 },
    });
  });
});
