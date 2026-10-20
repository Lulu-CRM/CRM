-- ImportJob and ImportRow match the shared contract (packages/shared/src/import.ts).

-- Job status: uploaded, processing, done, failed ("mapped" folds into "uploaded", "completed" becomes "done").
ALTER TYPE "import_job_status" RENAME TO "import_job_status_old";
CREATE TYPE "import_job_status" AS ENUM ('uploaded', 'processing', 'done', 'failed');
ALTER TABLE "import_jobs" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "import_jobs" ALTER COLUMN "status" TYPE "import_job_status" USING (
  CASE "status"::text
    WHEN 'mapped' THEN 'uploaded'
    WHEN 'completed' THEN 'done'
    ELSE "status"::text
  END
)::"import_job_status";
ALTER TABLE "import_jobs" ALTER COLUMN "status" SET DEFAULT 'uploaded';
DROP TYPE "import_job_status_old";

ALTER TABLE "import_jobs"
  ADD COLUMN "columns" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "sampleRow" JSONB,
  ADD COLUMN "rowsUpdated" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "rowsSkipped" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "duplicateHandling" TEXT,
  ADD COLUMN "error" TEXT;
UPDATE "import_jobs" SET "mapping" = '{}'::jsonb WHERE "mapping" IS NULL;
ALTER TABLE "import_jobs" ALTER COLUMN "mapping" SET DEFAULT '{}'::jsonb, ALTER COLUMN "mapping" SET NOT NULL;

-- Row status gains pending (stored, not processed yet), updated and merged.
ALTER TYPE "import_row_status" ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE "import_row_status" ADD VALUE IF NOT EXISTS 'updated';
ALTER TYPE "import_row_status" ADD VALUE IF NOT EXISTS 'merged';
ALTER TABLE "import_rows"
  ADD COLUMN "contact" JSONB,
  ADD COLUMN "duplicateMatch" TEXT;
