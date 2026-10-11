-- A day can have several signup forms, each with a name to tell it apart,
-- and a form can be left off the home page (shared only by its link).
-- Existing forms are named "Purdue Habitat build day" and stay listed.

-- DropIndex
DROP INDEX "SignupForm_date_key";

-- AlterTable
ALTER TABLE "SignupForm" ADD COLUMN     "listed" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "name" TEXT NOT NULL DEFAULT 'Purdue Habitat build day';
ALTER TABLE "SignupForm" ALTER COLUMN "name" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "SignupForm_date_idx" ON "SignupForm"("date");
