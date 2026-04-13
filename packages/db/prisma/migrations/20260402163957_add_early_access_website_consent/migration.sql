-- AlterTable
ALTER TABLE "early_access_members" ADD COLUMN     "consentAt" TIMESTAMP(3),
ADD COLUMN     "consentVersion" TEXT,
ADD COLUMN     "websiteUrl" TEXT;
