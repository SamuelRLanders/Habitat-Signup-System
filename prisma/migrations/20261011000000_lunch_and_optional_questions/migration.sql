-- What volunteers do for lunch at each build, and switches for a form's
-- optional questions (transportation, and friends to be placed with). Forms
-- already made keep asking both.

-- AlterTable
ALTER TABLE "Shift" ADD COLUMN     "lunch" TEXT;

-- AlterTable
ALTER TABLE "SignupForm" ADD COLUMN     "askGroups" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "askTransportation" BOOLEAN NOT NULL DEFAULT true;
