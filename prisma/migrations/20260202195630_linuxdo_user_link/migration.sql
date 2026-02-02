-- CreateTable
CREATE TABLE "linuxdo_user_links" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "linuxdoId" TEXT NOT NULL,
    "email" TEXT,
    "username" TEXT NOT NULL,
    "name" TEXT,
    "avatarTemplate" TEXT,
    "trustLevel" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL,
    "silenced" BOOLEAN NOT NULL,
    "raw" TEXT,
    "lastSyncedAt" DATETIME,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "linuxdo_user_links_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "linuxdo_user_links_linuxdoId_key" ON "linuxdo_user_links"("linuxdoId");
CREATE UNIQUE INDEX "linuxdo_user_links_userId_key" ON "linuxdo_user_links"("userId");
