-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('NOT_UPLOADED', 'UPLOADED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'REUPLOAD_REQUIRED');

-- CreateEnum
CREATE TYPE "FinancingMethod" AS ENUM ('NOT_SELECTED', 'FULL_PAYMENT', 'LOAN');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('NOT_REQUIRED', 'APPLICATION_PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'DISBURSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "InstallationStatus" AS ENUM ('PENDING', 'SCHEDULED', 'TEAM_ASSIGNED', 'IN_PROGRESS', 'INSPECTION_PENDING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "EquipmentType" AS ENUM ('PANEL', 'INVERTER', 'MOUNTING_STRUCTURE', 'DC_CABLE', 'AC_CABLE', 'EARTHING_KIT', 'LIGHTNING_ARRESTOR', 'NET_METER', 'OTHER');

-- CreateEnum
CREATE TYPE "WarrantyType" AS ENUM ('PRODUCT', 'PERFORMANCE', 'WORKMANSHIP');

-- AlterTable
ALTER TABLE "Connection" DROP COLUMN "docAddressProofVerified",
DROP COLUMN "docBankPassbookVerified",
DROP COLUMN "docElectricityBillVerified",
DROP COLUMN "docIdProofVerified",
DROP COLUMN "docOwnershipVerified",
DROP COLUMN "documentNotes",
DROP COLUMN "electricalConnectionDetails",
DROP COLUMN "meterInformation",
DROP COLUMN "orientation",
DROP COLUMN "otherSiteRequirements",
DROP COLUMN "roofAccess",
DROP COLUMN "roofAreaSqft",
DROP COLUMN "roofCondition",
DROP COLUMN "roofType",
DROP COLUMN "shadowObstruction",
DROP COLUMN "warrantyNotes",
DROP COLUMN "warrantyPeriodMonths",
DROP COLUMN "warrantyStartDate",
ADD COLUMN     "financingMethod" "FinancingMethod" NOT NULL DEFAULT 'NOT_SELECTED',
ADD COLUMN     "installationNotes" TEXT,
ADD COLUMN     "installationSignedOffAt" TIMESTAMP(3),
ADD COLUMN     "installationSignedOffByName" TEXT,
ADD COLUMN     "installationStatus" "InstallationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "installedEquipment" JSONB,
ADD COLUMN     "siteInspectionDetails" JSONB;

-- DropEnum
DROP TYPE "RoofAccess";

-- DropEnum
DROP TYPE "RoofCondition";

-- DropEnum
DROP TYPE "RoofType";

-- CreateTable
CREATE TABLE "RequiredDocumentType" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequiredDocumentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectionDocument" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "requiredDocumentTypeId" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'NOT_UPLOADED',
    "filePath" TEXT,
    "originalName" TEXT,
    "uploadedAt" TIMESTAMP(3),
    "uploadedById" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConnectionDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanApplication" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "bankName" TEXT NOT NULL,
    "applicationNumber" TEXT,
    "loanAmount" DECIMAL(12,2) NOT NULL,
    "applicationDate" TIMESTAMP(3),
    "status" "LoanStatus" NOT NULL DEFAULT 'APPLICATION_PENDING',
    "sanctionedAt" TIMESTAMP(3),
    "sanctionedAmount" DECIMAL(12,2),
    "disbursedAmount" DECIMAL(12,2),
    "disbursedAt" TIMESTAMP(3),
    "paymentReceivedByProprietorAmount" DECIMAL(12,2),
    "paymentReceivedByProprietorAt" TIMESTAMP(3),
    "paymentReference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarrantyRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "equipmentType" "EquipmentType" NOT NULL,
    "productName" TEXT NOT NULL,
    "manufacturer" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "warrantyType" "WarrantyType" NOT NULL DEFAULT 'PRODUCT',
    "startDate" TIMESTAMP(3) NOT NULL,
    "periodMonths" INTEGER NOT NULL,
    "terms" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarrantyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RequiredDocumentType_tenantId_isActive_idx" ON "RequiredDocumentType"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "ConnectionDocument_tenantId_connectionId_idx" ON "ConnectionDocument"("tenantId", "connectionId");

-- CreateIndex
CREATE INDEX "ConnectionDocument_tenantId_requiredDocumentTypeId_idx" ON "ConnectionDocument"("tenantId", "requiredDocumentTypeId");

-- CreateIndex
CREATE INDEX "LoanApplication_tenantId_connectionId_idx" ON "LoanApplication"("tenantId", "connectionId");

-- CreateIndex
CREATE INDEX "WarrantyRecord_tenantId_connectionId_idx" ON "WarrantyRecord"("tenantId", "connectionId");

-- AddForeignKey
ALTER TABLE "RequiredDocumentType" ADD CONSTRAINT "RequiredDocumentType_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectionDocument" ADD CONSTRAINT "ConnectionDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectionDocument" ADD CONSTRAINT "ConnectionDocument_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectionDocument" ADD CONSTRAINT "ConnectionDocument_requiredDocumentTypeId_fkey" FOREIGN KEY ("requiredDocumentTypeId") REFERENCES "RequiredDocumentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectionDocument" ADD CONSTRAINT "ConnectionDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanApplication" ADD CONSTRAINT "LoanApplication_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanApplication" ADD CONSTRAINT "LoanApplication_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyRecord" ADD CONSTRAINT "WarrantyRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyRecord" ADD CONSTRAINT "WarrantyRecord_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

