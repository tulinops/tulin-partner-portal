-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN     "brand" TEXT;

-- AlterTable
ALTER TABLE "StaffMember" ALTER COLUMN "updatedAt" DROP DEFAULT;
