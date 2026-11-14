import type { AuditEvent } from "@/lib/db/schema";
import { CATEGORY_LABELS, REVIEW_REASON_LABELS, URGENCY_LABELS, type Category, type ReviewReason, type Urgency } from "@/lib/domain";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type Described = { title: string; detail?: string; tone?: "default" | "good" | "warn" | "bad" };

function reasons(value: unknown): string {
  return Array.isArray(value)
    ? value.map((r) => REVIEW_REASON_LABELS[r as ReviewReason] ?? String(r)).join("; ")
    : "";
}

/** Turns an audit row into a sentence for the timeline. Unknown actions fall back to their raw name. */
function describe(e: AuditEvent): Described {
  const d = e.details;
  switch (e.action) {
    case "ticket.created":
      return { title: "Ticket submitted", detail: `via ${String(d.source ?? "web form").replace("_", " ")}` };
    case "triage.started":
      return { title: `Triage started (attempt ${d.attempt ?? 1})`, detail: `${d.provider} · ${d.model}` };
    case "ai.classified":
      return {
        title: `Classified as ${CATEGORY_LABELS[d.category as Category] ?? d.category} · ${URGENCY_LABELS[d.urgency as Urgency] ?? d.urgency}`,
        detail: `Confidence ${Number(d.confidence).toFixed(2)}${d.suspiciousInstructions ? " · flagged suspicious" : ""} · ${d.latencyMs} ms`,
      };
    case "kb.searched": {
      const matches = Array.isArray(d.matches) ? d.matches : [];
      return matches.length
        ? { title: `Matched ${matches.length} help article${matches.length === 1 ? "" : "s"}`, detail: matches.map((m: { title: string }) => m.title).join(", ") }
        : { title: "No help article matched", tone: "warn" };
    }
    case "ai.draft_created":
      return { title: "AI drafted a reply", detail: `${d.latencyMs} ms · ${Number(d.inputTokens) + Number(d.outputTokens)} tokens`, tone: "good" };
    case "ai.draft_rejected":
      return { title: "AI draft rejected by safety checks", detail: reasons(d.reasons), tone: "warn" };
    case "ai.duplicate_draft_prevented":
      return { title: "Duplicate draft prevented" };
    case "triage.routed_to_human":
      return { title: "Routed to a person", detail: reasons(d.reasons), tone: "warn" };
    case "ai.error":
      return {
        title: `AI error (attempt ${d.attempt}/${d.maxAttempts})`,
        detail: `${d.message} → ${d.nextStatus === "failed" ? "marked failed" : "kept in queue"}`,
        tone: "bad",
      };
    case "triage.retry_requested":
      return { title: "Triage requested" };
    case "agent.approved":
      return {
        title: d.manual ? "Reply written and sent" : d.edited ? "Draft edited, approved and sent" : "Draft approved and sent unchanged",
        tone: "good",
      };
    case "agent.escalated":
      return { title: "Escalated to the senior team", detail: d.note ? `“${d.note}”` : undefined, tone: "warn" };
    default:
      return { title: e.action };
  }
}

const ACTOR_LABEL: Record<AuditEvent["actorType"], string> = {
  customer: "Customer",
  ai: "AI",
  agent: "Agent",
  system: "System",
};

const DOT: Record<NonNullable<Described["tone"]>, string> = {
  default: "bg-muted-foreground/40",
  good: "bg-emerald-500",
  warn: "bg-amber-500",
  bad: "bg-red-500",
};

export function AuditTimeline({ events }: { events: AuditEvent[] }) {
  return (
    <ol className="space-y-3.5">
      {events.map((e) => {
        const { title, detail, tone = "default" } = describe(e);
        return (
          <li key={e.id} className="relative pl-5">
            <span aria-hidden className={cn("absolute top-1.5 left-0 size-2 rounded-full", DOT[tone])} />
            <p className="text-sm leading-snug font-medium">{title}</p>
            {detail && <p className="mt-0.5 text-xs break-words text-muted-foreground">{detail}</p>}
            <p className="mt-0.5 text-xs text-muted-foreground/80">
              {ACTOR_LABEL[e.actorType]}
              {e.actorType === "agent" || e.actorType === "ai" ? ` · ${e.actor}` : ""} ·{" "}
              <time dateTime={e.createdAt.toISOString()}>{formatDateTime(e.createdAt)}</time>
            </p>
          </li>
        );
      })}
    </ol>
  );
}
