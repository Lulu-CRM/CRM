"use client";

import { useTranslations } from "next-intl";
import { can, type Role } from "@lulu/shared";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, Card, EmptyState, SkeletonRows } from "@/components/ui";
import { useLookups } from "@/features/contacts/useLookups";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { useErrorMessage } from "@/lib/errors";
import { useApi } from "@/lib/useApi";
import type { SettingsSection } from "./SettingsPage";

/** Whether the signed-in user may change settings, from the workspace's role permissions. */
export function useCanEditSettings() {
  const lookups = useLookups();
  const roles = useApi(() => api.settings.roles.get(), []);
  const role = (lookups.me?.role ?? "member") as Role;
  return roles.data ? can(roles.data, role, "settings", "edit") : role === "owner";
}

/** Frame for one settings screen: back link, title, read-only notice, and loading or error states. */
export function SettingsScreen({
  section,
  loading,
  error,
  onRetry,
  canEdit,
  children,
}: {
  section: SettingsSection;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  canEdit: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const errorMessage = useErrorMessage();

  return (
    <>
      <PageHeader page="settings" />
      <Card>
        <Link href="/crm/settings" className="text-[10px] font-extrabold text-primary-hover hover:underline">
          ‹ {t("back")}
        </Link>
        <h2 className="mt-3 text-[17px] font-semibold tracking-tight text-[#363347]">{t(`sections.${section}.title`)}</h2>
        <p className="mt-1.5 max-w-[610px] text-[10px] leading-relaxed text-[#9190a0]">{t(`sections.${section}.copy`)}</p>
        {!canEdit && (
          <p role="note" className="mt-3 rounded-lg bg-info-soft p-3 text-[10px] text-[#2b6e99]">
            {t("readOnly")}
          </p>
        )}
        <div className="mt-5">
          {loading ? (
            <SkeletonRows rows={4} />
          ) : error ? (
            <EmptyState icon="!" title={errorMessage(error)} action={<Button variant="outline" onClick={onRetry}>{tCommon("retry")}</Button>} />
          ) : (
            children
          )}
        </div>
      </Card>
    </>
  );
}

export const settingsInput =
  "rounded-md border border-border-strong bg-surface px-[11px] py-2 text-[11px] text-text outline-none focus:border-[#8e83de] focus:shadow-[0_0_0_3px_#eeecff] disabled:bg-surface-muted aria-[invalid=true]:border-[#d9534f]";

/** A labelled on/off switch row, as in the design's AI controls. */
export function SwitchRow({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 border-b border-surface-muted py-3.5">
      <span>
        <strong className="block text-[11px] text-text-strong">{label}</strong>
        {hint && <small className="mt-1 block text-[9px] text-text-subtle">{hint}</small>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-[#6259d6]"
      />
    </label>
  );
}
