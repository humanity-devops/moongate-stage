-- CreateTable
CREATE TABLE "crowdfund_campaigns" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "entityName" TEXT NOT NULL,
    "entityDescription" TEXT,
    "entityWebsite" TEXT,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "goalAmount" DECIMAL(12,2) NOT NULL,
    "raisedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "deadline" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "wonAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crowdfund_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crowdfund_contributions" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "contributorName" TEXT NOT NULL,
    "contributorEmail" TEXT NOT NULL,
    "message" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crowdfund_contributions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crowdfund_campaigns_tenantId_idx" ON "crowdfund_campaigns"("tenantId");

-- CreateIndex
CREATE INDEX "crowdfund_campaigns_eventId_idx" ON "crowdfund_campaigns"("eventId");

-- CreateIndex
CREATE INDEX "crowdfund_campaigns_itemId_idx" ON "crowdfund_campaigns"("itemId");

-- CreateIndex
CREATE INDEX "crowdfund_campaigns_status_idx" ON "crowdfund_campaigns"("status");

-- CreateIndex
CREATE INDEX "crowdfund_contributions_campaignId_idx" ON "crowdfund_contributions"("campaignId");

-- AddForeignKey
ALTER TABLE "crowdfund_campaigns" ADD CONSTRAINT "crowdfund_campaigns_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crowdfund_campaigns" ADD CONSTRAINT "crowdfund_campaigns_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crowdfund_campaigns" ADD CONSTRAINT "crowdfund_campaigns_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "sponsor_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crowdfund_contributions" ADD CONSTRAINT "crowdfund_contributions_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "crowdfund_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
