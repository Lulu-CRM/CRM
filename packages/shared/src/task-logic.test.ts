import { describe, expect, it } from "vitest";
import { activitySchema, moduleEventSchema } from "./activity.js";
import { demoActivities, demoTasks } from "./fixtures/tasks.js";
import { taskCreateSchema, taskListQuerySchema, taskSchema, type Task } from "./task.js";
import { dueKind, filterTasks, setTaskDone, sortTimeline } from "./task-logic.js";

// Saturday 17 October 2026, 10:00 in Berlin.
const NOW = new Date("2026-10-17T08:00:00.000Z");
const BERLIN = "Europe/Berlin";

const tasks = demoTasks(NOW);
const task = (overrides: Partial<Task>): Task => ({ ...tasks[0], ...overrides });

describe("fixtures", () => {
  it("match the schemas", () => {
    for (const t of tasks) expect(() => taskSchema.parse(t)).not.toThrow();
    for (const a of demoActivities(NOW)) expect(() => activitySchema.parse(a)).not.toThrow();
  });

  it("show the design's chips", () => {
    expect(tasks.map((t) => dueKind(t, NOW, BERLIN))).toEqual(["today", "tomorrow", "done", "this_week"]);
  });
});

describe("dueKind", () => {
  it("marks tasks due on an earlier day as overdue", () => {
    expect(dueKind(task({ dueAt: "2026-10-16T12:00:00.000Z" }), NOW, BERLIN)).toBe("overdue");
  });

  it("counts a task due earlier today as today, not overdue", () => {
    expect(dueKind(task({ dueAt: "2026-10-17T06:00:00.000Z" }), NOW, BERLIN)).toBe("today");
  });

  it("uses the user's time zone to decide the day", () => {
    // 23:30 UTC on the 17th is already the 18th in Shanghai.
    const lateUtc = task({ dueAt: "2026-10-17T23:30:00.000Z" });
    expect(dueKind(lateUtc, NOW, "UTC")).toBe("today");
    expect(dueKind(lateUtc, NOW, "Asia/Shanghai")).toBe("tomorrow");
  });

  it("splits this week from later", () => {
    expect(dueKind(task({ dueAt: "2026-10-23T12:00:00.000Z" }), NOW, BERLIN)).toBe("this_week");
    expect(dueKind(task({ dueAt: "2026-10-24T12:00:00.000Z" }), NOW, BERLIN)).toBe("later");
  });

  it("handles done and undated tasks", () => {
    expect(dueKind(task({ done: true, dueAt: "2026-10-01T12:00:00.000Z" }), NOW, BERLIN)).toBe("done");
    expect(dueKind(task({ dueAt: null }), NOW, BERLIN)).toBe("none");
  });
});

describe("setTaskDone", () => {
  it("ticking a task sets doneAt and adds a timeline activity", () => {
    const { task: done, activity } = setTaskDone(tasks[0], true, "user_jamie", NOW);
    expect(done).toMatchObject({ done: true, doneAt: NOW.toISOString(), updatedAt: NOW.toISOString() });
    expect(activity).toEqual({
      type: "task",
      recordType: "contact",
      recordId: "contact_sophie",
      occurredAt: NOW.toISOString(),
      sourceModule: "crm",
      actorId: "user_jamie",
      payload: { taskId: "task_sophie_proposal", action: "completed" },
    });
  });

  it("unticking clears doneAt and logs the reopen", () => {
    const { task: reopened, activity } = setTaskDone(tasks[2], false, "user_alex", NOW);
    expect(reopened).toMatchObject({ done: false, doneAt: null });
    expect(activity?.payload).toEqual({ taskId: "task_roam_requirements", action: "reopened" });
  });

  it("does nothing when the state does not change", () => {
    expect(setTaskDone(tasks[2], true, "user_alex", NOW)).toEqual({ task: tasks[2], activity: null });
  });

  it("puts the completed task first on the timeline", () => {
    const { activity } = setTaskDone(tasks[0], true, "user_jamie", NOW);
    const timeline = sortTimeline([
      ...demoActivities(NOW),
      { ...activity!, id: "new", workspaceId: "ws_demo", createdAt: "", updatedAt: "", deletedAt: null },
    ]);
    expect(timeline[0].id).toBe("new");
  });
});

