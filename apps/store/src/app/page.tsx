import {
  ArrowRightIcon,
  BadgePercentIcon,
  BotMessageSquareIcon,
  Building2Icon,
  ReceiptIcon,
  TruckIcon,
} from "lucide-react";
import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { ProductIcon } from "@/components/product-icon";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { featuredProducts } from "@/lib/catalog";
import { getDb } from "@/lib/db";
import { PRODUCT_CATEGORIES } from "@/lib/domain";

const CATEGORY_ICON: Record<string, string> = {
  paper: "file",
  writing: "pen",
  "ink-toner": "printer",
  desk: "paperclip",
  furniture: "chair",
  tech: "monitor",
  breakroom: "coffee",
};

const VALUE_PROPS = [
  { icon: BadgePercentIcon, title: "Contract pricing", body: "Negotiated discounts applied automatically to every order." },
  { icon: ReceiptIcon, title: "Net-30 invoicing", body: "Order on account with PO numbers on every invoice." },
  { icon: TruckIcon, title: "Next-business-day delivery", body: "From our fulfilment centres, free on orders over $150." },
  { icon: Building2Icon, title: "Account managers", body: "Enterprise customers get a named contact for rollouts and moves." },
];

export default async function HomePage() {
  const [user, featured] = await Promise.all([getCurrentUser(), featuredProducts(getDb())]);
  const discount = user?.company.contractDiscountPct ?? 0;

  return (
    <>
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-primary/[0.07] to-transparent">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:py-20">
          <div>
            <p className="text-sm font-semibold text-primary">For offices, clinics and growing teams</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Everything your workplace runs on, delivered tomorrow.
            </h1>
            <p className="mt-4 max-w-xl text-lg text-pretty text-muted-foreground">
              Paper, toner, furniture and tech at contract prices, with invoicing on account and support that answers
              fast.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-11 px-5">
                <Link href="/products">
                  Shop all products <ArrowRightIcon data-icon="inline-end" aria-hidden />
                </Link>
              </Button>
              {!user && (
                <Button asChild size="lg" variant="outline" className="h-11 px-5">
                  <Link href="/sign-in">Sign in to your business account</Link>
                </Button>
              )}
            </div>
          </div>
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-3" aria-label="Shop by category">
            {PRODUCT_CATEGORIES.slice(0, 6).map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/products?category=${c.slug}`}
                  className="group block rounded-xl border bg-card p-2 shadow-xs transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <ProductIcon name={CATEGORY_ICON[c.slug]} category={c.slug} className="aspect-square w-full" iconClassName="size-8" />
                  <span className="mt-2 block text-center text-xs leading-tight font-medium">{c.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Popular with business customers</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {discount > 0 ? `Showing your ${discount}% contract price.` : "Sign in to see your contract pricing."}
            </p>
          </div>
          <Link href="/products" className="hidden text-sm font-medium text-primary hover:underline sm:block">
            View all products
          </Link>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {featured.map((p) => (
            <ProductCard key={p.id} product={p} discountPct={discount} />
          ))}
        </div>
      </section>

      <section className="border-y bg-muted/30">
        <ul className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          {VALUE_PROPS.map((v) => (
            <li key={v.title} className="flex gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <v.icon className="size-5" aria-hidden />
              </span>
              <div>
                <h3 className="font-medium">{v.title}</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">{v.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-5 rounded-2xl border bg-card p-6 shadow-xs sm:flex-row sm:items-center sm:p-8">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
            <BotMessageSquareIcon className="size-6" aria-hidden />
          </span>
          <div className="flex-1">
            <h2 className="text-lg font-semibold">Support that answers fast, with a person in charge</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Questions about an order, an invoice or a delivery are sorted by AI the moment they arrive, so urgent
              requests from your team go to the front of the queue. A Fernway support agent reviews every reply
              before it reaches you.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
