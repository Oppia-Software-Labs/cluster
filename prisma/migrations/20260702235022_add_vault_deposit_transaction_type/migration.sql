-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE 'vault_deposit';

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "network" TEXT NOT NULL DEFAULT 'mainnet';
