import { describe, expect, it } from "vitest";
import { openSecret, sealSecret } from "./secret-box";

const KEY = "k".repeat(40);

describe("secret box", () => {
  it("round-trips and never stores the plaintext", () => {
    const sealed = sealSecret("whsec_abc123", KEY);
    expect(sealed).not.toContain("whsec_abc123");
    expect(openSecret(sealed, KEY)).toBe("whsec_abc123");
  });

  it("uses a fresh IV every time", () => {
    expect(sealSecret("same", KEY)).not.toBe(sealSecret("same", KEY));
  });

  it("refuses tampered ciphertext and the wrong key", () => {
    const sealed = sealSecret("whsec_abc123", KEY);
    const parts = sealed.split(".");
    const flipped = Buffer.from(parts[3], "base64url");
    flipped[0] ^= 0xff;
    parts[3] = flipped.toString("base64url");
    expect(() => openSecret(parts.join("."), KEY)).toThrow();
    expect(() => openSecret(sealed, "x".repeat(40))).toThrow();
  });
});
