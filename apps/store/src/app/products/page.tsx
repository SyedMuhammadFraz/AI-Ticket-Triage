import { SearchXIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { getCurrentUser } from "@/lib/auth/session";
import { isCategory, listProducts } from "@/lib/catalog";
import { getDb } from "@/lib/db";
import { PRODUCT_CATEGORIES, categoryLabel } from "@/lib/domain";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Products" };

type SearchParams = Promise<{ category?: string | string[]; q?: string | string[] }>;

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const category = isCategory(sp.category) ? sp.category : undefined;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";

  const [user, items] = await Promise.all([getCurrentUser(), listProducts(getDb(), { category, q })]);
  const discount = user?.company.contractDiscountPct ?? 0;
  const title = q ? `Results for “${q}”` : category ? categoryLabel(category) : "All products";

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[14rem_1fr]">
      <aside aria-label="Categories" className="lg:sticky lg:top-40 lg:self-start">
        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Categories</h2>
        <ul className="mt-3 flex flex-wrap gap-1.5 lg:flex-col lg:gap-0.5">
          {[{ slug: undefined, label: "All products" }, ...PRODUCT_CATEGORIES].map((c) => {
            const active = c.slug === category;
            return (
              <li key={c.label}>
                <Link
                  href={c.slug ? `/products?category=${c.slug}` : "/products"}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "block rounded-lg px-3 py-1.5 text-sm transition-colors",
                    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {c.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </aside>

      <section aria-labelledby="results-title">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 id="results-title" className="text-2xl font-semibold tracking-tight">
            {title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {items.length} product{items.length === 1 ? "" : "s"}
            {discount > 0 && ` · your ${discount}% contract price applied`}
          </p>
        </div>

        {items.length === 0 ? (
          <div className="mt-10 flex flex-col items-center rounded-xl border border-dashed px-6 py-14 text-center">
            <SearchXIcon className="size-8 text-muted-foreground/60" aria-hidden />
            <p className="mt-3 font-medium">No products found</p>
            <p className="mt-1 text-sm text-muted-foreground">Try another search term or browse a category.</p>
            <Link href="/products" className="mt-4 text-sm font-medium text-primary hover:underline">
              Browse all products
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {items.map((p) => (
              <ProductCard key={p.id} product={p} discountPct={discount} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
