"use client";

import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { Link, usePathname } from "@/i18n/navigation";
import { crmHref, crmPages, findCrmPage } from "@/config/navigation";

export function CrmNav() {
  const t = useTranslations("nav");
  const tLayout = useTranslations("layout");
  const active = findCrmPage(usePathname());
  const contactCount = useContactCount();
  const format = useFormatter();

  return (
    <aside className="hidden w-[220px] flex-none border-r border-border bg-surface px-3 py-5.5 md:block">
      <div className="mb-5.5 flex items-center gap-2.5 rounded-lg bg-[#f3f1ff] px-2.5 py-3 text-primary-hover">
        <span className="grid size-[25px] place-items-center rounded-[7px] bg-[#675ce0] text-sm text-white">
          ♧
        </span>
        <div>
          <strong className="block text-xs">{tLayout("crm")}</strong>
          <small className="block text-[9px] text-[#8178c0]">{tLayout("relationships")}</small>
        </div>
        <span className="ml-auto text-[11px]" aria-hidden>
          ⌃
        </span>
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
              {page.key === "contacts" && contactCount !== null && (
                <b className="ml-auto rounded-[9px] border border-[#dedbf4] bg-surface px-1.5 py-0.5 text-[8px] text-[#6459c5]">
                  {format.number(contactCount)}
                </b>
              )}
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

function useContactCount() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    api.contacts
      .list({ pageSize: 1 })
      .then((result) => !cancelled && setCount(result.meta.total))
      .catch(() => {}); // The badge is optional, so a failed count just hides it.
    return () => {
      cancelled = true;
    };
  }, []);
  return count;
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
