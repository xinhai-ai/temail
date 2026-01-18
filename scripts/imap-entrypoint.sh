#!/bin/sh
set -e

# Regenerate Prisma client based on DATABASE_URL (handles SQLite/PostgreSQL)
echo "Generating Prisma client..."
npx prisma generate

# Start the IMAP service
echo "Starting IMAP service..."
exec "$@"
