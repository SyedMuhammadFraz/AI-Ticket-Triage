import type { Metadata } from "next";
import { SEED_TICKETS } from "../../../data/seed-tickets";
import { SubmitPanel, type SampleTicket } from "./submit-panel";

export const metadata: Metadata = {
  title: "Contact support",
  description: "Submit a support ticket to the fictional Fernway help desk.",
};

const SAMPLES: Array<{ key: string; label: string; hint: string }> = [
  { key: "where-is-order", label: "Where is my order?", hint: "Everyday question → grounded draft" },
  { key: "delayed-office-opening", label: "Delayed furniture, opening Monday", hint: "Enterprise + urgent → top of the queue" },
  { key: "esg-certificate", label: "ESG emissions certificate", hint: "No matching article → human review" },
  { key: "injection-credit", label: "Prompt-injection attempt", hint: "Hidden instructions → flagged" },
];

export default function SubmitPage() {
  const samples: SampleTicket[] = SAMPLES.flatMap(({ key, label, hint }) => {
    const t = SEED_TICKETS.find((s) => s.key === key);
    return t
      ? [
          {
            key,
            label,
            hint,
            values: {
              customerName: t.customerName,
              customerEmail: t.customerEmail,
              tier: t.tier,
              subject: t.subject,
              body: t.body,
            },
          },
        ]
      : [];
  });

  return (
    <div className="relative">
      <div aria-hidden className="bg-hero-glow absolute inset-x-0 top-0 h-80" />
      <div className="relative mx-auto max-w-6xl px-4 pt-12 pb-20 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-primary">Triage Desk · test form</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">How can we help?</h1>
          <p className="mt-3 text-muted-foreground">
            Real customers reach Triage Desk through the Fernway Office Supply store. This form files a ticket
            directly, for testing.
          </p>
        </div>
        <SubmitPanel samples={samples} />
      </div>
    </div>
  );
}
