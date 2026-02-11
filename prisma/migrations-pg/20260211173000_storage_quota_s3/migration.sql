-- AlterTable
ALTER TABLE "user_groups" ADD COLUMN IF NOT EXISTS "maxStorageMb" INTEGER;

-- AlterTable
ALTER TABLE "user_groups" ADD COLUMN IF NOT EXISTS "maxStorageFiles" INTEGER;

-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "maxStorageMb" INTEGER;

-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "maxStorageFiles" INTEGER;

-- AlterTable
ALTER TABLE "emails" ADD COLUMN IF NOT EXISTS "storageBytes" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "emails" ADD COLUMN IF NOT EXISTS "storageFiles" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "emails" ADD COLUMN IF NOT EXISTS "storageTruncated" BOOLEAN NOT NULL DEFAULT false;
