import { describe, expect, it } from "vitest";
import { hashIp } from "./intake";
import { sanitizeText, ticketInputSchema } from "./schema";

const valid = {
  customerName: "Maya Chen",
  customerEmail: "  Maya.Chen@Example.com ",
  tier: "pro",
  subject: "Password reset email never arrives",
  body: "I clicked forgot password three times and nothing arrived.",
};

describe("ticketInputSchema", () => {
  it("accepts a valid ticket and normalises the email", () => {
    const parsed = ticketInputSchema.parse(valid);
    expect(parsed.customerEmail).toBe("maya.chen@example.com");
  });

  it.each([
    ["customerEmail", "not-an-email"],
    ["tier", "platinum"],
    ["subject", "Hi"],
    ["body", "too short"],
    ["body", "x".repeat(5001)],
    ["customerName", ""],
  ])("rejects an invalid %s", (field, value) => {
    const result = ticketInputSchema.safeParse({ ...valid, [field]: value });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual([field]);
  });

  it("counts length after stripping invisible characters", () => {
    const padded = { ...valid, subject: "​​​Hi\u0000\u0007" };
    expect(ticketInputSchema.safeParse(padded).success).toBe(false);
  });
});

describe("sanitizeText", () => {
  it("removes control and bidi-override characters but keeps newlines", () => {
    expect(sanitizeText("a\u0000b\r\nc‮d\te")).toBe("ab\ncd\te");
  });
});

describe("hashIp", () => {
  it("is stable for the same secret and differs across secrets", () => {
    expect(hashIp("1.2.3.4", "s".repeat(32))).toBe(hashIp("1.2.3.4", "s".repeat(32)));
    expect(hashIp("1.2.3.4", "s".repeat(32))).not.toBe(hashIp("1.2.3.4", "t".repeat(32)));
    expect(hashIp("1.2.3.4", "s".repeat(32))).not.toContain("1.2.3.4");
  });
});
