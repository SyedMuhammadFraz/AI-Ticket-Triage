import Link from "next/link";
import { APP_NAME, BrandMark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight whitespace-nowrap">
          <BrandMark />
          <span>{APP_NAME}</span>
          <span className="hidden rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground sm:inline">
            Demo
          </span>
        </Link>
        <nav aria-label="Main" className="ml-auto flex items-center gap-1">
          <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
            <Link href="/#how-it-works">How it works</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard">
              <span className="sm:hidden">Agents</span>
              <span className="hidden sm:inline">Agent dashboard</span>
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/submit">
              <span className="sm:hidden">Submit</span>
              <span className="hidden sm:inline">Submit a ticket</span>
            </Link>
          </Button>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          Portfolio demo. Fernway, its customers and its help articles are fictional — no real customer data is used.
        </p>
        <p>Built with Next.js, PostgreSQL and a human-in-the-loop AI workflow.</p>
      </div>
    </footer>
  );
}
