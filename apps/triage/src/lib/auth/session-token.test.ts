import { describe, expect, it } from "vitest";
import { safeNextPath } from "./redirect";
import { decodeSession, encodeSession, passcodeMatches } from "./session-token";

const SECRET = "s".repeat(40);

describe("agent session token", () => {
  it("round-trips a valid session", () => {
    expect(decodeSession(encodeSession("Sam Rivera", SECRET), SECRET)).toEqual({ name: "Sam Rivera" });
  });

  it("rejects a token signed with another secret", () => {
    expect(decodeSession(encodeSession("Sam Rivera", "t".repeat(40)), SECRET)).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const token = encodeSession("Sam Rivera", SECRET);
    const [, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ name: "Mei Tanaka", exp: Date.now() + 1e9 })).toString("base64url");
    expect(decodeSession(`${forged}.${sig}`, SECRET)).toBeNull();
  });

  it("rejects expired tokens and garbage", () => {
    const old = encodeSession("Sam Rivera", SECRET, Date.now() - 9 * 3_600_000);
    expect(decodeSession(old, SECRET)).toBeNull();
    expect(decodeSession("not-a-token", SECRET)).toBeNull();
    expect(decodeSession("a.b.c", SECRET)).toBeNull();
    expect(decodeSession(undefined, SECRET)).toBeNull();
  });

  it("compares passcodes exactly", () => {
    expect(passcodeMatches("correct horse", "correct horse")).toBe(true);
    expect(passcodeMatches("correct hors", "correct horse")).toBe(false);
    expect(passcodeMatches("", "correct horse")).toBe(false);
  });
});

describe("safeNextPath", () => {
  it.each([
    ["/dashboard", "/dashboard"],
    ["/dashboard?status=sent&ticket=abc", "/dashboard?status=sent&ticket=abc"],
    ["https://evil.example/dashboard", "/dashboard"],
    ["//evil.example/dashboard", "/dashboard"],
    ["/dashboardevil", "/dashboard"],
    ["/admin", "/dashboard"],
    ["/dashboard\\..\\evil", "/dashboard"],
    [undefined, "/dashboard"],
  ])("%s → %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});
