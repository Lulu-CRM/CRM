"use client";

import { useTranslations } from "next-intl";
import {
  segmentConditionSchema,
  type LifecycleStage,
  type SegmentCondition,
  type SegmentRules,
} from "@lulu/shared";

// The rule builder edits conditions as plain strings; these turn them into real conditions and back.

export const fields = ["lifecycleStage", "ownerId", "tag", "marketingConsent", "lastTouch", "followUp", "openDeal"] as const;
export type Field = (typeof fields)[number];

export const operators: Record<Field, readonly string[]> = {
  lifecycleStage: ["is", "is_not"],
  ownerId: ["is", "is_not"],
  tag: ["has", "has_not"],
  marketingConsent: ["is"],
  lastTouch: ["within_days", "older_than_days", "never"],
  followUp: ["due"],
  openDeal: ["exists", "none"],
};

export type DraftCondition = { key: string; field: Field; op: string; value: string };

let nextKey = 0;
const key = () => `c${nextKey++}`;

export function newDraft(field: Field, defaultOwnerId = ""): DraftCondition {
  const defaults: Record<Field, Pick<DraftCondition, "op" | "value">> = {
    lifecycleStage: { op: "is", value: "qualified" },
    ownerId: { op: "is", value: defaultOwnerId },
    tag: { op: "has", value: "" },
    marketingConsent: { op: "is", value: "true" },
    lastTouch: { op: "within_days", value: "14" },
    followUp: { op: "due", value: "" },
    openDeal: { op: "exists", value: "" },
  };
  return { key: key(), field, ...defaults[field] };
}

export function toDraft(condition: SegmentCondition): DraftCondition {
  const value = "value" in condition ? String(condition.value) : "";
  return { key: key(), field: condition.field, op: condition.op, value };
}

/** A finished condition, or null while the row is incomplete (for example an empty tag). */
export function toCondition(draft: DraftCondition): SegmentCondition | null {
  const raw: Record<string, unknown> = { field: draft.field, op: draft.op };
  if (draft.field === "marketingConsent") raw.value = draft.value === "true";
  else if (draft.field === "lastTouch" && draft.op !== "never") raw.value = draft.value === "" ? Number.NaN : Number(draft.value);
  else if (draft.field !== "lastTouch" && draft.field !== "followUp" && draft.field !== "openDeal") raw.value = draft.value;
  const parsed = segmentConditionSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** Human-readable rules ("Stage is Qualified · Last touch in the last 14 days"), in the user's language. */
export function useRuleText(userName: (id: string | null) => string | undefined) {
  const t = useTranslations("segments.rules");
  const tStage = useTranslations("lifecycleStages");

  const condition = (c: SegmentCondition): string => {
    switch (c.field) {
      case "lifecycleStage":
        return t(`lifecycleStage.${c.op}`, { value: tStage(c.value as LifecycleStage) });
      case "ownerId":
        return t(`ownerId.${c.op}`, { value: userName(c.value) ?? "–" });
      case "tag":
        return t(`tag.${c.op}`, { value: c.value });
      case "marketingConsent":
        return t(c.value ? "marketingConsent.granted" : "marketingConsent.notGranted");
      case "lastTouch":
        return c.op === "never" ? t("lastTouch.never") : t(`lastTouch.${c.op}`, { days: c.value });
      case "followUp":
        return t("followUp.due");
      case "openDeal":
        return t(`openDeal.${c.op}`);
    }
  };

  return {
    condition,
    rules: (rules: SegmentRules) =>
      rules.conditions.map(condition).join(rules.match === "all" ? " · " : ` ${t("or")} `),
  };
}
