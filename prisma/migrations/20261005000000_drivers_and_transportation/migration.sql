-- Driver approvals and how volunteers get to the build site.
-- CreateEnum
CREATE TYPE "Transportation" AS ENUM ('NEEDS_RIDE', 'OWN_WAY', 'CAN_DRIVE');

-- CreateEnum
CREATE TYPE "DriverDecision" AS ENUM ('APPROVED', 'DECLINED');

-- AlterTable
ALTER TABLE "FormSignup" ADD COLUMN     "carSeats" INTEGER,
ADD COLUMN     "transportation" "Transportation";

-- AlterTable
ALTER TABLE "Volunteer" ADD COLUMN     "carSeats" INTEGER,
ADD COLUMN     "driverRequestedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "DriverApproval" (
    "id" TEXT NOT NULL,
    "decision" "DriverDecision" NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedUntil" DATE,
    "revokedAt" TIMESTAMP(3),
    "revokedByName" TEXT,
    "decidedByName" TEXT NOT NULL,
    "decidedById" TEXT,
    "volunteerId" TEXT NOT NULL,

    CONSTRAINT "DriverApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DriverApproval_volunteerId_decidedAt_idx" ON "DriverApproval"("volunteerId", "decidedAt");

-- CreateIndex
CREATE INDEX "DriverApproval_decision_approvedUntil_idx" ON "DriverApproval"("decision", "approvedUntil");

-- AddForeignKey
ALTER TABLE "DriverApproval" ADD CONSTRAINT "DriverApproval_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverApproval" ADD CONSTRAINT "DriverApproval_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "Volunteer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Block the Supabase Data API, as on every other table.
ALTER TABLE "DriverApproval" ENABLE ROW LEVEL SECURITY;
