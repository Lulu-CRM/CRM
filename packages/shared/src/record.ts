import { z } from "zod";
import { idSchema } from "./common";

// "Linked record" on Task, Note and Activity (see docs/data-model.md).
export const recordTypeSchema = z.enum(["contact", "company", "deal"]);

export const recordLinkSchema = z.object({
  recordType: recordTypeSchema.nullable(),
  recordId: idSchema.nullable(),
});

export type RecordType = z.infer<typeof recordTypeSchema>;
export type RecordLink = z.infer<typeof recordLinkSchema>;
