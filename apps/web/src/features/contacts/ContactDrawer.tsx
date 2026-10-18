"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Contact, Task } from "@lulu/shared";
import { Avatar, Button, Drawer, Pill, Skeleton, useToast } from "@/components/ui";
import { useFormat } from "@/i18n/format";
import { api } from "@/lib/api";
import { useErrorMessage } from "@/lib/errors";
import { useApi } from "@/lib/useApi";
import { ActivityItem } from "@/features/activities/ActivityItem";
import { DueChip } from "@/features/activities/DueChip";
import { knownSources, stageTone } from "./options";
import { avatarTone, initials } from "@/lib/initials";
import type { Lookups } from "./useLookups";

const textButton = "text-[11px] font-extrabold text-primary-hover hover:underline";

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
  const format = useFormat();
  const [converting, setConverting] = useState(false);
  const [addingTask, setAddingTask] = useState(false);

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
    [t("email"), contact.email ? <a className="hover:underline" href={`mailto:${contact.email}`}>{contact.email}</a> : "–"],
    [t("phone"), contact.phone ? <a className="hover:underline" href={`tel:${contact.phone}`}>{contact.phone}</a> : "–"],
    [t("owner"), lookups.userName(contact.ownerId) ?? "–"],
    [t("source"), source],
    [t("lastTouch"), contact.lastTouchAt ? format.recent(contact.lastTouchAt) : "–"],
  ];
  if (contact.tags.length) {
    details.push([t("tags"), <span key="tags" className="flex flex-wrap justify-end gap-1">{contact.tags.map((tag) => <Pill key={tag}>{tag}</Pill>)}</span>]);
  }

  return (
    <Drawer open onClose={() => { setAddingTask(false); onClose(); }} eyebrow={t("eyebrow")} title={contact.name}>
      <div className="flex items-center gap-3">
        <Avatar initials={initials(contact.name)} tone={avatarTone(contact.id)} />
        <div className="min-w-0 flex-1">
          <strong className="block truncate text-[13px] text-text-strong">{contact.jobRole ?? "–"}</strong>
          <span className="mt-1 block text-[11px] text-text-subtle">{lookups.companyName(contact.companyId) ?? ""}</span>
          <span className="mt-2 inline-flex">
            <Pill tone={stageTone[contact.lifecycleStage]}>{tStage(contact.lifecycleStage)}</Pill>
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-b border-border pb-4">
        {contact.email && (
          <a
            href={`mailto:${contact.email}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#dad8ec] bg-surface px-3.5 py-2.5 text-[11px] font-extrabold text-primary-hover hover:bg-[#f7f5ff]"
          >
            ✉ {t("sendEmail")}
          </a>
        )}
        <Button variant="outline" icon="＋" onClick={() => setAddingTask(true)}>
          {t("task")}
        </Button>
        <Button onClick={() => onEdit(contact)}>{t("edit")}</Button>
      </div>

      <dl className="mt-1">
        {details.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3.5 border-b border-surface-muted py-3.5">
            <dt className="text-[10px] text-text-subtle">{label}</dt>
            <dd className="max-w-[65%] text-right text-[10px] font-semibold break-words text-text-strong">{value}</dd>
          </div>
        ))}
      </dl>

      <TasksSection
        contactId={contact.id}
        tasks={tasks}
        adding={addingTask}
        setAdding={setAddingTask}
        onTimelineChanged={timeline.reload}
      />

      <section className="mt-6">
        <SectionHead eyebrow={t("timelineEyebrow")} title={t("timeline")} />
        {timeline.loading && !timeline.data ? (
          <Skeleton className="mt-3 h-10 w-full" />
        ) : timeline.data?.data.length ? (
          <ol className="mt-2">
            {timeline.data.data.map((activity) => (
              <ActivityItem key={activity.id} activity={activity} actorName={lookups.userName(activity.actorId)} />
            ))}
          </ol>
        ) : (
          <p className="py-4 text-[11px] text-text-subtle">{t("noActivity")}</p>
        )}
      </section>

      <section className="mt-6">
        <SectionHead eyebrow={t("notesEyebrow")} title={t("notes")} />
        <p className="py-4 text-[11px] text-text-subtle">{t("noNotes")}</p>
      </section>

      <div className="mt-6 flex flex-wrap gap-4 border-t border-border pt-4">
        {contact.lifecycleStage !== "customer" && (
          <button type="button" className={textButton} onClick={convert} disabled={converting}>
            {t("convert")}
          </button>
        )}
        <button type="button" className="text-[11px] font-extrabold text-[#c2413d] hover:underline" onClick={() => onDelete(contact)}>
          {t("delete")}
        </button>
      </div>
    </Drawer>
  );
}

function SectionHead({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <span className="text-[9px] font-black tracking-[0.16em] text-rail-label uppercase">{eyebrow}</span>
        <h3 className="mt-1.5 text-[13px] font-semibold text-text">{title}</h3>
      </div>
      {action}
    </div>
  );
}

function TasksSection({
  contactId,
  tasks,
  adding,
  setAdding,
  onTimelineChanged,
}: {
  contactId: string;
  tasks: ReturnType<typeof useApi<{ data: Task[] } | null>>;
  adding: boolean;
  setAdding: (adding: boolean) => void;
  onTimelineChanged: () => void;
}) {
  const t = useTranslations("contacts.drawer");
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [saving, setSaving] = useState(false);

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
    <section className="mt-6">
      <SectionHead
        eyebrow={t("tasksEyebrow")}
        title={t("tasks")}
        action={
          !adding && (
            <button type="button" onClick={() => setAdding(true)} className={textButton}>
              ＋ {t("task")}
            </button>
          )
        }
      />

      {adding && (
        <form onSubmit={addTask} className="mt-3 grid gap-2 rounded-lg border border-border p-3">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("taskTitle")}
            aria-label={t("taskTitle")}
            className="rounded-md border border-border-strong px-3 py-2 text-[11px] outline-none focus:border-[#8e83de] focus:shadow-[0_0_0_3px_#eeecff]"
          />
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              aria-label={t("taskDue")}
              className="rounded-md border border-border-strong px-2 py-1.5 text-[11px] outline-none focus:border-[#8e83de]"
            />
            <span className="flex-1" />
            <Button variant="outline" onClick={() => setAdding(false)}>{t("cancel")}</Button>
            <Button type="submit" loading={saving} disabled={!title.trim()}>{t("saveTask")}</Button>
          </div>
        </form>
      )}

      {tasks.loading && !tasks.data ? (
        <Skeleton className="mt-3 h-10 w-full" />
      ) : list.length ? (
        <ul className="mt-2">
          {list.map((task) => {
            return (
              <li key={task.id} className="flex items-center gap-2.5 border-b border-surface-muted py-3">
                <input
                  type="checkbox"
                  checked={task.done}
                  onChange={() => toggle(task)}
                  aria-label={task.title}
                  className="accent-[#6259d6]"
                />
                <span className={`flex-1 text-[10px] font-semibold ${task.done ? "text-text-faint line-through" : "text-text-strong"}`}>
                  {task.title}
                </span>
                <DueChip task={task} />
              </li>
            );
          })}
        </ul>
      ) : (
        !adding && <p className="py-4 text-[11px] text-text-subtle">{t("noTasks")}</p>
      )}
    </section>
  );
}
