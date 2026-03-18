#!/bin/bash
set -e

echo "Starting Git Kata application..."

# Wait for database to be ready
echo "Waiting for database..."
max_attempts=30
attempt=0

# Parse DATABASE_URL to extract host and port
# Format: postgresql://user:pass@host:port/dbname
if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL is not set"
    exit 1
fi

DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:]*\):\([0-9]*\)/.*|\1|p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*@[^:]*:\([0-9]*\)/.*|\1|p')
DB_USER="${DB_USER:-postgres}"

if [ -z "$DB_HOST" ] || [ -z "$DB_PORT" ]; then
    echo "ERROR: Could not parse database host/port from DATABASE_URL"
    exit 1
fi

while [ $attempt -lt $max_attempts ]; do
    if pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" > /dev/null 2>&1; then
        echo "Database is ready!"
        break
    fi
    attempt=$((attempt + 1))
    echo "Attempt $attempt/$max_attempts: Database not ready, waiting..."
    sleep 2
done

if [ $attempt -eq $max_attempts ]; then
    echo "ERROR: Database did not become ready in time"
    exit 1
fi

# Run database migrations
echo "Running database migrations..."
npx prisma db push

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

# Scan exercises to index them
echo "Scanning exercises..."
if [ -f "scripts/scan-exercises.js" ]; then
    node scripts/scan-exercises.js
elif [ -f "scripts/scan-exercises.ts" ]; then
    npx tsx scripts/scan-exercises.ts
fi

# Start the application
if [ "$NODE_ENV" = "production" ]; then
    echo "Starting production server..."
    exec npm run start
else
    echo "Starting development server..."
    exec npm run dev
fi
