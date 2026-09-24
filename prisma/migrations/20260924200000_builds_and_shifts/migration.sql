-- CreateEnum
CREATE TYPE "BuildStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED', 'CANCELLED');

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_opportunityId_fkey";

-- DropForeignKey
ALTER TABLE "Opportunity" DROP CONSTRAINT "Opportunity_createdById_fkey";

-- DropForeignKey
ALTER TABLE "Signup" DROP CONSTRAINT "Signup_opportunityId_fkey";

-- DropIndex
DROP INDEX "Signup_opportunityId_volunteerId_key";

-- AlterTable
ALTER TABLE "Message" DROP COLUMN "opportunityId",
ADD COLUMN     "shiftId" TEXT;

-- AlterTable
ALTER TABLE "Signup" DROP COLUMN "opportunityId",
ADD COLUMN     "shiftId" TEXT NOT NULL;

-- DropTable
DROP TABLE "Opportunity";

-- DropEnum
DROP TYPE "OpportunityStatus";

-- CreateTable
CREATE TABLE "Build" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "description" TEXT,
    "timeZone" TEXT NOT NULL DEFAULT 'America/Indiana/Indianapolis',
    "status" "BuildStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "Build_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "notes" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "buildId" TEXT NOT NULL,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Build_status_idx" ON "Build"("status");

-- CreateIndex
CREATE INDEX "Shift_buildId_startsAt_idx" ON "Shift"("buildId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Signup_shiftId_volunteerId_key" ON "Signup"("shiftId", "volunteerId");

-- AddForeignKey
ALTER TABLE "Build" ADD CONSTRAINT "Build_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_buildId_fkey" FOREIGN KEY ("buildId") REFERENCES "Build"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signup" ADD CONSTRAINT "Signup_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Block Supabase Data API access to the new tables (see the enable_rls migration).
ALTER TABLE "Build" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Shift" ENABLE ROW LEVEL SECURITY;
