"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, Pill } from "@/components/ui";
import { Link } from "@/i18n/navigation";

// The five settings screens, as in the design's CRM Settings list.
export const settingsSections = [
  { key: "fields", icon: "⊹" },
  { key: "pipelines", icon: "◈" },
  { key: "roles", icon: "♙" },
  { key: "consent", icon: "✓" },
  { key: "notifications", icon: "♧" },
] as const;

export type SettingsSection = (typeof settingsSections)[number]["key"];

export function SettingsPage() {
  const t = useTranslations("settings");

  return (
    <>
      <PageHeader page="settings" />
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <span className="text-[9px] font-black tracking-[0.16em] text-rail-label uppercase">{t("eyebrow")}</span>
            <h2 className="mt-1.5 text-[17px] font-semibold tracking-tight text-[#363347]">{t("title")}</h2>
            <p className="mt-1.5 max-w-[610px] text-[10px] leading-relaxed text-[#9190a0]">{t("intro")}</p>
          </div>
          <Pill tone="success">{t("protected")}</Pill>
        </div>
        <ul className="mt-5">
          {settingsSections.map((section) => (
            <li key={section.key} className="border-t border-surface-muted">
              <Link
                href={`/crm/settings/${section.key}`}
                className="flex items-center gap-3 px-1 py-4 hover:bg-surface-soft"
              >
                <span className="grid size-[34px] flex-none place-items-center rounded-[10px] bg-primary-soft text-base text-primary" aria-hidden>
                  {section.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block text-[11px] text-[#464253]">{t(`sections.${section.key}.title`)}</strong>
                  <small className="mt-1 block text-[9px] text-[#8c8999]">{t(`sections.${section.key}.copy`)}</small>
                </span>
                <span className="hidden text-[10px] font-extrabold text-primary-hover sm:inline">{t(`sections.${section.key}.action`)}</span>
                <span className="text-text-faint" aria-hidden>›</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
