import { CircleCheckIcon, InboxIcon, SearchCheckIcon, UserRoundCheckIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SUPPORT_STATUS_LABELS, type SupportStatus } from "@/lib/domain";

const STYLE: Record<SupportStatus, { className: string; icon: typeof InboxIcon }> = {
  submitted: { className: "bg-muted text-muted-foreground", icon: InboxIcon },
  received: { className: "bg-muted text-muted-foreground", icon: InboxIcon },
  in_review: { className: "bg-sky-500/10 text-sky-700 dark:text-sky-300", icon: SearchCheckIcon },
  answered: { className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", icon: CircleCheckIcon },
  escalated: { className: "bg-violet-500/10 text-violet-700 dark:text-violet-300", icon: UserRoundCheckIcon },
};

export function SupportStatusBadge({ status }: { status: SupportStatus }) {
  const { className, icon: Icon } = STYLE[status];
  return (
    <Badge className={className}>
      <Icon aria-hidden />
      {SUPPORT_STATUS_LABELS[status]}
    </Badge>
  );
}
