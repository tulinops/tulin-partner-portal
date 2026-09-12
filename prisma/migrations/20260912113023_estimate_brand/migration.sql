-- CreateEnum
CREATE TYPE "SolarBrand" AS ENUM ('WAAREE', 'LUMINOUS', 'MICROTEK', 'RENEW', 'VIKRAM', 'ADANI');

-- AlterTable
ALTER TABLE "Estimate" ADD COLUMN     "brand" "SolarBrand";
