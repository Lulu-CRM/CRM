import type { Activity } from "../activity.js";
import type { Task } from "../task.js";
import { DEMO_WORKSPACE_ID } from "./pipeline.js";

// Sample tasks and activities from the MagicPath design (design/src/components/generated/LuluCRM.tsx).
// Dates are relative to `now`, so "due today" in the design is still due today whenever mock mode runs.

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

// Date-only due dates are stored at 12:00 UTC (see task.ts).
function dueInDays(now: Date, days: number): string {
  const day = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + days * DAY_MS;
  return new Date(day + 12 * 60 * MINUTE_MS).toISOString();
}

function ago(now: Date, minutes: number): string {
  return new Date(now.getTime() - minutes * MINUTE_MS).toISOString();
}

export function demoTasks(now: Date = new Date()): Task[] {
  const created = ago(now, 7 * 24 * 60);
  const base = { workspaceId: DEMO_WORKSPACE_ID, createdAt: created, updatedAt: created, deletedAt: null };

  return [
    {
      ...base,
      id: "task_sophie_proposal",
      title: "Send proposal to Sophie Laurent",
      dueAt: dueInDays(now, 0),
      priority: "high",
      ownerId: "user_jamie",
      done: false,
      doneAt: null,
      recordType: "contact",
      recordId: "contact_sophie",
    },
    {
      ...base,
      id: "task_atlas_notes",
      title: "Review Atlas onboarding notes",
      dueAt: dueInDays(now, 1),
      priority: "normal",
      ownerId: "user_jamie",
      done: false,
      doneAt: null,
      recordType: "company",
      recordId: "company_atlas",
    },
    {
      ...base,
      id: "task_roam_requirements",
      title: "Confirm Roam & Root requirements",
      dueAt: dueInDays(now, -1),
      priority: "normal",
      ownerId: "user_alex",
      done: true,
      doneAt: ago(now, 24 * 60),
      recordType: "contact",
      recordId: "contact_mila",
    },
    {
      ...base,
      id: "task_klarwerk_review",
      title: "Schedule Klarwerk finance review",
      dueAt: dueInDays(now, 4),
      priority: "normal",
      ownerId: "user_alex",
      done: false,
      doneAt: null,
      recordType: "company",
      recordId: "company_klarwerk",
    },
  ];
}

export function demoActivities(now: Date = new Date()): Activity[] {
  const activity = (
    id: string,
    minutesAgo: number,
    fields: Pick<Activity, "type" | "recordType" | "recordId" | "sourceModule" | "actorId" | "payload">,
  ): Activity => {
    const at = ago(now, minutesAgo);
    return {
      id,
      workspaceId: DEMO_WORKSPACE_ID,
      createdAt: at,
      updatedAt: at,
      deletedAt: null,
      occurredAt: at,
      ...fields,
    };
  };

  return [
    activity("activity_sophie_reply", 12, {
      type: "email",
      recordType: "contact",
      recordId: "contact_sophie",
      sourceModule: "email",
      actorId: null,
      payload: { event: "email.received" },
    }),
    activity("activity_daniel_call", 60, {
      type: "meeting",
      recordType: "contact",
      recordId: "contact_daniel",
      sourceModule: "calendar",
      actorId: null,
      payload: { event: "calendar.scheduled" },
    }),
    activity("activity_roam_task", 24 * 60, {
      type: "task",
      recordType: "contact",
      recordId: "contact_mila",
      sourceModule: "crm",
      actorId: "user_alex",
      payload: { taskId: "task_roam_requirements", action: "completed" },
    }),
    activity("activity_klarwerk_signal", 26 * 60, {
      type: "ai_signal",
      recordType: "contact",
      recordId: "contact_tobias",
      sourceModule: "crm",
      actorId: null,
      payload: { signal: "buying_intent" },
    }),
    activity("activity_sophie_created", 5 * 24 * 60, {
      type: "created",
      recordType: "contact",
      recordId: "contact_sophie",
      sourceModule: "crm",
      actorId: "user_jamie",
      payload: { source: "website_form" },
    }),
  ];
}
