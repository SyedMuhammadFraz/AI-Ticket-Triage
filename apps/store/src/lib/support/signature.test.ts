import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyTriageSignature } from "./signature";

const SECRET = "whsec_" + "s".repeat(40);
const BODY = JSON.stringify({ id: "x", type: "ticket.triaged" });
const NOW = 1_800_000_000;
const sign = (t: number, body = BODY, secret = SECRET) => `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;

describe("verifyTriageSignature", () => {
  it("accepts a fresh, correct signature", () => {
    expect(verifyTriageSignature(BODY, sign(NOW), SECRET, NOW)).toBe(true);
    expect(verifyTriageSignature(BODY, `${sign(NOW)},v1=${"0".repeat(64)}`, SECRET, NOW)).toBe(true); // rotation
  });

  it("rejects a tampered body, the wrong secret and garbage headers", () => {
    expect(verifyTriageSignature(BODY.replace("triaged", "reply_approved"), sign(NOW), SECRET, NOW)).toBe(false);
    expect(verifyTriageSignature(BODY, sign(NOW, BODY, "whsec_other_secret_value_1234567890"), SECRET, NOW)).toBe(false);
    for (const h of [null, "", "t=abc,v1=zz", `v1=${"a".repeat(64)}`, `t=${NOW}`]) {
      expect(verifyTriageSignature(BODY, h, SECRET, NOW)).toBe(false);
    }
  });

  it("rejects replays older (or newer) than 5 minutes", () => {
    expect(verifyTriageSignature(BODY, sign(NOW - 301), SECRET, NOW)).toBe(false);
    expect(verifyTriageSignature(BODY, sign(NOW + 301), SECRET, NOW)).toBe(false);
    expect(verifyTriageSignature(BODY, sign(NOW - 299), SECRET, NOW)).toBe(true);
  });
});
