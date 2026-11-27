-- Confirmed assignments: no-shows, where each volunteer was planned to go,
-- and people admins added on the day.

-- AlterTable
ALTER TABLE "FormSignup" ADD COLUMN     "addedAt" TIMESTAMP(3),
ADD COLUMN     "addedByName" TEXT,
ADD COLUMN     "noShow" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "plannedShiftId" TEXT;

-- AlterTable
ALTER TABLE "SignupForm" ADD COLUMN     "attendanceConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "attendanceConfirmedByName" TEXT;

-- CreateIndex
CREATE INDEX "FormSignup_plannedShiftId_idx" ON "FormSignup"("plannedShiftId");

-- AddForeignKey
ALTER TABLE "FormSignup" ADD CONSTRAINT "FormSignup_plannedShiftId_fkey" FOREIGN KEY ("plannedShiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Events already saved count their saved placement as the planned one.
UPDATE "FormSignup" AS s
SET "plannedShiftId" = s."assignedShiftId"
FROM "SignupForm" AS f
WHERE s."formId" = f."id" AND f."placementSavedAt" IS NOT NULL;
