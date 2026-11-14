import { InfoIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { DashboardStats } from "@/lib/dashboard/queries";
import { formatPercent, formatSeconds, formatTokens, formatUsd } from "@/lib/format";

type Prices = { inputPerMTok?: number; outputPerMTok?: number };

/** KPI row. Values are plain numbers in text colours; no chart needed. */
export function StatsBar({ stats, prices }: { stats: DashboardStats; prices: Prices }) {
  const { ai } = stats;
  const perTicketIn = ai.tickets ? ai.inputTokens / ai.tickets : 0;
  const perTicketOut = ai.tickets ? ai.outputTokens / ai.tickets : 0;
  const hasPrices = prices.inputPerMTok !== undefined && prices.outputPerMTok !== undefined;

  let costValue = "—";
  let costNote = "Mock AI — no cost";
  if (ai.tickets > 0 && hasPrices) {
    costValue = formatUsd((perTicketIn * prices.inputPerMTok! + perTicketOut * prices.outputPerMTok!) / 1_000_000);
    costNote = `${formatTokens(perTicketIn + perTicketOut)} tokens · ${ai.model}`;
  } else if (ai.tickets > 0) {
    costValue = `${formatTokens(perTicketIn + perTicketOut)} tokens`;
    costNote = ai.model ?? "";
  }

  const tiles = [
    {
      label: "Tickets triaged",
      value: stats.triaged.toLocaleString("en-US"),
      note: stats.waiting ? `${stats.waiting} waiting` : "Queue is clear",
      help: "Tickets the AI has classified.",
    },
    {
      label: "Routed to a person",
      value: formatPercent(stats.routedToHuman, stats.triaged),
      note: `${stats.routedToHuman} of ${stats.triaged} triaged`,
      help: "Tickets the AI sent to human review (no matching article, low confidence, suspicious content or a rejected draft) plus tickets agents escalated.",
    },
    {
      label: "Avg. time to draft",
      value: stats.avgSecondsToDraft === null ? "—" : formatSeconds(stats.avgSecondsToDraft),
      note: "From start of triage",
      help: "Average time from the moment triage starts to an AI draft being ready for review.",
    },
    {
      label: "Sent without edits",
      value: formatPercent(stats.sentUnedited, stats.sentFromDraft),
      note: `${stats.sentUnedited} of ${stats.sentFromDraft} AI drafts sent`,
      help: "Share of approved AI drafts that agents sent unchanged.",
    },
    {
      label: "AI cost per ticket",
      value: costValue,
      note: costNote,
      help: "Average real-model token usage per triaged ticket (mock runs excluded). Set AI_PRICE_INPUT_PER_MTOK and AI_PRICE_OUTPUT_PER_MTOK to show it in dollars.",
    },
  ];

  return (
    <section aria-label="Queue statistics" className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3 lg:grid-cols-5">
      {tiles.map((t) => (
        <div key={t.label} className="bg-card px-4 py-3.5 last:col-span-2 sm:last:col-span-1">
          <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            {t.label}
            <Tooltip>
              <TooltipTrigger
                className="rounded-full text-muted-foreground/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                aria-label={`About ${t.label}`}
              >
                <InfoIcon className="size-3.5" aria-hidden />
              </TooltipTrigger>
              <TooltipContent className="max-w-64">{t.help}</TooltipContent>
            </Tooltip>
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">{t.value}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{t.note}</p>
        </div>
      ))}
    </section>
  );
}
