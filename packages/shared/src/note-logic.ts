import type { Note, NoteVisibility } from "./note";

// Private notes are only for their author: the API leaves them out of lists for everyone else,
// and answers NOTE_NOT_FOUND when someone else asks for, edits or deletes one.
export function canSeeNote(note: Pick<Note, "visibility" | "authorId" | "deletedAt">, userId: string) {
  return !note.deletedAt && (note.visibility === "shared" || note.authorId === userId);
}

export type NoteFilter = {
  visibility?: NoteVisibility | "all";
  // Matches title and body, ignoring case.
  q?: string;
  recordType?: Note["recordType"];
  recordId?: string;
};

// The notes a user can see that match the filter, most recently edited first.
export function filterNotes(notes: Note[], userId: string, filter: NoteFilter = {}) {
  const q = filter.q?.trim().toLocaleLowerCase();
  return notes
    .filter(
      (note) =>
        canSeeNote(note, userId) &&
        (!filter.visibility || filter.visibility === "all" || note.visibility === filter.visibility) &&
        (!filter.recordType || note.recordType === filter.recordType) &&
        (!filter.recordId || note.recordId === filter.recordId) &&
        (!q || `${note.title}\n${note.body}`.toLocaleLowerCase().includes(q)),
    )
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
}
