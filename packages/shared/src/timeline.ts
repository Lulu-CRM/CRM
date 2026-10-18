import { z } from "zod";
import { timestampSchema } from "./common";
import { activitySchema } from "./activity";
import { noteSchema } from "./note";
import { taskSchema } from "./task";

// GET /contacts/:id/timeline, newest first by `at`.
// `at` is the sort time for each kind:
//   activity -> occurredAt
//   note     -> createdAt
//   task     -> createdAt (open tasks only; a done task appears through its own activity)
export const timelineItemSchema = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("activity"), at: timestampSchema, activity: activitySchema }),
    z.object({ kind: z.literal("note"), at: timestampSchema, note: noteSchema }),
    z.object({ kind: z.literal("task"), at: timestampSchema, task: taskSchema }),
]);

export type TimelineItem = z.infer<typeof timelineItemSchema>;