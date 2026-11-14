export const TICKET_FIELDS = ["customerName", "customerEmail", "tier", "subject", "body"] as const;
export type TicketField = (typeof TICKET_FIELDS)[number];

export type SubmitState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Partial<Record<TicketField, string[]>> }
  | { status: "success"; ticketNumber: number | null };

export const initialSubmitState: SubmitState = { status: "idle" };
