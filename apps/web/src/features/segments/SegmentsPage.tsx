"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { SegmentContext, SegmentListItem } from "@lulu/shared";
import { PageHeader } from "@/components/layout/PageHeader";
import { Avatar, Button, Card, ConfirmDialog, Drawer, EmptyState, Pill, SkeletonRows, useToast } from "@/components/ui";
import { stageTone } from "@/features/contacts/options";
import { useLookups } from "@/features/contacts/useLookups";
import { api } from "@/lib/api";
import { useErrorMessage } from "@/lib/errors";
import { avatarTone, initials } from "@/lib/initials";
import { useApi } from "@/lib/useApi";
import { useRuleText } from "./rules";
import { SegmentFormModal } from "./SegmentFormModal";
import { SegmentIcon } from "./SegmentIcon";

export function SegmentsPage() {
  const t = useTranslations("segments");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const lookups = useLookups();
  const ruleText = useRuleText(lookups.userName);

  const segments = useApi(() => api.segments.list(), []);
  // Everything the rule builder's live preview needs, matched with the same shared rules as the server.
  const previewData = useApi(
    () => Promise.all([api.contacts.list({ pageSize: 100 }), api.tasks.list({ pageSize: 100, done: false }), api.deals.list(), api.pipelines()]),
    [],
  );

  const [activeId, setActiveId] = useState<string | null>(null);
  const [form, setForm] = useState<{ segment: SegmentListItem | null } | null>(null);
  const [viewing, setViewing] = useState<SegmentListItem | null>(null);
  const [toDelete, setToDelete] = useState<SegmentListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const list = segments.data?.data ?? [];
  const active = list.find((s) => s.id === activeId) ?? list[0];

  const context = useMemo<SegmentContext | null>(() => {
    if (!previewData.data) return null;
    const [, tasks, deals, pipelines] = previewData.data;
    return {
      now: new Date(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      tasks: tasks.data,
      deals: deals.data,
      stages: pipelines.flatMap((p) => p.stages),
    };
  }, [previewData.data]);

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.segments.remove(toDelete.id);
      toast(t("deleted"));
      setToDelete(null);
      setForm(null);
      segments.reload();
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <PageHeader page="segments" />
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <span className="text-[9px] font-black tracking-[0.16em] text-rail-label uppercase">{t("eyebrow")}</span>
            <h2 className="mt-1.5 text-[17px] font-semibold tracking-tight text-[#363347]">{t("title")}</h2>
            <p className="mt-1.5 max-w-[610px] text-[10px] leading-relaxed text-[#9190a0]">{t("intro")}</p>
          </div>
          <Button icon="＋" onClick={() => setForm({ segment: null })}>{t("create")}</Button>
        </div>

        {segments.loading && !segments.data ? (
          <div className="mt-5"><SkeletonRows rows={4} /></div>
        ) : segments.error ? (
          <EmptyState icon="!" title={errorMessage(segments.error)} action={<Button variant="outline" onClick={segments.reload}>{tCommon("retry")}</Button>} />
        ) : list.length === 0 ? (
          <EmptyState title={t("empty")} description={t("emptyHint")} action={<Button onClick={() => setForm({ segment: null })}>{t("create")}</Button>} />
        ) : (
          <>
            <ul className="mt-[19px]">
              {list.map((segment) => (
                <li key={segment.id} className={`flex items-center gap-3 border-t border-surface-muted px-1 py-[15px] ${active?.id === segment.id ? "bg-[#fcfbff]" : ""}`}>
                  <SegmentIcon colour={segment.color} />
                  <button type="button" onClick={() => setActiveId(segment.id)} aria-pressed={active?.id === segment.id} className="min-w-0 flex-1 text-left">
                    <strong className="block text-[11px] text-[#464253]">{segment.name}</strong>
                    {segment.description && <small className="mt-1 block text-[9px] text-[#8c8999]">{segment.description}</small>}
                    <span className="mt-[5px] block text-[8px] text-text-faint">{ruleText.rules(segment.rules)}</span>
                  </button>
                  <b className="text-[17px] text-[#4b4758]" aria-label={t("members", { count: segment.memberCount })}>
                    {segment.memberCount}
                  </b>
                  <button
                    type="button"
                    onClick={() => setForm({ segment })}
                    aria-label={t("edit", { name: segment.name })}
                    className="rounded px-1.5 py-1 text-[11px] text-text-subtle hover:bg-surface-muted hover:text-primary"
                  >
                    ✎
                  </button>
                </li>
              ))}
            </ul>
            {active && (
              <div className="mt-[18px] flex flex-wrap items-center justify-between gap-3 border-t border-[#efedf4] pt-[15px] text-[9px] text-[#8e8b9d]">
                <span className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-success" aria-hidden />
                  {t("live", { name: active.name })}
                </span>
                <Button variant="outline" onClick={() => setViewing(active)}>{t("viewContacts")} →</Button>
              </div>
            )}
          </>
        )}
      </Card>

      <SegmentFormModal
        open={form !== null}
        segment={form?.segment ?? null}
        users={lookups.users}
        contacts={previewData.data?.[0].data ?? []}
        context={context}
        onClose={() => setForm(null)}
        onDelete={setToDelete}
        onSubmit={async (input) => {
          try {
            if (form?.segment) await api.segments.update(form.segment.id, input);
            else await api.segments.create(input);
            toast(form?.segment ? t("saved") : t("created"));
            setForm(null);
            segments.reload();
          } catch (error) {
            toast(errorMessage(error), "error");
          }
        }}
      />

      <SegmentContactsDrawer segment={viewing} lookups={lookups} onClose={() => setViewing(null)} />

      <ConfirmDialog
        open={toDelete !== null}
        title={toDelete ? t("form.deleteTitle", { name: toDelete.name }) : ""}
        message={t("form.deleteBody")}
        confirmLabel={tCommon("delete")}
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}

function SegmentContactsDrawer({
  segment,
  lookups,
  onClose,
}: {
  segment: SegmentListItem | null;
  lookups: ReturnType<typeof useLookups>;
  onClose: () => void;
}) {
  const t = useTranslations("segments");
  const tStage = useTranslations("lifecycleStages");
  const errorMessage = useErrorMessage();
  const id = segment?.id;
  const members = useApi(() => (id ? api.segments.contacts(id, { pageSize: 100 }) : Promise.resolve(null)), [id]);

  if (!segment) return null;
  const list = members.data?.data ?? [];

  return (
    <Drawer open onClose={onClose} eyebrow={t("drawerEyebrow")} title={segment.name}>
        {members.loading && !members.data ? (
          <SkeletonRows rows={4} />
        ) : members.error ? (
          <EmptyState icon="!" title={errorMessage(members.error)} />
        ) : list.length === 0 ? (
          <EmptyState title={t("drawerEmpty")} />
        ) : (
          <ul aria-label={t("members", { count: list.length })}>
            {list.map((contact) => (
              <li key={contact.id} className="border-b border-surface-muted">
                <div className="flex w-full items-center gap-2.5 py-3">
                  <Avatar initials={initials(contact.name)} tone={avatarTone(contact.id)} small />
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-[10px] text-text-strong">{contact.name}</strong>
                    <small className="block truncate text-[9px] text-text-subtle">{lookups.companyName(contact.companyId) ?? ""}</small>
                  </span>
                  <Pill tone={stageTone[contact.lifecycleStage]}>{tStage(contact.lifecycleStage)}</Pill>
                </div>
              </li>
            ))}
          </ul>
        )}
    </Drawer>
  );
}
