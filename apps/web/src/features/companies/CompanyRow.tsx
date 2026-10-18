"use client";

import { useTranslations } from "next-intl";
import type { CompanyListItem } from "@lulu/shared";
import { useFormat } from "@/i18n/format";
import { companyMark, healthColour } from "./options";

// One account in the directory, laid out like the design's .crm-company-card.
export function CompanyRow({ company, onOpen }: { company: CompanyListItem; onOpen: (company: CompanyListItem) => void }) {
  const t = useTranslations("companies");
  const format = useFormat();

  const context = [t("people", { count: company.contactCount }), company.industry].filter(Boolean).join(" · ");

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(company)}
        aria-label={t("open", { name: company.name })}
        className="grid w-full grid-cols-[38px_minmax(150px,1fr)_20px] items-center gap-[13px] border-t border-surface-muted px-1 py-[15px] text-left hover:bg-surface-soft md:grid-cols-[38px_minmax(180px,1fr)_70px_120px_20px]"
      >
        <span className="grid h-[34px] w-[34px] place-items-center rounded-[10px] bg-primary-soft text-[10px] font-black text-[#5c52be]">
          {companyMark(company.name)}
        </span>
        <span className="min-w-0">
          <strong className="block truncate text-[11px] text-[#444152]">{company.name}</strong>
          {company.domain && <small className="mt-[3px] block truncate text-[9px] text-[#8d8a9c]">{company.domain}</small>}
          <span className="mt-[5px] block truncate text-[9px] text-text-faint">{context}</span>
        </span>
        <span className={`hidden text-[9px] font-extrabold md:block ${healthColour[company.health]}`}>
          {t(`health.${company.health}`)}
        </span>
        <span className="hidden text-right md:block">
          <small className="block text-[8px] text-text-faint">{t("pipelineValue")}</small>
          <strong className="mt-[3px] block text-[11px] text-[#494555]">{format.money(company.openDealValue)}</strong>
          {company.otherCurrencyDeals > 0 && (
            <small className="mt-[3px] block text-[8px] text-text-faint">
              {t("otherCurrency", { count: company.otherCurrencyDeals })}
            </small>
          )}
        </span>
        <span aria-hidden className="text-text-faint">›</span>
      </button>
    </li>
  );
}
