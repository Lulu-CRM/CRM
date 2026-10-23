-- Fields Dave asked for on the Add company form (Oct 23, 2026). All optional, so existing rows stay valid.
ALTER TABLE "companies"
  ADD COLUMN "leadStatus" "lifecycle_stage",
  ADD COLUMN "whatsapp" TEXT,
  ADD COLUMN "instagram" TEXT,
  ADD COLUMN "facebook" TEXT,
  ADD COLUMN "productService" TEXT,
  ADD COLUMN "aiNotes" TEXT;
