import { describe, expect, it } from "vitest";
import { computeTotals, contractPriceCents, FLAT_SHIPPING_CENTS, formatMoney } from "./pricing";

describe("contractPriceCents", () => {
  it("applies the company discount and rounds to the cent", () => {
    expect(contractPriceCents(28900, 12)).toBe(25432);
    expect(contractPriceCents(999, 0)).toBe(999);
  });
});

describe("computeTotals", () => {
  it("charges flat delivery under $150 and adds 8% tax on goods + delivery", () => {
    const t = computeTotals([{ unitPriceCents: 999, quantity: 2 }], 0);
    expect(t).toEqual({ subtotalCents: 1998, discountCents: 0, shippingCents: FLAT_SHIPPING_CENTS, taxCents: 256, totalCents: 3454 });
  });

  it("gives free delivery once the discounted subtotal reaches $150", () => {
    const t = computeTotals([{ unitPriceCents: 28900, quantity: 1 }], 12);
    expect(t.discountCents).toBe(3468);
    expect(t.shippingCents).toBe(0);
    expect(t.totalCents).toBe(28900 - 3468 + Math.round((28900 - 3468) * 0.08));
  });

  it("uses the discounted amount for the free-delivery threshold", () => {
    // $155 list, 5% off → $147.25, still under $150.
    expect(computeTotals([{ unitPriceCents: 15500, quantity: 1 }], 5).shippingCents).toBe(FLAT_SHIPPING_CENTS);
  });

  it("is zero for an empty cart", () => {
    expect(computeTotals([], 10).totalCents).toBe(0);
  });
});

describe("formatMoney", () => {
  it("formats cents as US dollars", () => {
    expect(formatMoney(123456)).toBe("$1,234.56");
  });
});
