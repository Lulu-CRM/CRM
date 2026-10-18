import { z } from "zod";
import { noteVisibilitySchema, type Note, type NoteCreateInput, type RecordType } from "@lulu/shared";

// The form works with plain strings. Messages are translation keys under notes.form.errors.
export const noteFormSchema = z.object({
  title: z.string().trim().min(1, "titleRequired").max(200, "titleTooLong"),
  body: z.string().max(10000, "bodyTooLong"),
  visibility: noteVisibilitySchema,
  // "" for no link, otherwise "<recordType>:<recordId>", for example "contact:contact_sophie".
  related: z.string(),
});

export type NoteFormValues = z.infer<typeof noteFormSchema>;

export function toFormValues(note: Note | null): NoteFormValues {
  return {
    title: note?.title ?? "",
    body: note?.body ?? "",
    visibility: note?.visibility ?? "shared",
    related: note?.recordType && note.recordId ? `${note.recordType}:${note.recordId}` : "",
  };
}

// Always sends both link fields, so clearing the link on edit unlinks the note.
export function toNoteInput(values: NoteFormValues): NoteCreateInput & { recordType: RecordType | null; recordId: string | null } {
  const [recordType, recordId] = values.related ? values.related.split(":", 2) : [null, null];
  return {
    title: values.title.trim(),
    body: values.body.trim(),
    visibility: values.visibility,
    recordType: (recordType as RecordType | null) ?? null,
    recordId: recordId ?? null,
  };
}
