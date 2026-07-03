-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('payment', 'config', 'trade');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('pending', 'ready', 'submitted', 'failed');

-- CreateEnum
CREATE TYPE "ThresholdLevel" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('owner', 'admin', 'member');

-- CreateTable
CREATE TABLE "users" (
    "publicKey" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("publicKey")
);

-- CreateTable
CREATE TABLE "multisig_accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stellarAccountId" TEXT NOT NULL,
    "network" TEXT NOT NULL DEFAULT 'mainnet',
    "createdBy" TEXT NOT NULL,
    "low" INTEGER NOT NULL,
    "medium" INTEGER NOT NULL,
    "high" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "multisig_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_members" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,
    "role" "MemberRole" NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "xdr" TEXT NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'pending',
    "requiredThreshold" INTEGER NOT NULL,
    "proposedBy" TEXT NOT NULL,
    "memo" TEXT,
    "submittedHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signatures" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "signerPublicKey" TEXT NOT NULL,
    "signatureXdr" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "balance_snapshots" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "assetCode" TEXT NOT NULL,
    "assetIssuer" TEXT,
    "amount" DECIMAL(38,7) NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "balance_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "multisig_accounts_stellarAccountId_key" ON "multisig_accounts"("stellarAccountId");

-- CreateIndex
CREATE INDEX "multisig_accounts_createdBy_idx" ON "multisig_accounts"("createdBy");

-- CreateIndex
CREATE INDEX "account_members_publicKey_idx" ON "account_members"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "account_members_accountId_publicKey_key" ON "account_members"("accountId", "publicKey");

-- CreateIndex
CREATE INDEX "transactions_accountId_idx" ON "transactions"("accountId");

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "signatures_transactionId_signerPublicKey_key" ON "signatures"("transactionId", "signerPublicKey");

-- CreateIndex
CREATE INDEX "activity_logs_accountId_idx" ON "activity_logs"("accountId");

-- CreateIndex
CREATE INDEX "balance_snapshots_accountId_capturedAt_idx" ON "balance_snapshots"("accountId", "capturedAt");

-- AddForeignKey
ALTER TABLE "multisig_accounts" ADD CONSTRAINT "multisig_accounts_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("publicKey") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_members" ADD CONSTRAINT "account_members_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "multisig_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_members" ADD CONSTRAINT "account_members_publicKey_fkey" FOREIGN KEY ("publicKey") REFERENCES "users"("publicKey") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "multisig_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_proposedBy_fkey" FOREIGN KEY ("proposedBy") REFERENCES "users"("publicKey") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "multisig_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "balance_snapshots" ADD CONSTRAINT "balance_snapshots_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "multisig_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

