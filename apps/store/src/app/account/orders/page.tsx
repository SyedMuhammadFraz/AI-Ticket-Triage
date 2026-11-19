import { PackageIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { OrderStatusBadge } from "@/components/order-status";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { formatOrderNumber } from "@/lib/domain";
import { formatDate, formatDeliveryDate } from "@/lib/format";
import { listCompanyOrders } from "@/lib/orders";
import { formatMoney } from "@/lib/pricing";

export const metadata: Metadata = { title: "Orders" };

export default async function OrdersPage() {
  const user = await requireUser("/account/orders");
  const orders = await listCompanyOrders(getDb(), user.company.id);

  return (
    <section aria-labelledby="orders-title">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 id="orders-title" className="text-xl font-semibold tracking-tight">
            Orders
          </h2>
          <p className="text-sm text-muted-foreground">All orders placed by your company, newest first.</p>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="mt-6 flex flex-col items-center rounded-xl border border-dashed px-6 py-14 text-center">
          <PackageIcon className="size-8 text-muted-foreground/60" aria-hidden />
          <p className="mt-3 font-medium">No orders yet</p>
          <Button asChild className="mt-4">
            <Link href="/products">Start shopping</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Order</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Placed</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Ordered by</th>
                <th scope="col" className="px-4 py-2.5 font-medium">PO</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Items</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <Link href={`/account/orders/${o.number}`} className="font-mono font-medium text-primary hover:underline">
                      {formatOrderNumber(o.number)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(o.placedAt)}</td>
                  <td className="px-4 py-3">{o.buyerName}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{o.poNumber ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-start gap-1">
                      <OrderStatusBadge status={o.status} />
                      {o.estimatedDelivery && (o.status === "shipped" || o.status === "delayed" || o.status === "partially_delivered" || o.status === "processing") && (
                        <span className="text-xs text-muted-foreground">ETA {formatDeliveryDate(o.estimatedDelivery)}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{o.itemCount}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">{formatMoney(o.totalCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
