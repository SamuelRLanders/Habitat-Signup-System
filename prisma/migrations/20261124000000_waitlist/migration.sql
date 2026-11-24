-- Waitlists for full builds: a form can let volunteers join them, and a
-- signup can be waiting rather than signed up.

-- AlterTable
ALTER TABLE "SignupForm" ADD COLUMN "waitlist" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "FormSignup" ADD COLUMN "waitlistedAt" TIMESTAMP(3);
