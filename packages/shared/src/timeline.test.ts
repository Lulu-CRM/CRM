import { describe, expect, it } from "vitest";
import { timelineItemSchema } from "./timeline";

const base = {
  id: "r1",
  workspaceId: "w1",
  createdAt: "2026-10-18T09:00:00.000Z",
  updatedAt: "2026-10-18T09:00:00.000Z",
  deletedAt: null,
};
const at = "2026-10-18T09:00:00.000Z";

const activity = {
  ...base,
  type: "email",
  recordType: "contact",
  recordId: "c1",
  occurredAt: at,
  sourceModule: "email",
  actorId: null,
  payload: {},
};

const note = {
  ...base,
  title: "Call notes",
  body: "Prefers mornings",
  visibility: "shared",
  authorId: "u1",
  recordType: "contact",
  recordId: "c1",
};

const task = {
  ...base,
  title: "Send proposal",
  dueAt: null,
  priority: "normal",
  ownerId: "u1",
  done: false,
  doneAt: null,
  recordType: "contact",
  recordId: "c1",
};

describe("timelineItemSchema", () => {
  it("parses an activity, a note and a task", () => {
    expect(timelineItemSchema.safeParse({ kind: "activity", at, activity }).success).toBe(true);
    expect(timelineItemSchema.safeParse({ kind: "note", at, note }).success).toBe(true);
    expect(timelineItemSchema.safeParse({ kind: "task", at, task }).success).toBe(true);
  });

  it("rejects an unknown kind", () => {
    expect(timelineItemSchema.safeParse({ kind: "email", at, activity }).success).toBe(false);
  });
});