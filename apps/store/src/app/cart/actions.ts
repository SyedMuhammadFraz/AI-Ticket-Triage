"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { addLine, CART_COOKIE, cartCount, parseCart, serializeCart, setLine, type CartLine } from "@/lib/cart";
import { getProduct } from "@/lib/catalog";
import { getDb } from "@/lib/db";
import { LIMITS, PAYMENT_METHODS } from "@/lib/domain";
import { getEnv } from "@/lib/env";
import { OrderError, placeOrder } from "@/lib/orders";

export type CartResult = { ok: true; message: string; count: number } | { ok: false; error: string };

async function readCart(): Promise<CartLine[]> {
  return parseCart((await cookies()).get(CART_COOKIE)?.value);
}

async function writeCart(lines: CartLine[]): Promise<void> {
  const store = await cookies();
  if (lines.length === 0) {
    store.delete(CART_COOKIE);
    return;
  }
  store.set(CART_COOKIE, serializeCart(lines), {
    httpOnly: true,
    sameSite: "lax",
    secure: getEnv().NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

const lineSchema = z.object({
  sku: z.string().regex(/^[A-Z]{3}-\d{4}$/, { error: "Unknown product." }),
  quantity: z.number().int().min(0).max(LIMITS.quantity.max),
});

export async function addToCart(input: { sku: string; quantity: number }): Promise<CartResult> {
  const parsed = lineSchema.safeParse(input);
  if (!parsed.success || parsed.data.quantity < 1) return { ok: false, error: "Choose a valid quantity." };
  const product = await getProduct(getDb(), parsed.data.sku);
  if (!product) return { ok: false, error: "That product is no longer available." };

  const lines = addLine(await readCart(), product.sku, parsed.data.quantity);
  await writeCart(lines);
  refresh();
  return { ok: true, message: `Added ${parsed.data.quantity} × ${product.name}`, count: cartCount(lines) };
}

export async function updateCartLine(input: { sku: string; quantity: number }): Promise<CartResult> {
  const parsed = lineSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Choose a valid quantity." };
  const lines = setLine(await readCart(), parsed.data.sku, parsed.data.quantity);
  await writeCart(lines);
  refresh();
  return { ok: true, message: parsed.data.quantity === 0 ? "Removed from cart" : "Cart updated", count: cartCount(lines) };
}

export type CheckoutState = { error: string | null };

const checkoutSchema = z.object({
  poNumber: z
    .string()
    .trim()
    .max(LIMITS.poNumber.max, { error: "PO number is too long." })
    .regex(/^[A-Za-z0-9 ._/-]*$/, { error: "PO numbers can contain letters, numbers, spaces and - _ . /" }),
  paymentMethod: z.enum(PAYMENT_METHODS, { error: "Choose a payment method." }),
});

export async function placeOrderAction(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in to place an order." };

  const parsed = checkoutSchema.safeParse({
    poNumber: formData.get("poNumber") ?? "",
    paymentMethod: formData.get("paymentMethod"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your order details." };

  let number: number;
  try {
    ({ number } = await placeOrder(getDb(), {
      userId: user.id,
      company: user.company,
      lines: await readCart(),
      poNumber: parsed.data.poNumber || null,
      paymentMethod: parsed.data.paymentMethod,
    }));
  } catch (err) {
    if (err instanceof OrderError) return { error: err.message };
    console.error("[checkout] order failed:", err);
    return { error: "We couldn't place your order. Please try again." };
  }
  await writeCart([]);
  redirect(`/account/orders/${number}?placed=1`);
}
