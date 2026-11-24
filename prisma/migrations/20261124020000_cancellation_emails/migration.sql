-- Whether a volunteer cancelling after a form closes emails admins.

-- AlterTable
ALTER TABLE "SignupForm" ADD COLUMN "cancellationEmails" BOOLEAN NOT NULL DEFAULT true;
