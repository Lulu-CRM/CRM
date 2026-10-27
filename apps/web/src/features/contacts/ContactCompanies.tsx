"use client";

import { useTranslations } from "next-intl";
import type { Contact } from "@lulu/shared";
import { Pill } from "@/components/ui";
import { useAiText } from "@/features/ai/aiText";
import { channel } from "@/features/companies/channel";
import { facebookUrl, instagramUrl, whatsappUrl } from "@/lib/socialLinks";
import type { Lookups } from "./useLookups";

/**
 * Every company of the person with all its details, one row each that opens (Dave, Oct 27, 2026).
 * The main company comes first and starts open.
 */
export function ContactCompanies({ contact, lookups }: { contact: Contact; lookups: Lookups }) {
  const t = useTranslations("contacts.drawer");
  const tCompany = useTranslations("companies.drawer");
  const tForm = useTranslations("companies.form");
  const tCompanies = useTranslations("companies");
  const aiText = useAiText();

  const ids = contact.companyIds.length ? contact.companyIds : contact.companyId ? [contact.companyId] : [];
  const companies = ids.flatMap((id) => lookups.companies.filter((company) => company.id === id));

  return (
    <section className="mt-6">
      <span className="text-[9px] font-black tracking-[0.16em] text-rail-label uppercase">{t("companiesEyebrow")}</span>
      <h3 className="mt-1.5 text-[13px] font-semibold text-text">{t("companies")}</h3>
      {companies.length === 0 ? (
        <p className="mt-3 text-[10px] text-text-subtle">{t("noCompanies")}</p>
      ) : (
        <div className="mt-3 grid gap-2">
          {companies.map((company, index) => {
            const rows: [string, React.ReactNode][] = [
              [tCompany("domain"), company.domain ?? "–"],
              [tCompany("industry"), company.industry ?? "–"],
              [tCompany("size"), company.size ? tCompanies("sizeValue", { size: company.size }) : "–"],
              [tCompany("owner"), lookups.userName(company.ownerId) ?? "–"],
              [tForm("whatsapp"), channel(company.whatsapp, whatsappUrl, tCompany("openWhatsapp"))],
              [tForm("instagram"), channel(company.instagram, instagramUrl, tCompany("openInstagram"))],
              [tForm("facebook"), channel(company.facebook, facebookUrl, tCompany("openFacebook"))],
              [tForm("productService"), company.productService ?? "–"],
            ];
            const notes = (company.aiNotes ?? []).map(aiText).filter(Boolean);
            return (
              <details key={company.id} open={index === 0} className="group rounded-lg border border-border">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-[11px] font-semibold text-text-strong">
                  <span className="flex min-w-0 items-center gap-2">
                    <span aria-hidden className="text-text-subtle transition-transform group-open:rotate-90">▸</span>
                    <span className="truncate">{company.name}</span>
                  </span>
                  {company.id === contact.companyId && <Pill tone="neutral">{t("mainCompany")}</Pill>}
                </summary>
                <dl className="border-t border-surface-muted px-3">
                  {rows.map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-3.5 border-b border-surface-muted py-2.5 last:border-b-0">
                      <dt className="text-[10px] text-text-subtle">{label}</dt>
                      <dd className="max-w-[65%] text-right text-[10px] font-semibold break-words text-text-strong">{value}</dd>
                    </div>
                  ))}
                </dl>
                {notes.length > 0 && (
                  <div className="border-t border-surface-muted px-3 py-2.5">
                    <span className="text-[10px] text-text-subtle">✦ {t("aiNotes")}</span>
                    <ul className="mt-1 list-disc space-y-1 pl-4 text-[10px] text-text">
                      {notes.map((note, i) => (
                        <li key={i}>{note}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </details>
            );
          })}
        </div>
      )}
    </section>
  );
}
