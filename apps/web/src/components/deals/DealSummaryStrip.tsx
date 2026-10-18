"use client";

import { useTranslations } from "next-intl";
import type { DealSummary } from "@lulu/shared";
import { useFormat } from "@/i18n/format";

export function DealSummaryStrip({ summary }: { summary: DealSummary }) {
  const t = useTranslations("deals.summary");
  const format = useFormat();

  const items = [
    { key: "openValue", value: format.money(summary.openValue) },
    { key: "weightedValue", value: format.money(summary.weightedValue) },
    { key: "winRate", value: summary.winRate === null ? "–" : format.percent(summary.winRate) },
    { key: "activeDeals", value: format.number(summary.activeDeals) },
    {
      key: "averageClose",
      value: summary.averageDaysToClose === null ? "–" : t("days", { count: summary.averageDaysToClose }),
    },
  ] as const;

  return (
    <div className="mt-5 border-y border-surface-muted py-3">
      <dl className="flex flex-wrap gap-x-6 gap-y-2 text-[9px] text-text-subtle">
        {items.map((item) => (
          <div key={item.key} className="flex items-baseline gap-1">
            <dt className="order-2">{t(item.key)}</dt>
            <dd className="order-1 text-xs font-bold text-text-strong" data-testid={`summary-${item.key}`}>
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
      {summary.otherCurrencyDeals > 0 && (
        <p className="mt-2 text-[9px] text-text-faint">
          {t("otherCurrencies", { count: summary.otherCurrencyDeals })}
        </p>
      )}
    </div>
  );
}
