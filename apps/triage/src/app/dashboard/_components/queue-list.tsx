import { InboxIcon } from "lucide-react";
import Link from "next/link";
import { CategoryBadge, PriorityBadge, StatusBadge, TierBadge } from "@/components/ticket-badges";
import type { QueueItem } from "@/lib/dashboard/queries";
import { QUEUE_FILTERS, type QueueFilter, type TicketStatus } from "@/lib/domain";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function dashboardHref(filter: QueueFilter, ticketId?: string): string {
  const params = new URLSearchParams();
  if (filter !== "open") params.set("status", filter);
  if (ticketId) params.set("ticket", ticketId);
  const qs = params.toString();
  return qs ? `/dashboard?${qs}` : "/dashboard";
}

export function StatusTabs({
  current,
  counts,
}: {
  current: QueueFilter;
  counts: Record<TicketStatus, number>;
}) {
  const filters = Object.entries(QUEUE_FILTERS) as Array<[QueueFilter, (typeof QUEUE_FILTERS)[QueueFilter]]>;
  return (
    <nav aria-label="Filter tickets by status" className="flex flex-wrap gap-1">
      {filters.map(([key, f]) => {
        const n = f.statuses.reduce((sum, s) => sum + counts[s], 0);
        const active = key === current;
        return (
          <Link
            key={key}
            href={dashboardHref(key)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {f.label}
            <span className={cn("rounded-full px-1.5 text-xs", active ? "bg-primary-foreground/20" : "bg-muted")}>{n}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function QueueList({
  items,
  filter,
  selectedId,
  now,
}: {
  items: QueueItem[];
  filter: QueueFilter;
  selectedId?: string;
  now: Date;
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed px-6 py-12 text-center">
        <InboxIcon className="size-8 text-muted-foreground/60" aria-hidden />
        <p className="mt-3 font-medium">Nothing here</p>
        <p className="mt-1 text-sm text-muted-foreground">No tickets match this filter.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y overflow-hidden rounded-xl border bg-card" aria-label="Tickets">
      {items.map((t) => {
        const selected = t.id === selectedId;
        return (
          <li key={t.id}>
            <Link
              href={dashboardHref(filter, t.id)}
              aria-current={selected ? "true" : undefined}
              scroll={false}
              className={cn(
                "block px-4 py-3 transition-colors focus-visible:bg-muted focus-visible:outline-none",
                selected ? "bg-primary/[0.06] shadow-[inset_3px_0_0_var(--primary)]" : "hover:bg-muted/60",
              )}
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <PriorityBadge score={t.priorityScore} triaged={t.urgency !== null} />
                <span className="font-mono">#{t.number}</span>
                <span aria-hidden>·</span>
                <time dateTime={t.createdAt.toISOString()}>{formatRelativeTime(t.createdAt, now)}</time>
                <span className="ml-auto">
                  <StatusBadge status={t.status} retrying={t.status === "queued" && Boolean(t.lastError)} />
                </span>
              </div>
              <p className="mt-1.5 truncate text-sm font-medium">{t.subject}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <span className="truncate">{t.customerName}</span>
                <TierBadge tier={t.tier} />
                <CategoryBadge category={t.category} />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
