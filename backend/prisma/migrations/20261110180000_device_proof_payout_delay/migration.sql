-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "release_after" TIMESTAMP(3),
ADD COLUMN     "released_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "energy_kwh" DECIMAL(10,3),
ADD COLUMN     "outcome" TEXT,
ADD COLUMN     "proof_source" TEXT NOT NULL DEFAULT 'manual';

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "charger_id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "last_seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_events" (
    "id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "booking_id" TEXT,
    "type" TEXT NOT NULL,
    "counter" INTEGER NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "devices_charger_id_key" ON "devices"("charger_id");

-- CreateIndex
CREATE INDEX "device_events_booking_id_idx" ON "device_events"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "device_events_device_id_counter_key" ON "device_events"("device_id", "counter");

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_charger_id_fkey" FOREIGN KEY ("charger_id") REFERENCES "chargers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_events" ADD CONSTRAINT "device_events_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

