import { describe, expect, it } from "vitest";
import { addLine, cartCount, parseCart, serializeCart, setLine } from "./cart";

describe("parseCart", () => {
  it("reads valid lines and merges duplicates", () => {
    expect(parseCart("PAP-1001:2,WRT-2001:1,PAP-1001:3")).toEqual([
      { sku: "PAP-1001", quantity: 5 },
      { sku: "WRT-2001", quantity: 1 },
    ]);
  });

  it.each([
    ["price smuggling", "PAP-1001:2:0.01"],
    ["negative quantity", "PAP-1001:-5"],
    ["zero", "PAP-1001:0"],
    ["fraction", "PAP-1001:1.5"],
    ["bad sku", "'; DROP TABLE orders;--:1"],
    ["json", '[{"sku":"PAP-1001","price":1}]'],
  ])("drops %s", (_label, raw) => {
    expect(parseCart(raw)).toEqual([]);
  });

  it("clamps huge quantities and caps the number of lines", () => {
    expect(parseCart("PAP-1001:999999")).toEqual([{ sku: "PAP-1001", quantity: 999 }]);
    const many = Array.from({ length: 80 }, (_, i) => `ABC-${String(1000 + i)}:1`).join(",");
    expect(parseCart(many)).toHaveLength(50);
  });
});

describe("cart updates", () => {
  it("round-trips through the cookie format", () => {
    const lines = addLine(addLine([], "PAP-1001", 2), "TEC-6002", 1);
    expect(parseCart(serializeCart(lines))).toEqual(lines);
    expect(cartCount(lines)).toBe(3);
  });

  it("removes a line when its quantity is set to 0", () => {
    const lines = addLine([], "PAP-1001", 2);
    expect(setLine(lines, "PAP-1001", 0)).toEqual([]);
    expect(setLine(lines, "PAP-1001", 7)).toEqual([{ sku: "PAP-1001", quantity: 7 }]);
  });
});
