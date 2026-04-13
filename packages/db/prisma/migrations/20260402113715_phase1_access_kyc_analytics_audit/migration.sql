-- AlterTable
ALTER TABLE "crowdfund_campaigns" ADD COLUMN     "approvalStatus" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedBy" TEXT,
ADD COLUMN     "rejectionReason" TEXT;

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "accessMode" TEXT NOT NULL DEFAULT 'public';

-- CreateTable
CREATE TABLE "event_access_grants" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "grantType" TEXT NOT NULL,
    "email" TEXT,
    "token" TEXT,
    "usedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_access_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kyc_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_submissions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kycConfigId" TEXT NOT NULL,
    "bidId" TEXT,
    "orderId" TEXT,
    "contactId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "data" JSONB,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kyc_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "eventType" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "resourceId" TEXT,
    "resourceType" TEXT,
    "referrer" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "device" TEXT,
    "country" TEXT,
    "metadata" JSONB,
    "anonymizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "event_access_grants_token_key" ON "event_access_grants"("token");

-- CreateIndex
CREATE INDEX "event_access_grants_eventId_idx" ON "event_access_grants"("eventId");

-- CreateIndex
CREATE INDEX "event_access_grants_token_idx" ON "event_access_grants"("token");

-- CreateIndex
CREATE INDEX "event_access_grants_eventId_email_idx" ON "event_access_grants"("eventId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "kyc_configs_tenantId_key" ON "kyc_configs"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "kyc_submissions_bidId_key" ON "kyc_submissions"("bidId");

-- CreateIndex
CREATE UNIQUE INDEX "kyc_submissions_orderId_key" ON "kyc_submissions"("orderId");

-- CreateIndex
CREATE INDEX "kyc_submissions_tenantId_idx" ON "kyc_submissions"("tenantId");

-- CreateIndex
CREATE INDEX "kyc_submissions_status_idx" ON "kyc_submissions"("status");

-- CreateIndex
CREATE INDEX "analytics_events_tenantId_eventType_idx" ON "analytics_events"("tenantId", "eventType");

-- CreateIndex
CREATE INDEX "analytics_events_tenantId_createdAt_idx" ON "analytics_events"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "analytics_events_resourceId_resourceType_idx" ON "analytics_events"("resourceId", "resourceType");

-- CreateIndex
CREATE INDEX "analytics_events_createdAt_idx" ON "analytics_events"("createdAt");

-- AddForeignKey
ALTER TABLE "event_access_grants" ADD CONSTRAINT "event_access_grants_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_configs" ADD CONSTRAINT "kyc_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_submissions" ADD CONSTRAINT "kyc_submissions_kycConfigId_fkey" FOREIGN KEY ("kycConfigId") REFERENCES "kyc_configs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
