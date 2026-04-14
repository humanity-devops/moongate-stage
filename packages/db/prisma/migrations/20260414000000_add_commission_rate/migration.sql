-- AlterTable: add commissionRate to Tenant (missing from previous migrations)
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "commissionRate" DECIMAL(5,4);

-- AlterTable: add commissionRate to Event (missing from previous migrations)
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "commissionRate" DECIMAL(5,4);
