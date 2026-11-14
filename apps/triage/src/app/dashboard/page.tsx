import { MousePointerClickIcon } from "lucide-react";
import type { Metadata } from "next";
import { z } from "zod";
import { requireAgent } from "@/lib/auth/session";
import { countByStatus, getDashboardStats, getTicketDetail, listQueue } from "@/lib/dashboard/queries";
import { getDb } from "@/lib/db";
import { QUEUE_FILTERS, type QueueFilter } from "@/lib/domain";
import { getEnv } from "@/lib/env";
import { cn } from "@/lib/utils";
import { AutoRefresh, SignOutButton, TriageAllButton } from "./_components/action-buttons";
import { QueueList, StatusTabs, dashboardHref } from "./_components/queue-list";
import { StatsBar } from "./_components/stats-bar";
import { TicketDetailView } from "./_components/ticket-detail";

export const metadata: Metadata = { title: "Agent dashboard" };

type SearchParams = Promise<{ status?: string | string[]; ticket?: string | string[] }>;

function parseFilter(value: unknown): QueueFilter {
  return typeof value === "string" && value in QUEUE_FILTERS ? (value as QueueFilter) : "open";
}

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const filter = parseFilter(sp.status);
  const ticketParam = z.uuid().safeParse(sp.ticket);
  const ticketId = ticketParam.success ? ticketParam.data : undefined;

  // Real authorization check (the proxy's redirect is only a fast path).
  const agent = await requireAgent(dashboardHref(filter, ticketId));

  const db = getDb();
  const env = getEnv();
  const [stats, counts, queue, detail] = await Promise.all([
    getDashboardStats(db),
    countByStatus(db),
    listQueue(db, filter),
    ticketId ? getTicketDetail(db, ticketId) : Promise.resolve(null),
  ]);
  const now = new Date();
  const live = counts.processing > 0 || stats.freshQueued > 0;
  const aiLabel = env.AI_PROVIDER === "gemini" ? env.GEMINI_MODEL : "Mock AI (offline)";

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Support queue</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Signed in as <span className="font-medium text-foreground">{agent.name}</span> · AI: {aiLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AutoRefresh active={live} />
          {counts.queued > 0 && <TriageAllButton count={counts.queued} />}
          <SignOutButton />
        </div>
      </div>

      {/* On small screens, an open ticket takes the whole view. */}
      <div className={cn("mt-5", detail && "hidden lg:block")}>
        <StatsBar
          stats={stats}
          prices={{ inputPerMTok: env.AI_PRICE_INPUT_PER_MTOK, outputPerMTok: env.AI_PRICE_OUTPUT_PER_MTOK }}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,23rem)_minmax(0,1fr)]">
        <section
          aria-label="Ticket queue"
          className={cn(
            "min-w-0 space-y-3 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:self-start lg:overflow-y-auto",
            detail && "hidden lg:block",
          )}
        >
          <StatusTabs current={filter} counts={counts} />
          <QueueList items={queue} filter={filter} selectedId={detail?.ticket.id} now={now} />
        </section>

        <section aria-label="Selected ticket" className={cn("min-w-0", !detail && "hidden lg:block")}>
          {detail ? (
            <TicketDetailView detail={detail} filter={filter} now={now} />
          ) : (
            <div className="flex h-full min-h-80 flex-col items-center justify-center rounded-xl border border-dashed p-10 text-center">
              <MousePointerClickIcon className="size-8 text-muted-foreground/60" aria-hidden />
              <p className="mt-3 font-medium">{ticketId ? "Ticket not found" : "Select a ticket"}</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Open a ticket from the queue to review the AI&apos;s triage, check its sources and approve, edit or
                escalate the reply.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
