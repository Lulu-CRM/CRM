// packages/shared/src/timeline.ts
import { z } from "zod";
import { timestampSchema } from "./common";
import { activitySchema } from "./activity";
import { noteSchema } from "./note";
import { taskSchema } from "./task";

// GET /contacts/:id/timeline. `at` is the time used to sort the entry.
export const timelineItemSchema = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("activity"), at: timestampSchema, activity: activitySchema }),
    z.object({ kind: z.literal("note"), at: timestampSchema, note: noteSchema }),
    z.object({ kind: z.literal("task"), at: timestampSchema, task: taskSchema }),
]);

export type TimelineItem = z.infer<typeof timelineItemSchema>;