import { describe, expect, it } from "vitest";
import { overviewSchema } from "./overview";
import { buildOverview, startOfWeek, type OverviewInput } from "./overview-logic";
import { demoCompanies, demoContacts } from "./fixtures/contacts";
import { demoDeals, demoStages } from "./fixtures/pipeline";
import { demoActivities, demoTasks } from "./fixtures/tasks";
import type { Activity } from "./activity";
import type { Task } from "./task";

const NOW = new Date("2026-10-18T10:00:00.000Z"); // a Sunday
const TZ = "UTC";

const input = (over: Partial<OverviewInput> = {}): OverviewInput => ({
  contacts: demoContacts,
  companies: demoCompanies,
  deals: demoDeals,
  stages: demoStages,
  tasks: demoTasks(NOW),
  activities: demoActivities(NOW),
  currency: "EUR",
  ...over,
});

describe("buildOverview", () => {
  it("matches the schema for the sample data", () => {
    expect(() => overviewSchema.parse(buildOverview(input(), NOW, TZ))).not.toThrow();
  });

  it("counts live contacts only", () => {
    const deleted = { ...demoContacts[0], deletedAt: "2026-10-10T00:00:00.000Z" };
    const result = buildOverview(input({ contacts: [deleted, ...demoContacts.slice(1)] }), NOW, TZ);
    expect(result.contactCount).toBe(4);
  });

  it("compares the contact count with a month ago", () => {
    const old = (id: string) => ({ ...demoContacts[0], id, createdAt: "2026-08-01T00:00:00.000Z" });
    const fresh = (id: string) => ({ ...demoContacts[0], id, createdAt: "2026-10-10T00:00:00.000Z" });
    const result = buildOverview(input({ contacts: [old("a"), old("b"), fresh("c")] }), NOW, TZ);
    expect(result.contactChange).toBe(0.5);
    // Sample contacts were all created this month, so there is nothing to compare with.
    expect(buildOverview(input(), NOW, TZ).contactChange).toBeNull();
  });

  it("takes pipeline totals from summarizeDeals and lists open stages in order", () => {
    const result = buildOverview(input(), NOW, TZ);
    expect(result.pipelineByStage.map((s) => s.stageId)).toEqual(
      demoStages.filter((s) => s.type === "open").sort((a, b) => a.order - b.order).map((s) => s.id),
    );
    const sum = result.pipelineByStage.reduce((total, s) => total + s.value.amount, 0);
    expect(sum).toBe(result.openPipeline.amount);
    expect(result.weightedPipeline.amount).toBeLessThanOrEqual(result.openPipeline.amount);
  });

  it("counts follow-ups due within a week, and those due today", () => {
    const task = (id: string, dueAt: string | null, done = false): Task => ({
      ...demoTasks(NOW)[0],
      id,
      dueAt,
      done,
      doneAt: done ? NOW.toISOString() : null,
    });
    const tasks = [
      task("overdue", "2026-10-10T12:00:00.000Z"),
      task("today", "2026-10-18T12:00:00.000Z"),
      task("today-done", "2026-10-18T12:00:00.000Z", true),
      task("in-3-days", "2026-10-21T12:00:00.000Z"),
      task("in-a-month", "2026-11-18T12:00:00.000Z"),
      task("no-date", null),
    ];
    const result = buildOverview(input({ tasks }), NOW, TZ);
    expect(result.followUpsDue).toBe(3);
    expect(result.dueToday).toBe(1);
  });

  it("counts AI signals in the last 30 days and since Monday", () => {
    const signal = (id: string, occurredAt: string): Activity => ({
      ...demoActivities(NOW)[0],
      id,
      type: "ai_signal",
      occurredAt,
    });
    const activities = [
      signal("this-week", "2026-10-13T09:00:00.000Z"), // Tuesday
      signal("last-week", "2026-10-08T09:00:00.000Z"),
      signal("too-old", "2026-08-01T09:00:00.000Z"),
    ];
    const result = buildOverview(input({ activities }), NOW, TZ);
    expect(result.aiSignals).toBe(2);
    expect(result.aiSignalsThisWeek).toBe(1);
  });

  it("lists the 4 most recently touched contacts and the 5 newest activities with names", () => {
    const result = buildOverview(input(), NOW, TZ);
    expect(result.recentContacts.map((c) => c.name)).toEqual(["Sophie Laurent", "Daniel Chen", "Mila Rossi", "Tobias Klein"]);
    expect(result.recentActivity).toHaveLength(5);
    expect(result.recentActivity[0].recordName).toBe("Sophie Laurent");
    const times = result.recentActivity.map((a) => Date.parse(a.occurredAt));
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });
});

describe("startOfWeek", () => {
  it("returns Monday midnight in the given time zone", () => {
    expect(new Date(startOfWeek(NOW, "UTC")).toISOString()).toBe("2026-10-12T00:00:00.000Z");
    // 01:00 Monday in Berlin is still Sunday in UTC; Berlin's week has already started.
    const mondayBerlin = new Date("2026-10-18T23:30:00.000Z");
    expect(new Date(startOfWeek(mondayBerlin, "Europe/Berlin")).toISOString()).toBe("2026-10-18T22:00:00.000Z");
    expect(new Date(startOfWeek(NOW, "Asia/Shanghai")).toISOString()).toBe("2026-10-11T16:00:00.000Z");
  });
});
