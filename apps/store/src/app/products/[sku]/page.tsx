import { ChevronRightIcon, ReceiptIcon, ShieldCheckIcon, TruckIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCartButton } from "@/components/add-to-cart";
import { Price, StockLabel } from "@/components/product-card";
import { ProductIcon } from "@/components/product-icon";
import { getCurrentUser } from "@/lib/auth/session";
import { isValidSku } from "@/lib/cart";
import { getProduct } from "@/lib/catalog";
import { getDb } from "@/lib/db";
import { TIER_LABELS, categoryLabel } from "@/lib/domain";

type Params = Promise<{ sku: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { sku } = await params;
  const product = isValidSku(sku) ? await getProduct(getDb(), sku) : null;
  return { title: product?.name ?? "Product not found" };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { sku } = await params;
  if (!isValidSku(sku)) notFound();
  const [user, product] = await Promise.all([getCurrentUser(), getProduct(getDb(), sku)]);
  if (!product) notFound();
  const discount = user?.company.contractDiscountPct ?? 0;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/products" className="hover:text-foreground">
          Products
        </Link>
        <ChevronRightIcon className="size-3.5" aria-hidden />
        <Link href={`/products?category=${product.category}`} className="hover:text-foreground">
          {categoryLabel(product.category)}
        </Link>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        <ProductIcon name={product.icon} category={product.category} className="aspect-square w-full max-w-xl rounded-2xl" iconClassName="size-28" />

        <div>
          <p className="font-mono text-sm text-muted-foreground">{product.sku}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-balance">{product.name}</h1>
          <p className="mt-1 text-muted-foreground">{product.unitLabel}</p>

          <div className="mt-5 rounded-xl border bg-card p-5 shadow-xs">
            <Price priceCents={product.priceCents} discountPct={discount} />
            <p className="mt-1 text-xs text-muted-foreground">
              {discount > 0
                ? `${TIER_LABELS[user!.company.tier]} contract price for ${user!.company.name} (${discount}% off list)`
                : user
                  ? "List price"
                  : "List price · sign in for your contract price"}
            </p>
            <p className="mt-3 text-sm">
              <StockLabel product={product} />
            </p>
            <AddToCartButton sku={product.sku} withQuantity size="lg" className="mt-4" />
          </div>

          <p className="mt-6 leading-relaxed text-pretty">{product.description}</p>

          {product.specs.length > 0 && (
            <dl className="mt-6 divide-y rounded-xl border text-sm">
              {product.specs.map(([label, value]) => (
                <div key={label} className="grid grid-cols-[10rem_1fr] gap-4 px-4 py-2.5">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}

          <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <TruckIcon className="size-4" aria-hidden /> Free delivery on orders over $150
            </li>
            <li className="flex items-center gap-2">
              <ReceiptIcon className="size-4" aria-hidden /> Invoice on Net-30 terms for Business and Enterprise accounts
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheckIcon className="size-4" aria-hidden /> 30-day returns on unopened items
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
