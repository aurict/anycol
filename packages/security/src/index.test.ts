import { describe, expect, it } from "vitest";
import {
  decryptSecret,
  encryptSecret,
  redactSensitive,
  verifyWebhookSignature,
} from "./index";
import { createHmac, randomBytes } from "node:crypto";

describe("security", () => {
  it("round-trips encrypted credentials", () => {
    const key = randomBytes(32).toString("base64");
    const encrypted = encryptSecret("refresh-token", key);
    expect(encrypted.ciphertext).not.toContain("refresh-token");
    expect(decryptSecret(encrypted, key)).toBe("refresh-token");
  });

  it("verifies webhook signatures without exposing secrets", () => {
    const signature = createHmac("sha256", "secret")
      .update("payload")
      .digest("hex");
    expect(verifyWebhookSignature("payload", signature, "secret")).toBe(true);
    expect(verifyWebhookSignature("tampered", signature, "secret")).toBe(false);
    expect(redactSensitive({ accessToken: "x", safe: "ok" })).toEqual({
      accessToken: "[REDACTED]",
      safe: "ok",
    });
  });
});
