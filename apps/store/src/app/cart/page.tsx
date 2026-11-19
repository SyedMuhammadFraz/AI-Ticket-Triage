import { ShoppingCartIcon } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { ProductIcon } from "@/components/product-icon";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { CART_COOKIE, parseCart } from "@/lib/cart";
import { getProductsBySku } from "@/lib/catalog";
import { getDb } from "@/lib/db";
import { computeTotals, contractPriceCents, formatMoney, FREE_SHIPPING_OVER_CENTS } from "@/lib/pricing";
import { CartLineControls, CheckoutForm } from "./cart-client";

export const metadata: Metadata = { title: "Cart" };

export default async function CartPage() {
  const [user, cookieStore] = await Promise.all([getCurrentUser(), cookies()]);
  const lines = parseCart(cookieStore.get(CART_COOKIE)?.value);
  const catalog = await getProductsBySku(getDb(), lines.map((l) => l.sku));
  const items = lines.flatMap((l) => {
    const product = catalog.get(l.sku);
    return product ? [{ product, quantity: l.quantity }] : [];
  });
  const discount = user?.company.contractDiscountPct ?? 0;
  const totals = computeTotals(
    items.map((i) => ({ unitPriceCents: i.product.priceCents, quantity: i.quantity })),
    discount,
  );

  if (items.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center px-4 py-20 text-center sm:px-6">
        <ShoppingCartIcon className="size-10 text-muted-foreground/60" aria-hidden />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Your cart is empty</h1>
        <p className="mt-2 text-muted-foreground">Add supplies from the catalogue to get started.</p>
        <Button asChild className="mt-6">
          <Link href="/products">Browse products</Link>
        </Button>
      </div>
    );
  }

  const afterDiscount = totals.subtotalCents - totals.discountCents;

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_24rem]">
      <section aria-labelledby="cart-title">
        <h1 id="cart-title" className="text-2xl font-semibold tracking-tight">
          Cart
        </h1>
        <ul className="mt-6 divide-y rounded-xl border bg-card">
          {items.map(({ product, quantity }) => {
            const unit = contractPriceCents(product.priceCents, discount);
            return (
              <li key={product.sku} className="flex flex-wrap items-center gap-4 p-4">
                <ProductIcon name={product.icon} category={product.category} className="size-16 shrink-0" iconClassName="size-7" />
                <div className="min-w-0 flex-1">
                  <Link href={`/products/${product.sku}`} className="font-medium hover:underline">
                    {product.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-mono">{product.sku}</span> · {product.unitLabel}
                  </p>
                  <p className="mt-1 text-sm">{formatMoney(unit)} each</p>
                </div>
                <CartLineControls sku={product.sku} quantity={quantity} name={product.name} />
                <p className="w-24 text-right font-medium">{formatMoney(unit * quantity)}</p>
              </li>
            );
          })}
        </ul>
        {afterDiscount < FREE_SHIPPING_OVER_CENTS && (
          <p className="mt-3 text-sm text-muted-foreground">
            Add {formatMoney(FREE_SHIPPING_OVER_CENTS - afterDiscount)} more for free delivery.
          </p>
        )}
      </section>

      <aside aria-label="Order summary" className="h-fit rounded-xl border bg-card p-5 shadow-xs lg:sticky lg:top-40">
        <h2 className="font-semibold">Order summary</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal (list)</dt>
            <dd>{formatMoney(totals.subtotalCents)}</dd>
          </div>
          {totals.discountCents > 0 && (
            <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
              <dt>Contract discount ({discount}%)</dt>
              <dd>−{formatMoney(totals.discountCents)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Delivery</dt>
            <dd>{totals.shippingCents === 0 ? "Free" : formatMoney(totals.shippingCents)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Estimated tax</dt>
            <dd>{formatMoney(totals.taxCents)}</dd>
          </div>
          <div className="flex justify-between border-t pt-2 text-base font-semibold">
            <dt>Total</dt>
            <dd>{formatMoney(totals.totalCents)}</dd>
          </div>
        </dl>
        <div className="mt-5 border-t pt-5">
          {user ? (
            <CheckoutForm
              invoiceAllowed={user.company.paymentTerms === "net30"}
              shippingAddress={user.company.shippingAddress}
              companyName={user.company.name}
            />
          ) : (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">Sign in to your business account to check out with contract pricing and invoicing.</p>
              <Button asChild className="w-full">
                <Link href="/sign-in?next=/cart">Sign in to check out</Link>
              </Button>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
