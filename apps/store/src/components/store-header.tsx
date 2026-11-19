import { Building2Icon, LifeBuoyIcon, LogOutIcon, SearchIcon, ShoppingCartIcon, TruckIcon, UserRoundIcon } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { signOut } from "@/app/sign-in/actions";
import { BrandMark, BrandWordmark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { CART_COOKIE, cartCount, parseCart } from "@/lib/cart";
import { PRODUCT_CATEGORIES, TIER_LABELS } from "@/lib/domain";

export async function StoreHeader() {
  const [user, cookieStore] = await Promise.all([getCurrentUser(), cookies()]);
  const count = cartCount(parseCart(cookieStore.get(CART_COOKIE)?.value));

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="hidden bg-primary text-primary-foreground sm:block">
        <p className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium sm:px-6">
          <TruckIcon className="size-3.5" aria-hidden />
          Free next-business-day delivery on orders over $150 · Net-30 invoicing for business accounts
        </p>
      </div>

      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="Fernway Office Supply — home">
          <BrandMark />
          <BrandWordmark />
        </Link>

        <form action="/products" role="search" className="relative hidden flex-1 md:block">
          <label htmlFor="site-search" className="sr-only">
            Search products
          </label>
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            id="site-search"
            name="q"
            type="search"
            maxLength={80}
            placeholder="Search products or SKUs, e.g. toner, chair, PAP-1001"
            className="h-10 w-full rounded-lg border bg-muted/40 pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
          />
        </form>

        <nav aria-label="Account" className="ml-auto flex items-center gap-1">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/help">
              <LifeBuoyIcon aria-hidden /> Help
            </Link>
          </Button>
          {user ? (
            <>
              <Button asChild variant="ghost" className="hidden h-10 gap-2 px-2 lg:inline-flex">
                <Link href="/account/orders">
                  <Building2Icon className="text-muted-foreground" aria-hidden />
                  <span className="flex flex-col items-start leading-tight">
                    <span className="text-xs text-muted-foreground">{user.company.name}</span>
                    <span className="text-sm font-medium">
                      {user.name} · {TIER_LABELS[user.company.tier]}
                    </span>
                  </span>
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className="lg:hidden">
                <Link href="/account/orders">Orders</Link>
              </Button>
              <form action={signOut}>
                <Button type="submit" variant="ghost" size="icon" aria-label="Sign out">
                  <LogOutIcon aria-hidden />
                </Button>
              </form>
            </>
          ) : (
            <Button asChild variant="ghost" size="sm">
              <Link href="/sign-in">
                <UserRoundIcon aria-hidden /> Sign in
              </Link>
            </Button>
          )}
          <Button asChild variant="outline" size="sm" className="relative h-9">
            <Link href="/cart" aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}>
              <ShoppingCartIcon aria-hidden />
              <span className="hidden sm:inline">Cart</span>
              {count > 0 && (
                <span className="rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </Link>
          </Button>
          <ThemeToggle />
        </nav>
      </div>

      <nav aria-label="Categories" className="border-t">
        <ul className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-1.5 text-sm sm:px-6">
          <li>
            <Link href="/products" className="block rounded-md px-2.5 py-1 font-medium whitespace-nowrap hover:bg-muted">
              All products
            </Link>
          </li>
          {PRODUCT_CATEGORIES.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/products?category=${c.slug}`}
                className="block rounded-md px-2.5 py-1 whitespace-nowrap text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {c.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

export function StoreFooter() {
  return (
    <footer className="mt-16 border-t bg-muted/30">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 text-sm sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2.5">
            <BrandMark />
            <BrandWordmark />
          </div>
          <p className="mt-3 max-w-xs text-muted-foreground">
            Office supplies, furniture and tech for growing teams, with contract pricing and invoicing.
          </p>
        </div>
        <div>
          <h2 className="font-semibold">Shop</h2>
          <ul className="mt-3 space-y-2 text-muted-foreground">
            {PRODUCT_CATEGORIES.slice(0, 5).map((c) => (
              <li key={c.slug}>
                <Link href={`/products?category=${c.slug}`} className="hover:text-foreground">
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="font-semibold">For business</h2>
          <ul className="mt-3 space-y-2 text-muted-foreground">
            <li>Contract pricing up to 12% off</li>
            <li>Net-30 invoicing &amp; PO numbers</li>
            <li>Dedicated Enterprise account managers</li>
            <li>
              <Link href="/sign-in" className="hover:text-foreground">
                Sign in to your business account
              </Link>
            </li>
            <li>
              <Link href="/help" className="hover:text-foreground">
                Help centre
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h2 className="font-semibold">About this demo</h2>
          <p className="mt-3 text-muted-foreground">
            Fernway, its customers and products are fictional. The store is the demo host for{" "}
            <span className="font-medium text-foreground">Triage Desk</span>, an AI support-triage service.
          </p>
        </div>
      </div>
    </footer>
  );
}
