import { LeafIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm", className)}
    >
      <LeafIcon className="size-4.5" strokeWidth={2.2} />
    </span>
  );
}

export function BrandWordmark() {
  return (
    <span className="flex flex-col leading-none">
      <span className="text-[15px] font-semibold tracking-tight">Fernway</span>
      <span className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Office Supply</span>
    </span>
  );
}
