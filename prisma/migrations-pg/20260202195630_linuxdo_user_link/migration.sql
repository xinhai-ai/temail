-- CreateTable
CREATE TABLE "linuxdo_user_links" (
    "id" TEXT NOT NULL,
    "linuxdoId" TEXT NOT NULL,
    "email" TEXT,
    "username" TEXT NOT NULL,
    "name" TEXT,
    "avatarTemplate" TEXT,
    "trustLevel" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL,
    "silenced" BOOLEAN NOT NULL,
    "raw" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "linuxdo_user_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "linuxdo_user_links_linuxdoId_key" ON "linuxdo_user_links"("linuxdoId");
CREATE UNIQUE INDEX "linuxdo_user_links_userId_key" ON "linuxdo_user_links"("userId");

-- AddForeignKey
ALTER TABLE "linuxdo_user_links" ADD CONSTRAINT "linuxdo_user_links_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
