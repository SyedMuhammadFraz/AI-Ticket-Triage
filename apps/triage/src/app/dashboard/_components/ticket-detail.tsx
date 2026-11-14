import {
  ArrowLeftIcon,
  PackageIcon,
  BookOpenTextIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  FlagIcon,
  LoaderCircleIcon,
  OctagonXIcon,
  ShieldAlertIcon,
} from "lucide-react";
import Link from "next/link";
import { CategoryBadge, PriorityBadge, StatusBadge, TierBadge } from "@/components/ticket-badges";
import type { TicketDetail } from "@/lib/dashboard/queries";
import { REVIEW_REASON_LABELS, TIER_LABELS, URGENCY_LABELS, type QueueFilter } from "@/lib/domain";
import { firstName, formatDateTime, formatRelativeTime } from "@/lib/format";
import { TIER_WEIGHT, URGENCY_WEIGHT } from "@/lib/triage/priority";
import { cn } from "@/lib/utils";
import { RunTriageButton } from "./action-buttons";
import { AuditTimeline } from "./audit-timeline";
import { dashboardHref } from "./queue-list";
import { ReplyComposer } from "./reply-composer";

type Article = TicketDetail["articles"][number];

function Callout({
  tone,
  icon: Icon,
  title,
  children,
  action,
}: {
  tone: "warn" | "bad" | "info";
  icon: typeof CircleAlertIcon;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      role={tone === "info" ? "status" : "note"}
      className={cn(
        "flex gap-3 rounded-lg border p-3.5 text-sm",
        tone === "warn" && "border-amber-500/30 bg-amber-500/5",
        tone === "bad" && "border-red-500/30 bg-red-500/5",
        tone === "info" && "bg-muted/50",
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          tone === "warn" && "text-amber-600 dark:text-amber-400",
          tone === "bad" && "text-red-600 dark:text-red-400",
          tone === "info" && "text-muted-foreground",
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        {children && <div className="mt-1 text-muted-foreground">{children}</div>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}

function ArticleList({ title, articles, open = false }: { title: string; articles: Article[]; open?: boolean }) {
  if (articles.length === 0) return null;
  return (
    <section aria-label={title}>
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        <BookOpenTextIcon className="size-4 text-muted-foreground" aria-hidden /> {title}
      </h3>
      <ul className="space-y-2">
        {articles.map((a) => (
          <li key={a.id}>
            <details className="group rounded-lg border bg-card" open={open && articles.length === 1}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
                {a.title}
                <span className="text-xs font-normal text-muted-foreground group-open:hidden">Show article</span>
                <span className="hidden text-xs font-normal text-muted-foreground group-open:inline">Hide</span>
              </summary>
              <p className="border-t px-3 py-3 text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                {a.body.replace(/\*\*(.+?)\*\*/g, "$1")}
              </p>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TicketDetailView({ detail, filter, now }: { detail: TicketDetail; filter: QueueFilter; now: Date }) {
  const { ticket, draft, message, articles, events } = detail;
  const byId = new Map(articles.map((a) => [a.id, a]));
  const citedIds = draft?.citedArticleIds ?? [];
  const cited = citedIds.map((id) => byId.get(id)).filter((a): a is Article => Boolean(a));
  const related = ticket.kbMatches
    .filter((m) => !citedIds.includes(m.articleId))
    .map((m) => byId.get(m.articleId))
    .filter((a): a is Article => Boolean(a));

  const pendingDraft = draft?.status === "pending" ? draft : null;
  const aiTrouble = ticket.status === "failed" || (ticket.status === "queued" && Boolean(ticket.lastError));
  const canReply = ticket.status === "draft_ready" || ticket.status === "needs_review" || aiTrouble;
  const suspicious = ticket.reviewReasons.includes("suspicious_instructions");
  const otherReasons = ticket.reviewReasons.filter((r) => r !== "suspicious_instructions");
  const escalation = [...events].reverse().find((e) => e.action === "agent.escalated");
  const triaged = ticket.urgency !== null;

  const template = `Hi ${firstName(ticket.customerName)},\n\nThanks for getting in touch.\n\n\n\nBest regards,\nThe Fernway Support Team`;

  return (
    <article className="overflow-hidden rounded-xl border bg-card shadow-xs">
      <header className="border-b p-5">
        <Link
          href={dashboardHref(filter)}
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground lg:hidden"
        >
          <ArrowLeftIcon className="size-4" aria-hidden /> Back to queue
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">
              <span className="font-mono">#{ticket.number}</span> · received{" "}
              <time dateTime={ticket.createdAt.toISOString()} title={formatDateTime(ticket.createdAt)}>
                {formatRelativeTime(ticket.createdAt, now)}
              </time>
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-pretty">{ticket.subject}</h2>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{ticket.customerName}</span>
              <span className="break-all">{ticket.customerEmail}</span>
              <TierBadge tier={ticket.tier} />
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <PriorityBadge score={ticket.priorityScore} triaged={triaged} />
            <StatusBadge status={ticket.status} retrying={ticket.status === "queued" && Boolean(ticket.lastError)} />
          </div>
        </div>
      </header>

      <div className="grid gap-6 p-5 xl:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="min-w-0 space-y-5">
          {suspicious && (
            <Callout tone="bad" icon={ShieldAlertIcon} title="Hidden instructions detected">
              This ticket contains text aimed at the AI (for example, asking it to change its rules or approve
              something). It was treated as data and ignored, and no draft was written. Reply by hand or escalate.
            </Callout>
          )}
          {ticket.status === "needs_review" && otherReasons.length > 0 && (
            <Callout tone="warn" icon={CircleAlertIcon} title="Routed to a person">
              <ul className="list-disc space-y-0.5 pl-4">
                {otherReasons.map((r) => (
                  <li key={r}>{REVIEW_REASON_LABELS[r]}</li>
                ))}
              </ul>
            </Callout>
          )}
          {ticket.status === "queued" && ticket.lastError && (
            <Callout
              tone="warn"
              icon={CircleAlertIcon}
              title={`AI attempt ${ticket.attempts} failed — the ticket is still queued`}
              action={<RunTriageButton ticketId={ticket.id} retry />}
            >
              {ticket.lastError} You can retry now, or reply by hand below.
            </Callout>
          )}
          {ticket.status === "failed" && (
            <Callout
              tone="bad"
              icon={OctagonXIcon}
              title={`Triage failed after ${ticket.attempts} attempts`}
              action={<RunTriageButton ticketId={ticket.id} retry />}
            >
              {ticket.lastError} Nothing was lost — retry when the AI service is back, or reply by hand below.
            </Callout>
          )}
          {ticket.status === "queued" && !ticket.lastError && (
            <Callout
              tone="info"
              icon={LoaderCircleIcon}
              title="Waiting for triage"
              action={<RunTriageButton ticketId={ticket.id} retry={false} />}
            />
          )}
          {ticket.status === "processing" && (
            <Callout tone="info" icon={LoaderCircleIcon} title="The AI is triaging this ticket…" />
          )}

          <section aria-label="Customer message">
            <h3 className="mb-2 text-sm font-semibold">Customer message</h3>
            <div className="rounded-lg border bg-muted/30 p-4 text-sm leading-relaxed break-words whitespace-pre-wrap">
              {ticket.body}
            </div>
          </section>

          {canReply && (
            <ReplyComposer
              key={`${ticket.id}:${pendingDraft?.id ?? "manual"}`}
              ticketId={ticket.id}
              aiDraft={pendingDraft?.aiBody ?? null}
              template={template}
            />
          )}

          {ticket.status === "sent" && message && (
            <section aria-label="Sent reply" className="space-y-2">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <CircleCheckIcon className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden /> Reply sent
              </h3>
              <p className="text-xs text-muted-foreground">
                By {message.sentBy} · {formatDateTime(message.sentAt)} ·{" "}
                {message.draftId ? (message.wasEdited ? "AI draft, edited before sending" : "AI draft, sent unchanged") : "Written by the agent"}
              </p>
              <div className="rounded-lg border p-4 text-sm leading-relaxed break-words whitespace-pre-wrap">
                {message.body}
              </div>
            </section>
          )}

          {ticket.status === "escalated" && (
            <Callout tone="warn" icon={FlagIcon} title="Escalated to the senior team">
              {escalation ? (
                <>
                  By {escalation.actor} · {formatDateTime(escalation.createdAt)}
                  {escalation.details.note ? <span className="mt-1 block">“{String(escalation.details.note)}”</span> : null}
                </>
              ) : null}
            </Callout>
          )}

          <ArticleList title={cited.length ? "Sources used in the draft" : "Sources"} articles={cited} />
          <ArticleList title="Related help articles" articles={related} />
        </div>

        <aside className="min-w-0 space-y-6">
          <section aria-label="AI triage" className="rounded-lg border p-4">
            <h3 className="text-sm font-semibold">AI triage</h3>
            {triaged ? (
              <dl className="mt-3 space-y-2.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Category</dt>
                  <dd>
                    <CategoryBadge category={ticket.category} />
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Urgency</dt>
                  <dd className="font-medium">{URGENCY_LABELS[ticket.urgency!]}</dd>
                </div>
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">Confidence</dt>
                    <dd className="font-medium">{(ticket.confidence ?? 0).toFixed(2)}</dd>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-primary/15" aria-hidden>
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((ticket.confidence ?? 0) * 100)}%` }} />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Priority</dt>
                  <dd className="text-right text-xs text-muted-foreground">
                    {URGENCY_LABELS[ticket.urgency!]} {URGENCY_WEIGHT[ticket.urgency!]} + {TIER_LABELS[ticket.tier]}{" "}
                    {TIER_WEIGHT[ticket.tier]} = <span className="font-medium text-foreground">{ticket.priorityScore}</span>
                  </dd>
                </div>
                {ticket.triageReason && (
                  <div className="border-t pt-2.5">
                    <dt className="sr-only">Reason</dt>
                    <dd className="text-xs leading-relaxed text-muted-foreground">“{ticket.triageReason}”</dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Not triaged yet.</p>
            )}
          </section>

          {ticket.context && <OrderContextPanel context={ticket.context} />}

          <section aria-label="Activity">
            <h3 className="mb-3 text-sm font-semibold">Activity</h3>
            <AuditTimeline events={events} />
          </section>
        </aside>
      </div>
    </article>
  );
}

function OrderContextPanel({ context }: { context: NonNullable<TicketDetail["ticket"]["context"]> }) {
  const { company, order } = context;
  return (
    <section aria-label="Order context" className="rounded-lg border p-4">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">
        <PackageIcon className="size-4 text-muted-foreground" aria-hidden /> Order context
      </h3>
      <p className="mt-0.5 text-xs text-muted-foreground">Sent by the store&apos;s systems with this ticket</p>
      <dl className="mt-3 space-y-2 text-sm">
        {company && (
          <div>
            <dt className="text-xs text-muted-foreground">Company</dt>
            <dd>
              {company.name}
              {company.tierLabel && <span className="text-muted-foreground"> · {company.tierLabel}</span>}
              {company.accountManager && <span className="block text-xs text-muted-foreground">Account manager: {company.accountManager}</span>}
            </dd>
          </div>
        )}
        {order && (
          <>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-xs text-muted-foreground">Order</dt>
              <dd className="font-mono text-xs font-medium">{order.number}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-xs text-muted-foreground">Status</dt>
              <dd className="font-medium capitalize">{order.status.replace(/_/g, " ")}</dd>
            </div>
            {order.estimatedDelivery && (
              <div className="flex items-center justify-between gap-2">
                <dt className="text-xs text-muted-foreground">ETA</dt>
                <dd>{formatDateTime(new Date(order.estimatedDelivery))}</dd>
              </div>
            )}
            {order.poNumber && (
              <div className="flex items-center justify-between gap-2">
                <dt className="text-xs text-muted-foreground">PO</dt>
                <dd className="font-mono text-xs">{order.poNumber}</dd>
              </div>
            )}
            {order.carrier && (
              <div>
                <dt className="text-xs text-muted-foreground">Carrier</dt>
                <dd className="text-xs">
                  {order.carrier}
                  {order.trackingNumber && <span className="block font-mono text-muted-foreground">{order.trackingNumber}</span>}
                </dd>
              </div>
            )}
            {order.items.length > 0 && (
              <div>
                <dt className="text-xs text-muted-foreground">Items</dt>
                <dd>
                  <ul className="mt-1 space-y-1 text-xs">
                    {order.items.map((i) => (
                      <li key={i.sku} className="flex justify-between gap-2">
                        <span className="min-w-0 truncate">{i.name}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {i.quantityDelivered !== undefined ? `${i.quantityDelivered}/` : ""}
                          {i.quantity}
                        </span>
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
          </>
        )}
      </dl>
    </section>
  );
}
