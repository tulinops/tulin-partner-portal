-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'COMPLETE');

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT';
