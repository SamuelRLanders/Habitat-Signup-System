-- Keep the creator's name on the build, so it survives the admin's account
-- being deleted. Existing builds take their creator's current name.
ALTER TABLE "Build" ADD COLUMN "createdByName" TEXT;
UPDATE "Build" SET "createdByName" = "User"."name" FROM "User" WHERE "User"."id" = "Build"."createdById";
UPDATE "Build" SET "createdByName" = '' WHERE "createdByName" IS NULL;
ALTER TABLE "Build" ALTER COLUMN "createdByName" SET NOT NULL;

-- Deleting the creator's account keeps the build.
ALTER TABLE "Build" DROP CONSTRAINT "Build_createdById_fkey";
ALTER TABLE "Build" ALTER COLUMN "createdById" DROP NOT NULL;
ALTER TABLE "Build" ADD CONSTRAINT "Build_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The group waiver link is now a join link.
ALTER TABLE "Registration" RENAME COLUMN "waiverToken" TO "joinToken";
ALTER INDEX "Registration_waiverToken_key" RENAME TO "Registration_joinToken_key";
