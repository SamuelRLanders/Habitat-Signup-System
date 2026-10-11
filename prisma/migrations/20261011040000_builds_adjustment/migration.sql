-- Admins now edit how many builds a volunteer has done in total, not just
-- those before the app, so the column holds the difference between that
-- and the builds counted from their signups. It can be negative.

-- AlterTable
ALTER TABLE "Volunteer" RENAME COLUMN "priorBuilds" TO "buildsAdjustment";
