"use client";

import { useTranslations } from "next-intl";
import type { CompanyListItem } from "@lulu/shared";
import { Avatar, Button, Drawer, EmptyState, Pill, Skeleton } from "@/components/ui";
import { useStageName } from "@/components/deals/stages";
import { useFormat } from "@/i18n/format";
import { api } from "@/lib/api";
import { useErrorMessage } from "@/lib/errors";
import { avatarTone, initials } from "@/lib/initials";
import { useApi } from "@/lib/useApi";
import { stageTone } from "@/features/contacts/options";
import type { Lookups } from "@/features/contacts/useLookups";
import { companyMark, healthColour } from "./options";

export function CompanyDrawer({
  company,
  lookups,
  onClose,
  onEdit,
  onDelete,
}: {
  company: CompanyListItem | null;
  lookups: Lookups;
  onClose: () => void;
  onEdit: (company: CompanyListItem) => void;
  onDelete: (company: CompanyListItem) => void;
}) {
  const t = useTranslations("companies.drawer");
  const tCompanies = useTranslations("companies");
  const tForm = useTranslations("companies.form");
  const tStage = useTranslations("lifecycleStages");
  const tCommon = useTranslations("common");
  const format = useFormat();
  const errorMessage = useErrorMessage();
  const stageName = useStageName();

  const id = company?.id;
  // Refetched when the company changes, so an edit shows at once.
  const detail = useApi(
    () => (id ? Promise.all([api.companies.get(id), api.pipelines()]) : Promise.resolve(null)),
    [id, company?.updatedAt],
  );

  if (!company) return null;

  const [full, pipelines] = detail.data ?? [null, []];
  const stages = new Map(pipelines.flatMap((p) => p.stages).map((s) => [s.id, s]));

  const details: [string, React.ReactNode][] = [
    [t("domain"), company.domain ?? "–"],
    [t("industry"), company.industry ?? "–"],
    [t("size"), company.size ? tCompanies("sizeValue", { size: company.size }) : "–"],
    [t("owner"), lookups.userName(company.ownerId) ?? "–"],
    [t("lastTouch"), company.lastTouchAt ? format.recent(company.lastTouchAt) : "–"],
    // Added Oct 23, 2026 (labels shared with the company form).
    [tForm("leadStatus"), company.leadStatus ? tStage(company.leadStatus) : "–"],
    [tForm("whatsapp"), company.whatsapp ?? "–"],
    [tForm("instagram"), company.instagram ?? "–"],
    [tForm("facebook"), company.facebook ?? "–"],
    [tForm("productService"), company.productService ?? "–"],
    [tForm("aiNotes"), company.aiNotes ?? "–"],
  ];

  return (
    <Drawer open onClose={onClose} eyebrow={t("eyebrow")} title={company.name}>
      <div className="flex items-center gap-3">
        <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[10px] bg-primary-soft text-[11px] font-black text-[#5c52be]">
          {companyMark(company.name)}
        </span>
        <div className="min-w-0 flex-1">
          <strong className="block truncate text-[13px] text-text-strong">{company.name}</strong>
          <span className="mt-1 block text-[11px] text-text-subtle">
            {tCompanies("people", { count: company.contactCount })}
          </span>
        </div>
        <span className={`text-[10px] font-extrabold ${healthColour[company.health]}`}>{tCompanies(`health.${company.health}`)}</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-surface-soft p-3">
          <small className="block text-[9px] text-text-faint">{t("pipelineValue")}</small>
          <strong className="mt-1 block text-[15px] text-text-strong">{format.money(company.openDealValue)}</strong>
          {company.otherCurrencyDeals > 0 && (
            <small className="mt-1 block text-[9px] text-text-subtle">
              {tCompanies("otherCurrency", { count: company.otherCurrencyDeals })}
            </small>
          )}
        </div>
        <div className="rounded-lg bg-surface-soft p-3">
          <small className="block text-[9px] text-text-faint">{t("deals")}</small>
          <strong className="mt-1 block text-[15px] text-text-strong">{t("openDeals", { count: company.openDealCount })}</strong>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-b border-border pb-4">
        {company.domain && (
          <a
            href={`https://${company.domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-[#dad8ec] bg-surface px-3.5 py-2.5 text-[11px] font-extrabold text-primary-hover hover:bg-[#f7f5ff]"
          >
            ↗ {t("website")}
          </a>
        )}
        <Button onClick={() => onEdit(company)}>{t("edit")}</Button>
      </div>

      <dl className="mt-1">
        {details.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3.5 border-b border-surface-muted py-3.5">
            <dt className="text-[10px] text-text-subtle">{label}</dt>
            <dd className="max-w-[65%] text-right text-[10px] font-semibold break-words text-text-strong">{value}</dd>
          </div>
        ))}
      </dl>

      {detail.error ? (
        <EmptyState
          icon="!"
          title={errorMessage(detail.error)}
          action={<Button variant="outline" onClick={detail.reload}>{tCommon("retry")}</Button>}
        />
      ) : (
        <>
          <section className="mt-6">
            <SectionHead eyebrow={t("peopleEyebrow")} title={t("people")} />
            {!full ? (
              <Skeleton className="mt-3 h-10 w-full" />
            ) : full.contacts.length ? (
              <ul className="mt-2">
                {full.contacts.map((contact) => (
                  <li key={contact.id} className="flex items-center gap-2.5 border-b border-surface-muted py-3">
                    <Avatar initials={initials(contact.name)} tone={avatarTone(contact.id)} small />
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-[11px] text-text-strong">{contact.name}</strong>
                      <small className="mt-0.5 block truncate text-[10px] text-text-faint">{contact.jobRole ?? contact.email ?? ""}</small>
                    </span>
                    <Pill tone={stageTone[contact.lifecycleStage]}>{tStage(contact.lifecycleStage)}</Pill>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-4 text-[11px] text-text-subtle">{t("noPeople")}</p>
            )}
          </section>

          <section className="mt-6">
            <SectionHead eyebrow={t("dealsEyebrow")} title={t("deals")} />
            {!full ? (
              <Skeleton className="mt-3 h-10 w-full" />
            ) : full.deals.length ? (
              <ul className="mt-2">
                {full.deals.map((deal) => {
                  const stage = stages.get(deal.stageId);
                  return (
                    <li key={deal.id} className="flex items-center gap-2.5 border-b border-surface-muted py-3">
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate text-[11px] text-text-strong">{deal.name}</strong>
                        <small className="mt-0.5 block text-[10px] text-text-faint">{stage ? stageName(stage) : ""}</small>
                      </span>
                      <strong className="text-[11px] text-text-strong">
                        {format.money({ amount: deal.value, currency: deal.currency })}
                      </strong>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="py-4 text-[11px] text-text-subtle">{t("noDeals")}</p>
            )}
          </section>
        </>
      )}

      <div className="mt-6 flex flex-wrap gap-4 border-t border-border pt-4">
        <button type="button" className="text-[11px] font-extrabold text-[#c2413d] hover:underline" onClick={() => onDelete(company)}>
          {t("delete")}
        </button>
      </div>
    </Drawer>
  );
}

function SectionHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <span className="text-[9px] font-black tracking-[0.16em] text-rail-label uppercase">{eyebrow}</span>
      <h3 className="mt-1.5 text-[13px] font-semibold text-text">{title}</h3>
    </div>
  );
}
