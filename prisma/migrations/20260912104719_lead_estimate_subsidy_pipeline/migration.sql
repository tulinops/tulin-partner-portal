-- CreateEnum
CREATE TYPE "EstimateStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SubsidyStatus" AS ENUM ('NOT_APPLIED', 'APPLIED', 'APPROVED', 'REJECTED', 'DISBURSED');

-- AlterEnum
-- Explicit value mapping (not a naive same-name cast) so any existing
-- Connection row using the old ConnectionStatus labels migrates safely
-- instead of failing to cast.
BEGIN;
CREATE TYPE "ConnectionStatus_new" AS ENUM ('SITE_INSPECTION_PENDING', 'SITE_INSPECTION_DONE', 'SUBSIDY_APPLIED', 'SUBSIDY_APPROVED', 'INSTALLATION_IN_PROGRESS', 'COMPLETED', 'CANCELLED');
ALTER TABLE "public"."Connection" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Connection" ALTER COLUMN "status" TYPE "ConnectionStatus_new" USING (
  CASE "status"::text
    WHEN 'PENDING_INSTALL' THEN 'SITE_INSPECTION_PENDING'
    WHEN 'IN_PROGRESS'     THEN 'INSTALLATION_IN_PROGRESS'
    WHEN 'INSTALLED'       THEN 'COMPLETED'
    WHEN 'CANCELLED'       THEN 'CANCELLED'
  END
)::"ConnectionStatus_new";
ALTER TYPE "ConnectionStatus" RENAME TO "ConnectionStatus_old";
ALTER TYPE "ConnectionStatus_new" RENAME TO "ConnectionStatus";
DROP TYPE "public"."ConnectionStatus_old";
ALTER TABLE "Connection" ALTER COLUMN "status" SET DEFAULT 'SITE_INSPECTION_PENDING';
COMMIT;

-- AlterTable
ALTER TABLE "Connection" ADD COLUMN     "docAddressProofVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "docBankPassbookVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "docElectricityBillVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "docIdProofVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "docOwnershipVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "documentNotes" TEXT,
ADD COLUMN     "siteInspectionDate" TIMESTAMP(3),
ADD COLUMN     "siteInspectionNotes" TEXT,
ADD COLUMN     "siteInspectorName" TEXT,
ADD COLUMN     "subsidyApplicationRefNo" TEXT,
ADD COLUMN     "subsidyAppliedAmount" DECIMAL(12,2),
ADD COLUMN     "subsidyAppliedAt" TIMESTAMP(3),
ADD COLUMN     "subsidyApprovedAmount" DECIMAL(12,2),
ADD COLUMN     "subsidyApprovedAt" TIMESTAMP(3),
ADD COLUMN     "subsidyDisbursedAt" TIMESTAMP(3),
ADD COLUMN     "subsidyScheme" TEXT DEFAULT 'PM Surya Ghar Muft Bijli Yojana',
ADD COLUMN     "subsidyStatus" "SubsidyStatus" NOT NULL DEFAULT 'NOT_APPLIED',
ADD COLUMN     "warrantyNotes" TEXT,
ADD COLUMN     "warrantyPeriodMonths" INTEGER,
ADD COLUMN     "warrantyStartDate" TIMESTAMP(3),
ALTER COLUMN "status" SET DEFAULT 'SITE_INSPECTION_PENDING';

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "email" TEXT,
ADD COLUMN     "requirementNotes" TEXT;

-- CreateTable
CREATE TABLE "Estimate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "estimateNumber" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "systemSizeKw" DECIMAL(6,2),
    "lineItems" JSONB NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "gstPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "gstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "subsidyEstimate" DECIMAL(12,2),
    "status" "EstimateStatus" NOT NULL DEFAULT 'DRAFT',
    "validUntil" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Estimate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Estimate_estimateNumber_key" ON "Estimate"("estimateNumber");

-- CreateIndex
CREATE INDEX "Estimate_tenantId_leadId_idx" ON "Estimate"("tenantId", "leadId");

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
