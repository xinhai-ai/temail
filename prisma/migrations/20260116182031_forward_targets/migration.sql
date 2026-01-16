-- CreateTable
CREATE TABLE "forward_targets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "config" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "ruleId" TEXT NOT NULL,
    CONSTRAINT "forward_targets_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "forward_rules" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_forward_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "success" BOOLEAN NOT NULL,
    "message" TEXT,
    "responseCode" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ruleId" TEXT NOT NULL,
    "targetId" TEXT,
    CONSTRAINT "forward_logs_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "forward_rules" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "forward_logs_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "forward_targets" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_forward_logs" ("createdAt", "id", "message", "responseCode", "ruleId", "success") SELECT "createdAt", "id", "message", "responseCode", "ruleId", "success" FROM "forward_logs";
DROP TABLE "forward_logs";
ALTER TABLE "new_forward_logs" RENAME TO "forward_logs";
CREATE INDEX "forward_logs_ruleId_idx" ON "forward_logs"("ruleId");
CREATE INDEX "forward_logs_targetId_idx" ON "forward_logs"("targetId");
CREATE INDEX "forward_logs_createdAt_idx" ON "forward_logs"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "forward_targets_ruleId_idx" ON "forward_targets"("ruleId");

-- CreateIndex
CREATE INDEX "forward_targets_ruleId_type_idx" ON "forward_targets"("ruleId", "type");
