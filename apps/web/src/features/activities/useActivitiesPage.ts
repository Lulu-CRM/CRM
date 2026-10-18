"use client";

import { useEffect, useMemo, useState } from "react";
import { setTaskDone, sortTimeline, type Activity, type Task, type TaskCreateInput } from "@lulu/shared";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { useLookups } from "@/features/contacts/useLookups";

/**
 * Tasks, the activity timeline and the names they refer to.
 * Ticking a task is optimistic: the task and its timeline line change at once, using the same
 * shared rule as the API (setTaskDone), and both go back if the API refuses.
 */
export function useActivitiesPage() {
  const lookups = useLookups();
  const tasks = useApi(() => api.tasks.list({ pageSize: 100 }), []);
  const activities = useApi(() => api.activities.list({ pageSize: 50 }), []);
  const contacts = useApi(() => api.contacts.list({ pageSize: 100 }), []);
  const deals = useApi(() => api.deals.list(), []);

  // Tasks changed on this page, newest version wins over what the list last loaded.
  const [changed, setChanged] = useState<Map<string, Task>>(new Map());
  // Timeline lines shown before the server's copy arrives.
  const [pending, setPending] = useState<Activity[]>([]);

  // A fresh timeline from the server includes everything that was pending.
  useEffect(() => setPending([]), [activities.data]);

  const taskList = useMemo(
    () =>
      (tasks.data?.data ?? []).map((task) => {
        const local = changed.get(task.id);
        return local && local.updatedAt >= task.updatedAt ? local : task;
      }),
    [tasks.data, changed],
  );

  const timeline = useMemo(() => sortTimeline([...pending, ...(activities.data?.data ?? [])]), [pending, activities.data]);

  const remember = (task: Task) => setChanged((map) => new Map(map).set(task.id, task));
  const forget = (id: string) =>
    setChanged((map) => {
      const next = new Map(map);
      next.delete(id);
      return next;
    });

  const toggle = async (task: Task) => {
    const actorId = lookups.me?.id ?? task.ownerId;
    const { task: optimistic, activity } = setTaskDone(task, !task.done, actorId, new Date());
    const pendingId = `pending_${task.id}_${optimistic.updatedAt}`;
    remember(optimistic);
    if (activity) {
      const at = activity.occurredAt;
      setPending((list) => [{ ...activity, id: pendingId, workspaceId: task.workspaceId, createdAt: at, updatedAt: at, deletedAt: null }, ...list]);
    }
    try {
      remember(await api.tasks.update(task.id, { done: !task.done }));
      activities.reload();
    } catch (error) {
      forget(task.id);
      setPending((list) => list.filter((a) => a.id !== pendingId));
      throw error;
    }
  };

  const create = async (input: TaskCreateInput) => {
    await api.tasks.create(input);
    tasks.reload();
  };

  const update = async (task: Task, input: TaskCreateInput) => {
    // The record link is fixed after creation (PATCH /tasks/:id does not take it).
    const { title, dueAt, ownerId, priority } = input;
    remember(await api.tasks.update(task.id, { title, dueAt, ownerId, priority }));
  };

  const contactList = contacts.data?.data ?? [];
  const dealList = deals.data?.data ?? [];
  const recordName = (task: Pick<Task, "recordType" | "recordId">) => {
    if (!task.recordId) return undefined;
    if (task.recordType === "contact") return contactList.find((c) => c.id === task.recordId)?.name;
    if (task.recordType === "company") return lookups.companyName(task.recordId);
    return dealList.find((d) => d.id === task.recordId)?.name;
  };

  return {
    lookups,
    contacts: contactList,
    deals: dealList,
    tasks: { list: taskList, loading: tasks.loading && !tasks.data, error: tasks.error, reload: tasks.reload },
    timeline: { list: timeline, loading: activities.loading && !activities.data, error: activities.error, reload: activities.reload },
    recordName,
    toggle,
    create,
    update,
  };
}
