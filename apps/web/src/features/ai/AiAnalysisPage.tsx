"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { AiInsight, AiSettings, AiText } from "@lulu/shared";
import { PageHeader } from "@/components/layout/PageHeader";
import { Avatar, Button, Card, EmptyState, Modal, Pill, Skeleton, useToast } from "@/components/ui";
import { useLookups } from "@/features/contacts/useLookups";
import { SwitchRow } from "@/features/settings/SettingsScreen";
import { useFormat } from "@/i18n/format";
import { api } from "@/lib/api";
import { useErrorMessage } from "@/lib/errors";
import { avatarTone, initials } from "@/lib/initials";
import { useApi } from "@/lib/useApi";

// How often to check whether the background analysis has written its insight.
export const AI_POLL_MS = 700;

/** Shows AI-written text: a translation key from the simulated provider, or a real model's text as written. */
export function useAiText() {
  const t = useTranslations("aiAnalysis.generated");
  return (text: AiText) => ("key" in text ? (t.has(text.key) ? t(text.key, text.params) : "") : text.text);
}

export function AiAnalysisPage() {
  const t = useTranslations("aiAnalysis");
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const lookups = useLookups();
  const contacts = useApi(() => api.contacts.list({ pageSize: 100 }), []);
  const list = contacts.data?.data ?? [];
  const [contactId, setContactId] = useState("");
  const selected = list.find((c) => c.id === contactId) ?? list[0];

  const insight = useApi(() => (selected ? api.ai.latest(selected.id) : Promise.resolve(null)), [selected?.id]);
  const [running, setRunning] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const runStarted = useRef(0);

  // While the analysis runs in the background, check for its insight.
  useEffect(() => {
    if (!running || !selected) return;
    const timer = setInterval(async () => {
      try {
        const latest = await api.ai.latest(selected.id);
        if (latest && Date.parse(latest.createdAt) >= runStarted.current) {
          setRunning(false);
          insight.reload();
        }
      } catch (error) {
        setRunning(false);
        toast(errorMessage(error), "error");
      }
    }, AI_POLL_MS);
    return () => clearInterval(timer);
    // insight.reload is stable; the effect restarts only for a new run or contact.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, selected?.id]);

  const run = async () => {
    if (!selected) return;
    try {
      // Allow for clock drift between the browser and the server: anything from this second on counts.
      runStarted.current = Date.now() - 1000;
      setRunning(true);
      await api.ai.run(selected.id);
    } catch (error) {
      setRunning(false);
      toast(errorMessage(error), "error");
    }
  };

  const dismiss = async (current: AiInsight) => {
    try {
      await api.ai.dismiss(current.id);
      toast(t("dismissed"));
      insight.reload();
    } catch (error) {
      toast(errorMessage(error), "error");
    }
  };

  const current = insight.data ?? null;

  return (
    <>
      <PageHeader page="ai" />
      <div className="grid gap-[17px] xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="min-w-0">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <span className="text-[9px] font-black tracking-[0.16em] text-rail-label uppercase">{t("eyebrow")}</span>
              <h2 className="mt-1.5 text-[17px] font-semibold tracking-tight text-[#363347]">{t("title")}</h2>
              <p className="mt-1.5 max-w-[610px] text-[10px] leading-relaxed text-[#9190a0]">{t("intro")}</p>
            </div>
            <Pill tone="violet">✦ {t("badge")}</Pill>
          </div>

          {contacts.loading && !contacts.data ? (
            <Skeleton className="mt-5 h-14 w-full" />
          ) : contacts.error ? (
            <EmptyState icon="!" title={errorMessage(contacts.error)} />
          ) : !selected ? (
            <EmptyState title={t("noContacts")} />
          ) : (
            <>
              <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-border p-3">
                <Avatar initials={initials(selected.name)} tone={avatarTone(selected.id)} />
                <label className="grid min-w-0 flex-1 gap-1">
                  <span className="text-[9px] font-extrabold text-neutral">{t("pickContact")}</span>
                  <select
                    className="rounded-md border border-border-strong bg-surface px-2 py-2 text-[11px] text-text outline-none focus:border-[#8e83de]"
                    value={selected.id}
                    disabled={running}
                    onChange={(e) => setContactId(e.target.value)}
                  >
                    {list.map((c) => (
                      <option key={c.id} value={c.id}>
                        {[c.name, lookups.companyName(c.companyId)].filter(Boolean).join(" · ")}
                      </option>
                    ))}
                  </select>
                </label>
                <Button loading={running} onClick={run}>{running ? t("running") : t("run")}</Button>
              </div>

              {insight.loading && !insight.data ? (
                <Skeleton className="mt-4 h-40 w-full" />
              ) : current ? (
                <InsightCards insight={current} onAccept={() => setConfirming(true)} onDismiss={() => dismiss(current)} />
              ) : (
                <EmptyState icon="✦" title={t("empty")} description={t("emptyHint")} />
              )}
            </>
          )}
        </Card>

        <AiControls />
      </div>

      {current && selected && (
        <AcceptModal
          open={confirming}
          insight={current}
          contactName={selected.name}
          onClose={() => setConfirming(false)}
          onAccepted={() => {
            setConfirming(false);
            insight.reload();
          }}
        />
      )}
    </>
  );
}

function InsightCards({ insight, onAccept, onDismiss }: { insight: AiInsight; onAccept: () => void; onDismiss: () => void }) {
  const t = useTranslations("aiAnalysis");
  const tField = useTranslations("aiAnalysis.fields");
  const text = useAiText();
  const format = useFormat();
  const hasChanges = insight.suggestedTask !== null || insight.suggestedStage !== null;
  const filled = Math.round(insight.dataQualityScore * 5);

  const card = "rounded-xl border p-4";
  const eyebrow = "text-[8px] font-black tracking-[0.14em] uppercase";

  return (
    <>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <section className={`${card} border-[#e4ddff] bg-[#f8f6ff]`} aria-label={t("summary")}>
          <span className={`${eyebrow} text-[#6258c7]`}>{t("summary")}</span>
          <p className="mt-2 text-[11px] leading-relaxed text-text-strong">{text(insight.summary)}</p>
        </section>
        <section className={`${card} border-[#d9f0e3] bg-[#f6fcf8]`} aria-label={t("nextStep")}>
          <span className={`${eyebrow} text-[#4e9e73]`}>{t("nextStep")}</span>
          <strong className="mt-2 block text-[11px] text-text-strong">{text(insight.nextStep.title)}</strong>
          <p className="mt-1.5 text-[10px] leading-relaxed text-text-muted">{text(insight.nextStep.detail)}</p>
        </section>
        <section className={`${card} border-[#d8ecfa] bg-[#f5fafe]`} aria-label={t("quality")}>
          <span className={`${eyebrow} text-[#4c96bf]`}>{t("quality")}</span>
          <strong className="mt-2 block text-[11px] text-text-strong">{t("qualityScore", { filled, total: 5 })}</strong>
          <div className="mt-2 h-[5px] overflow-hidden rounded-[5px] bg-[#eeeef4]" aria-hidden>
            <i className="block h-full rounded-[5px] bg-[#7669dd]" style={{ width: `${insight.dataQualityScore * 100}%` }} />
          </div>
          <p className="mt-2 text-[10px] text-text-muted">
            {insight.missingFields.length
              ? t("missing", { fields: insight.missingFields.map((f) => tField(f)).join(", ") })
              : t("complete")}
          </p>
        </section>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#efedf4] pt-4">
        <span className="text-[10px] text-text-subtle">
          {insight.status === "suggested"
            ? t("generatedAt", { time: format.recent(insight.createdAt) })
            : t(`status.${insight.status}`)}
        </span>
        {insight.status === "suggested" && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={onDismiss}>{t("dismiss")}</Button>
            {hasChanges && <Button onClick={onAccept}>{t("review")}</Button>}
          </div>
        )}
      </div>
    </>
  );
}

/** The confirm step: the user sees and picks every change before anything is saved (AGENTS.md rule 7). */
function AcceptModal({
  open,
  insight,
  contactName,
  onClose,
  onAccepted,
}: {
  open: boolean;
  insight: AiInsight;
  contactName: string;
  onClose: () => void;
  onAccepted: () => void;
}) {
  const t = useTranslations("aiAnalysis.accept");
  const tStage = useTranslations("lifecycleStages");
  const tCommon = useTranslations("common");
  const text = useAiText();
  const format = useFormat();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const settings = useApi(() => api.settings.ai.get(), []);
  const [createTask, setCreateTask] = useState(true);
  const [taskTitle, setTaskTitle] = useState("");
  const [applyStage, setApplyStage] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCreateTask(insight.suggestedTask !== null);
    setTaskTitle(insight.suggestedTask ? text(insight.suggestedTask.title) : "");
    // "Auto-update fields" only pre-ticks the field change here; the user still confirms it.
    setApplyStage(insight.suggestedStage !== null && (settings.data?.autoUpdateFields ?? false));
    // text() is a translation helper; the reset follows the insight and the switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, insight, settings.data?.autoUpdateFields]);

  const nothing = !createTask && !applyStage;

  const save = async () => {
    setSaving(true);
    try {
      await api.ai.accept(insight.id, { createTask, taskTitle: createTask ? taskTitle.trim() : undefined, applyStage });
      toast(t("saved"));
      onAccepted();
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={t("eyebrow")}
      title={t("title", { name: contactName })}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>{tCommon("cancel")}</Button>
          <Button loading={saving} disabled={nothing || (createTask && !taskTitle.trim())} onClick={save}>{t("confirm")}</Button>
        </>
      }
    >
      <p className="text-[10px] text-text-subtle">{t("intro")}</p>
      <div className="mt-3 grid gap-3">
        {insight.suggestedTask && (
          <div className="rounded-lg border border-border p-3">
            <label className="flex items-center gap-2 text-[11px] font-semibold text-text-strong">
              <input type="checkbox" className="accent-[#6259d6]" checked={createTask} onChange={(e) => setCreateTask(e.target.checked)} />
              {t("createTask", { date: format.date(insight.suggestedTask.dueAt) })}
            </label>
            <input
              aria-label={t("taskTitle")}
              className="mt-2 w-full rounded-md border border-border-strong px-[11px] py-2 text-[11px] outline-none focus:border-[#8e83de] disabled:bg-surface-muted"
              value={taskTitle}
              disabled={!createTask}
              maxLength={200}
              onChange={(e) => setTaskTitle(e.target.value)}
            />
          </div>
        )}
        {insight.suggestedStage && (
          <label className="flex items-center gap-2 rounded-lg border border-border p-3 text-[11px] font-semibold text-text-strong">
            <input type="checkbox" className="accent-[#6259d6]" checked={applyStage} onChange={(e) => setApplyStage(e.target.checked)} />
            {t("applyStage", { stage: tStage(insight.suggestedStage) })}
          </label>
        )}
      </div>
    </Modal>
  );
}

function AiControls() {
  const t = useTranslations("aiAnalysis.controls");
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const remote = useApi(() => api.settings.ai.get(), []);
  const roles = useApi(() => api.settings.roles.get(), []);
  const lookups = useLookups();
  const [value, setValue] = useState<AiSettings | null>(null);
  useEffect(() => {
    if (remote.data) setValue(remote.data);
  }, [remote.data]);

  const role = lookups.me?.role ?? "member";
  const canEdit = role === "owner" || (roles.data?.[role]?.settings?.includes("edit") ?? false);

  // Each switch saves at once, and goes back if saving fails.
  const toggle = async (key: keyof AiSettings, on: boolean) => {
    if (!value) return;
    const before = value;
    const next = { ...value, [key]: on };
    setValue(next);
    try {
      setValue(await api.settings.ai.put(next));
      toast(t("saved"));
    } catch (error) {
      setValue(before);
      toast(errorMessage(error), "error");
    }
  };

  return (
    <Card className="min-w-0 self-start">
      <span className="text-[9px] font-black tracking-[0.16em] text-rail-label uppercase">{t("eyebrow")}</span>
      <h2 className="mt-1.5 text-[17px] font-semibold tracking-tight text-[#363347]">{t("title")}</h2>
      <p className="mt-1.5 text-[10px] leading-relaxed text-[#9190a0]">{t("intro")}</p>
      {value ? (
        <div className="mt-3">
          {(["analyzeNewActivity", "suggestFollowUps", "autoUpdateFields"] as const).map((key) => (
            <SwitchRow key={key} label={t(`${key}.label`)} hint={t(`${key}.hint`)} checked={value[key]} disabled={!canEdit} onChange={(on) => toggle(key, on)} />
          ))}
        </div>
      ) : (
        <Skeleton className="mt-3 h-32 w-full" />
      )}
      <p className="mt-3 text-[9px] text-text-faint">{t("footnote")}</p>
    </Card>
  );
}
