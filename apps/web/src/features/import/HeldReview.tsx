"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Contact, HeldRow, ImportJob, ImportResolveAction } from "@lulu/shared";
import { Button, EmptyState, SkeletonRows, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { useErrorMessage } from "@/lib/errors";
import { useApi } from "@/lib/useApi";

/** The held duplicates of an import, side by side with the contact each may duplicate. Nothing is merged without a click. */
export function HeldReview({
  job,
  onJobChange,
  onClose,
}: {
  job: ImportJob;
  onJobChange: (job: ImportJob) => void;
  onClose: () => void;
}) {
  const t = useTranslations("import.held");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const held = useApi(async () => {
    const rows = (await api.imports.held(job.id)).data;
    const ids = [...new Set(rows.map((r) => r.duplicateOfContactId))];
    const existing = await Promise.all(ids.map((id) => api.contacts.get(id).catch(() => null)));
    return { rows, existing: new Map(existing.filter((c): c is Contact => c !== null).map((c) => [c.id, c])) };
  }, [job.id]);
  const [working, setWorking] = useState<string | null>(null);

  const resolve = async (row: HeldRow, action: ImportResolveAction) => {
    setWorking(row.id);
    try {
      await api.imports.resolve(job.id, row.id, action);
      toast(t(`resolved.${action}`));
      onJobChange(await api.imports.get(job.id));
      held.reload();
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setWorking(null);
    }
  };

  const rows = held.data?.rows ?? [];

  return (
    <section aria-labelledby="held-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id="held-title" className="text-[13px] font-semibold text-text">{t("title")}</h3>
          <p className="mt-1 text-[10px] text-text-subtle">{t("intro")}</p>
        </div>
        <Button variant="outline" onClick={onClose}>{tCommon("close")}</Button>
      </div>

      {held.loading && !held.data ? (
        <div className="mt-4"><SkeletonRows rows={3} /></div>
      ) : held.error ? (
        <EmptyState icon="!" title={errorMessage(held.error)} action={<Button variant="outline" onClick={held.reload}>{tCommon("retry")}</Button>} />
      ) : rows.length === 0 ? (
        <EmptyState icon="✓" title={t("empty")} />
      ) : (
        <ul className="mt-4 grid gap-3">
          {rows.map((row) => {
            const existing = held.data?.existing.get(row.duplicateOfContactId);
            const line = (c: { email: string | null; companyName?: string | null; jobRole: string | null }) =>
              [c.email, c.companyName, c.jobRole].filter(Boolean).join(" · ");
            return (
              <li key={row.id} className="rounded-lg border border-border p-3" aria-label={t("rowLabel", { row: row.rowNumber, name: row.contact.name })}>
                <p className="text-[9px] font-semibold text-warning">{t(`match.${row.duplicateMatch}`)}</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-md bg-surface-soft p-2.5">
                    <small className="block text-[8px] font-black tracking-[0.12em] text-rail-label uppercase">{t("imported", { row: row.rowNumber })}</small>
                    <strong className="mt-1 block text-[10px] text-text-strong">{row.contact.name}</strong>
                    <small className="block text-[9px] text-text-subtle">{line(row.contact)}</small>
                  </div>
                  <div className="rounded-md bg-surface-soft p-2.5">
                    <small className="block text-[8px] font-black tracking-[0.12em] text-rail-label uppercase">{t("existing")}</small>
                    <strong className="mt-1 block text-[10px] text-text-strong">{existing?.name ?? "–"}</strong>
                    <small className="block text-[9px] text-text-subtle">{existing ? line(existing) : ""}</small>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <Button variant="ghost" disabled={working !== null} onClick={() => resolve(row, "skip")}>{t("actions.skip")}</Button>
                  <Button variant="outline" disabled={working !== null} onClick={() => resolve(row, "create")}>{t("actions.create")}</Button>
                  <Button loading={working === row.id} disabled={working !== null} onClick={() => resolve(row, "merge")}>{t("actions.merge")}</Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
