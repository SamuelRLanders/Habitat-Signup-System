-- CreateTable
CREATE TABLE "BuildSection" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "buildId" TEXT NOT NULL,

    CONSTRAINT "BuildSection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BuildSection_buildId_position_idx" ON "BuildSection"("buildId", "position");

-- AddForeignKey
ALTER TABLE "BuildSection" ADD CONSTRAINT "BuildSection_buildId_fkey" FOREIGN KEY ("buildId") REFERENCES "Build"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Block Supabase Data API access, like every other table.
ALTER TABLE "BuildSection" ENABLE ROW LEVEL SECURITY;
