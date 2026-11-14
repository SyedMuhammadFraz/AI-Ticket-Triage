"use client";

import {
  ArrowRightIcon,
  CircleCheckIcon,
  LoaderCircleIcon,
  LockIcon,
  MailIcon,
  SparklesIcon,
  TriangleAlertIcon,
  UserCheckIcon,
  WandSparklesIcon,
} from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LIMITS, TIER_LABELS, TIERS, type Tier } from "@/lib/domain";
import { ticketInputSchema } from "@/lib/tickets/schema";
import { submitTicket } from "./actions";
import { TICKET_FIELDS, initialSubmitState, type SubmitState, type TicketField } from "./form-state";

type Values = Record<TicketField, string>;
export type SampleTicket = {
  key: string;
  label: string;
  hint: string;
  values: Omit<Values, "tier"> & { tier: Tier };
};

const EMPTY: Values = { customerName: "", customerEmail: "", tier: "", subject: "", body: "" };

type Feedback = { message: string; fieldErrors?: Partial<Record<TicketField, string[]>> };

/** Owns a key so "Submit another ticket" can remount the form with fresh state. */
export function SubmitPanel({ samples }: { samples: SampleTicket[] }) {
  const [formKey, setFormKey] = useState(0);
  const [prefill, setPrefill] = useState<{ values: Values; label: string } | null>(null);

  return (
    <div className="mt-10 grid grid-cols-1 gap-8 *:min-w-0 lg:grid-cols-[1fr_20rem]">
      <TicketForm
        key={formKey}
        prefill={prefill}
        onReset={() => {
          setPrefill(null);
          setFormKey((k) => k + 1);
        }}
      />
      <aside className="space-y-6" aria-label="Demo helpers">
        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <WandSparklesIcon className="size-4 text-primary" aria-hidden />
            Try a sample ticket
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">Fills the form so you can see each path.</p>
          <ul className="mt-4 space-y-2">
            {samples.map((s) => (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() => {
                    setPrefill({ values: s.values, label: s.label });
                    setFormKey((k) => k + 1);
                  }}
                  className="group w-full rounded-lg border px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <span className="flex items-center justify-between gap-2 text-sm font-medium">
                    {s.label}
                    <ArrowRightIcon
                      className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{s.hint}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <WhatHappensNext />
      </aside>
    </div>
  );
}

function TicketForm({
  prefill,
  onReset,
}: {
  prefill: { values: Values; label: string } | null;
  onReset: () => void;
}) {
  const [state, formAction, pending] = useActionState<SubmitState, FormData>(submitTicket, initialSubmitState);
  const [values, setValues] = useState<Values>(prefill?.values ?? EMPTY);
  // Errors found in the browser before submitting (same rules as the server).
  const [clientFeedback, setClientFeedback] = useState<Feedback | null>(null);
  // Hide a field's error as soon as the user edits that field.
  const [edited, setEdited] = useState<ReadonlySet<TicketField>>(new Set());
  const errorRef = useRef<HTMLDivElement>(null);
  const id = useId();

  // After the server rejects a submission, move focus to the error summary so
  // keyboard and screen-reader users hear what went wrong.
  useEffect(() => {
    if (state.status === "error") errorRef.current?.focus();
  }, [state]);

  if (state.status === "success") {
    return <SubmitSuccess ticketNumber={state.ticketNumber} onReset={onReset} />;
  }

  const feedback: Feedback | null = clientFeedback ?? (state.status === "error" ? state : null);
  const errorFor = (f: TicketField) => (edited.has(f) ? undefined : feedback?.fieldErrors?.[f]?.[0]);
  const set = (f: TicketField) => (value: string) => {
    setValues((v) => ({ ...v, [f]: value }));
    setEdited((s) => new Set(s).add(f));
  };
  const fieldId = (f: TicketField) => `${id}-${f}`;
  const fieldProps = (f: TicketField) => ({
    id: fieldId(f),
    name: f,
    "aria-invalid": errorFor(f) ? true : undefined,
    "aria-describedby": errorFor(f) ? `${fieldId(f)}-error` : undefined,
  });

  // Validate in the browser first for instant feedback; the server re-validates everything.
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    setEdited(new Set());
    const result = ticketInputSchema.safeParse(values);
    if (result.success) {
      setClientFeedback(null);
      return;
    }
    event.preventDefault();
    const fieldErrors = z.flattenError(result.error).fieldErrors as Feedback["fieldErrors"];
    setClientFeedback({ message: "Please check the highlighted fields.", fieldErrors });
    const firstInvalid = TICKET_FIELDS.find((f) => fieldErrors?.[f]?.length);
    if (firstInvalid) document.getElementById(fieldId(firstInvalid))?.focus();
  };

  return (
    <form
      action={formAction}
      onSubmit={handleSubmit}
      noValidate
      className="rounded-xl border bg-card p-5 shadow-sm sm:p-7"
      aria-describedby={feedback ? `${id}-form-error` : undefined}
    >
      {prefill && (
        <p className="mb-5 flex items-center gap-2 rounded-lg bg-primary/5 px-3 py-2 text-sm text-primary">
          <SparklesIcon className="size-4" aria-hidden />
          Filled with the “{prefill.label}” sample. Edit anything, then submit.
        </p>
      )}

      {feedback && (
        <div
          ref={errorRef}
          id={`${id}-form-error`}
          role="alert"
          tabIndex={-1}
          className="mb-5 flex items-start gap-2 outline-none rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
        >
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          {feedback.message}
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your name" error={errorFor("customerName")} fieldId={fieldId("customerName")}>
          <Input
            {...fieldProps("customerName")}
            autoComplete="name"
            required
            maxLength={LIMITS.name.max}
            value={values.customerName}
            onChange={(e) => set("customerName")(e.target.value)}
          />
        </Field>
        <Field label="Email" error={errorFor("customerEmail")} fieldId={fieldId("customerEmail")}>
          <Input
            {...fieldProps("customerEmail")}
            type="email"
            autoComplete="email"
            required
            maxLength={LIMITS.email.max}
            value={values.customerEmail}
            onChange={(e) => set("customerEmail")(e.target.value)}
          />
        </Field>
      </div>

      <div className="mt-5">
        <Field
          label="Your plan"
          hint="In a real helpdesk this comes from the customer's account."
          error={errorFor("tier")}
          fieldId={fieldId("tier")}
        >
          <Select name="tier" value={values.tier} onValueChange={set("tier")}>
            <SelectTrigger
              id={fieldId("tier")}
              className="w-full sm:w-64"
              aria-invalid={errorFor("tier") ? true : undefined}
              aria-describedby={errorFor("tier") ? `${fieldId("tier")}-error` : `${fieldId("tier")}-hint`}
            >
              <SelectValue placeholder="Select your plan" />
            </SelectTrigger>
            <SelectContent>
              {TIERS.map((t) => (
                <SelectItem key={t} value={t}>
                  {TIER_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="mt-5">
        <Field label="Subject" error={errorFor("subject")} fieldId={fieldId("subject")}>
          <Input
            {...fieldProps("subject")}
            required
            maxLength={LIMITS.subject.max}
            placeholder="A short summary of the problem"
            value={values.subject}
            onChange={(e) => set("subject")(e.target.value)}
          />
        </Field>
      </div>

      <div className="mt-5">
        <Field
          label="Message"
          error={errorFor("body")}
          fieldId={fieldId("body")}
          counter={`${values.body.length.toLocaleString()} / ${LIMITS.body.max.toLocaleString()}`}
        >
          <Textarea
            {...fieldProps("body")}
            required
            rows={8}
            maxLength={LIMITS.body.max}
            placeholder="What happened, what you expected, and anything you've already tried."
            value={values.body}
            onChange={(e) => set("body")(e.target.value)}
            className="min-h-40 resize-y"
          />
        </Field>
      </div>

      {/* Honeypot for bots: hidden from people and assistive tech. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor={`${id}-website`}>Website</label>
        <input id={`${id}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      <div className="mt-7 flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <LockIcon className="size-3.5 shrink-0" aria-hidden />
          Demo site — please don&apos;t enter real personal information.
        </p>
        <Button type="submit" size="lg" disabled={pending} className="h-10 px-5">
          {pending ? (
            <>
              <LoaderCircleIcon className="animate-spin" aria-hidden /> Sending…
            </>
          ) : (
            <>
              Submit ticket <ArrowRightIcon data-icon="inline-end" aria-hidden />
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

/** Label, control, and either an error (`{fieldId}-error`) or a hint (`{fieldId}-hint`). */
function Field({
  label,
  hint,
  error,
  fieldId,
  counter,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  fieldId: string;
  counter?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={fieldId}>{label}</Label>
        {counter && <span className="text-xs text-muted-foreground tabular-nums">{counter}</span>}
      </div>
      {children}
      {error ? (
        <p id={`${fieldId}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${fieldId}-hint`} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

function SubmitSuccess({ ticketNumber, onReset }: { ticketNumber: number | null; onReset: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  return (
    <section
      aria-live="polite"
      className="flex flex-col items-start rounded-xl border bg-card p-7 shadow-sm sm:p-9"
    >
      <span className="grid size-12 place-items-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        <CircleCheckIcon className="size-6" aria-hidden />
      </span>
      <h2 ref={headingRef} tabIndex={-1} className="mt-5 text-2xl font-semibold tracking-tight outline-none">
        {ticketNumber ? `Ticket #${ticketNumber} received` : "Ticket received"}
      </h2>
      <p className="mt-2 max-w-lg text-muted-foreground">
        Thanks for getting in touch. Your ticket is in our queue and a member of the support team will reply by
        email. Every reply is reviewed by a person before it&apos;s sent.
      </p>
      <div className="mt-7 flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={onReset}>
          Submit another ticket
        </Button>
        <Button asChild variant="link" className="px-0">
          <Link href="/dashboard">
            Demo: see it in the agent dashboard <ArrowRightIcon data-icon="inline-end" aria-hidden />
          </Link>
        </Button>
      </div>
    </section>
  );
}

function WhatHappensNext() {
  const steps = [
    { icon: SparklesIcon, text: "AI labels the category and urgency, and checks for anything suspicious." },
    { icon: MailIcon, text: "If a help article matches, the AI drafts a reply using only that article." },
    { icon: UserCheckIcon, text: "A support agent reviews, edits or escalates. Nothing is sent without their approval." },
  ];
  return (
    <div className="rounded-xl border bg-card p-5 shadow-xs">
      <h2 className="text-sm font-semibold">What happens next</h2>
      <ol className="mt-4 space-y-3">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3 text-sm">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
              <s.icon className="size-3.5" aria-hidden />
            </span>
            <span className="text-muted-foreground">{s.text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
