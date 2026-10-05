-- Volunteers now sign up through signup forms without accounts, so the old
-- account-based signups, group links, volunteer profiles and the built-in
-- waiver are removed. Everything in them was test data. Only admins keep
-- user accounts, and message recipients are now volunteers.

-- Message recipients were a user or a group member; now they're volunteers.
-- No messages have been sent yet.
ALTER TABLE "MessageRecipient" DROP CONSTRAINT "MessageRecipient_one_recipient_check";
ALTER TABLE "MessageRecipient" DROP CONSTRAINT "MessageRecipient_groupMemberId_fkey";
ALTER TABLE "MessageRecipient" DROP CONSTRAINT "MessageRecipient_userId_fkey";
ALTER TABLE "MessageRecipient" DROP COLUMN "groupMemberId",
DROP COLUMN "userId",
ADD COLUMN     "volunteerId" TEXT NOT NULL;
CREATE INDEX "MessageRecipient_volunteerId_idx" ON "MessageRecipient"("volunteerId");
ALTER TABLE "MessageRecipient" ADD CONSTRAINT "MessageRecipient_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "Volunteer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Old signups, groups and waivers. (IF EXISTS: a first attempt at this
-- migration dropped the waiver tables before failing.)
DROP TABLE IF EXISTS "WaiverAcceptance";
DROP TABLE IF EXISTS "Waiver";
DROP TABLE "GroupMember";
DROP TABLE "Signup";
DROP TABLE "Registration";
DROP TABLE "VolunteerProfile";
DROP TYPE "SignupStatus";
DROP TYPE "Sex";

-- Volunteer accounts. Their sessions and sign-in methods go with them; builds
-- and forms they created keep the copied creator name.
DELETE FROM "User" WHERE "role" <> 'ADMIN';

-- Only admins have accounts now.
CREATE TYPE "Role_new" AS ENUM ('ADMIN');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
DROP TYPE "Role";
ALTER TYPE "Role_new" RENAME TO "Role";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'ADMIN';
