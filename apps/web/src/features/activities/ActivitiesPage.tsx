"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { filterTasks, type DueFilter, type Task } from "@lulu/shared";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, Card, EmptyState, SkeletonRows, useToast } from "@/components/ui";
import { useErrorMessage } from "@/lib/errors";
import { ActivityItem } from "./ActivityItem";
import { DueChip, userTimeZone } from "./DueChip";
import { TaskFormModal } from "./TaskFormModal";
import { useActivitiesPage } from "./useActivitiesPage";

const dueFilters: DueFilter[] = ["all", "overdue", "today", "this_week"];

export function ActivitiesPage() {
  const t = useTranslations("tasks");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const page = useActivitiesPage();
  const { lookups } = page;

  const [ownerId, setOwnerId] = useState("");
  const [due, setDue] = useState<DueFilter>("all");
  const [showDone, setShowDone] = useState(true);
  const [form, setForm] = useState<{ task: Task | null } | null>(null);

  const now = new Date();
  const timeZone = userTimeZone();
  const filtered = filterTasks(page.tasks.list, { ownerId: ownerId || undefined, due, showDone }, now, timeZone);
  const counts = useMemo(() => {
    const base = { ownerId: ownerId || undefined, showDone };
    return Object.fromEntries(
      dueFilters.map((key) => [key, filterTasks(page.tasks.list, { ...base, due: key }, new Date(), timeZone).length]),
    ) as Record<DueFilter, number>;
  }, [page.tasks.list, ownerId, showDone, timeZone]);

  const toggle = async (task: Task) => {
    try {
      await page.toggle(task);
    } catch (error) {
      toast(errorMessage(error), "error");
    }
  };

  const filtersActive = ownerId !== "" || due !== "all" || !showDone;

  return (
    <>
      <PageHeader page="activities" />
      <div className="grid gap-[17px] xl:grid-cols-2">
        <Card className="min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-[9px] font-black tracking-[0.16em] text-rail-label uppercase">{t("eyebrow")}</span>
              <h2 className="mt-1.5 text-[17px] font-semibold tracking-tight text-[#363347]">{t("title")}</h2>
            </div>
            <Button icon="＋" onClick={() => setForm({ task: null })}>
              {t("newTask")}
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-b border-surface-muted pb-3">
            <div role="group" aria-label={t("filters.label")} className="flex flex-wrap gap-1">
              {dueFilters.map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={due === key}
                  onClick={() => setDue(key)}
                  className={`rounded-[7px] px-2.5 py-[7px] text-[9px] whitespace-nowrap ${
                    due === key ? "bg-[#efedff] font-extrabold text-primary-hover" : "text-[#8c899b] hover:bg-surface-muted"
                  }`}
                >
                  {t(`filters.${key}`)} <b className="ml-1 text-[8px]">{counts[key]}</b>
                </button>
              ))}
            </div>
            <span className="flex-1" />
            <select
              value={ownerId}
              onChange={(event) => setOwnerId(event.target.value)}
              aria-label={t("filters.owner")}
              className="rounded-md border border-border-strong bg-surface px-2 py-1.5 text-[10px] text-text outline-none focus:border-[#8e83de]"
            >
              <option value="">{t("filters.anyOwner")}</option>
              {lookups.users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-[10px] text-text-muted">
              <input
                type="checkbox"
                checked={showDone}
                onChange={(event) => setShowDone(event.target.checked)}
                className="accent-[#6259d6]"
              />
              {t("filters.showDone")}
            </label>
          </div>

          {page.tasks.loading ? (
            <div className="mt-4">
              <SkeletonRows rows={4} />
            </div>
          ) : page.tasks.error ? (
            <EmptyState
              icon="!"
              title={errorMessage(page.tasks.error)}
              action={<Button variant="outline" onClick={page.tasks.reload}>{tCommon("retry")}</Button>}
            />
          ) : filtered.length === 0 ? (
            filtersActive && page.tasks.list.length > 0 ? (
              <EmptyState title={t("noMatches")} description={t("noMatchesHint")} />
            ) : (
              <EmptyState
                title={t("empty")}
                description={t("emptyHint")}
                action={<Button onClick={() => setForm({ task: null })}>{t("newTask")}</Button>}
              />
            )
          ) : (
            <ul>
              {filtered.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  meta={[page.recordName(task), lookups.userName(task.ownerId)].filter(Boolean).join(" · ")}
                  now={now}
                  onToggle={() => toggle(task)}
                  onEdit={() => setForm({ task })}
                />
              ))}
            </ul>
          )}
        </Card>

        <Card className="min-w-0">
          <span className="text-[9px] font-black tracking-[0.16em] text-rail-label uppercase">{t("timeline.eyebrow")}</span>
          <h2 className="mt-1.5 text-[17px] font-semibold tracking-tight text-[#363347]">{t("timeline.title")}</h2>
          {page.timeline.loading ? (
            <div className="mt-4">
              <SkeletonRows rows={5} />
            </div>
          ) : page.timeline.error ? (
            <EmptyState
              icon="!"
              title={errorMessage(page.timeline.error)}
              action={<Button variant="outline" onClick={page.timeline.reload}>{tCommon("retry")}</Button>}
            />
          ) : page.timeline.list.length === 0 ? (
            <EmptyState title={t("timeline.empty")} />
          ) : (
            <ol className="mt-[15px]" aria-label={t("timeline.title")}>
              {page.timeline.list.map((activity) => (
                <ActivityItem
                  key={activity.id}
                  activity={activity}
                  actorName={lookups.userName(activity.actorId)}
                  recordName={page.recordName(activity)}
                />
              ))}
            </ol>
          )}
        </Card>
      </div>

      <TaskFormModal
        open={form !== null}
        task={form?.task ?? null}
        users={lookups.users}
        contacts={page.contacts}
        companies={lookups.companies}
        deals={page.deals}
        defaultOwnerId={lookups.me?.id ?? lookups.users[0]?.id ?? ""}
        onClose={() => setForm(null)}
        onSubmit={async (input) => {
          try {
            if (form?.task) await page.update(form.task, input);
            else await page.create(input);
            toast(form?.task ? t("form.saved") : t("form.created"));
            setForm(null);
          } catch (error) {
            toast(errorMessage(error), "error");
          }
        }}
      />
    </>
  );
}

function TaskRow({
  task,
  meta,
  now,
  onToggle,
  onEdit,
}: {
  task: Task;
  meta: string;
  now: Date;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const t = useTranslations("tasks");

  return (
    <li className="flex items-center gap-[9px] border-t border-surface-muted py-3.5 first:border-t-0">
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-[9px]">
        <input type="checkbox" checked={task.done} onChange={onToggle} className="accent-[#6259d6]" />
        <span className="min-w-0 flex-1">
          <strong className={`block truncate text-[10px] ${task.done ? "text-text-faint line-through" : "text-[#464354]"}`}>
            {task.title}
          </strong>
          {meta && <small className="mt-1 block truncate text-[9px] text-[#9c99a9]">{meta}</small>}
        </span>
      </label>
      <DueChip task={task} now={now} />
      <button
        type="button"
        onClick={onEdit}
        aria-label={t("edit", { title: task.title })}
        className="rounded px-1.5 py-1 text-[11px] text-text-subtle hover:bg-surface-muted hover:text-primary"
      >
        ✎
      </button>
    </li>
  );
}
