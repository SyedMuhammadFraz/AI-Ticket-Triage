import type { ActorType } from "@/lib/domain";
import type { DbExecutor } from "@/lib/db";
import { auditEvents } from "@/lib/db/schema";

export type AuditInput = {
  ticketId: string | null;
  actorType: ActorType;
  /** Who did it: an agent's name, "customer", the model id, or "triage-pipeline". */
  actor: string;
  /** Dotted verb, e.g. "ticket.created", "ai.classified", "agent.approved". */
  action: string;
  details?: Record<string, unknown>;
};

/** Appends one event to the audit trail. Rows are never updated or deleted by the app. */
export async function recordAudit(db: DbExecutor, event: AuditInput): Promise<void> {
  await db.insert(auditEvents).values({
    ticketId: event.ticketId,
    actorType: event.actorType,
    actor: event.actor,
    action: event.action,
    details: event.details ?? {},
  });
}
