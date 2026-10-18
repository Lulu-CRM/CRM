"use client";

import { useTranslations } from "next-intl";
import { dueKind, type DueKind, type Task } from "@lulu/shared";
import { Pill, type PillTone } from "@/components/ui";
import { useFormat } from "@/i18n/format";

// Tones from the design: due today stands out, tomorrow is violet, done is green.
const tones: Record<DueKind, PillTone> = {
  done: "success",
  overdue: "warning",
  today: "warning",
  tomorrow: "violet",
  this_week: "neutral",
  later: "neutral",
  none: "neutral",
};

export function userTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** The due chip on a task: Overdue, Today, Tomorrow, a weekday this week, a date later, or Done. */
export function DueChip({ task, now = new Date() }: { task: Task; now?: Date }) {
  const t = useTranslations("due");
  const format = useFormat();
  const kind = dueKind(task, now, userTimeZone());
  if (kind === "none") return null;

  const label =
    kind === "this_week" && task.dueAt
      ? format.weekday(task.dueAt)
      : kind === "later" && task.dueAt
        ? format.dayMonth(task.dueAt)
        : t(kind as "done" | "overdue" | "today" | "tomorrow");

  return <Pill tone={tones[kind]}>{label}</Pill>;
}
