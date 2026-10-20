-- Segment colour is required (segmentColorSchema in packages/shared/src/segment.ts).
UPDATE "segments" SET "color" = 'violet' WHERE "color" IS NULL OR "color" NOT IN ('violet', 'coral', 'blue', 'mint', 'peach');
ALTER TABLE "segments" ALTER COLUMN "color" SET DEFAULT 'violet', ALTER COLUMN "color" SET NOT NULL;
