-- Volunteers asking to be placed with others on the same day.
-- CreateTable
CREATE TABLE "GroupRequest" (
    "signupId" TEXT NOT NULL,
    "email" TEXT NOT NULL,

    CONSTRAINT "GroupRequest_pkey" PRIMARY KEY ("signupId","email")
);

-- CreateIndex
CREATE INDEX "GroupRequest_email_idx" ON "GroupRequest"("email");

-- AddForeignKey
ALTER TABLE "GroupRequest" ADD CONSTRAINT "GroupRequest_signupId_fkey" FOREIGN KEY ("signupId") REFERENCES "FormSignup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Block the Supabase Data API, as on every other table.
ALTER TABLE "GroupRequest" ENABLE ROW LEVEL SECURITY;