describe("filterTasks", () => {
  it("lists open tasks by due date and done tasks last", () => {
    expect(filterTasks(tasks, {}, NOW, BERLIN).map((t) => t.id)).toEqual([
      "task_sophie_proposal",
      "task_atlas_notes",
      "task_klarwerk_review",
      "task_roam_requirements",
    ]);
  });

  it("puts undated open tasks after dated ones", () => {
    const list = filterTasks([task({ id: "undated", dueAt: null }), tasks[1]], {}, NOW, BERLIN);
    expect(list.map((t) => t.id)).toEqual(["task_atlas_notes", "undated"]);
  });

  it("filters by owner", () => {
    expect(filterTasks(tasks, { ownerId: "user_alex" }, NOW, BERLIN).map((t) => t.id)).toEqual([
      "task_klarwerk_review",
      "task_roam_requirements",
    ]);
  });

  it("filters by due date and leaves done tasks out of due filters", () => {
    const overdue = task({ id: "late", dueAt: "2026-10-10T12:00:00.000Z" });
    const all = [...tasks, overdue];
    expect(filterTasks(all, { due: "overdue" }, NOW, BERLIN).map((t) => t.id)).toEqual(["late"]);
    expect(filterTasks(all, { due: "today" }, NOW, BERLIN).map((t) => t.id)).toEqual(["task_sophie_proposal"]);
    expect(filterTasks(all, { due: "this_week" }, NOW, BERLIN).map((t) => t.id)).toEqual([
      "task_sophie_proposal",
      "task_atlas_notes",
      "task_klarwerk_review",
    ]);
  });

  it("can hide done tasks and skips deleted ones", () => {
    const all = [...tasks, task({ id: "deleted", deletedAt: NOW.toISOString() })];
    const list = filterTasks(all, { showDone: false }, NOW, BERLIN);
    expect(list.map((t) => t.id)).not.toContain("task_roam_requirements");
    expect(list.map((t) => t.id)).not.toContain("deleted");
  });
});

describe("schemas", () => {
  it("needs both halves of a record link", () => {
    expect(taskCreateSchema.safeParse({ title: "Call", recordType: "contact" }).success).toBe(false);
    expect(taskCreateSchema.safeParse({ title: "Call", recordType: "contact", recordId: "c1" }).success).toBe(true);
    expect(taskCreateSchema.safeParse({ title: "Call" }).success).toBe(true);
  });

  it("reads done=true and done=false from the query string", () => {
    expect(taskListQuerySchema.parse({ done: "false" }).done).toBe(false);
    expect(taskListQuerySchema.parse({ done: "true" }).done).toBe(true);
    expect(taskListQuerySchema.safeParse({ done: "yes" }).success).toBe(false);
  });

  it("accepts the event example from docs/api.md", () => {
    const event = moduleEventSchema.parse({
      type: "email.received",
      sourceModule: "email",
      occurredAt: "2026-10-17T09:42:00Z",
      contact: { email: "sophie@northstar.studio" },
      summary: "Reply received from Sophie Laurent",
    });
    expect(event.payload).toEqual({});
  });

  it("rejects events from unknown modules or with the CRM as source", () => {
    const event = {
      sourceModule: "email",
      occurredAt: "2026-10-17T09:42:00Z",
      contact: { email: "sophie@northstar.studio" },
      summary: "x",
    };
    expect(moduleEventSchema.safeParse({ ...event, type: "billing.paid" }).success).toBe(false);
    expect(moduleEventSchema.safeParse({ ...event, type: "email.received", sourceModule: "crm" }).success).toBe(false);
  });
});
