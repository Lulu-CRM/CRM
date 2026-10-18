"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { crmHref, crmPages, findCrmPage } from "@/config/navigation";

export function CrmNav() {
  const t = useTranslations("nav");
  const tLayout = useTranslations("layout");
  const active = findCrmPage(usePathname());

  return (
    <aside className="hidden w-[220px] flex-none border-r border-border bg-surface px-3 py-5.5 md:block">
      <div className="mb-5.5 flex items-center gap-2.5 rounded-lg bg-[#f3f1ff] px-2.5 py-3 text-primary-hover">
        <span>♧</span>
        <div>
          <strong className="block text-xs">{tLayout("crm")}</strong>
          <small className="block text-[9px] text-[#8178c0]">{tLayout("relationships")}</small>
        </div>
      </div>

      <span className="block px-2.5 pb-2 text-[8px] font-black tracking-[0.14em] text-text-subtle uppercase">
        {tLayout("crmWorkspace")}
      </span>
      <nav className="grid gap-0.5">
        {crmPages.map((page) => {
          const isActive = page.key === active?.key;
          return (
            <Link
              key={page.key}
              href={crmHref(page.slug)}
              aria-current={isActive ? "page" : undefined}
              className={`flex min-h-8 items-center gap-2.5 rounded-md px-2.5 py-2 text-[11px] ${
                isActive
                  ? "bg-primary-soft font-extrabold text-primary-hover shadow-[inset_3px_0_var(--color-primary)]"
                  : "text-text-muted hover:bg-surface-soft hover:text-primary-hover"
              }`}
            >
              <span className="w-4 text-center text-xs">{page.icon}</span>
              {t(page.key)}
            </Link>
          );
        })}
      </nav>

      <div className="mt-5.5 flex gap-2 border-t border-border px-2.5 pt-4 text-primary">
        <span>✦</span>
        <div>
          <strong className="block text-[10px]">{tLayout("aiTipTitle")}</strong>
          <small className="mt-1 block text-[9px] leading-snug text-text-faint">
            {tLayout("aiTipBody")}
          </small>
        </div>
      </div>
    </aside>
  );
}

// Below md the side nav is hidden, so the pages scroll as tabs above the content.
export function CrmTabs() {
  const t = useTranslations("nav");
  const active = findCrmPage(usePathname());

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-border bg-surface px-4 py-2 md:hidden">
      {crmPages.map((page) => (
        <Link
          key={page.key}
          href={crmHref(page.slug)}
          aria-current={page.key === active?.key ? "page" : undefined}
          className={`rounded-md px-3 py-1.5 text-xs whitespace-nowrap ${
            page.key === active?.key
              ? "bg-primary-soft font-bold text-primary-hover"
              : "text-text-muted"
          }`}
        >
          {t(page.key)}
        </Link>
      ))}
    </nav>
  );
}
