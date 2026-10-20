-- AiInsight matches the shared contract (packages/shared/src/ai.ts): AI text is JSON, plus the provider and the
-- changes an insight suggests. Existing text (none in the seed) is kept as { text, language: "en" }.
ALTER TABLE "ai_insights"
  ALTER COLUMN "summary" TYPE JSONB USING jsonb_build_object('text', "summary", 'language', 'en'),
  ALTER COLUMN "nextStep" TYPE JSONB USING jsonb_build_object(
    'title', jsonb_build_object('text', "nextStep", 'language', 'en'),
    'detail', jsonb_build_object('text', "nextStep", 'language', 'en')
  ),
  ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'simulated',
  ADD COLUMN "suggestedTask" JSONB,
  ADD COLUMN "suggestedStage" "lifecycle_stage";
