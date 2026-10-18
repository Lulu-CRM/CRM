import { z } from "zod";
import { activitySchema } from "./activity.js";
import { contactSchema } from "./contact.js";
import { idSchema, moneySchema } from "./common.js";

// One row per open stage of the default pipeline, in pipeline order. The UI shows the stage
// name through the stage helpers and draws the bar from `value` relative to the largest one.
export const overviewStageSchema = z.object({
  stageId: idSchema,
  value: moneySchema,
  dealCount: z.number().int().min(0),
});

// The activity stream names the record it belongs to, so the UI does not need one call per row.
export const overviewActivitySchema = activitySchema.extend({
  recordName: z.string().nullable(),
});

// GET /overview
export const overviewSchema = z.object({
  contactCount: z.number().int().min(0),
  // Change in contact count against the same day last month, as a fraction (0.12 = +12%).
  // null when there were no contacts a month ago.
  contactChange: z.number().nullable(),
  openPipeline: moneySchema,
  weightedPipeline: moneySchema,
  activeDeals: z.number().int().min(0),
  // Open tasks that are overdue or due in the next 7 days, and how many of them are due today.
  followUpsDue: z.number().int().min(0),
  dueToday: z.number().int().min(0),
  // AI signal activities in the last 30 days, and how many came since the start of this week (Monday).
  aiSignals: z.number().int().min(0),
  aiSignalsThisWeek: z.number().int().min(0),
  pipelineByStage: z.array(overviewStageSchema),
  // The 4 contacts touched most recently, and the 5 newest activities.
  recentContacts: z.array(contactSchema),
  recentActivity: z.array(overviewActivitySchema),
});

export type OverviewStage = z.infer<typeof overviewStageSchema>;
export type OverviewActivity = z.infer<typeof overviewActivitySchema>;
export type Overview = z.infer<typeof overviewSchema>;
