-- AI notes are written by the AI, not typed (Dave, Oct 24, 2026): a JSON list of AI texts plus when they were
-- written. Any text people already typed is kept as one plain-text line.
ALTER TABLE "companies" ALTER COLUMN "aiNotes" TYPE JSONB USING (
  CASE WHEN "aiNotes" IS NULL OR btrim("aiNotes") = '' THEN NULL
    ELSE jsonb_build_array(jsonb_build_object('text', "aiNotes", 'language', 'en')) END
);
ALTER TABLE "companies" ADD COLUMN "aiNotesUpdatedAt" TIMESTAMP(3);
