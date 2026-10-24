"use client";

import { useTranslations } from "next-intl";
import type { AiText } from "@lulu/shared";

// How often to check whether a background AI job has written its result.
export const AI_POLL_MS = 700;

/** Shows AI-written text: a translation key from the simulated provider, or a real model's text as written. */
export function useAiText() {
  const t = useTranslations("aiAnalysis.generated");
  return (text: AiText) => ("key" in text ? (t.has(text.key) ? t(text.key, text.params) : "") : text.text);
}
