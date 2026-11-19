import { ArrowLeftIcon, CircleCheckIcon, LeafIcon, PackageIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SupportStatusBadge } from "@/components/support-status";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { formatOrderNumber, formatSupportNumber, type SupportStatus } from "@/lib/domain";
import { formatDateTime } from "@/lib/format";
import { getBuyerTicket, markReplySeen } from "@/lib/support/tickets";
import { cn } from "@/lib/utils";
import { eq } from "drizzle-orm";

type Params = Promise<{ number: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { number } = await params;
  return { title: `Request ${formatSupportNumber(Number(number) || 0)}` };
}

const STEPS: Array<{ label: string; reached: (s: SupportStatus) => boolean }> = [
  { label: "Received", reached: () => true },
  { label: "Being reviewed", reached: (s) => s === "in_review" || s === "answered" || s === "escalated" },
  { label: "Answered", reached: (s) => s === "answered" },
];

export default async function SupportRequestPage({ params, searchParams }: { params: Params; searchParams: Promise<{ sent?: string }> }) {
  const { number } = await params;
  const n = Number(number);
  const user = await requireUser(`/account/support/${number}`);
  if (!Number.isInteger(n) || n <= 0) notFound();

  const db = getDb();
  // Only the buyer who sent it can open it; anything else is a 404.
  const ticket = await getBuyerTicket(db, user.id, n);
  if (!ticket) notFound();
  const [order] = ticket.orderId ? await db.select({ number: orders.number }).from(orders).where(eq(orders.id, ticket.orderId)) : [];
  if (ticket.status === "answered") await markReplySeen(db, ticket.id);
  const { sent } = await searchParams;

  return (
    <article className="max-w-3xl space-y-6">
      <Link href="/account/support" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" aria-hidden /> Support requests
      </Link>

      {sent && (
        <p role="status" className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm">
          <CircleCheckIcon className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
          Thanks — we&apos;ve received your request. You&apos;ll see our reply here, and we&apos;ll email {user.email} (simulated).
        </p>
      )}

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm text-muted-foreground">{formatSupportNumber(ticket.number)}</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">{ticket.subject}</h2>
          {order && (
            <Link
              href={`/account/orders/${order.number}`}
              className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <PackageIcon className="size-4" aria-hidden /> Order {formatOrderNumber(order.number)}
            </Link>
          )}
        </div>
        <SupportStatusBadge status={ticket.status} />
      </header>

      {ticket.status !== "escalated" && (
        <ol className="grid grid-cols-3 gap-2" aria-label="Request progress">
          {STEPS.map((s) => {
            const done = s.reached(ticket.status);
            return (
              <li key={s.label} className="text-xs">
                <div className={cn("h-1.5 rounded-full", done ? "bg-primary" : "bg-muted")} />
                <p className={cn("mt-1.5", done ? "font-medium" : "text-muted-foreground")}>{s.label}</p>
              </li>
            );
          })}
        </ol>
      )}

      <section aria-label="Your message" className="rounded-xl border bg-card p-5">
        <p className="text-xs text-muted-foreground">
          You · {formatDateTime(ticket.createdAt)}
        </p>
        <p className="mt-2 text-sm leading-relaxed break-words whitespace-pre-wrap">{ticket.body}</p>
      </section>

      {ticket.status === "answered" && ticket.replyBody ? (
        <section aria-label="Our reply" className="rounded-xl border border-primary/30 bg-primary/[0.04] p-5">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="grid size-6 place-items-center rounded-md bg-primary text-primary-foreground">
              <LeafIcon className="size-3.5" aria-hidden />
            </span>
            Fernway Support · {ticket.repliedBy} · {ticket.repliedAt && formatDateTime(ticket.repliedAt)}
          </p>
          <p className="mt-3 text-sm leading-relaxed break-words whitespace-pre-wrap">{ticket.replyBody}</p>
        </section>
      ) : ticket.status === "escalated" ? (
        <p className="rounded-xl border bg-muted/40 p-5 text-sm text-muted-foreground">
          We&apos;ve passed your request to a specialist team, who will contact you directly.
        </p>
      ) : (
        <p className="rounded-xl border bg-muted/40 p-5 text-sm text-muted-foreground">
          A member of our support team is looking into this. Their reply will appear here.
        </p>
      )}
    </article>
  );
}
