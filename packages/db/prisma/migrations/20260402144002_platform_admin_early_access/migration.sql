-- AlterTable
ALTER TABLE "early_access_members" ADD COLUMN     "adminNotes" TEXT,
ADD COLUMN     "internalStatus" TEXT NOT NULL DEFAULT 'new',
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedBy" TEXT;

-- CreateIndex
CREATE INDEX "early_access_members_internalStatus_idx" ON "early_access_members"("internalStatus");
