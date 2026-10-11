-- Projects are removed: each build (Shift) now belongs to a signup form and
-- has its own name, address and description. Existing builds move to the
-- form for their day, taking their project's name and address, with the
-- build's notes and then the project's description as their description.
-- Builds of a cancelled project are cancelled. Builds on a day with no form
-- are deleted: nobody can have chosen them, since volunteers only choose
-- builds through a form.

-- AlterTable
ALTER TABLE "Shift" ADD COLUMN "formId" TEXT,
ADD COLUMN "name" TEXT,
ADD COLUMN "address" TEXT,
ADD COLUMN "description" TEXT;

-- Move each build to its form. Times are stored as UTC; a build's day is
-- the date it starts in its project's time zone.
UPDATE "Shift" SET
  "name" = "Build"."name",
  "address" = "Build"."address",
  "description" = NULLIF(CONCAT_WS(E'\n\n', NULLIF(TRIM("Shift"."notes"), ''), NULLIF(TRIM("Build"."description"), '')), ''),
  "cancelledAt" = CASE
    WHEN "Build"."status" = 'CANCELLED' THEN COALESCE("Shift"."cancelledAt", "Build"."updatedAt")
    ELSE "Shift"."cancelledAt"
  END,
  "formId" = (
    SELECT "SignupForm"."id" FROM "SignupForm"
    WHERE "SignupForm"."date" = (("Shift"."startsAt" AT TIME ZONE 'UTC') AT TIME ZONE "Build"."timeZone")::date
  )
FROM "Build"
WHERE "Build"."id" = "Shift"."buildId";

DELETE FROM "Shift" WHERE "formId" IS NULL;

-- DropForeignKey
ALTER TABLE "Shift" DROP CONSTRAINT "Shift_buildId_fkey";

-- DropIndex
DROP INDEX "Shift_buildId_startsAt_idx";

-- AlterTable
ALTER TABLE "Shift" DROP COLUMN "buildId",
DROP COLUMN "notes",
ALTER COLUMN "formId" SET NOT NULL,
ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "address" SET NOT NULL;

-- DropTable
DROP TABLE "Build";

-- DropEnum
DROP TYPE "BuildStatus";

-- CreateIndex
CREATE INDEX "Shift_formId_startsAt_idx" ON "Shift"("formId", "startsAt");

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_formId_fkey" FOREIGN KEY ("formId") REFERENCES "SignupForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
