"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  notificationEventSchema,
  permissionActionSchema,
  permissionResourceSchema,
  type ConsentSettings as Consent,
  type NotificationSettings as Notifications,
  type RolePermissions,
} from "@lulu/shared";
import { Button, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { useErrorMessage } from "@/lib/errors";
import { useApi } from "@/lib/useApi";
import { SettingsScreen, settingsInput, SwitchRow, useCanEditSettings } from "./SettingsScreen";

// Roles, consent and notifications all work the same way: load, edit a copy, save it with PUT.
function useEditable<T>(load: () => Promise<T>, save: (value: T) => Promise<T>) {
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const tSettings = useTranslations("settings");
  const remote = useApi(load, []);
  const [value, setValue] = useState<T | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (remote.data) setValue(structuredClone(remote.data));
  }, [remote.data]);

  const dirty = value !== null && JSON.stringify(value) !== JSON.stringify(remote.data);
  const submit = async () => {
    if (!value) return;
    setSaving(true);
    try {
      setValue(await save(value));
      remote.reload();
      toast(tSettings("saved"));
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setSaving(false);
    }
  };
  return { remote, value, setValue, dirty, saving, submit, reset: () => remote.data && setValue(structuredClone(remote.data)) };
}

function SaveBar({ dirty, saving, onSave, onReset }: { dirty: boolean; saving: boolean; onSave: () => void; onReset: () => void }) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  return (
    <div className="mt-5 flex items-center justify-end gap-2 border-t border-[#efedf4] pt-4">
      {dirty && <span className="mr-auto text-[10px] text-text-subtle">{t("unsaved")}</span>}
      <Button variant="outline" disabled={!dirty || saving} onClick={onReset}>{tCommon("cancel")}</Button>
      <Button disabled={!dirty} loading={saving} onClick={onSave}>{tCommon("save")}</Button>
    </div>
  );
}

