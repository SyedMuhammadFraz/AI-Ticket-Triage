import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/brand";
import { safeNextPath } from "@/lib/auth/redirect";
import { getAgentSession } from "@/lib/auth/session";
import { getEnv } from "@/lib/env";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Agent sign-in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(next);
  if (await getAgentSession()) redirect(nextPath);

  return (
    <div className="relative flex flex-1 items-center justify-center px-4 py-16">
      <div aria-hidden className="bg-hero-glow absolute inset-x-0 top-0 h-80" />
      <div className="relative w-full max-w-sm rounded-2xl border bg-card p-7 shadow-lg shadow-primary/5">
        <BrandMark className="size-9" />
        <h1 className="mt-5 text-xl font-semibold tracking-tight">Agent sign-in</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review AI-triaged tickets and approve every reply before it&apos;s sent.
        </p>
        <SignInForm next={nextPath} passcodeRequired={Boolean(getEnv().AGENT_PASSCODE)} />
      </div>
    </div>
  );
}
