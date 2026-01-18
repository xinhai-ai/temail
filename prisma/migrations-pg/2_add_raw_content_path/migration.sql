-- Migration: add_raw_content_path
-- Description: Add rawContentPath field to Email and InboundEmail tables for file-based storage

ALTER TABLE "emails" ADD COLUMN IF NOT EXISTS "rawContentPath" TEXT;
ALTER TABLE "inbound_emails" ADD COLUMN IF NOT EXISTS "rawContentPath" TEXT;
