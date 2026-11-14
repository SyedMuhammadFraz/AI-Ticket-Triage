import { describe, expect, it } from "vitest";
import { TIERS, URGENCIES } from "@/lib/domain";
import { computePriority, priorityBand } from "./priority";

describe("computePriority", () => {
  it("puts enterprise + urgent above every other combination", () => {
    const top = computePriority("enterprise", "urgent");
    for (const tier of TIERS) {
      for (const urgency of URGENCIES) {
        if (tier === "enterprise" && urgency === "urgent") continue;
        expect(computePriority(tier, urgency)).toBeLessThan(top);
      }
    }
  });

  it("ranks urgency above tier: a free urgent ticket beats an enterprise low one", () => {
    expect(computePriority("free", "urgent")).toBeGreaterThan(computePriority("enterprise", "low"));
  });

  it("breaks ties within an urgency level by tier", () => {
    expect(computePriority("enterprise", "medium")).toBeGreaterThan(computePriority("pro", "medium"));
    expect(computePriority("pro", "medium")).toBeGreaterThan(computePriority("free", "medium"));
  });

  it("maps scores to display bands", () => {
    expect(priorityBand(computePriority("enterprise", "urgent"))).toBe("P1");
    expect(priorityBand(computePriority("free", "low"))).toBe("P4");
  });
});
