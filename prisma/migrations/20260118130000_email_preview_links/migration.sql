-- CreateTable
CREATE TABLE "email_preview_links" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAccessedAt" DATETIME,
    "emailId" TEXT NOT NULL,
    CONSTRAINT "email_preview_links_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "emails" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "email_preview_links_token_key" ON "email_preview_links"("token");

-- CreateIndex
CREATE UNIQUE INDEX "email_preview_links_emailId_key" ON "email_preview_links"("emailId");

-- CreateIndex
CREATE INDEX "email_preview_links_createdAt_idx" ON "email_preview_links"("createdAt");

