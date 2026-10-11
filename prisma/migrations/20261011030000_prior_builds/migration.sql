-- Builds each volunteer went on before the app, set by an admin, for
-- working out how experienced they are.

-- AlterTable
ALTER TABLE "Volunteer" ADD COLUMN     "priorBuilds" INTEGER NOT NULL DEFAULT 0;
