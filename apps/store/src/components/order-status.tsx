import {
  CircleCheckIcon,
  CircleXIcon,
  ClockIcon,
  PackageCheckIcon,
  TriangleAlertIcon,
  TruckIcon,
  Undo2Icon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/domain";

/** Status colour always comes with an icon and a label. */
const STYLE: Record<OrderStatus, { className: string; icon: typeof ClockIcon }> = {
  processing: { className: "bg-sky-500/10 text-sky-700 dark:text-sky-300", icon: ClockIcon },
  shipped: { className: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300", icon: TruckIcon },
  delayed: { className: "bg-amber-500/15 text-amber-800 dark:text-amber-300", icon: TriangleAlertIcon },
  partially_delivered: { className: "bg-amber-500/15 text-amber-800 dark:text-amber-300", icon: PackageCheckIcon },
  delivered: { className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", icon: CircleCheckIcon },
  cancelled: { className: "bg-muted text-muted-foreground", icon: CircleXIcon },
  returned: { className: "bg-muted text-foreground", icon: Undo2Icon },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { className, icon: Icon } = STYLE[status];
  return (
    <Badge className={className}>
      <Icon aria-hidden />
      {ORDER_STATUS_LABELS[status]}
    </Badge>
  );
}
