import { describe, expect, it } from "vitest";
import { validateMedia } from "./index";
describe("media validation", () => {
  it("rejects invalid media before publishing", () =>
    expect(
      validateMedia(
        { mimeType: "image/gif", bytes: 20 },
        { mimeTypes: ["image/jpeg"], maxBytes: 10 },
      ),
    ).toHaveLength(2));
});
