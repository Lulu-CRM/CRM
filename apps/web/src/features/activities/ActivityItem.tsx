"use client";

import { useTranslations } from "next-intl";
import type { Activity, ActivityType } from "@lulu/shared";
import { useFormat } from "@/i18n/format";

// Icon and colour per activity type, from the design's activity stream.
const look: Record<ActivityType, { icon: string; className: string }> = {
  email: { icon: "✉", className: "bg-primary-soft text-[#5f54c8]" },
  meeting: { icon: "◷", className: "bg-[#e4f3fc] text-[#4a91bd]" },
  task: { icon: "✓", className: "bg-[#e3f5eb] text-[#4d9b72]" },
  note: { icon: "▤", className: "bg-primary-soft text-[#5f54c8]" },
  ai_signal: { icon: "✦", className: "bg-[#fff0e7] text-[#bc7655]" },
  created: { icon: "◈", className: "bg-[#fff0e7] text-[#bc7655]" },
  stage_changed: { icon: "↗", className: "bg-[#e4f3fc] text-[#4a91bd]" },
  marketplace: { icon: "◇", className: "bg-[#e3f5eb] text-[#4d9b72]" },
};

// Within the last hours the design says "12 min ago", later "Yesterday, 16:18".
const HOURS_12 = 12 * 60 * 60 * 1000;

/**
 * One line of an activity timeline. The text comes from the translation files (activities.*),
 * built from the activity's type and payload, so it reads in the user's language.
 */
export function ActivityItem({
  activity,
  actorName,
  recordName,
}: {
  activity: Activity;
  actorName?: string;
  recordName?: string;
}) {
  const t = useTranslations("activities");
  const format = useFormat();
  const actor = actorName ?? t("someone");

  // Tasks say what happened ("completed", "reopened") when the payload tells us.
  const action = typeof activity.payload.action === "string" ? activity.payload.action : null;
  const detailKey = action && t.has(`details.${activity.type}_${action}`) ? `details.${activity.type}_${action}` : `details.${activity.type}`;
  const detail = t.has(detailKey) ? t(detailKey, { actor }) : null;
  const titleKey = action && t.has(`titles.${activity.type}_${action}`) ? `titles.${activity.type}_${action}` : `titles.${activity.type}`;
  const { icon, className } = look[activity.type];

  return (
    <li className="flex items-start gap-2.5 border-t border-surface-muted py-[11px] first:border-t-0">
      <b className={`grid size-[27px] flex-none place-items-center rounded-lg text-[11px] ${className}`} aria-hidden>
        {icon}
      </b>
      <span className="min-w-0 flex-1">
        <strong className="block text-[10px] text-text-strong">{t(titleKey)}</strong>
        {(recordName || detail) && (
          <small className="mt-1 block text-[9px] leading-snug text-text-subtle">
            {[recordName, detail].filter(Boolean).join(" · ")}
          </small>
        )}
      </span>
      <time dateTime={activity.occurredAt} className="text-[9px] whitespace-nowrap text-text-faint">
        {Date.now() - Date.parse(activity.occurredAt) < HOURS_12
          ? format.relative(activity.occurredAt)
          : format.recent(activity.occurredAt)}
      </time>
    </li>
  );
}
