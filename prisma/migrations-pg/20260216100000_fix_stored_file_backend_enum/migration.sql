-- Create missing enum type for storage backend markers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'StoredFileBackend'
      AND n.nspname = current_schema()
  ) THEN
    CREATE TYPE "StoredFileBackend" AS ENUM ('LOCAL', 'S3');
  END IF;
END $$;

-- Convert marker columns from TEXT to enum for PostgreSQL schema parity
ALTER TABLE "emails"
  ALTER COLUMN "rawStorageBackend" TYPE "StoredFileBackend"
  USING (
    CASE
      WHEN "rawStorageBackend" IS NULL THEN NULL
      WHEN UPPER("rawStorageBackend"::text) = 'LOCAL' THEN 'LOCAL'::"StoredFileBackend"
      WHEN UPPER("rawStorageBackend"::text) = 'S3' THEN 'S3'::"StoredFileBackend"
      ELSE NULL
    END
  );

ALTER TABLE "inbound_emails"
  ALTER COLUMN "rawStorageBackend" TYPE "StoredFileBackend"
  USING (
    CASE
      WHEN "rawStorageBackend" IS NULL THEN NULL
      WHEN UPPER("rawStorageBackend"::text) = 'LOCAL' THEN 'LOCAL'::"StoredFileBackend"
      WHEN UPPER("rawStorageBackend"::text) = 'S3' THEN 'S3'::"StoredFileBackend"
      ELSE NULL
    END
  );

ALTER TABLE "attachments"
  ALTER COLUMN "storageBackend" TYPE "StoredFileBackend"
  USING (
    CASE
      WHEN "storageBackend" IS NULL THEN NULL
      WHEN UPPER("storageBackend"::text) = 'LOCAL' THEN 'LOCAL'::"StoredFileBackend"
      WHEN UPPER("storageBackend"::text) = 'S3' THEN 'S3'::"StoredFileBackend"
      ELSE NULL
    END
  );
