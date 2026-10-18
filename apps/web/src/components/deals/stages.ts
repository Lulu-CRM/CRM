"use client";

import { useTranslations } from "next-intl";
import type { Stage } from "@lulu/shared";

// Default stages have a key and show the translation; stages a workspace adds show their name as typed.
export function useStageName() {
  const t = useTranslations("deals.stages");
  return (stage: Stage) => (stage.key && t.has(stage.key) ? t(stage.key) : stage.name);
}

// Dot colours from the design, by position in the pipeline. Won and lost have their own.
const openColours = ["#62be8f", "#e49b6c", "#8b74e8", "#60a7de"];

export function stageColour(stage: Stage) {
  if (stage.type === "won") return "var(--color-success)";
  if (stage.type === "lost") return "var(--color-neutral)";
  return openColours[stage.order % openColours.length];
}
