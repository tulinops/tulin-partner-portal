-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM ('SOLAR', 'GENERIC');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN');

-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('NEW', 'CONTACTED', 'SITE_VISIT', 'QUOTED', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('INSTAGRAM', 'FACEBOOK', 'WHATSAPP', 'REFERRAL', 'OTHER');

-- CreateEnum
CREATE TYPE "EstimateStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'LOCKED');

-- CreateEnum
CREATE TYPE "SolarBrand" AS ENUM ('WAAREE', 'LUMINOUS', 'MICROTEK', 'RENEW', 'VIKRAM', 'ADANI');

-- CreateEnum
CREATE TYPE "InventoryTxnType" AS ENUM ('PURCHASE', 'ALLOCATION', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('SITE_INSPECTION_PENDING', 'SITE_INSPECTION_DONE', 'SUBSIDY_APPLIED', 'SUBSIDY_APPROVED', 'INSTALLATION_IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubsidyStatus" AS ENUM ('NOT_APPLIED', 'APPLIED', 'APPROVED', 'REJECTED', 'DISBURSED');

-- CreateEnum
CREATE TYPE "SiteVisitStatus" AS ENUM ('PENDING', 'ASSIGNED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'RESCHEDULE_REQUESTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SiteVisitResult" AS ENUM ('SUITABLE', 'SUITABLE_WITH_CONDITIONS', 'NOT_SUITABLE', 'REQUIRES_FURTHER_INSPECTION');

-- CreateEnum
CREATE TYPE "SitePhotoCategory" AS ENUM ('ROOF', 'METER', 'INSTALL_AREA', 'DB_PANEL', 'OTHER');

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

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "businessType" "BusinessType" NOT NULL DEFAULT 'SOLAR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "businessAddress" TEXT,
    "gstin" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "tenantId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT,
    "requirementNotes" TEXT,
    "source" "LeadSource" NOT NULL DEFAULT 'OTHER',
    "stage" "LeadStage" NOT NULL DEFAULT 'NEW',
    "estimatedValue" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Estimate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "estimateNumber" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "systemSizeKw" DECIMAL(6,2),
    "brand" "SolarBrand",
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

-- CreateTable
CREATE TABLE "LeadNote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "followUpAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "supplier" TEXT,
    "runningStock" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryTransaction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "type" "InventoryTxnType" NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unitCost" DECIMAL(12,2),
    "supplier" TEXT,
    "connectionId" TEXT,
    "note" TEXT,
    "purchaseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Connection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT,
    "systemSizeKw" DECIMAL(6,2),
    "status" "ConnectionStatus" NOT NULL DEFAULT 'SITE_INSPECTION_PENDING',
    "installDate" TIMESTAMP(3),
    "assignedInstaller" TEXT,
    "staffMemberId" TEXT,
    "siteVisitStatus" "SiteVisitStatus" NOT NULL DEFAULT 'PENDING',
    "siteVisitScheduledAt" TIMESTAMP(3),
    "siteVisitInstructions" TEXT,
    "siteInspectionDetails" JSONB,
    "siteVisitResult" "SiteVisitResult",
    "siteVisitWorkerNotes" TEXT,
    "financingMethod" "FinancingMethod" NOT NULL DEFAULT 'NOT_SELECTED',
    "subsidyScheme" TEXT DEFAULT 'PM Surya Ghar Muft Bijli Yojana',
    "subsidyApplicationRefNo" TEXT,
    "subsidyAppliedAmount" DECIMAL(12,2),
    "subsidyApprovedAmount" DECIMAL(12,2),
    "subsidyStatus" "SubsidyStatus" NOT NULL DEFAULT 'NOT_APPLIED',
    "subsidyAppliedAt" TIMESTAMP(3),
    "subsidyApprovedAt" TIMESTAMP(3),
    "subsidyDisbursedAt" TIMESTAMP(3),
    "installationStatus" "InstallationStatus" NOT NULL DEFAULT 'PENDING',
    "installationNotes" TEXT,
    "installationSignedOffAt" TIMESTAMP(3),
    "installationSignedOffByName" TEXT,
    "installedEquipment" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Connection_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lineItems" JSONB NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "gstPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "gstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerPayment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "CustomerPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SitePhoto" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "category" "SitePhotoCategory" NOT NULL,
    "filePath" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SitePhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffMember" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT,

    CONSTRAINT "StaffMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE INDEX "Lead_tenantId_stage_idx" ON "Lead"("tenantId", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "Estimate_estimateNumber_key" ON "Estimate"("estimateNumber");

-- CreateIndex
CREATE INDEX "Estimate_tenantId_leadId_idx" ON "Estimate"("tenantId", "leadId");

-- CreateIndex
CREATE INDEX "LeadNote_tenantId_leadId_idx" ON "LeadNote"("tenantId", "leadId");

-- CreateIndex
CREATE INDEX "InventoryItem_tenantId_idx" ON "InventoryItem"("tenantId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_tenantId_inventoryItemId_idx" ON "InventoryTransaction"("tenantId", "inventoryItemId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_tenantId_connectionId_idx" ON "InventoryTransaction"("tenantId", "connectionId");

-- CreateIndex
CREATE UNIQUE INDEX "Connection_leadId_key" ON "Connection"("leadId");

-- CreateIndex
CREATE INDEX "Connection_tenantId_status_idx" ON "Connection"("tenantId", "status");

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

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_connectionId_key" ON "Invoice"("connectionId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_connectionId_idx" ON "Invoice"("tenantId", "connectionId");

-- CreateIndex
CREATE INDEX "CustomerPayment_tenantId_connectionId_idx" ON "CustomerPayment"("tenantId", "connectionId");

-- CreateIndex
CREATE INDEX "SitePhoto_tenantId_connectionId_idx" ON "SitePhoto"("tenantId", "connectionId");

-- CreateIndex
CREATE INDEX "StaffMember_tenantId_idx" ON "StaffMember"("tenantId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadNote" ADD CONSTRAINT "LeadNote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadNote" ADD CONSTRAINT "LeadNote_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Connection" ADD CONSTRAINT "Connection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Connection" ADD CONSTRAINT "Connection_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Connection" ADD CONSTRAINT "Connection_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPayment" ADD CONSTRAINT "CustomerPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPayment" ADD CONSTRAINT "CustomerPayment_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitePhoto" ADD CONSTRAINT "SitePhoto_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitePhoto" ADD CONSTRAINT "SitePhoto_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMember" ADD CONSTRAINT "StaffMember_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
