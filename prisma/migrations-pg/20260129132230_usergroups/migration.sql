-- CreateEnum
CREATE TYPE "UserGroupDomainPolicy" AS ENUM ('ALL_PUBLIC', 'ALLOWLIST');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "userGroupId" TEXT;

-- CreateTable
CREATE TABLE "user_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "domainPolicy" "UserGroupDomainPolicy" NOT NULL DEFAULT 'ALL_PUBLIC',
    "maxMailboxes" INTEGER,
    "maxWorkflows" INTEGER,
    "telegramEnabled" BOOLEAN NOT NULL DEFAULT true,
    "workflowEnabled" BOOLEAN NOT NULL DEFAULT true,
    "openApiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_group_domains" (
    "userGroupId" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_group_domains_pkey" PRIMARY KEY ("userGroupId","domainId")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_groups_name_key" ON "user_groups"("name");

-- CreateIndex
CREATE INDEX "user_group_domains_domainId_idx" ON "user_group_domains"("domainId");

-- CreateIndex
CREATE INDEX "users_userGroupId_idx" ON "users"("userGroupId");

-- AddForeignKey
ALTER TABLE "user_group_domains" ADD CONSTRAINT "user_group_domains_userGroupId_fkey" FOREIGN KEY ("userGroupId") REFERENCES "user_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_group_domains" ADD CONSTRAINT "user_group_domains_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "domains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_userGroupId_fkey" FOREIGN KEY ("userGroupId") REFERENCES "user_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

