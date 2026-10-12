-- Counting signup confirmations and cancellations emailed to each volunteer,
-- to limit how many one volunteer can set off.

-- CreateTable
CREATE TABLE "SignupEmail" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignupEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SignupEmail_email_createdAt_idx" ON "SignupEmail"("email", "createdAt");

-- Block the Supabase Data API, as on every other table.
ALTER TABLE "SignupEmail" ENABLE ROW LEVEL SECURITY;
