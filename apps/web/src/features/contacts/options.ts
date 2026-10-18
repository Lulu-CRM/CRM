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

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

const tones = ["violet", "blue", "mint", "peach", "coral"] as const;

// Same contact, same colour, on every screen. The constants (seed 11, factor 193) are
// picked so the design's sample contacts get the colours they have in the MagicPath design.
export function avatarTone(id: string) {
  let hash = 11;
  for (const char of id) hash = (hash * 193 + char.charCodeAt(0)) >>> 0;
  return tones[hash % tones.length];
}

export function startOfMonth(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}
