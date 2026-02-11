-- AlterTable
ALTER TABLE "user_groups" ADD COLUMN "maxStorageMb" INTEGER;

-- AlterTable
ALTER TABLE "user_groups" ADD COLUMN "maxStorageFiles" INTEGER;

-- AlterTable
ALTER TABLE "users" ADD COLUMN "maxStorageMb" INTEGER;

-- AlterTable
ALTER TABLE "users" ADD COLUMN "maxStorageFiles" INTEGER;

-- AlterTable
ALTER TABLE "emails" ADD COLUMN "storageBytes" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "emails" ADD COLUMN "storageFiles" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "emails" ADD COLUMN "storageTruncated" BOOLEAN NOT NULL DEFAULT false;
