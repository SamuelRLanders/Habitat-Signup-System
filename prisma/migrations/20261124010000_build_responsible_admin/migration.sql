-- The admin responsible for organizing each build.

-- AlterTable
ALTER TABLE "Shift" ADD COLUMN "responsibleId" TEXT;

-- CreateIndex
CREATE INDEX "Shift_responsibleId_idx" ON "Shift"("responsibleId");

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Existing builds: the admin who created the form, if they're an editor or
-- the owner, or else the owner.
UPDATE "Shift" AS s
SET "responsibleId" = f."createdById"
FROM "SignupForm" AS f
JOIN "User" AS u ON u.id = f."createdById"
WHERE s."formId" = f.id AND u.role IN ('OWNER', 'EDITOR');

UPDATE "Shift"
SET "responsibleId" = (SELECT id FROM "User" WHERE role = 'OWNER' LIMIT 1)
WHERE "responsibleId" IS NULL;
