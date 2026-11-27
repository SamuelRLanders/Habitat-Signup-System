-- Spots editors reserve at a build for named volunteers.

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByName" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "signupId" TEXT,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_signupId_key" ON "Reservation"("signupId");

-- CreateIndex
CREATE INDEX "Reservation_shiftId_idx" ON "Reservation"("shiftId");

-- CreateIndex
CREATE INDEX "Reservation_email_idx" ON "Reservation"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_formId_email_key" ON "Reservation"("formId", "email");

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_formId_fkey" FOREIGN KEY ("formId") REFERENCES "SignupForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_signupId_fkey" FOREIGN KEY ("signupId") REFERENCES "FormSignup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Block the Supabase Data API, as on every table.
ALTER TABLE "Reservation" ENABLE ROW LEVEL SECURITY;
