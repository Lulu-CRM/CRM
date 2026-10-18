"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { findCrmPage } from "@/config/navigation";

export function TopBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const t = useTranslations("layout");
  const tNav = useTranslations("nav");
  const page = findCrmPage(usePathname());

  return (
    <header className="flex h-[69px] items-center justify-between gap-4 border-b border-border bg-surface px-4 md:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label={t("openMenu")}
          className="text-xl text-text-muted lg:hidden"
        >
          ☰
        </button>
        <nav aria-label={t("breadcrumb")} className="flex min-w-0 items-center gap-2 text-[11px] text-text-subtle">
          <span className="hidden sm:inline">{t("workspace")}</span>
          <i className="hidden not-italic text-text-faint sm:inline">/</i>
          <strong className="text-text-strong">{t("crm")}</strong>
          {page && (
            <>
              <i className="not-italic text-text-faint">/</i>
              <strong className="truncate text-text-strong">{tNav(page.key)}</strong>
            </>
          )}
        </nav>
      </div>

      <div className="flex items-center gap-4">
        <label className="hidden h-[38px] w-[218px] items-center gap-2 rounded-lg border border-border-strong px-3 text-text-subtle md:flex">
          <span aria-hidden>⌕</span>
          <input
            type="search"
            placeholder={t("searchWorkspace")}
            aria-label={t("searchWorkspace")}
            className="w-full min-w-0 bg-transparent text-[11px] text-text outline-none"
          />
        </label>
        <button type="button" className="hidden text-[11px] text-text-muted sm:block">
          ? {t("help")}
        </button>
        <button type="button" aria-label={t("notifications")} className="relative text-lg text-text-muted">
          ♢
          <i className="absolute top-0 right-0 size-[5px] rounded-full bg-[#ee7968]" />
        </button>
      </div>
    </header>
  );
}
