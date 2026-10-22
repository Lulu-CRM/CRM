"use client";

import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { DealsView } from "@/components/deals/DealsView";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui";
import { LeadsPage } from "@/features/leads/LeadsPage";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";

type Tab = "leads" | "deals";

/**
 * Leads & Deals (MagicPath design update): the lead board and the deal pipeline on one page, with a
 * switch between them. `?view=deals` opens the deals side, so links can point at either.
 */
export function PipelinePage() {
  const t = useTranslations("pipeline");
  const format = useFormatter();
  const [tab, setTab] = useState<Tab>("leads");

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("view") === "deals") setTab("deals");
  }, []);

  const choose = (next: Tab) => {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "deals") url.searchParams.set("view", "deals");
    else url.searchParams.delete("view");
    window.history.replaceState(null, "", url);
  };

  // Leads = contacts on the lead board; deals = open deals, as the deal summary counts them.
  const counts = useApi(() => Promise.all([api.contacts.list({ pageSize: 1 }), api.deals.summary()]), []);
  const badge = (total: number | undefined) =>
    total == null ? null : <b className="ml-1 text-[8px] opacity-80">{format.number(total)}</b>;

  const tabs: { key: Tab; label: string; badge: React.ReactNode }[] = [
    { key: "leads", label: t("leads"), badge: badge(counts.data?.[0].meta.total) },
    { key: "deals", label: t("deals"), badge: badge(counts.data?.[1].activeDeals) },
  ];

  return (
    <>
      <PageHeader page="pipeline" />
      <Card className="mb-[17px]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <span className="text-[9px] font-black tracking-[0.16em] text-rail-label uppercase">{t("eyebrow")}</span>
            <h2 className="mt-1.5 text-[17px] font-semibold tracking-tight text-[#363347]">{t("title")}</h2>
            <p className="mt-1.5 text-[10px] leading-relaxed text-[#9190a0]">{t("intro")}</p>
          </div>
          <div
            role="tablist"
            aria-label={t("switchLabel")}
            className="flex gap-1 rounded-[9px] border border-[#e5e3ed] bg-[#fafaff] p-1 whitespace-nowrap max-md:w-full"
          >
            {tabs.map(({ key, label, badge }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => choose(key)}
                className={`rounded-md px-3 py-2 text-[10px] font-extrabold max-md:flex-1 ${
                  tab === key ? "bg-[#5e54dd] text-white shadow-[0_5px_12px_#5e54dd2b]" : "text-[#8b889a] hover:text-text"
                }`}
              >
                {label}
                {badge}
              </button>
            ))}
          </div>
        </div>
      </Card>
      {tab === "leads" ? <LeadsPage embedded /> : <DealsView embedded />}
    </>
  );
}
