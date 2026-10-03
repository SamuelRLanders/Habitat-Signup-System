-- Builds are now only seen by admins, so they're either active or
-- cancelled. Drafts, published and closed builds all become active.
CREATE TYPE "BuildStatus_new" AS ENUM ('ACTIVE', 'CANCELLED');

ALTER TABLE "Build" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Build" ALTER COLUMN "status" TYPE "BuildStatus_new"
  USING (CASE WHEN "status" = 'CANCELLED' THEN 'CANCELLED' ELSE 'ACTIVE' END)::"BuildStatus_new";
ALTER TABLE "Build" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

DROP TYPE "BuildStatus";
ALTER TYPE "BuildStatus_new" RENAME TO "BuildStatus";

-- Volunteers can no longer sign in, so end any sessions they still have.
DELETE FROM "Session"
WHERE "userId" IN (SELECT "id" FROM "User" WHERE "role" <> 'ADMIN');
