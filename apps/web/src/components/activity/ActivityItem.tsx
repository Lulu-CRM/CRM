"use client";

import { useTranslations } from "next-intl";
import type { Activity, ActivityType } from "@lulu/shared";
import { useFormat } from "@/i18n/format";

const icon: Record<ActivityType, string> = {
  email: "✉",
  meeting: "◷",
  task: "✓",
  note: "▤",
  ai_signal: "✦",
  created: "＋",
  stage_changed: "↗",
};

// Within the last hours the design says "12 min ago", later "Yesterday, 16:18".
const HOURS_12 = 12 * 60 * 60 * 1000;

// One timeline row: icon, translated title, a detail line and the time.
// `context` replaces the detail line, for example "Sophie Laurent" on the Overview.
export function ActivityItem({
  activity,
  actorName,
  context,
}: {
  activity: Activity;
  actorName?: string;
  context?: string;
}) {
  const t = useTranslations("activities");
  const format = useFormat();
  const detailKey = `details.${activity.type}`;
  const detail = context ?? (t.has(detailKey) ? t(detailKey, { actor: actorName ?? t("someone") }) : null);
  const age = Date.now() - Date.parse(activity.occurredAt);

  return (
    <li className="flex items-start gap-2.5 border-b border-surface-muted py-3 last:border-b-0">
      <b className="grid size-[22px] flex-none place-items-center rounded-[7px] bg-primary-soft text-[10px] text-[#5d54c5]" aria-hidden>
        {icon[activity.type]}
      </b>
      <span className="min-w-0 flex-1">
        <strong className="block text-[10px] text-text-strong">{t(`titles.${activity.type}`)}</strong>
        {detail && <small className="mt-1 block text-[9px] leading-snug text-text-subtle">{detail}</small>}
      </span>
      <time dateTime={activity.occurredAt} className="text-[9px] whitespace-nowrap text-text-faint">
        {age < HOURS_12 ? format.relative(activity.occurredAt) : format.recent(activity.occurredAt)}
      </time>
    </li>
  );
}