export function RolesSettings() {
  const t = useTranslations("settings.roles");
  const canEdit = useCanEditSettings();
  const form = useEditable<RolePermissions>(() => api.settings.roles.get(), (v) => api.settings.roles.put(v));
  const roles = ["admin", "member"] as const;
  const actions = permissionActionSchema.options;

  const toggle = (role: (typeof roles)[number], resource: string, action: string, on: boolean) =>
    form.setValue((current) => {
      if (!current) return current;
      const next = structuredClone(current);
      const list = new Set(next[role]?.[resource as keyof RolePermissions["admin"]] ?? []);
      if (on) list.add(action as never);
      else list.delete(action as never);
      next[role] = { ...next[role], [resource]: actions.filter((a) => list.has(a)) };
      return next;
    });

  return (
    <SettingsScreen section="roles" loading={form.remote.loading && !form.value} error={form.remote.error} onRetry={form.remote.reload} canEdit={canEdit}>
      <p className="mb-3 text-[10px] text-text-subtle">{t("ownerNote")}</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left">
          <thead>
            <tr className="text-[9px] font-semibold tracking-[0.08em] text-[#9e9baa] uppercase">
              <th scope="col" className="py-2">{t("resource")}</th>
              {roles.map((role) => (
                <th key={role} scope="col" colSpan={actions.length} className="py-2 text-center">{t(`role.${role}`)}</th>
              ))}
            </tr>
            <tr className="text-[9px] text-text-subtle">
              <td />
              {roles.flatMap((role) => actions.map((action) => <td key={`${role}-${action}`} className="pb-2 text-center">{t(`action.${action}`)}</td>))}
            </tr>
          </thead>
          <tbody>
            {permissionResourceSchema.options.map((resource) => (
              <tr key={resource} className="border-t border-surface-muted">
                <th scope="row" className="py-2.5 text-[10px] font-semibold text-text-strong">{t(`resources.${resource}`)}</th>
                {roles.flatMap((role) =>
                  actions.map((action) => {
                    const on = form.value?.[role]?.[resource]?.includes(action) ?? false;
                    return (
                      <td key={`${role}-${action}`} className="text-center">
                        <input
                          type="checkbox"
                          className="accent-[#6259d6]"
                          checked={on}
                          disabled={!canEdit}
                          onChange={(e) => toggle(role, resource, action, e.target.checked)}
                          aria-label={t("cell", { role: t(`role.${role}`), action: t(`action.${action}`), resource: t(`resources.${resource}`) })}
                        />
                      </td>
                    );
                  }),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canEdit && <SaveBar dirty={form.dirty} saving={form.saving} onSave={form.submit} onReset={form.reset} />}
    </SettingsScreen>
  );
}

export function ConsentSettings() {
  const t = useTranslations("settings.consent");
  const canEdit = useCanEditSettings();
  const form = useEditable<Consent>(() => api.settings.consent.get(), (v) => api.settings.consent.put(v));
  const value = form.value;
  const set = (change: Partial<Consent>) => form.setValue((current) => (current ? { ...current, ...change } : current));

  return (
    <SettingsScreen section="consent" loading={form.remote.loading && !value} error={form.remote.error} onRetry={form.remote.reload} canEdit={canEdit}>
      {value && (
        <>
          <SwitchRow label={t("marketing")} hint={t("marketingHint")} checked={value.requireConsentForMarketing} disabled={!canEdit} onChange={(v) => set({ requireConsentForMarketing: v })} />
          <SwitchRow label={t("evidence")} hint={t("evidenceHint")} checked={value.requireConsentEvidence} disabled={!canEdit} onChange={(v) => set({ requireConsentEvidence: v })} />
          <label className="flex flex-wrap items-center justify-between gap-4 border-b border-surface-muted py-3.5">
            <span>
              <strong className="block text-[11px] text-text-strong">{t("imported")}</strong>
              <small className="mt-1 block text-[9px] text-text-subtle">{t("importedHint")}</small>
            </span>
            <select
              className={settingsInput}
              value={value.importedContactsConsent}
              disabled={!canEdit}
              onChange={(e) => set({ importedContactsConsent: e.target.value as Consent["importedContactsConsent"] })}
            >
              <option value="not_granted">{t("importedOptions.not_granted")}</option>
              <option value="granted">{t("importedOptions.granted")}</option>
            </select>
          </label>
          {canEdit && <SaveBar dirty={form.dirty} saving={form.saving} onSave={form.submit} onReset={form.reset} />}
        </>
      )}
    </SettingsScreen>
  );
}

export function NotificationSettings() {
  const t = useTranslations("settings.notifications");
  const canEdit = useCanEditSettings();
  const form = useEditable<Notifications>(() => api.settings.notifications.get(), (v) => api.settings.notifications.put(v));
  const channels = ["inApp", "email"] as const;

  return (
    <SettingsScreen section="notifications" loading={form.remote.loading && !form.value} error={form.remote.error} onRetry={form.remote.reload} canEdit={canEdit}>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="text-[9px] font-semibold tracking-[0.08em] text-[#9e9baa] uppercase">
            <th scope="col" className="py-2">{t("event")}</th>
            {channels.map((c) => <th key={c} scope="col" className="w-20 py-2 text-center">{t(`channels.${c}`)}</th>)}
          </tr>
        </thead>
        <tbody>
          {notificationEventSchema.options.map((event) => (
            <tr key={event} className="border-t border-surface-muted">
              <th scope="row" className="py-3 text-[10px] font-semibold text-text-strong">{t(`events.${event}`)}</th>
              {channels.map((channel) => (
                <td key={channel} className="text-center">
                  <input
                    type="checkbox"
                    className="accent-[#6259d6]"
                    checked={form.value?.[event]?.[channel] ?? false}
                    disabled={!canEdit}
                    aria-label={t("cell", { event: t(`events.${event}`), channel: t(`channels.${channel}`) })}
                    onChange={(e) =>
                      form.setValue((current) =>
                        current ? { ...current, [event]: { ...current[event], [channel]: e.target.checked } } : current,
                      )
                    }
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {canEdit && <SaveBar dirty={form.dirty} saving={form.saving} onSave={form.submit} onReset={form.reset} />}
    </SettingsScreen>
  );
}
