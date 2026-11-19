import { LifeBuoyIcon, PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SupportStatusBadge } from "@/components/support-status";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { formatSupportNumber } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { listBuyerTickets } from "@/lib/support/tickets";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Support requests" };

export default async function SupportListPage() {
  const user = await requireUser("/account/support");
  const tickets = await listBuyerTickets(getDb(), user.id);

  return (
    <section aria-labelledby="support-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="support-title" className="text-xl font-semibold tracking-tight">
            Support requests
          </h2>
          <p className="text-sm text-muted-foreground">Questions you&apos;ve sent to Fernway support and our replies.</p>
        </div>
        <Button asChild>
          <Link href="/account/support/new">
            <PlusIcon aria-hidden /> New request
          </Link>
        </Button>
      </div>

      {tickets.length === 0 ? (
        <div className="mt-6 flex flex-col items-center rounded-xl border border-dashed px-6 py-14 text-center">
          <LifeBuoyIcon className="size-8 text-muted-foreground/60" aria-hidden />
          <p className="mt-3 font-medium">No support requests yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Problem with an order? Open it under Orders and choose “Get help with this order”, so we can see the details.
          </p>
        </div>
      ) : (
        <ul className="mt-6 divide-y overflow-hidden rounded-xl border bg-card">
          {tickets.map((t) => {
            const unread = t.status === "answered" && !t.replySeenAt;
            return (
              <li key={t.id}>
                <Link href={`/account/support/${t.number}`} className="flex flex-wrap items-center gap-3 px-4 py-3.5 hover:bg-muted/40">
                  <span className={cn("size-2 shrink-0 rounded-full", unread ? "bg-primary" : "bg-transparent")} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-sm", unread ? "font-semibold" : "font-medium")}>
                      {t.subject}
                      {unread && <span className="sr-only"> (new reply)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-mono">{formatSupportNumber(t.number)}</span> · sent {formatDate(t.createdAt)}
                    </p>
                  </div>
                  <SupportStatusBadge status={t.status} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
