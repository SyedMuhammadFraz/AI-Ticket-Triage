/**
 * Pricing rules, kept pure so they can be tested and reused by the cart,
 * checkout and order pages. All amounts are integer cents.
 */

export const FREE_SHIPPING_OVER_CENTS = 15_000; // $150
export const FLAT_SHIPPING_CENTS = 1_200; // $12
export const TAX_RATE = 0.08;

/** A company's negotiated price for one unit (discount rounded to the cent). */
export function contractPriceCents(listPriceCents: number, discountPct: number): number {
  return Math.round(listPriceCents * (1 - discountPct / 100));
}

export type PricedLine = { unitPriceCents: number; quantity: number };

export type Totals = {
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
};

/**
 * `lines` carry LIST prices; the contract discount is applied to the subtotal
 * and shown as its own line so buyers can see what their contract saves them.
 */
export function computeTotals(lines: PricedLine[], discountPct: number): Totals {
  const subtotalCents = lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);
  const discountCents = Math.round((subtotalCents * discountPct) / 100);
  const afterDiscount = subtotalCents - discountCents;
  const shippingCents = afterDiscount === 0 || afterDiscount >= FREE_SHIPPING_OVER_CENTS ? 0 : FLAT_SHIPPING_CENTS;
  const taxCents = Math.round((afterDiscount + shippingCents) * TAX_RATE);
  return { subtotalCents, discountCents, shippingCents, taxCents, totalCents: afterDiscount + shippingCents + taxCents };
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function formatMoney(cents: number): string {
  return usd.format(cents / 100);
}
