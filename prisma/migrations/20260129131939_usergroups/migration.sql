-- CreateTable
CREATE TABLE "user_groups" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "domainPolicy" TEXT NOT NULL DEFAULT 'ALL_PUBLIC',
    "maxMailboxes" INTEGER,
    "maxWorkflows" INTEGER,
    "telegramEnabled" BOOLEAN NOT NULL DEFAULT true,
    "workflowEnabled" BOOLEAN NOT NULL DEFAULT true,
    "openApiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "user_group_domains" (
    "userGroupId" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userGroupId", "domainId"),
    CONSTRAINT "user_group_domains_userGroupId_fkey" FOREIGN KEY ("userGroupId") REFERENCES "user_groups" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_group_domains_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "domains" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "avatar" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "emailVerified" DATETIME,
    "trashRetentionDays" INTEGER NOT NULL DEFAULT 30,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userGroupId" TEXT,
    CONSTRAINT "users_userGroupId_fkey" FOREIGN KEY ("userGroupId") REFERENCES "user_groups" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_users" ("avatar", "createdAt", "email", "emailVerified", "id", "isActive", "name", "password", "role", "trashRetentionDays", "updatedAt") SELECT "avatar", "createdAt", "email", "emailVerified", "id", "isActive", "name", "password", "role", "trashRetentionDays", "updatedAt" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_userGroupId_idx" ON "users"("userGroupId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "user_groups_name_key" ON "user_groups"("name");

-- CreateIndex
CREATE INDEX "user_group_domains_domainId_idx" ON "user_group_domains"("domainId");

