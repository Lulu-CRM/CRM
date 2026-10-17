import type { Activity } from "./activity";
import type { Task } from "./task";

// Pure task and timeline logic for the Activities & Tasks page, shared with the API (PATCH /tasks/:id).

const DAY_MS = 24 * 60 * 60 * 1000;

/** Calendar day of `date` in `timeZone`, as a day number, so two dates can be compared by day. */
function dayNumber(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return Date.UTC(part("year"), part("month") - 1, part("day")) / DAY_MS;
}

/**
 * Which chip a task shows. The UI translates the kind (tasks.due.<kind>);
 * for "this_week" it shows the weekday and for "later" the date, both through Intl.
 */
export type DueKind = "done" | "overdue" | "today" | "tomorrow" | "this_week" | "later" | "none";

export function dueKind(task: Task, now: Date, timeZone: string): DueKind {
  if (task.done) return "done";
  if (task.dueAt === null) return "none";

  const days = dayNumber(new Date(task.dueAt), timeZone) - dayNumber(now, timeZone);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 7) return "this_week";
  return "later";
}

export type ActivityDraft = Omit<Activity, "id" | "workspaceId" | "createdAt" | "updatedAt" | "deletedAt">;

/**
 * Ticks or unticks a task. Returns the updated task and the activity to add to the timeline,
 * or `activity: null` when nothing changed.
 */
export function setTaskDone(
  task: Task,
  done: boolean,
  actorId: string,
  now: Date = new Date(),
): { task: Task; activity: ActivityDraft | null } {
  if (task.done === done) return { task, activity: null };

  const timestamp = now.toISOString();
  return {
    task: { ...task, done, doneAt: done ? timestamp : null, updatedAt: timestamp },
    activity: {
      type: "task",
      recordType: task.recordType,
      recordId: task.recordId,
      occurredAt: timestamp,
      sourceModule: "crm",
      actorId,
      payload: { taskId: task.id, action: done ? "completed" : "reopened" },
    },
  };
}

export type DueFilter = "all" | "overdue" | "today" | "this_week";

export type TaskFilters = {
  ownerId?: string;
  due?: DueFilter;
  showDone?: boolean;
};

/**
 * Tasks for the list: filtered by owner and due date, open tasks first by due date (undated last),
 * then done tasks with the most recently finished first.
 */
export function filterTasks(tasks: Task[], filters: TaskFilters, now: Date, timeZone: string): Task[] {
  const { ownerId, due = "all", showDone = true } = filters;

  const matchesDue = (task: Task) => {
    if (due === "all") return true;
    const kind = dueKind(task, now, timeZone);
    if (due === "this_week") return kind === "today" || kind === "tomorrow" || kind === "this_week";
    return kind === due;
  };

  const time = (value: string | null, empty: number) => (value === null ? empty : Date.parse(value));

  return tasks
    .filter((task) => task.deletedAt === null)
    .filter((task) => ownerId === undefined || task.ownerId === ownerId)
    .filter((task) => (task.done ? showDone && due === "all" : matchesDue(task)))
    .sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (a.done) return time(b.doneAt, 0) - time(a.doneAt, 0);
      return time(a.dueAt, Number.POSITIVE_INFINITY) - time(b.dueAt, Number.POSITIVE_INFINITY);
    });
}

/** Timeline order: newest first, deleted activities left out. */
export function sortTimeline(activities: Activity[]): Activity[] {
  return activities
    .filter((activity) => activity.deletedAt === null)
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
}
