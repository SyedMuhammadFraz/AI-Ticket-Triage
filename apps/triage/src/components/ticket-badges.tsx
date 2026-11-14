import {
  CircleCheckIcon,
  CircleDashedIcon,
  FlagIcon,
  LoaderCircleIcon,
  OctagonXIcon,
  PencilLineIcon,
  RotateCwIcon,
  UserRoundSearchIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_LABELS, STATUS_LABELS, TIER_LABELS, type Category, type TicketStatus, type Tier } from "@/lib/domain";
import { priorityBand } from "@/lib/triage/priority";
import { cn } from "@/lib/utils";

/** Status colours always come with an icon and a label — never colour alone. */
const STATUS_STYLE: Record<TicketStatus, { className: string; icon: typeof CircleCheckIcon }> = {
  queued: { className: "bg-muted text-muted-foreground", icon: CircleDashedIcon },
  processing: { className: "bg-sky-500/10 text-sky-700 dark:text-sky-300", icon: LoaderCircleIcon },
  draft_ready: { className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", icon: PencilLineIcon },
  needs_review: { className: "bg-amber-500/15 text-amber-800 dark:text-amber-300", icon: UserRoundSearchIcon },
  failed: { className: "bg-red-500/10 text-red-700 dark:text-red-300", icon: OctagonXIcon },
  sent: { className: "bg-muted text-foreground", icon: CircleCheckIcon },
  escalated: { className: "bg-violet-500/10 text-violet-700 dark:text-violet-300", icon: FlagIcon },
};

export function StatusBadge({ status, retrying = false }: { status: TicketStatus; retrying?: boolean }) {
  if (status === "queued" && retrying) {
    return (
      <Badge className="bg-amber-500/15 text-amber-800 dark:text-amber-300">
        <RotateCwIcon aria-hidden /> Retry pending
      </Badge>
    );
  }
  const { className, icon: Icon } = STATUS_STYLE[status];
  return (
    <Badge className={className}>
      <Icon className={cn(status === "processing" && "animate-spin")} aria-hidden />
      {STATUS_LABELS[status]}
    </Badge>
  );
}

const BAND_STYLE = {
  P1: "bg-red-500/10 text-red-700 dark:text-red-300",
  P2: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
  P3: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  P4: "bg-muted text-muted-foreground",
} as const;

export function PriorityBadge({ score, triaged }: { score: number; triaged: boolean }) {
  if (!triaged) {
    return (
      <Badge variant="outline" className="font-mono text-muted-foreground" title="Not triaged yet">
        P–
      </Badge>
    );
  }
  const band = priorityBand(score);
  return (
    <Badge className={cn("font-mono", BAND_STYLE[band])} title={`Priority score ${score}`}>
      {band}
    </Badge>
  );
}

export function TierBadge({ tier }: { tier: Tier }) {
  return (
    <Badge
      variant="outline"
      className={cn(tier === "enterprise" && "border-primary/30 text-primary", tier === "free" && "text-muted-foreground")}
    >
      {TIER_LABELS[tier]}
    </Badge>
  );
}

export function CategoryBadge({ category }: { category: Category | null }) {
  if (!category) return null;
  return <Badge variant="secondary">{CATEGORY_LABELS[category]}</Badge>;
}
