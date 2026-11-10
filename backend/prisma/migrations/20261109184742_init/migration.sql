-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('driver', 'host', 'admin');

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('active', 'revoked', 'suspended');

-- CreateEnum
CREATE TYPE "MandateStatus" AS ENUM ('active', 'used', 'expired', 'revoked');

-- CreateEnum
CREATE TYPE "ConnectorType" AS ENUM ('Type2', 'CCS2', 'CHAdeMO', 'Type1', 'GBT');

-- CreateEnum
CREATE TYPE "KwTier" AS ENUM ('3.3kW', '7.4kW', '11kW', '22kW', '50kW', '150kW');

-- CreateEnum
CREATE TYPE "ChargerStatus" AS ENUM ('active', 'inactive', 'maintenance');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('pending', 'authorized', 'in_progress', 'completed', 'cancelled', 'no_show', 'disputed');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('awaiting_start', 'driver_confirmed', 'host_confirmed', 'in_progress', 'ended', 'disputed');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'authorized', 'captured', 'partially_refunded', 'refunded', 'voided', 'failed');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('open', 'ai_reviewed', 'pending_admin', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "DisputeDecision" AS ENUM ('release_to_host', 'partial_refund', 'full_refund');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "totp_secret" TEXT,
    "totp_enabled" BOOLEAN NOT NULL DEFAULT false,
    "avatar_url" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "paypal_email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Charging Concierge',
    "model" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "version" TEXT,
    "status" "AgentStatus" NOT NULL DEFAULT 'active',
    "public_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mandates" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "max_amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "max_distance_km" DECIMAL(5,2),
    "connector_types" "ConnectorType"[],
    "token" TEXT NOT NULL,
    "status" "MandateStatus" NOT NULL DEFAULT 'active',
    "amount_used" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "bookings_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "mandates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chargers" (
    "id" TEXT NOT NULL,
    "host_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT 'Bengaluru',
    "latitude" DECIMAL(10,8) NOT NULL,
    "longitude" DECIMAL(11,8) NOT NULL,
    "connector_type" "ConnectorType" NOT NULL,
    "kw_tier" "KwTier" NOT NULL,
    "amenities" JSONB NOT NULL DEFAULT '[]',
    "photos" TEXT[],
    "status" "ChargerStatus" NOT NULL DEFAULT 'active',
    "total_bookings" INTEGER NOT NULL DEFAULT 0,
    "avg_rating" DECIMAL(2,1) NOT NULL DEFAULT 0,
    "suggested_price" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chargers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_packages" (
    "id" TEXT NOT NULL,
    "charger_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "duration_min" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability" (
    "id" TEXT NOT NULL,
    "charger_id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "charger_id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "package_id" TEXT NOT NULL,
    "scheduled_start" TIMESTAMP(3) NOT NULL,
    "scheduled_end" TIMESTAMP(3) NOT NULL,
    "base_amount" DECIMAL(10,2) NOT NULL,
    "platform_fee" DECIMAL(10,2) NOT NULL,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "mandate_id" TEXT,
    "booked_by_agent" BOOLEAN NOT NULL DEFAULT false,
    "status" "BookingStatus" NOT NULL DEFAULT 'pending',
    "cancelled_at" TIMESTAMP(3),
    "cancellation_fee" DECIMAL(10,2),
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "driver_start_confirm" TIMESTAMP(3),
    "host_start_confirm" TIMESTAMP(3),
    "actual_start" TIMESTAMP(3),
    "actual_end" TIMESTAMP(3),
    "actual_duration_min" INTEGER,
    "driver_end_confirm" TIMESTAMP(3),
    "host_end_confirm" TIMESTAMP(3),
    "final_amount" DECIMAL(10,2),
    "status" "SessionStatus" NOT NULL DEFAULT 'awaiting_start',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "paypal_order_id" TEXT,
    "paypal_auth_id" TEXT,
    "paypal_capture_id" TEXT,
    "paypal_payout_id" TEXT,
    "authorized_amount" DECIMAL(10,2),
    "captured_amount" DECIMAL(10,2),
    "refunded_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "host_payout_amount" DECIMAL(10,2),
    "platform_fee_amount" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "mandate_id" TEXT,
    "authorized_at" TIMESTAMP(3),
    "captured_at" TIMESTAMP(3),
    "refunded_at" TIMESTAMP(3),
    "payout_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disputes" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "raised_by_id" TEXT NOT NULL,
    "raised_by_role" "UserRole" NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "evidence" JSONB,
    "ai_decision" "DisputeDecision",
    "ai_refund_amount" DECIMAL(10,2),
    "ai_reasoning" TEXT,
    "ai_confidence" DECIMAL(3,2),
    "ai_reviewed_at" TIMESTAMP(3),
    "final_decision" "DisputeDecision",
    "final_refund_amount" DECIMAL(10,2),
    "admin_notes" TEXT,
    "resolved_by_id" TEXT,
    "status" "DisputeStatus" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT,
    "mandate_id" TEXT,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "inputs" JSONB,
    "outputs" JSONB,
    "booking_id" TEXT,
    "paypal_order_id" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error_message" TEXT,
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_ratings" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "charger_id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "review_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "driver_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "host_ratings" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "host_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "review_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "host_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_key" ON "user_roles"("user_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_booking_id_key" ON "sessions"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_booking_id_key" ON "payments"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "disputes_booking_id_key" ON "disputes"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "driver_ratings_booking_id_key" ON "driver_ratings"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "host_ratings_booking_id_key" ON "host_ratings"("booking_id");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mandates" ADD CONSTRAINT "mandates_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mandates" ADD CONSTRAINT "mandates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chargers" ADD CONSTRAINT "chargers_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_packages" ADD CONSTRAINT "time_packages_charger_id_fkey" FOREIGN KEY ("charger_id") REFERENCES "chargers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability" ADD CONSTRAINT "availability_charger_id_fkey" FOREIGN KEY ("charger_id") REFERENCES "chargers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_charger_id_fkey" FOREIGN KEY ("charger_id") REFERENCES "chargers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "time_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_mandate_id_fkey" FOREIGN KEY ("mandate_id") REFERENCES "mandates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_mandate_id_fkey" FOREIGN KEY ("mandate_id") REFERENCES "mandates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_raised_by_id_fkey" FOREIGN KEY ("raised_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_mandate_id_fkey" FOREIGN KEY ("mandate_id") REFERENCES "mandates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_ratings" ADD CONSTRAINT "driver_ratings_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_ratings" ADD CONSTRAINT "driver_ratings_charger_id_fkey" FOREIGN KEY ("charger_id") REFERENCES "chargers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_ratings" ADD CONSTRAINT "driver_ratings_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "host_ratings" ADD CONSTRAINT "host_ratings_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "host_ratings" ADD CONSTRAINT "host_ratings_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "host_ratings" ADD CONSTRAINT "host_ratings_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
