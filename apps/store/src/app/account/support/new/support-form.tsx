"use client";

import { LoaderCircleIcon, SendIcon, TriangleAlertIcon } from "lucide-react";
import { useActionState, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SUPPORT_LIMITS } from "@/lib/domain";
import { submitSupportRequest, type SupportFormState } from "../actions";

export type OrderOption = { number: number; label: string };

export function SupportForm({
  orders,
  defaultOrder,
  defaultSubject,
}: {
  orders: OrderOption[];
  defaultOrder: number | null;
  defaultSubject: string;
}) {
  const [state, action, pending] = useActionState<SupportFormState, FormData>(submitSupportRequest, { error: null });
  const [body, setBody] = useState("");
  const id = useId();
  const err = (f: "subject" | "body" | "orderNumber") => state.fieldErrors?.[f]?.[0];

  return (
    <form action={action} className="space-y-5 rounded-xl border bg-card p-5 shadow-xs sm:p-6">
      {state.error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          {state.error}
        </p>
      )}

      <div className="grid gap-2">
        <Label htmlFor={`${id}-order`}>Which order is this about?</Label>
        <select
          id={`${id}-order`}
          name="orderNumber"
          defaultValue={defaultOrder ?? ""}
          className="h-9 w-full rounded-lg border bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">Not about a specific order</option>
          {orders.map((o) => (
            <option key={o.number} value={o.number}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">We&apos;ll attach the order&apos;s details so you don&apos;t have to repeat them.</p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${id}-subject`}>Subject</Label>
        <Input
          id={`${id}-subject`}
          name="subject"
          required
          minLength={SUPPORT_LIMITS.subject.min}
          maxLength={SUPPORT_LIMITS.subject.max}
          defaultValue={defaultSubject}
          aria-invalid={err("subject") ? true : undefined}
        />
        {err("subject") && <p className="text-sm text-destructive">{err("subject")}</p>}
      </div>

      <div className="grid gap-2">
        <div className="flex items-baseline justify-between">
          <Label htmlFor={`${id}-body`}>How can we help?</Label>
          <span className="text-xs text-muted-foreground tabular-nums">
            {body.length.toLocaleString()} / {SUPPORT_LIMITS.body.max.toLocaleString()}
          </span>
        </div>
        <Textarea
          id={`${id}-body`}
          name="body"
          required
          minLength={SUPPORT_LIMITS.body.min}
          maxLength={SUPPORT_LIMITS.body.max}
          rows={7}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What happened, and is there a deadline we should know about?"
          aria-invalid={err("body") ? true : undefined}
        />
        {err("body") && <p className="text-sm text-destructive">{err("body")}</p>}
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">A member of our support team reviews every reply before it&apos;s sent.</p>
        <Button type="submit" disabled={pending}>
          {pending ? <LoaderCircleIcon className="animate-spin" aria-hidden /> : <SendIcon aria-hidden />}
          Send request
        </Button>
      </div>
    </form>
  );
}
