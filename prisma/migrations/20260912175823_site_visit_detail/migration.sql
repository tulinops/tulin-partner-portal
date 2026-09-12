/*
  Warnings:

  - You are about to drop the column `siteInspectionDate` on the `Connection` table. All the data in the column will be lost.
  - You are about to drop the column `siteInspectionNotes` on the `Connection` table. All the data in the column will be lost.
  - You are about to drop the column `siteInspectorName` on the `Connection` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "SiteVisitStatus" AS ENUM ('PENDING', 'ASSIGNED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'RESCHEDULE_REQUESTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SiteVisitResult" AS ENUM ('SUITABLE', 'SUITABLE_WITH_CONDITIONS', 'NOT_SUITABLE', 'REQUIRES_FURTHER_INSPECTION');

-- CreateEnum
CREATE TYPE "RoofType" AS ENUM ('RCC', 'TIN', 'TILED', 'OTHER');

-- CreateEnum
CREATE TYPE "RoofCondition" AS ENUM ('GOOD', 'NEEDS_REPAIR', 'POOR');

-- CreateEnum
CREATE TYPE "RoofAccess" AS ENUM ('EASY', 'LADDER_REQUIRED', 'DIFFICULT');

-- CreateEnum
CREATE TYPE "SitePhotoCategory" AS ENUM ('ROOF', 'METER', 'INSTALL_AREA', 'DB_PANEL', 'OTHER');

-- AlterTable
ALTER TABLE "Connection" DROP COLUMN "siteInspectionDate",
DROP COLUMN "siteInspectionNotes",
DROP COLUMN "siteInspectorName",
ADD COLUMN     "electricalConnectionDetails" TEXT,
ADD COLUMN     "meterInformation" TEXT,
ADD COLUMN     "orientation" TEXT,
ADD COLUMN     "otherSiteRequirements" TEXT,
ADD COLUMN     "roofAccess" "RoofAccess",
ADD COLUMN     "roofAreaSqft" DECIMAL(8,2),
ADD COLUMN     "roofCondition" "RoofCondition",
ADD COLUMN     "roofType" "RoofType",
ADD COLUMN     "shadowObstruction" TEXT,
ADD COLUMN     "siteVisitInstructions" TEXT,
ADD COLUMN     "siteVisitResult" "SiteVisitResult",
ADD COLUMN     "siteVisitScheduledAt" TIMESTAMP(3),
ADD COLUMN     "siteVisitStatus" "SiteVisitStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "siteVisitWorkerNotes" TEXT;

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

-- CreateIndex
CREATE INDEX "SitePhoto_tenantId_connectionId_idx" ON "SitePhoto"("tenantId", "connectionId");

-- AddForeignKey
ALTER TABLE "SitePhoto" ADD CONSTRAINT "SitePhoto_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitePhoto" ADD CONSTRAINT "SitePhoto_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
