-- Create FTS virtual table for Email textBody search
CREATE VIRTUAL TABLE "emails_fts" USING fts5(
  emailId UNINDEXED,
  textBody
);

-- Backfill existing emails
INSERT INTO "emails_fts"(emailId, textBody)
SELECT "id", COALESCE("textBody", '') FROM "emails";

-- Keep FTS table in sync
CREATE TRIGGER "emails_fts_insert" AFTER INSERT ON "emails" BEGIN
  INSERT INTO "emails_fts"(emailId, textBody)
  VALUES (new."id", COALESCE(new."textBody", ''));
END;

CREATE TRIGGER "emails_fts_delete" AFTER DELETE ON "emails" BEGIN
  DELETE FROM "emails_fts" WHERE emailId = old."id";
END;

CREATE TRIGGER "emails_fts_update" AFTER UPDATE OF "textBody" ON "emails" BEGIN
  DELETE FROM "emails_fts" WHERE emailId = old."id";
  INSERT INTO "emails_fts"(emailId, textBody)
  VALUES (new."id", COALESCE(new."textBody", ''));
END;

