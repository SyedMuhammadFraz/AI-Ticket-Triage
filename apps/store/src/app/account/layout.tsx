import { Building2Icon, UserRoundIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { countUnreadReplies } from "@/lib/support/tickets";
import { AccountTabs } from "./account-tabs";
import { TIER_LABELS } from "@/lib/domain";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/account/orders");
  const c = user.company;
  const unread = await countUnreadReplies(getDb(), user.id);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <section aria-label="Your company account" className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-5 shadow-xs">
        <span className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary">
          <Building2Icon className="size-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight">{c.name}</h1>
            <Badge variant="outline" className={c.tier === "enterprise" ? "border-primary/40 text-primary" : undefined}>
              {TIER_LABELS[c.tier]} account
            </Badge>
          </div>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            <UserRoundIcon className="size-3.5" aria-hidden />
            {user.name}, {user.jobTitle}
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-6 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Payment terms</dt>
            <dd className="font-medium">{c.paymentTerms === "net30" ? "Net 30 invoice" : "Card"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Contract discount</dt>
            <dd className="font-medium">{c.contractDiscountPct ? `${c.contractDiscountPct}%` : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Account manager</dt>
            <dd className="font-medium">{c.accountManager ?? "Shared team"}</dd>
          </div>
        </dl>
      </section>
      <div className="mt-6">
        <AccountTabs unread={unread} />
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}
