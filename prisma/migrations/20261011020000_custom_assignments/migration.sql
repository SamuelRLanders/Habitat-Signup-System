-- Admins can move volunteers between builds once a form closes, saving
-- custom assignments in place of the app's placement.

-- AlterTable
ALTER TABLE "FormSignup" ADD COLUMN     "assignedShiftId" TEXT;

-- AlterTable
ALTER TABLE "SignupForm" ADD COLUMN     "assignmentsSavedAt" TIMESTAMP(3),
ADD COLUMN     "assignmentsSavedByName" TEXT;

-- CreateIndex
CREATE INDEX "FormSignup_assignedShiftId_idx" ON "FormSignup"("assignedShiftId");

-- AddForeignKey
ALTER TABLE "FormSignup" ADD CONSTRAINT "FormSignup_assignedShiftId_fkey" FOREIGN KEY ("assignedShiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
