import { z } from "zod";
import { baseRecordSchema, idSchema, timestampSchema } from "./common.js";
import { lifecycleStageSchema } from "./contact.js";

// AI analysis (docs/api.md, "AI analysis"). AI runs behind one provider interface (AiProvider below);
// a simulated provider answers until we have a model key. Nothing is saved until the user accepts.

// Text an AI wrote. The simulated provider gives a translation key and values (ai.generated.<key>),
// so it reads in every language; a real model writes plain text in the language it was asked for.
export const aiTextSchema = z.union([
  z.object({ key: z.string().min(1), params: z.record(z.string(), z.union([z.string(), z.number()])) }),
  z.object({ text: z.string().min(1), language: z.string().min(2) }),
]);

// Contact fields the data-quality check looks at.
export const qualityFieldSchema = z.enum(["email", "phone", "company", "jobRole", "source"]);

export const aiInsightStatusSchema = z.enum(["suggested", "accepted", "dismissed"]);

export const aiInsightSchema = baseRecordSchema.extend({
  contactId: idSchema,
  provider: z.enum(["simulated", "model"]),
  summary: aiTextSchema,
  nextStep: z.object({ title: aiTextSchema, detail: aiTextSchema }),
  // Changes the insight proposes. They are only saved when the user accepts them.
  suggestedTask: z.object({ title: aiTextSchema, dueAt: timestampSchema }).nullable(),
  suggestedStage: lifecycleStageSchema.nullable(),
  dataQualityScore: z.number().min(0).max(1),
  missingFields: z.array(qualityFieldSchema),
  status: aiInsightStatusSchema,
});

// POST /contacts/:id/ai-analysis: the job that will write the next insight.
export const aiRunSchema = z.object({
  jobId: idSchema,
  status: z.enum(["queued", "running", "done", "failed"]),
});

// POST /ai-insights/:id/accept. The user picks which suggested changes to save. The task title is sent
// as the user saw it (in their language), because a saved task is ordinary data, not a translation.
export const aiAcceptSchema = z.object({
  createTask: z.boolean(),
  taskTitle: z.string().trim().min(1).max(200).optional(),
  applyStage: z.boolean(),
}).refine((input) => !input.createTask || input.taskTitle !== undefined, {
  message: "TASK_TITLE_REQUIRED",
  path: ["taskTitle"],
});

export type AiText = z.infer<typeof aiTextSchema>;
export type QualityField = z.infer<typeof qualityFieldSchema>;
export type AiInsight = z.infer<typeof aiInsightSchema>;
export type AiRun = z.infer<typeof aiRunSchema>;
export type AiAcceptInput = z.infer<typeof aiAcceptSchema>;

/** What a provider returns. The API adds ids, status and timestamps. */
export type AiInsightContent = Pick<
  AiInsight,
  "provider" | "summary" | "nextStep" | "suggestedTask" | "suggestedStage" | "dataQualityScore" | "missingFields"
>;
