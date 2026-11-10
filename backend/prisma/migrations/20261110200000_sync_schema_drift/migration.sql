-- Brings the migration history in line with schema.prisma.
-- These columns were added earlier with `prisma db push`, so a fresh database built
-- from migrations alone (e.g. the Docker/Render deploy) was missing them.
-- Every statement is idempotent: on databases that already have them it does nothing.

-- AlterEnum
ALTER TYPE "ChargerStatus" ADD VALUE IF NOT EXISTS 'blocked';

-- AlterTable
ALTER TABLE "chargers" ADD COLUMN IF NOT EXISTS "block_reason" TEXT,
ADD COLUMN IF NOT EXISTS "blocked_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "blocked_by" TEXT,
ADD COLUMN IF NOT EXISTS "is_blocked" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "privacy_accepted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "privacy_accepted_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "privacy_version" TEXT,
ADD COLUMN IF NOT EXISTS "terms_accepted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "terms_accepted_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "terms_version" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "chargers_host_id_name_address_key" ON "chargers"("host_id", "name", "address");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chargers_blocked_by_fkey') THEN
    ALTER TABLE "chargers" ADD CONSTRAINT "chargers_blocked_by_fkey"
      FOREIGN KEY ("blocked_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
