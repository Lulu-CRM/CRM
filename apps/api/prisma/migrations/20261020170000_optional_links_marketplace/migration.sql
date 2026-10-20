-- Task 5: notes may stand alone and an unlinked task logs an activity without a record (packages/shared
-- note.ts, activity.ts), and Marketplace events (POST /events) get their own activity type.
ALTER TYPE "activity_type" ADD VALUE 'marketplace';

ALTER TABLE "notes" ALTER COLUMN "recordType" DROP NOT NULL,
ALTER COLUMN "recordId" DROP NOT NULL;

ALTER TABLE "activities" ALTER COLUMN "recordType" DROP NOT NULL,
ALTER COLUMN "recordId" DROP NOT NULL;
