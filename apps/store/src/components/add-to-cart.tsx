"use client";

import { LoaderCircleIcon, MinusIcon, PlusIcon, ShoppingCartIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addToCart } from "@/app/cart/actions";
import { Button } from "@/components/ui/button";
import { LIMITS } from "@/lib/domain";
import { cn } from "@/lib/utils";

export function AddToCartButton({
  sku,
  withQuantity = false,
  size = "default",
  className,
}: {
  sku: string;
  withQuantity?: boolean;
  size?: "default" | "lg" | "sm";
  className?: string;
}) {
  const [quantity, setQuantity] = useState(1);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const add = () =>
    startTransition(async () => {
      const result = await addToCart({ sku, quantity });
      if (result.ok) {
        toast.success(result.message, {
          action: { label: "View cart", onClick: () => router.push("/cart") },
        });
      } else {
        toast.error(result.error);
      }
    });

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {withQuantity && (
        <QuantityStepper value={quantity} onChange={setQuantity} disabled={pending} label="Quantity" />
      )}
      <Button size={size} onClick={add} disabled={pending} className={cn(withQuantity && "flex-1", size === "lg" && "h-10")}>
        {pending ? <LoaderCircleIcon className="animate-spin" aria-hidden /> : <ShoppingCartIcon aria-hidden />}
        Add to cart
      </Button>
    </div>
  );
}

export function QuantityStepper({
  value,
  onChange,
  disabled,
  label,
}: {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  label: string;
}) {
  const clamp = (n: number) => Math.min(LIMITS.quantity.max, Math.max(1, Number.isFinite(n) ? Math.trunc(n) : 1));
  return (
    <div className="flex h-9 items-center rounded-lg border" role="group" aria-label={label}>
      <button
        type="button"
        className="grid h-full w-8 place-items-center rounded-l-lg text-muted-foreground hover:bg-muted disabled:opacity-50"
        onClick={() => onChange(clamp(value - 1))}
        disabled={disabled || value <= 1}
        aria-label="Decrease quantity"
      >
        <MinusIcon className="size-3.5" aria-hidden />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={LIMITS.quantity.max}
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
        disabled={disabled}
        aria-label={label}
        className="h-full w-12 border-x bg-transparent text-center text-sm [appearance:textfield] outline-none focus-visible:bg-muted/50 [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button
        type="button"
        className="grid h-full w-8 place-items-center rounded-r-lg text-muted-foreground hover:bg-muted disabled:opacity-50"
        onClick={() => onChange(clamp(value + 1))}
        disabled={disabled || value >= LIMITS.quantity.max}
        aria-label="Increase quantity"
      >
        <PlusIcon className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}
