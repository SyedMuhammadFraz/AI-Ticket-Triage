import { ArrowRightIcon, TriangleAlertIcon } from "lucide-react";
import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/auth/session-token";
import { getDb } from "@/lib/db";
import { companies, users } from "@/lib/db/schema";
import { TIER_LABELS } from "@/lib/domain";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { signIn } from "./actions";

export const metadata: Metadata = { title: "Sign in" };

const TIER_ORDER = { enterprise: 0, business: 1, starter: 2 } as const;

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; error?: string }>;
}) {
  const sp = await searchParams;
  const next = safeNextPath(sp.next);
  if (await getCurrentUser()) redirect(next);

  const rows = await getDb()
    .select({ user: users, company: companies })
    .from(users)
    .innerJoin(companies, eq(users.companyId, companies.id))
    .orderBy(asc(companies.name), asc(users.name));
  rows.sort((a, b) => TIER_ORDER[a.company.tier] - TIER_ORDER[b.company.tier]);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
      <BrandMark className="size-10" />
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">Sign in to your business account</h1>
      <p className="mt-2 text-muted-foreground">
        Demo store: choose one of the fictional buyers below. Each belongs to a company with its own tier, contract
        pricing and order history.
      </p>
      {sp.error && (
        <p role="alert" className="mt-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <TriangleAlertIcon className="size-4" aria-hidden /> That account couldn&apos;t be found. Please choose again.
        </p>
      )}
      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {rows.map(({ user, company }) => (
          <li key={user.id}>
            <form action={signIn}>
              <input type="hidden" name="userId" value={user.id} />
              <input type="hidden" name="next" value={next} />
              <button
                type="submit"
                className="group flex w-full items-center gap-3 rounded-xl border bg-card p-4 text-left shadow-xs transition hover:border-primary/40 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {initials(user.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{user.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {user.jobTitle} · {company.name}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn("mt-1.5", company.tier === "enterprise" && "border-primary/40 text-primary")}
                  >
                    {TIER_LABELS[company.tier]}
                    {company.contractDiscountPct > 0 && ` · ${company.contractDiscountPct}% contract`}
                  </Badge>
                </span>
                <ArrowRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
