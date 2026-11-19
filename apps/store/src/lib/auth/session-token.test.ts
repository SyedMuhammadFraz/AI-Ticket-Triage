import { describe, expect, it } from "vitest";
import { decodeSession, encodeSession, safeNextPath } from "./session-token";

const SECRET = "s".repeat(40);
const USER = "6f1c2a3b-4d5e-4f60-8a71-92b3c4d5e6f7";

describe("customer session token", () => {
  it("round-trips", () => {
    expect(decodeSession(encodeSession(USER, SECRET), SECRET)).toEqual({ userId: USER });
  });

  it("rejects tampering, other secrets, expiry and garbage", () => {
    const token = encodeSession(USER, SECRET);
    const [, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ uid: "00000000-0000-4000-8000-000000000000", exp: Date.now() + 1e9 })).toString("base64url");
    expect(decodeSession(`${forged}.${sig}`, SECRET)).toBeNull();
    expect(decodeSession(encodeSession(USER, "t".repeat(40)), SECRET)).toBeNull();
    expect(decodeSession(encodeSession(USER, SECRET, Date.now() - 13 * 3_600_000), SECRET)).toBeNull();
    expect(decodeSession("nope", SECRET)).toBeNull();
  });
});

describe("safeNextPath", () => {
  it.each([
    ["/account/orders/50001", "/account/orders/50001"],
    ["/cart", "/cart"],
    ["/products?category=paper", "/products?category=paper"],
    ["https://evil.example", "/account/orders"],
    ["//evil.example/account", "/account/orders"],
    ["/admin", "/account/orders"],
    ["/account\\..\\x", "/account/orders"],
    [undefined, "/account/orders"],
  ])("%s → %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});
