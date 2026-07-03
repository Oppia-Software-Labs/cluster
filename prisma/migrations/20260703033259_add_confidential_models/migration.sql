-- CreateEnum
CREATE TYPE "ConfidentialRegStatus" AS ENUM ('pending', 'registered');

-- CreateEnum
CREATE TYPE "ConfidentialOp" AS ENUM ('register', 'deposit', 'merge', 'transfer', 'withdraw');

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "confidentialOp" "ConfidentialOp";

-- CreateTable
CREATE TABLE "ConfidentialRegistration" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "tokenContract" TEXT NOT NULL,
    "auditorId" INTEGER NOT NULL,
    "status" "ConfidentialRegStatus" NOT NULL DEFAULT 'pending',
    "spendingPubKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfidentialRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfidentialWrapKey" (
    "id" TEXT NOT NULL,
    "userPublicKey" TEXT NOT NULL,
    "wrapPublicKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfidentialWrapKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfidentialKeyEnvelope" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "memberPublicKey" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfidentialKeyEnvelope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfidentialOpening" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfidentialOpening_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConfidentialRegistration_accountId_key" ON "ConfidentialRegistration"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "ConfidentialWrapKey_userPublicKey_key" ON "ConfidentialWrapKey"("userPublicKey");

-- CreateIndex
CREATE INDEX "ConfidentialKeyEnvelope_accountId_idx" ON "ConfidentialKeyEnvelope"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "ConfidentialKeyEnvelope_accountId_memberPublicKey_key" ON "ConfidentialKeyEnvelope"("accountId", "memberPublicKey");

-- CreateIndex
CREATE INDEX "ConfidentialOpening_accountId_idx" ON "ConfidentialOpening"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "ConfidentialOpening_accountId_eventKey_key" ON "ConfidentialOpening"("accountId", "eventKey");

-- AddForeignKey
ALTER TABLE "ConfidentialRegistration" ADD CONSTRAINT "ConfidentialRegistration_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "multisig_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfidentialWrapKey" ADD CONSTRAINT "ConfidentialWrapKey_userPublicKey_fkey" FOREIGN KEY ("userPublicKey") REFERENCES "users"("publicKey") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfidentialKeyEnvelope" ADD CONSTRAINT "ConfidentialKeyEnvelope_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "multisig_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfidentialOpening" ADD CONSTRAINT "ConfidentialOpening_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "multisig_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

