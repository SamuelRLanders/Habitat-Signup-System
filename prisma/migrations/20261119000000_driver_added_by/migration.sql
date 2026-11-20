-- Admins can add a volunteer to pending driver approval themselves. This
-- keeps the name of the admin who did, until the request is decided.

-- AlterTable
ALTER TABLE "Volunteer" ADD COLUMN     "driverAddedByName" TEXT;
