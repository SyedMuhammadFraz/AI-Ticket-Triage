import { LIMITS } from "@/lib/domain";

/**
 * The cart lives in a cookie as "SKU:qty,SKU:qty". It holds no prices: prices
 * are always looked up on the server, so editing the cookie can't change what
 * anything costs. Anything that doesn't match the strict format is dropped.
 */
export const CART_COOKIE = "fw_cart";

export type CartLine = { sku: string; quantity: number };

const SKU = /^[A-Z]{3}-\d{4}$/;

export function isValidSku(sku: string): boolean {
  return SKU.test(sku);
}

export function clampQuantity(q: number): number {
  if (!Number.isFinite(q)) return LIMITS.quantity.min;
  return Math.min(LIMITS.quantity.max, Math.max(LIMITS.quantity.min, Math.trunc(q)));
}

export function parseCart(raw: string | undefined): CartLine[] {
  if (!raw) return [];
  const lines = new Map<string, number>();
  for (const part of raw.split(",").slice(0, LIMITS.cartLines)) {
    const fields = part.split(":");
    if (fields.length !== 2) continue; // exactly "SKU:qty" — anything else is dropped
    const [sku, qty] = fields;
    if (!/^\d{1,6}$/.test(qty)) continue;
    const quantity = Number(qty);
    if (isValidSku(sku) && quantity >= 1) {
      lines.set(sku, clampQuantity((lines.get(sku) ?? 0) + quantity));
    }
  }
  return [...lines].map(([sku, quantity]) => ({ sku, quantity }));
}

export function serializeCart(lines: CartLine[]): string {
  return lines
    .slice(0, LIMITS.cartLines)
    .map((l) => `${l.sku}:${clampQuantity(l.quantity)}`)
    .join(",");
}

export function addLine(lines: CartLine[], sku: string, quantity: number): CartLine[] {
  const existing = lines.find((l) => l.sku === sku);
  if (existing) return lines.map((l) => (l.sku === sku ? { sku, quantity: clampQuantity(l.quantity + quantity) } : l));
  if (lines.length >= LIMITS.cartLines) return lines;
  return [...lines, { sku, quantity: clampQuantity(quantity) }];
}

export function setLine(lines: CartLine[], sku: string, quantity: number): CartLine[] {
  return quantity <= 0 ? lines.filter((l) => l.sku !== sku) : lines.map((l) => (l.sku === sku ? { sku, quantity: clampQuantity(quantity) } : l));
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((n, l) => n + l.quantity, 0);
}
