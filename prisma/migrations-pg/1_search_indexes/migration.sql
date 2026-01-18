-- Enable pg_trgm extension for fast text search (including CJK)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN indexes for email search fields
CREATE INDEX CONCURRENTLY IF NOT EXISTS "emails_subject_trgm_idx" ON "emails" USING GIN ("subject" gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "emails_fromAddress_trgm_idx" ON "emails" USING GIN ("fromAddress" gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "emails_fromName_trgm_idx" ON "emails" USING GIN ("fromName" gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "emails_toAddress_trgm_idx" ON "emails" USING GIN ("toAddress" gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "emails_textBody_trgm_idx" ON "emails" USING GIN ("textBody" gin_trgm_ops);
