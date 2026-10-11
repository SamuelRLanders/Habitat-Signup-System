-- Cancelling a build day's event, and counting emails sent each day.
-- AlterEnum
ALTER TYPE "FormStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "SignupForm" ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledByName" TEXT;

-- CreateTable
CREATE TABLE "EmailDay" (
    "day" DATE NOT NULL,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "warnedAt" TIMESTAMP(3),

    CONSTRAINT "EmailDay_pkey" PRIMARY KEY ("day")
);

-- Block the Supabase Data API, as on every other table.
ALTER TABLE "EmailDay" ENABLE ROW LEVEL SECURITY;
