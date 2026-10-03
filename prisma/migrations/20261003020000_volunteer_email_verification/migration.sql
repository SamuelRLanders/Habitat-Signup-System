-- Codes and short sessions for volunteers confirming their email address.
-- CreateTable
CREATE TABLE "VolunteerCode" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VolunteerCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VolunteerSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VolunteerSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VolunteerCode_email_idx" ON "VolunteerCode"("email");

-- CreateIndex
CREATE UNIQUE INDEX "VolunteerSession_tokenHash_key" ON "VolunteerSession"("tokenHash");

-- CreateIndex
CREATE INDEX "VolunteerSession_expiresAt_idx" ON "VolunteerSession"("expiresAt");


-- Block the Supabase Data API, as on every other table.
ALTER TABLE "VolunteerCode" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VolunteerSession" ENABLE ROW LEVEL SECURITY;
