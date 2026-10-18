import { z } from "zod";
import { baseRecordSchema, fractionSchema, idSchema } from "./common.js";

export const stageTypeSchema = z.enum(["open", "won", "lost"]);

// Default stages and pipelines carry a `key` so the UI shows a translated name (stages.<key>).
// Stages a workspace adds itself have `key: null`, and the UI shows `name` as the user typed it.
export const stageSchema = baseRecordSchema.extend({
  pipelineId: idSchema,
  key: z.string().min(1).nullable(),
  name: z.string().trim().min(1),
  order: z.number().int().min(0),
  probability: fractionSchema,
  type: stageTypeSchema,
});

export const pipelineSchema = baseRecordSchema.extend({
  key: z.string().min(1).nullable(),
  name: z.string().trim().min(1),
  isDefault: z.boolean(),
});

// GET /pipelines returns each pipeline with its stages.
export const pipelineWithStagesSchema = pipelineSchema.extend({
  stages: z.array(stageSchema),
});

export type StageType = z.infer<typeof stageTypeSchema>;
export type Stage = z.infer<typeof stageSchema>;
export type Pipeline = z.infer<typeof pipelineSchema>;
export type PipelineWithStages = z.infer<typeof pipelineWithStagesSchema>;
