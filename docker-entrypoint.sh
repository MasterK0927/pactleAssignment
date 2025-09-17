#!/usr/bin/env bash
set -euo pipefail

# Default values if not provided
: "${DB_HOST:=localhost}"
: "${DB_PORT:=5432}"
: "${DB_USER:=postgres}"
: "${DB_NAME:=pactle_db}"

echo "Waiting for PostgreSQL at ${DB_HOST}:${DB_PORT} (db=${DB_NAME}, user=${DB_USER})..."

# Wait for Postgres to be ready
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; do
  echo "Postgres is unavailable - sleeping"
  sleep 2
done

echo "Postgres is up! Running migrations and seeds..."

# Run migrations and seed (safe to re-run; migration system should be idempotent)
if npm run db:migrate; then
  echo "Migrations completed."
else
  echo "Migrations failed, but continuing to start app (will use in-memory fallback)." >&2
fi

if npm run db:seed; then
  echo "Seeding completed."
else
  echo "Seeding failed, but continuing to start app." >&2
fi

# Start the application
echo "Starting application..."
exec npm start
