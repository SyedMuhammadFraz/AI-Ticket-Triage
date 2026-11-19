import { ArrowLeftIcon, TriangleAlertIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { formatOrderNumber, ORDER_STATUS_LABELS } from "@/lib/domain";
import { getEnv, supportConfigured } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { listCompanyOrders } from "@/lib/orders";
import { SupportForm } from "./support-form";

export const metadata: Metadata = { title: "Contact support" };

export default async function NewSupportRequestPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const user = await requireUser("/account/support/new");
  const { order } = await searchParams;
  const orders = await listCompanyOrders(getDb(), user.company.id);
  const requested = Number(order);
  const preselected = orders.find((o) => o.number === requested) ?? null;

  return (
    <section aria-labelledby="new-support-title" className="max-w-2xl">
      <Link href="/account/support" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" aria-hidden /> Support requests
      </Link>
      <h2 id="new-support-title" className="mt-4 text-xl font-semibold tracking-tight">
        Contact support
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Most requests get a reply the same business day. Urgent delivery problems for Enterprise accounts go to the front of
        the queue.
      </p>

      {!supportConfigured(getEnv()) && (
        <p role="note" className="mt-4 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm">
          <TriangleAlertIcon className="size-4 text-amber-600" aria-hidden />
          Support isn&apos;t connected in this environment. Run <code className="font-mono">npm run integration:connect-store -w apps/triage</code>.
        </p>
      )}

      <div className="mt-6">
        <SupportForm
          orders={orders.map((o) => ({
            number: o.number,
            label: `${formatOrderNumber(o.number)} · ${formatDate(o.placedAt)} · ${ORDER_STATUS_LABELS[o.status]}${o.poNumber ? ` · PO ${o.poNumber}` : ""}`,
          }))}
          defaultOrder={preselected?.number ?? null}
          defaultSubject={preselected ? `Question about order ${formatOrderNumber(preselected.number)}` : ""}
        />
      </div>
    </section>
  );
}
