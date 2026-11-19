"use client";

import { CreditCardIcon, LoaderCircleIcon, ReceiptIcon, Trash2Icon, TriangleAlertIcon } from "lucide-react";
import { useActionState, useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { QuantityStepper } from "@/components/add-to-cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LIMITS } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { placeOrderAction, updateCartLine, type CheckoutState } from "./actions";

export function CartLineControls({ sku, quantity, name }: { sku: string; quantity: number; name: string }) {
  const [value, setValue] = useState(quantity);
  const [pending, startTransition] = useTransition();

  const commit = (next: number) =>
    startTransition(async () => {
      const result = await updateCartLine({ sku, quantity: next });
      if (!result.ok) toast.error(result.error);
      else if (next === 0) toast.success(`Removed ${name}`);
    });

  return (
    <div className="flex items-center gap-2">
      <QuantityStepper
        value={value}
        label={`Quantity of ${name}`}
        disabled={pending}
        onChange={(n) => {
          setValue(n);
          commit(n);
        }}
      />
      <Button variant="ghost" size="icon-sm" aria-label={`Remove ${name}`} disabled={pending} onClick={() => commit(0)}>
        {pending ? <LoaderCircleIcon className="animate-spin" aria-hidden /> : <Trash2Icon aria-hidden />}
      </Button>
    </div>
  );
}

export function CheckoutForm({
  invoiceAllowed,
  shippingAddress,
  companyName,
}: {
  invoiceAllowed: boolean;
  shippingAddress: string;
  companyName: string;
}) {
  const [state, formAction, pending] = useActionState<CheckoutState, FormData>(placeOrderAction, { error: null });
  const [method, setMethod] = useState<"invoice" | "card">(invoiceAllowed ? "invoice" : "card");
  const id = useId();

  return (
    <form action={formAction} className="space-y-5">
      {state.error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          {state.error}
        </p>
      )}

      <div className="grid gap-2">
        <Label htmlFor={`${id}-po`}>
          PO number <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id={`${id}-po`}
          name="poNumber"
          maxLength={LIMITS.poNumber.max}
          placeholder="e.g. PO-2026-0142"
          pattern="[A-Za-z0-9 ._\/\-]*"
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">Printed on your invoice and packing slip.</p>
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Payment</legend>
        {[
          {
            value: "invoice" as const,
            icon: ReceiptIcon,
            title: "Invoice on account (Net 30)",
            note: invoiceAllowed ? `Billed to ${companyName}` : "Available on Business and Enterprise accounts",
            disabled: !invoiceAllowed,
          },
          { value: "card" as const, icon: CreditCardIcon, title: "Company card on file", note: "Visa ending 4242 (demo)", disabled: false },
        ].map((o) => (
          <label
            key={o.value}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
              method === o.value && "border-primary bg-primary/5",
              o.disabled && "cursor-not-allowed opacity-60",
            )}
          >
            <input
              type="radio"
              name="paymentMethod"
              value={o.value}
              checked={method === o.value}
              disabled={o.disabled}
              onChange={() => setMethod(o.value)}
              className="mt-1 accent-[var(--primary)]"
            />
            <o.icon className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
            <span className="text-sm">
              <span className="block font-medium">{o.title}</span>
              <span className="text-xs text-muted-foreground">{o.note}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="text-sm">
        <p className="font-medium">Deliver to</p>
        <p className="mt-1 text-muted-foreground">{shippingAddress}</p>
      </div>

      <Button type="submit" size="lg" className="h-11 w-full" disabled={pending}>
        {pending && <LoaderCircleIcon className="animate-spin" aria-hidden />}
        Place order
      </Button>
      <p className="text-center text-xs text-muted-foreground">Demo store: no payment is taken and nothing ships.</p>
    </form>
  );
}
