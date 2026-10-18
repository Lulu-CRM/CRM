import { describe, expect, it } from "vitest";
import { demoNotes } from "./fixtures/notes";
import { noteCreateSchema, noteListQuerySchema, noteSchema, noteUpdateSchema, type Note } from "./note";
import { canSeeNote, filterNotes } from "./note-logic";

const NOW = new Date("2026-10-17T10:00:00.000Z");
const notes = demoNotes(NOW);
const note = (overrides: Partial<Note>): Note => ({ ...notes[0], ...overrides });

describe("note fixtures", () => {
  it("match the schema", () => {
    for (const n of notes) expect(() => noteSchema.parse(n)).not.toThrow();
  });
});

describe("noteCreateSchema", () => {
  it("accepts a title alone", () => {
    expect(noteCreateSchema.parse({ title: "Call back" })).toEqual({ title: "Call back" });
  });

  it("rejects an empty title", () => {
    expect(noteCreateSchema.safeParse({ title: "  " }).success).toBe(false);
  });

  it("rejects a half link", () => {
    const result = noteCreateSchema.safeParse({ title: "x", recordType: "contact" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("RECORD_LINK_INCOMPLETE");
  });

  it("rejects an unknown visibility", () => {
    expect(noteCreateSchema.safeParse({ title: "x", visibility: "team" }).success).toBe(false);
  });
});

describe("noteUpdateSchema", () => {
  it("accepts a new link or removing it", () => {
    expect(noteUpdateSchema.safeParse({ recordType: "deal", recordId: "deal_atlas" }).success).toBe(true);
    expect(noteUpdateSchema.safeParse({ recordType: null, recordId: null }).success).toBe(true);
  });

  it("accepts edits that leave the link alone", () => {
    expect(noteUpdateSchema.safeParse({ title: "New title" }).success).toBe(true);
  });

  it("rejects sending only one half of the link", () => {
    expect(noteUpdateSchema.safeParse({ recordId: "deal_atlas" }).success).toBe(false);
    expect(noteUpdateSchema.safeParse({ recordType: "deal", recordId: null }).success).toBe(false);
  });
});

describe("noteListQuerySchema", () => {
  it("reads the filters from a query string", () => {
    expect(noteListQuerySchema.parse({ visibility: "private", page: "2" })).toMatchObject({ visibility: "private", page: 2 });
    expect(noteListQuerySchema.safeParse({ recordType: "lead" }).success).toBe(false);
  });
});

describe("canSeeNote", () => {
  it("shows shared notes to everyone and private notes only to their author", () => {
    expect(canSeeNote(note({ visibility: "shared", authorId: "user_alex" }), "user_jamie")).toBe(true);
    expect(canSeeNote(note({ visibility: "private", authorId: "user_alex" }), "user_jamie")).toBe(false);
    expect(canSeeNote(note({ visibility: "private", authorId: "user_alex" }), "user_alex")).toBe(true);
  });

  it("hides deleted notes", () => {
    expect(canSeeNote(note({ deletedAt: NOW.toISOString() }), "user_jamie")).toBe(false);
  });
});

describe("filterNotes", () => {
  it("leaves out other people's private notes and puts the latest first", () => {
    expect(filterNotes(notes, "user_jamie").map((n) => n.id)).toEqual(["note_northstar_criteria", "note_roam_context"]);
    expect(filterNotes(notes, "user_alex").map((n) => n.id)).toEqual([
      "note_northstar_criteria",
      "note_klarwerk_next_step",
      "note_roam_context",
    ]);
  });

  it("filters by visibility, linked record and text", () => {
    expect(filterNotes(notes, "user_alex", { visibility: "private" }).map((n) => n.id)).toEqual(["note_klarwerk_next_step"]);
    expect(filterNotes(notes, "user_alex", { visibility: "all" })).toHaveLength(3);
    expect(filterNotes(notes, "user_jamie", { recordType: "contact", recordId: "contact_mila" }).map((n) => n.id)).toEqual([
      "note_roam_context",
    ]);
    // Title or body, any case.
    expect(filterNotes(notes, "user_jamie", { q: "APPROVAL" }).map((n) => n.id)).toEqual(["note_northstar_criteria"]);
    expect(filterNotes(notes, "user_jamie", { q: "roam" }).map((n) => n.id)).toEqual(["note_roam_context"]);
    expect(filterNotes(notes, "user_jamie", { q: "finance" })).toEqual([]);
  });
});
