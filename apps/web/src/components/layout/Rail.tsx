"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { crmHref, crmMenu, crmPage, extraModules, findCrmMenuItem, workspaceModules } from "@/config/navigation";
import { useRecordCount } from "./useRecordCount";

// Placeholder until auth (backend task 2) gives us the signed-in user.
const currentUser = { name: "Jamie Morgan", initials: "JM" };

const linkClass =
  "flex min-h-9 items-center gap-2.5 rounded-[9px] px-2.5 text-[11px] font-medium text-rail-text hover:bg-rail-hover hover:text-white";

/**
 * The dark left rail from the MagicPath design: the other Lulu modules, and the CRM with its own
 * menu folded in under it (Contacts & Companies, Leads & Deals, Notes, Import Contacts).
 */
export function Rail({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations("layout");
  const tModules = useTranslations("modules");
  const tNav = useTranslations("nav");
  const format = useFormatter();
  const active = findCrmMenuItem(usePathname());
  const [crmOpen, setCrmOpen] = useState(true);
  const recordCount = useRecordCount();

  return (
    <aside className="flex h-full w-[var(--rail-width)] flex-col overflow-y-auto bg-rail px-3.5 pt-6 pb-4.5 text-rail-text">
      <div className="flex items-center gap-2.5 px-2.5 pb-7 text-white">
        <span className="grid size-[34px] place-items-center rounded-[11px] bg-gradient-to-br from-primary-light to-primary text-lg font-black shadow-brand">
          L
        </span>
        <div>
          <strong className="block text-base tracking-tight">Lulu</strong>
          <span className="block text-[9px] tracking-[0.12em] text-rail-label uppercase">
            {t("tagline")}
          </span>
        </div>
      </div>

      <span className="px-2.5 pb-2 text-[9px] font-black tracking-[0.16em] text-rail-label uppercase">
        {t("workspace")}
      </span>
      <nav className="grid gap-0.5">
        {workspaceModules.map((module) => (
          <Link key={module.key} href={module.href} onClick={onNavigate} className={linkClass}>
            <span className="w-4 text-center text-[13px]">{module.icon}</span>
            {tModules(module.key)}
          </Link>
        ))}
      </nav>

      <button
        type="button"
        onClick={() => setCrmOpen((open) => !open)}
        aria-expanded={crmOpen}
        aria-controls="crm-menu"
        className="mt-1 flex min-h-[39px] items-center gap-2.5 rounded-[9px] bg-rail-active px-2.5 text-left text-[11px] font-extrabold text-white shadow-[inset_3px_0_var(--color-rail-indicator)]"
      >
        <span className="w-4 text-center text-[13px] text-accent">♧</span>
        {tModules("crm")}
        <span className="ml-auto text-[10px] text-accent" aria-hidden>
          {crmOpen ? "⌃" : "⌄"}
        </span>
      </button>
      {crmOpen && (
        <nav id="crm-menu" aria-label={tModules("crm")} className="mt-0.5 ml-2.5 grid gap-0.5 border-l border-[#2d2c3d] pt-1 pl-2.5">
          {crmMenu.map((key) => {
            const page = crmPage(key);
            const isActive = key === active;
            return (
              <Link
                key={key}
                href={crmHref(page.slug)}
                onClick={onNavigate}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-8 items-center gap-2.5 rounded-lg px-2.5 text-[11px] ${
                  isActive
                    ? "bg-rail-active font-bold text-white shadow-[inset_2px_0_var(--color-rail-indicator)]"
                    : "text-rail-text hover:bg-rail-hover hover:text-white"
                }`}
              >
                <span className={`w-4 text-center text-xs ${isActive ? "text-accent" : ""}`}>{page.icon}</span>
                {tNav(key)}
                {key === "directory" && recordCount !== null && (
                  <b className="ml-auto rounded-[9px] border border-[#41415d] bg-rail-hover px-1.5 py-0.5 text-[8px] text-accent">
                    {format.number(recordCount)}
                  </b>
                )}
              </Link>
            );
          })}
        </nav>
      )}

      <div className="min-h-6 flex-1" />

      <div className="border-t border-[#2d2c3d] pt-4">
        <span className="px-2.5 pb-2 text-[9px] font-black tracking-[0.16em] text-rail-label uppercase">
          {t("modules")}
        </span>
        <nav className="grid gap-0.5">
          {extraModules.map((module) => (
            <Link key={module.key} href={module.href} onClick={onNavigate} className={linkClass}>
              <span className="w-4 text-center text-[13px]">{module.icon}</span>
              {tModules(module.key)}
            </Link>
          ))}
        </nav>
      </div>

      <div className="mt-3.5 flex items-center gap-2.5 border-t border-[#2d2c3d] px-1 pt-4">
        <Avatar initials={currentUser.initials} small />
        <span>
          <strong className="block text-[11px] text-white">{currentUser.name}</strong>
          <small className="block text-[9px] text-rail-label">{t("workspaceOwner")}</small>
        </span>
        <button type="button" aria-label={t("profileMenu")} className="ml-auto text-[#85869b]">
          ⌄
        </button>
      </div>
    </aside>
  );
}
