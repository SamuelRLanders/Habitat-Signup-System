-- Admin roles: the single ADMIN role becomes OWNER, EDITOR and VIEWER.
-- Every existing admin becomes an editor, except landers2@purdue.edu, who
-- becomes the owner. Also adds ownership transfers, and lets a Message
-- outlive the admin who sent it, as forms and driver decisions do.

-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('OWNER', 'EDITOR', 'VIEWER');
ALTER TABLE "public"."User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING (
  CASE WHEN lower("email") = 'landers2@purdue.edu' THEN 'OWNER' ELSE 'EDITOR' END
)::"Role_new";
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "public"."Role_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'VIEWER';
COMMIT;

-- Only one admin can be the owner.
-- CreateIndex
CREATE UNIQUE INDEX "User_one_owner" ON "User"("role") WHERE (role = 'OWNER');

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_sentById_fkey";

-- AlterTable
ALTER TABLE "Message" ALTER COLUMN "sentById" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "OwnershipTransfer" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,

    CONSTRAINT "OwnershipTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OwnershipTransfer_tokenHash_key" ON "OwnershipTransfer"("tokenHash");

-- CreateIndex
CREATE INDEX "OwnershipTransfer_fromId_idx" ON "OwnershipTransfer"("fromId");

-- CreateIndex
CREATE INDEX "OwnershipTransfer_toId_idx" ON "OwnershipTransfer"("toId");

-- AddForeignKey
ALTER TABLE "OwnershipTransfer" ADD CONSTRAINT "OwnershipTransfer_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnershipTransfer" ADD CONSTRAINT "OwnershipTransfer_toId_fkey" FOREIGN KEY ("toId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Block the Supabase Data API, as on every other table.
ALTER TABLE "OwnershipTransfer" ENABLE ROW LEVEL SECURITY;
