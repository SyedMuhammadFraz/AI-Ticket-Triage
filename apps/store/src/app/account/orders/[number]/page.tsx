import {
  ArrowLeftIcon,
  CalendarClockIcon,
  CircleCheckIcon,
  LifeBuoyIcon,
  MapPinIcon,
  ReceiptIcon,
  TruckIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderStatusBadge } from "@/components/order-status";
import { Button } from "@/components/ui/button";
import { ProductIcon } from "@/components/product-icon";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { formatOrderNumber, type OrderStatus } from "@/lib/domain";
import { formatDateTime, formatDeliveryDate } from "@/lib/format";
import { getCompanyOrder } from "@/lib/orders";
import { formatMoney } from "@/lib/pricing";
import { cn } from "@/lib/utils";

type Params = Promise<{ number: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { number } = await params;
  return { title: `Order ${formatOrderNumber(Number(number) || 0)}` };
}

const EVENT_LABEL: Record<string, string> = {
  placed: "Order placed",
  approved: "Payment approved",
  packed: "Packed",
  shipped: "Shipped",
  delayed: "Delivery delayed",
  partially_delivered: "Partially delivered",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
};

const STEPS = ["Placed", "Approved", "Shipped", "Delivered"] as const;

function stepIndex(status: OrderStatus): number {
  switch (status) {
    case "processing":
      return 1;
    case "shipped":
    case "delayed":
    case "partially_delivered":
      return 2;
    case "delivered":
    case "returned":
      return 3;
    default:
      return 0;
  }
}

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<{ placed?: string }>;
}) {
  const { number } = await params;
  const n = Number(number);
  const user = await requireUser(`/account/orders/${number}`);
  if (!Number.isInteger(n) || n <= 0) notFound();

  // Scoped to the buyer's company — another company's order number returns 404, not its contents.
  const detail = await getCompanyOrder(getDb(), user.company.id, n);
  if (!detail) notFound();
  const { order, buyerName, items, events } = detail;
  const { placed } = await searchParams;
  const current = stepIndex(order.status);
  const trouble = order.status === "delayed" || order.status === "partially_delivered";
  const closed = order.status === "cancelled";

  return (
    <article className="space-y-6">
      <Link href="/account/orders" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" aria-hidden /> All orders
      </Link>

      {placed && (
        <p role="status" className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm">
          <CircleCheckIcon className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
          Thank you — your order has been placed. A confirmation has been sent to {user.email} (simulated).
        </p>
      )}

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-mono text-2xl font-semibold tracking-tight">{formatOrderNumber(order.number)}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Placed {formatDateTime(order.placedAt)} by {buyerName}
            {order.poNumber && (
              <>
                {" "}· PO <span className="font-mono">{order.poNumber}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <OrderStatusBadge status={order.status} />
          <Button asChild variant="outline" size="sm">
            <Link href={`/account/support/new?order=${order.number}`}>
              <LifeBuoyIcon aria-hidden /> Get help with this order
            </Link>
          </Button>
        </div>
      </header>

      {!closed && (
        <ol className="grid grid-cols-4 gap-2" aria-label="Order progress">
          {STEPS.map((label, i) => {
            const done = i <= current;
            const warn = trouble && i === 3;
            return (
              <li key={label} className="text-xs">
                <div className={cn("h-1.5 rounded-full", done ? "bg-primary" : warn ? "bg-amber-500/60" : "bg-muted")} />
                <p className={cn("mt-1.5", done ? "font-medium" : "text-muted-foreground")}>
                  {label}
                  {warn && <span className="sr-only"> (delayed)</span>}
                </p>
              </li>
            );
          })}
        </ol>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <section aria-label="Items" className="overflow-hidden rounded-xl border bg-card">
            <ul className="divide-y">
              {items.map(({ item, icon, category }) => (
                <li key={item.id} className="flex items-center gap-4 p-4">
                  <ProductIcon name={icon} category={category} className="size-14 shrink-0" iconClassName="size-6" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/products/${item.sku}`} className="font-medium hover:underline">
                      {item.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-mono">{item.sku}</span> · {formatMoney(item.unitPriceCents)} list each
                    </p>
                    {order.status === "partially_delivered" && (
                      <p className={cn("mt-1 text-xs", item.quantityDelivered < item.quantity ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400")}>
                        {item.quantityDelivered} of {item.quantity} delivered
                      </p>
                    )}
                  </div>
                  <p className="text-sm tabular-nums">× {item.quantity}</p>
                </li>
              ))}
            </ul>
          </section>

          <section aria-label="Order history" className="rounded-xl border bg-card p-5">
            <h3 className="text-sm font-semibold">History</h3>
            <ol className="mt-4 space-y-3.5">
              {[...events].reverse().map((e) => (
                <li key={e.id} className="relative pl-5">
                  <span
                    aria-hidden
                    className={cn(
                      "absolute top-1.5 left-0 size-2 rounded-full",
                      e.kind === "delayed" || e.kind === "partially_delivered" ? "bg-amber-500" : e.kind === "delivered" ? "bg-emerald-500" : "bg-muted-foreground/40",
                    )}
                  />
                  <p className="text-sm font-medium">{EVENT_LABEL[e.kind] ?? e.kind}</p>
                  {e.note && <p className="text-xs text-muted-foreground">{e.note}</p>}
                  <p className="text-xs text-muted-foreground/80">{formatDateTime(e.at)}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-4">
          <section aria-label="Delivery" className="space-y-3 rounded-xl border bg-card p-5 text-sm">
            <h3 className="font-semibold">Delivery</h3>
            {order.estimatedDelivery && !["delivered", "returned", "cancelled"].includes(order.status) && (
              <p className="flex items-start gap-2">
                <CalendarClockIcon className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
                <span>
                  {order.status === "delayed" ? "New estimated delivery" : "Estimated delivery"}
                  <span className="block font-medium">{formatDeliveryDate(order.estimatedDelivery)}</span>
                </span>
              </p>
            )}
            {order.carrier && (
              <p className="flex items-start gap-2">
                <TruckIcon className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
                <span>
                  {order.carrier}
                  <span className="block font-mono text-xs text-muted-foreground">{order.trackingNumber}</span>
                </span>
              </p>
            )}
            <p className="flex items-start gap-2">
              <MapPinIcon className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
              <span className="text-muted-foreground">{order.shippingAddress}</span>
            </p>
          </section>

          <section aria-label="Payment" className="rounded-xl border bg-card p-5 text-sm">
            <h3 className="flex items-center gap-2 font-semibold">
              <ReceiptIcon className="size-4 text-muted-foreground" aria-hidden />
              {order.paymentMethod === "invoice" ? "Invoice · Net 30" : "Paid by card"}
            </h3>
            <dl className="mt-3 space-y-1.5">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd>{formatMoney(order.subtotalCents)}</dd>
              </div>
              {order.discountCents > 0 && (
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                  <dt>Contract discount</dt>
                  <dd>−{formatMoney(order.discountCents)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Delivery</dt>
                <dd>{order.shippingCents ? formatMoney(order.shippingCents) : "Free"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Tax</dt>
                <dd>{formatMoney(order.taxCents)}</dd>
              </div>
              <div className="flex justify-between border-t pt-1.5 font-semibold">
                <dt>Total</dt>
                <dd>{formatMoney(order.totalCents)}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </article>
  );
}
