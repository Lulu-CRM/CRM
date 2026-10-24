-- A person can belong to several companies (Dave, Oct 24, 2026). companyId stays the main one.
ALTER TABLE "contacts" ADD COLUMN "companyIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "contacts" SET "companyIds" = ARRAY["companyId"] WHERE "companyId" IS NOT NULL;

CREATE INDEX "contacts_companyIds_idx" ON "contacts" USING GIN ("companyIds");
