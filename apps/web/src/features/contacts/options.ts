import type { LifecycleStage } from "@lulu/shared";
import type { PillTone } from "@/components/ui";

export const lifecycleStages: LifecycleStage[] = ["new", "qualified", "follow_up", "customer"];

export const stageTone: Record<LifecycleStage, PillTone> = {
  new: "neutral",
  qualified: "violet",
  follow_up: "warning",
  customer: "success",
};

// Known sources are translated (sources.<key>). Anything else is a custom source, shown as typed.
export const knownSources = ["website_form", "referral", "email", "import", "marketplace", "instagram"] as const;

export const filterKeys = ["all", "mine", "followUp", "newThisMonth"] as const;
export type FilterKey = (typeof filterKeys)[number];

export function startOfMonth(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}
