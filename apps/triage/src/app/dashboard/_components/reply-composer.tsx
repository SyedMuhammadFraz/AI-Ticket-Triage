"use client";

import { FlagIcon, LoaderCircleIcon, PencilIcon, SendIcon, UndoIcon } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LIMITS } from "@/lib/domain";
import { approveReply, escalate } from "../actions";

type Props = {
  ticketId: string;
  /** The AI draft, or null when the ticket was routed to a person without one. */
  aiDraft: string | null;
  /** Starting text for a hand-written reply. */
  template: string;
};

export function ReplyComposer({ ticketId, aiDraft, template }: Props) {
  const id = useId();
  const [body, setBody] = useState(aiDraft ?? template);
  const [editing, setEditing] = useState(aiDraft === null);
  const [escalating, setEscalating] = useState(false);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [action, setAction] = useState<"send" | "escalate" | null>(null);

  const edited = aiDraft !== null && body.trim() !== aiDraft.trim();
  const empty = body.trim().length === 0;

  const run = (kind: "send" | "escalate") => {
    setAction(kind);
    startTransition(async () => {
      const result = kind === "send" ? await approveReply({ ticketId, body }) : await escalate({ ticketId, note });
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
      setAction(null);
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={`${id}-reply`} className="text-sm font-semibold">
          {aiDraft ? "Suggested reply" : "Write a reply"}
        </Label>
        <span className="text-xs text-muted-foreground">
          {aiDraft ? (edited ? "Edited by you" : "AI draft — review before sending") : "No AI draft for this ticket"}
        </span>
      </div>

      <Textarea
        id={`${id}-reply`}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        readOnly={!editing}
        maxLength={LIMITS.reply.max}
        rows={12}
        className={editing ? "min-h-64" : "min-h-64 cursor-default bg-muted/40 focus-visible:ring-0"}
        aria-describedby={`${id}-hint`}
      />
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        Nothing is sent until you click {aiDraft ? "Approve & send" : "Send reply"}. Sending is simulated — the
        message is saved, not emailed.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => run("send")} disabled={pending || empty}>
          {pending && action === "send" ? <LoaderCircleIcon className="animate-spin" aria-hidden /> : <SendIcon aria-hidden />}
          {aiDraft ? (edited ? "Send edited reply" : "Approve & send") : "Send reply"}
        </Button>

        {aiDraft && !editing && (
          <Button variant="outline" onClick={() => setEditing(true)} disabled={pending}>
            <PencilIcon aria-hidden /> Edit
          </Button>
        )}
        {aiDraft && edited && (
          <Button variant="ghost" onClick={() => setBody(aiDraft)} disabled={pending}>
            <UndoIcon aria-hidden /> Reset to AI draft
          </Button>
        )}

        <Button
          variant="ghost"
          className="ml-auto text-muted-foreground"
          onClick={() => setEscalating((v) => !v)}
          disabled={pending}
          aria-expanded={escalating}
          aria-controls={`${id}-escalate`}
        >
          <FlagIcon aria-hidden /> Escalate
        </Button>
      </div>

      {escalating && (
        <div id={`${id}-escalate`} className="space-y-2 rounded-lg border border-violet-500/30 bg-violet-500/5 p-3">
          <Label htmlFor={`${id}-note`} className="text-sm">
            Escalate to the senior team
          </Label>
          <Textarea
            id={`${id}-note`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={LIMITS.escalationNote.max}
            rows={2}
            placeholder="Optional: what should they know?"
          />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => run("escalate")} disabled={pending}>
              {pending && action === "escalate" && <LoaderCircleIcon className="animate-spin" aria-hidden />}
              Confirm escalation
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEscalating(false)} disabled={pending}>
              Cancel
            </Button>
          </div>
          {aiDraft && <p className="text-xs text-muted-foreground">The AI draft will be discarded.</p>}
        </div>
      )}
    </div>
  );
}
