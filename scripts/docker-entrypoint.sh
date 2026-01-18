#!/bin/sh
set -e

# Regenerate Prisma client based on DATABASE_URL (handles SQLite/PostgreSQL)
echo "Generating Prisma client..."
npx prisma generate

# Run database migrations
echo "Running database migrations..."
npx prisma migrate deploy

# Bootstrap admin user if configured
echo "Running bootstrap admin..."
node scripts/bootstrap-admin.js

# Start the application
echo "Starting application..."
exec "$@"
