-- Volunteers and their signups through signup forms, with the shifts each
-- volunteer said they could work.
-- CreateTable
CREATE TABLE "Volunteer" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "dateOfBirth" DATE NOT NULL,
    "tShirtSize" "TShirtSize" NOT NULL,
    "hasDriversLicense" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Volunteer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormSignup" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "dateOfBirth" DATE NOT NULL,
    "tShirtSize" "TShirtSize" NOT NULL,
    "hasDriversLicense" BOOLEAN NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "formId" TEXT NOT NULL,
    "volunteerId" TEXT NOT NULL,

    CONSTRAINT "FormSignup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftPreference" (
    "signupId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,

    CONSTRAINT "ShiftPreference_pkey" PRIMARY KEY ("signupId","shiftId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Volunteer_email_key" ON "Volunteer"("email");

-- CreateIndex
CREATE INDEX "FormSignup_volunteerId_idx" ON "FormSignup"("volunteerId");

-- CreateIndex
CREATE UNIQUE INDEX "FormSignup_formId_volunteerId_key" ON "FormSignup"("formId", "volunteerId");

-- CreateIndex
CREATE INDEX "ShiftPreference_shiftId_idx" ON "ShiftPreference"("shiftId");

-- AddForeignKey
ALTER TABLE "FormSignup" ADD CONSTRAINT "FormSignup_formId_fkey" FOREIGN KEY ("formId") REFERENCES "SignupForm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSignup" ADD CONSTRAINT "FormSignup_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "Volunteer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftPreference" ADD CONSTRAINT "ShiftPreference_signupId_fkey" FOREIGN KEY ("signupId") REFERENCES "FormSignup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftPreference" ADD CONSTRAINT "ShiftPreference_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Block the Supabase Data API, as on every other table.
ALTER TABLE "Volunteer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FormSignup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ShiftPreference" ENABLE ROW LEVEL SECURITY;
