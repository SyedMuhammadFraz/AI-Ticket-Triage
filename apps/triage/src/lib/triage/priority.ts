import type { Tier, Urgency } from "@/lib/domain";

/**
 * Fixed, explainable priority rules — no AI involved. Higher score = handled first.
 * Enterprise + urgent always lands at the top of the queue.
 */
export const URGENCY_WEIGHT: Record<Urgency, number> = {
  urgent: 40,
  high: 30,
  medium: 20,
  low: 10,
};

export const TIER_WEIGHT: Record<Tier, number> = {
  enterprise: 15,
  pro: 5,
  free: 0,
};

export function computePriority(tier: Tier, urgency: Urgency): number {
  return URGENCY_WEIGHT[urgency] + TIER_WEIGHT[tier];
}

export type PriorityBand = "P1" | "P2" | "P3" | "P4";

export function priorityBand(score: number): PriorityBand {
  if (score >= 50) return "P1";
  if (score >= 35) return "P2";
  if (score >= 20) return "P3";
  return "P4";
}
