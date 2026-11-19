import { BookOpenTextIcon, LifeBuoyIcon, TriangleAlertIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { listHelpArticles } from "@/lib/support/triage-client";

export const metadata: Metadata = { title: "Help centre" };

const SECTION_LABELS: Record<string, string> = {
  delivery: "Delivery & tracking",
  damaged_wrong_item: "Damaged, wrong or missing items",
  returns_refunds: "Returns & refunds",
  billing_invoices: "Invoices & payments",
  order_changes: "Changing an order",
  account_access: "Your account",
  product_question: "Products & quotes",
};

export default async function HelpPage() {
  const articles = await listHelpArticles();
  const sections = new Map<string, NonNullable<typeof articles>>();
  for (const a of articles ?? []) sections.set(a.category, [...(sections.get(a.category) ?? []), a]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <p className="text-sm font-semibold text-primary">Help centre</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">How can we help?</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Answers to common questions about deliveries, returns, invoices and your account. These are the same articles our
        support team uses when replying to you.
      </p>

      {articles === null ? (
        <p role="note" className="mt-8 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
          <TriangleAlertIcon className="size-4 text-amber-600" aria-hidden /> The help centre is temporarily unavailable. Please try again shortly.
        </p>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {[...sections].map(([category, list]) => (
            <section key={category} aria-labelledby={`sec-${category}`} className="rounded-xl border bg-card p-5 shadow-xs">
              <h2 id={`sec-${category}`} className="font-semibold">
                {SECTION_LABELS[category] ?? category}
              </h2>
              <ul className="mt-3 space-y-2">
                {list.map((a) => (
                  <li key={a.slug}>
                    <Link href={`/help/${a.slug}`} className="flex items-start gap-2 text-sm text-muted-foreground hover:text-foreground">
                      <BookOpenTextIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                      {a.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <div className="mt-10 flex flex-col items-start gap-4 rounded-2xl border bg-primary/5 p-6 sm:flex-row sm:items-center">
        <LifeBuoyIcon className="size-8 text-primary" aria-hidden />
        <div className="flex-1">
          <h2 className="font-semibold">Still need help?</h2>
          <p className="text-sm text-muted-foreground">Send us a request from your account. Attach an order and we&apos;ll see its details.</p>
        </div>
        <Button asChild>
          <Link href="/account/support/new">Contact support</Link>
        </Button>
      </div>
    </div>
  );
}
