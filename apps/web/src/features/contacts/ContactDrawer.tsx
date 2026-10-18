"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { dueKind, type Activity, type Contact, type Task } from "@lulu/shared";
import { Avatar, Button, Drawer, EmptyState, Pill, Skeleton, useToast } from "@/components/ui";
import { useFormat } from "@/i18n/format";
import { api } from "@/lib/api";
import { useErrorMessage } from "@/lib/errors";
import { useApi } from "@/lib/useApi";
import { avatarTone, initials, knownSources, stageTone } from "./options";
import type { Lookups } from "./useLookups";

const DAY_MS = 24 * 60 * 60 * 1000;

export function ContactDrawer({
  contact,
  lookups,
  onClose,
  onEdit,
  onDelete,
  onChanged,
}: {
  contact: Contact | null;
  lookups: Lookups;
  onClose: () => void;
  onEdit: (contact: Contact) => void;
  onDelete: (contact: Contact) => void;
  onChanged: (contact: Contact) => void;
}) {
  const t = useTranslations("contacts.drawer");
  const tStage = useTranslations("lifecycleStages");
  const tSource = useTranslations("sources");
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [converting, setConverting] = useState(false);

  const id = contact?.id;
  const tasks = useApi(
    () => (id ? api.tasks.list({ recordType: "contact", recordId: id }) : Promise.resolve(null)),
    [id],
  );
  const timeline = useApi(
    () => (id ? api.activities.list({ recordType: "contact", recordId: id }) : Promise.resolve(null)),
    [id],
  );

  if (!contact) return null;

  const source = contact.source
    ? (knownSources as readonly string[]).includes(contact.source)
      ? tSource(contact.source)
      : contact.source
    : "–";

  const convert = async () => {
    setConverting(true);
    try {
      onChanged(await api.contacts.convert(contact.id));
      toast(t("converted"));
      timeline.reload();
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setConverting(false);
    }
  };

  const details: [string, React.ReactNode][] = [
    [t("email"), contact.email ? <a className="text-primary hover:underline" href={`mailto:${contact.email}`}>{contact.email}</a> : "–"],
    [t("phone"), contact.phone ? <a className="hover:underline" href={`tel:${contact.phone}`}>{contact.phone}</a> : "–"],
    [t("company"), lookups.companyName(contact.companyId) ?? "–"],
    [t("owner"), lookups.userName(contact.ownerId) ?? "–"],
    [t("source"), source],
    [t("tags"), contact.tags.length ? <span className="flex flex-wrap gap-1">{contact.tags.map((tag) => <Pill key={tag}>{tag}</Pill>)}</span> : "–"],
  ];

  return (
    <Drawer open onClose={onClose} eyebrow={t("eyebrow")} title={contact.name}>
      <div className="flex items-center gap-3">
        <Avatar initials={initials(contact.name)} tone={avatarTone(contact.id)} />
        <div className="min-w-0 flex-1">
          <strong className="block truncate text-sm text-text-strong">{contact.jobRole ?? "–"}</strong>
          <span className="mt-1 block text-[11px] text-text-subtle">{lookups.companyName(contact.companyId) ?? ""}</span>
        </div>
        <Pill tone={stageTone[contact.lifecycleStage]}>{tStage(contact.lifecycleStage)}</Pill>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-b border-border pb-4">
        {contact.email && (
          <a
            href={`mailto:${contact.email}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#dad8ec] px-3 py-2 text-[11px] font-extrabold text-primary-hover hover:bg-[#f7f5ff]"
          >
            ✉ {t("sendEmail")}
          </a>
        )}
        <Button variant="outline" onClick={() => onEdit(contact)}>{t("edit")}</Button>
        {contact.lifecycleStage !== "customer" && (
          <Button variant="outline" onClick={convert} loading={converting}>{t("convert")}</Button>
        )}
        <Button variant="ghost" onClick={() => onDelete(contact)}>{t("delete")}</Button>
      </div>

      <Section title={t("details")}>
        <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2.5 text-[11px]">
          {details.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-text-subtle">{label}</dt>
              <dd className="min-w-0 break-words text-text-strong">{value}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <TasksSection contactId={contact.id} tasks={tasks} onTimelineChanged={timeline.reload} />

      <Section title={t("timeline")}>
        {timeline.loading && !timeline.data ? (
          <Skeleton className="h-10 w-full" />
        ) : timeline.data?.data.length ? (
          <ol className="grid gap-3">
            {timeline.data.data.map((activity) => (
              <TimelineItem key={activity.id} activity={activity} lookups={lookups} />
            ))}
          </ol>
        ) : (
          <EmptyState title={t("noActivity")} />
        )}
      </Section>

      <Section title={t("notes")}>
        <EmptyState title={t("noNotes")} />
      </Section>
    </Drawer>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-text-strong">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function TasksSection({
  contactId,
  tasks,
  onTimelineChanged,
}: {
  contactId: string;
  tasks: ReturnType<typeof useApi<{ data: Task[] } | null>>;
  onTimelineChanged: () => void;
}) {
  const t = useTranslations("contacts.drawer");
  const tDue = useTranslations("due");
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const format = useFormat();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [saving, setSaving] = useState(false);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const addTask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await api.tasks.create({
        title: title.trim(),
        // Date-only due dates are stored at 12:00 UTC (see packages/shared/src/task.ts).
        dueAt: due ? `${due}T12:00:00.000Z` : null,
        recordType: "contact",
        recordId: contactId,
      });
      setTitle("");
      setDue("");
      setAdding(false);
      toast(t("taskAdded"));
      tasks.reload();
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (task: Task) => {
    try {
      await api.tasks.update(task.id, { done: !task.done });
      tasks.reload();
      onTimelineChanged();
    } catch (error) {
      toast(errorMessage(error), "error");
    }
  };

  const list = tasks.data?.data ?? [];

  return (
    <Section
      title={t("tasks")}
      action={
        !adding && (
          <button type="button" onClick={() => setAdding(true)} className="text-[11px] font-bold text-primary hover:underline">
            ＋ {t("addTask")}
          </button>
        )
      }
    >
      {adding && (
        <form onSubmit={addTask} className="mb-3 grid gap-2 rounded-lg border border-border p-3">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("taskTitle")}
            aria-label={t("taskTitle")}
            className="rounded-md border border-border-strong px-3 py-2 text-xs outline-none focus:border-primary"
          />
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              aria-label={t("taskDue")}
              className="rounded-md border border-border-strong px-2 py-1.5 text-xs outline-none focus:border-primary"
            />
            <span className="flex-1" />
            <Button variant="ghost" onClick={() => setAdding(false)}>{t("cancel")}</Button>
            <Button type="submit" loading={saving} disabled={!title.trim()}>{t("saveTask")}</Button>
          </div>
        </form>
      )}

      {tasks.loading && !tasks.data ? (
        <Skeleton className="h-10 w-full" />
      ) : list.length ? (
        <ul className="grid gap-2">
          {list.map((task) => {
            const kind = dueKind(task, new Date(), timeZone);
            return (
              <li key={task.id} className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={task.done}
                  onChange={() => toggle(task)}
                  aria-label={task.title}
                  className="accent-[#6259d6]"
                />
                <span className={`flex-1 text-[11px] ${task.done ? "text-text-faint line-through" : "text-text-strong"}`}>
                  {task.title}
                </span>
                {task.dueAt && kind !== "none" && (
                  <Pill tone={kind === "overdue" ? "warning" : kind === "today" ? "violet" : "neutral"}>
                    {kind === "later" || kind === "this_week" || kind === "done"
                      ? format.date(task.dueAt)
                      : tDue(kind)}
                  </Pill>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        !adding && <EmptyState title={t("noTasks")} />
      )}
    </Section>
  );
}

function TimelineItem({ activity, lookups }: { activity: Activity; lookups: Lookups }) {
  const t = useTranslations("activities");
  const format = useFormat();
  const actor = lookups.userName(activity.actorId) ?? t("someone");
  const recent = Date.now() - Date.parse(activity.occurredAt) < 7 * DAY_MS;

  return (
    <li className="flex gap-3">
      <span className="mt-1 size-2 flex-none rounded-full bg-primary" aria-hidden />
      <div className="min-w-0">
        <p className="text-[11px] text-text-strong">{t(activity.type, { actor })}</p>
        <time dateTime={activity.occurredAt} className="text-[10px] text-text-subtle">
          {recent ? format.relative(activity.occurredAt) : format.date(activity.occurredAt)}
        </time>
      </div>
    </li>
  );
}
