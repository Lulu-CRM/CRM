import type { CompanyHealth } from "@lulu/shared";

// Health colours from the design (.crm-health.strong / .watch / .new).
export const healthColour: Record<CompanyHealth, string> = {
  strong: "text-[#4caa7a]",
  watch: "text-[#d18a3e]",
  new: "text-[#827bce]",
};

export const filterKeys = ["all", "mine"] as const;
export type FilterKey = (typeof filterKeys)[number];

// Sort options, as the API's sort parameter (docs/api.md, GET /companies).
export const sortOptions = ["-openDealValue", "name", "-contactCount", "-lastTouchAt"] as const;
export type SortOption = (typeof sortOptions)[number];
export const sortLabelKey = (sort: SortOption) => sort.replace("-", "") as "openDealValue" | "name" | "contactCount" | "lastTouchAt";

// "Northstar Studio" -> "NS", like the design's company mark. Works for names in any script.
export function companyMark(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter((part) => /^\p{L}|^\p{N}/u.test(part))
    .slice(0, 2)
    .map((part) => [...part][0]!.toUpperCase())
    .join("");
}
