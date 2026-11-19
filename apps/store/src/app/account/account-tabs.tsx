"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function AccountTabs({ unread }: { unread: number }) {
  const pathname = usePathname();
  const tabs = [
    { href: "/account/orders", label: "Orders" },
    { href: "/account/support", label: "Support requests", badge: unread },
  ];
  return (
    <nav aria-label="Account sections" className="flex gap-1 border-b">
      {tabs.map((t) => {
        const active = pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {t.badge ? (
              <span className="rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground" aria-label={`${t.badge} new replies`}>
                {t.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
