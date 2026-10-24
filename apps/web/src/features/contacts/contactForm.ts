import { z } from "zod";
import { lifecycleStageSchema, type Contact, type ContactCreateInput } from "@lulu/shared";

// The form works with plain strings. Messages are translation keys under contacts.form.errors.
export const contactFormSchema = z.object({
  name: z.string().trim().min(1, "nameRequired"),
  email: z.union([z.literal(""), z.email("emailInvalid")]),
  phone: z.string().trim(),
  jobRole: z.string().trim(),
  lifecycleStage: lifecycleStageSchema,
  source: z.string(),
  ownerId: z.string().min(1, "ownerRequired"),
  tags: z.string(),
});

export type ContactFormValues = z.infer<typeof contactFormSchema>;

export function toFormValues(contact: Contact | null, defaultOwnerId: string): ContactFormValues {
  return {
    name: contact?.name ?? "",
    email: contact?.email ?? "",
    phone: contact?.phone ?? "",
    jobRole: contact?.jobRole ?? "",
    lifecycleStage: contact?.lifecycleStage ?? "new",
    source: contact?.source ?? "",
    ownerId: contact?.ownerId ?? defaultOwnerId,
    tags: contact?.tags.join(", ") ?? "",
  };
}

// Empty fields become null, so clearing a field in edit mode clears it on the server too.
// No company: people are linked from the company form (Dave, Oct 24, 2026), so an edit keeps the links.
export function toContactInput(values: ContactFormValues): ContactCreateInput {
  const orNull = (value: string) => (value.trim() === "" ? null : value.trim());
  return {
    name: values.name.trim(),
    email: orNull(values.email),
    phone: orNull(values.phone),
    jobRole: orNull(values.jobRole),
    lifecycleStage: values.lifecycleStage,
    source: orNull(values.source),
    ownerId: values.ownerId,
    tags: [...new Set(values.tags.split(",").map((tag) => tag.trim()).filter(Boolean))],
  };
}

