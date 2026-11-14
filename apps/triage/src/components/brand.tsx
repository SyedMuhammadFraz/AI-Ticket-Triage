import { cn } from "@/lib/utils";

export const APP_NAME = "Triage Desk";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm shadow-primary/30",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-4" strokeWidth={2.2} stroke="currentColor">
        <path d="M4 7h16M7 12h10M10 17h4" strokeLinecap="round" />
      </svg>
    </span>
  );
}
