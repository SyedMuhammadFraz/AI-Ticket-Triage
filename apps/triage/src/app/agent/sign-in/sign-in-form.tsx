"use client";

import { ArrowRightIcon, LoaderCircleIcon, TriangleAlertIcon } from "lucide-react";
import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEMO_AGENTS } from "@/lib/domain";
import { signIn, type SignInState } from "./actions";

export function SignInForm({ next, passcodeRequired }: { next: string; passcodeRequired: boolean }) {
  const [state, formAction, pending] = useActionState<SignInState, FormData>(signIn, { error: null });
  const id = useId();

  return (
    <form action={formAction} className="mt-6 grid gap-5">
      <input type="hidden" name="next" value={next} />

      {state.error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
        >
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          {state.error}
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor={`${id}-agent`}>Sign in as</Label>
        <Select name="agent" defaultValue={DEMO_AGENTS[0]}>
          <SelectTrigger id={`${id}-agent`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DEMO_AGENTS.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Fictional support agents. Everything you do is recorded in the audit log under this name.
        </p>
      </div>

      {passcodeRequired && (
        <div className="grid gap-2">
          <Label htmlFor={`${id}-passcode`}>Team passcode</Label>
          <Input id={`${id}-passcode`} name="passcode" type="password" autoComplete="current-password" required />
        </div>
      )}

      <Button type="submit" size="lg" disabled={pending} className="h-10">
        {pending ? (
          <>
            <LoaderCircleIcon className="animate-spin" aria-hidden /> Signing in…
          </>
        ) : (
          <>
            Open the dashboard <ArrowRightIcon data-icon="inline-end" aria-hidden />
          </>
        )}
      </Button>
    </form>
  );
}
