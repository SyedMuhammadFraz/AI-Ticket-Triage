import Link from "next/link";
import { AddToCartButton } from "@/components/add-to-cart";
import { ProductIcon } from "@/components/product-icon";
import type { Product } from "@/lib/db/schema";
import { categoryLabel } from "@/lib/domain";
import { contractPriceCents, formatMoney } from "@/lib/pricing";

export function StockLabel({ product }: { product: Pick<Product, "stock" | "leadTimeDays"> }) {
  if (product.stock === 0) return <span className="text-amber-700 dark:text-amber-400">Backorder</span>;
  if (product.leadTimeDays > 2) return <span className="text-muted-foreground">Ships in {product.leadTimeDays} days</span>;
  if (product.stock < 60) return <span className="text-amber-700 dark:text-amber-400">Low stock · ships tomorrow</span>;
  return <span className="text-emerald-700 dark:text-emerald-400">In stock · ships tomorrow</span>;
}

export function Price({ priceCents, discountPct }: { priceCents: number; discountPct: number }) {
  if (discountPct <= 0) return <span className="text-lg font-semibold">{formatMoney(priceCents)}</span>;
  return (
    <span className="flex items-baseline gap-2">
      <span className="text-lg font-semibold">{formatMoney(contractPriceCents(priceCents, discountPct))}</span>
      <span className="text-xs text-muted-foreground line-through">{formatMoney(priceCents)}</span>
    </span>
  );
}

export function ProductCard({ product, discountPct }: { product: Product; discountPct: number }) {
  return (
    <article className="group flex flex-col rounded-xl border bg-card p-3 shadow-xs transition-shadow hover:shadow-md">
      <Link href={`/products/${product.sku}`} className="block rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
        <ProductIcon name={product.icon} category={product.category} className="aspect-[4/3] w-full" iconClassName="size-12 transition-transform group-hover:scale-105" />
        <p className="mt-3 text-xs text-muted-foreground">
          {categoryLabel(product.category)} · <span className="font-mono">{product.sku}</span>
        </p>
        <h3 className="mt-1 line-clamp-2 min-h-10 text-sm font-medium">{product.name}</h3>
      </Link>
      <p className="mt-1 text-xs text-muted-foreground">{product.unitLabel}</p>
      <div className="mt-auto pt-3">
        <Price priceCents={product.priceCents} discountPct={discountPct} />
        <p className="mt-0.5 text-xs">
          <StockLabel product={product} />
        </p>
        <AddToCartButton sku={product.sku} size="sm" className="mt-3 *:w-full" />
      </div>
    </article>
  );
}
