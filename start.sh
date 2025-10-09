#!/bin/bash
# Startup script for deployment

# Set production environment
export NODE_ENV=production

# Use the PORT environment variable or default to 80 for autoscale deployment
export PORT=${PORT:-80}

# Generate Prisma client if needed
npx prisma generate

# Run database migrations if needed
npx prisma migrate deploy

# Start the server
npx ts-node src/server.ts