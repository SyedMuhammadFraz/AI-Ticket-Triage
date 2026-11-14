"use client";

import { LoaderCircleIcon, LogOutIcon, PlayIcon, RotateCwIcon, ZapIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { runTriage, signOut, triageAllQueued, type ActionResult } from "../actions";

function useAction() {
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<ActionResult>) =>
    startTransition(async () => {
      const result = await fn();
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });
  return { pending, run };
}

export function RunTriageButton({ ticketId, retry }: { ticketId: string; retry: boolean }) {
  const { pending, run } = useAction();
  return (
    <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => runTriage({ ticketId }))}>
      {pending ? (
        <LoaderCircleIcon className="animate-spin" aria-hidden />
      ) : retry ? (
        <RotateCwIcon aria-hidden />
      ) : (
        <PlayIcon aria-hidden />
      )}
      {retry ? "Retry triage" : "Run triage now"}
    </Button>
  );
}

export function TriageAllButton({ count }: { count: number }) {
  const { pending, run } = useAction();
  return (
    <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => triageAllQueued())}>
      {pending ? <LoaderCircleIcon className="animate-spin" aria-hidden /> : <ZapIcon aria-hidden />}
      Triage {count} queued
    </Button>
  );
}

export function SignOutButton() {
  return (
    <form action={signOut}>
      <Button type="submit" size="sm" variant="ghost" className="text-muted-foreground">
        <LogOutIcon aria-hidden /> Sign out
      </Button>
    </form>
  );
}

/**
 * While tickets are being triaged in the background, re-fetch the page every
 * few seconds so their status updates without a manual reload. (Polling, not
 * websockets: real-time infrastructure is out of scope.)
 */
export function AutoRefresh({ active, intervalMs = 3000 }: { active: boolean; intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(timer);
  }, [active, intervalMs, router]);

  if (!active) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-sky-500 opacity-60" />
        <span className="relative inline-flex size-2 rounded-full bg-sky-500" />
      </span>
      Triage in progress — updating
    </span>
  );
}
