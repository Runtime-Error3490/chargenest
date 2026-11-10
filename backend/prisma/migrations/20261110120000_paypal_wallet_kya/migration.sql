-- CreateEnum
CREATE TYPE "FundingSource" AS ENUM ('wallet', 'paypal');

-- CreateEnum
CREATE TYPE "WalletTxType" AS ENUM ('topup', 'booking_hold', 'hold_release', 'host_credit', 'refund', 'withdrawal', 'damage_charge');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('draft', 'sent', 'paid', 'cancelled');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('pending', 'approved', 'denied', 'executed', 'failed', 'expired');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "wallet_balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "wallet_held" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "agents" ADD COLUMN     "autonomy_level" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "kya_verified_at" TIMESTAMP(3),
ADD COLUMN     "permissions" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "private_key_enc" TEXT,
ADD COLUMN     "spending_limit" DECIMAL(10,2) NOT NULL DEFAULT 5000;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "funding_source" "FundingSource" NOT NULL DEFAULT 'wallet';

-- AlterTable
ALTER TABLE "disputes" ADD COLUMN     "paypal_dispute_id" TEXT,
ADD COLUMN     "raised_by_agent_id" TEXT;

-- AlterTable
ALTER TABLE "audit_log" ADD COLUMN     "decision" TEXT,
ADD COLUMN     "kya_payload" JSONB,
ADD COLUMN     "kya_signature" TEXT;

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "WalletTxType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "balance_after" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "booking_id" TEXT,
    "paypal_order_id" TEXT,
    "paypal_ref" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "issuer_id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "paypal_invoice_id" TEXT,
    "paypal_invoice_url" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "reason" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMP(3),

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_approvals" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "args" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'pending',
    "result" JSONB,
    "error" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),

    CONSTRAINT "agent_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wallet_transactions_paypal_order_id_key" ON "wallet_transactions"("paypal_order_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_user_id_created_at_idx" ON "wallet_transactions"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_paypal_invoice_id_key" ON "invoices"("paypal_invoice_id");

-- CreateIndex
CREATE INDEX "agent_approvals_user_id_status_idx" ON "agent_approvals"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "disputes_paypal_dispute_id_key" ON "disputes"("paypal_dispute_id");

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_issuer_id_fkey" FOREIGN KEY ("issuer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_approvals" ADD CONSTRAINT "agent_approvals_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_approvals" ADD CONSTRAINT "agent_approvals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

