-- Signup forms: one per build day. Sections move from builds to forms; the
-- old build sections were test data, so they are dropped.
-- CreateEnum
CREATE TYPE "FormStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- DropForeignKey
ALTER TABLE "BuildSection" DROP CONSTRAINT "BuildSection_buildId_fkey";

-- DropTable
DROP TABLE "BuildSection";

-- CreateTable
CREATE TABLE "SignupForm" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT,
    "status" "FormStatus" NOT NULL DEFAULT 'DRAFT',
    "opensAt" TIMESTAMP(3) NOT NULL,
    "closesAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "SignupForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormSection" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "formId" TEXT NOT NULL,

    CONSTRAINT "FormSection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SignupForm_date_key" ON "SignupForm"("date");

-- CreateIndex
CREATE INDEX "SignupForm_status_date_idx" ON "SignupForm"("status", "date");

-- CreateIndex
CREATE INDEX "FormSection_formId_position_idx" ON "FormSection"("formId", "position");

-- AddForeignKey
ALTER TABLE "SignupForm" ADD CONSTRAINT "SignupForm_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSection" ADD CONSTRAINT "FormSection_formId_fkey" FOREIGN KEY ("formId") REFERENCES "SignupForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Block the Supabase Data API, as on every other table.
ALTER TABLE "SignupForm" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FormSection" ENABLE ROW LEVEL SECURITY;
