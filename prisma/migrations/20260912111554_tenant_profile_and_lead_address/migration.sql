-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "address" TEXT;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "businessAddress" TEXT,
ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "gstin" TEXT;
