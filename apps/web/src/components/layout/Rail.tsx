"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { extraModules, workspaceModules } from "@/config/navigation";

// Placeholder until auth (backend task 2) gives us the signed-in user.
const currentUser = { name: "Jamie Morgan", initials: "JM" };

const linkClass =
  "flex min-h-9 items-center gap-2.5 rounded-[9px] px-2.5 text-[11px] font-medium text-rail-text hover:bg-rail-hover hover:text-white";

export function Rail({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations("layout");
  const tModules = useTranslations("modules");

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
        {workspaceModules.map((module) => {
          const active = module.key === "crm";
          return (
            <Link
              key={module.key}
              href={module.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`${linkClass} ${active ? "bg-rail-active font-extrabold text-white shadow-[inset_3px_0_var(--color-rail-indicator)]" : ""}`}
            >
              <span className={`w-4 text-center text-[13px] ${active ? "text-accent" : ""}`}>
                {module.icon}
              </span>
              {tModules(module.key)}
              {active && (
                <b className="ml-auto text-[8px] text-accent">{t("active")}</b>
              )}
            </Link>
          );
        })}
      </nav>

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
