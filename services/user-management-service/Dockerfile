FROM node:18-alpine

WORKDIR /app

# Install OpenSSL for Prisma and curl for health checks
RUN apk add --no-cache openssl curl

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Create logs directory
RUN mkdir -p logs

# Create startup script that handles database connection properly
RUN cat > /app/start.sh << 'SCRIPT'
#!/bin/sh
echo "🚀 Starting User Management Service..."

# Wait for database to be ready
echo "⏳ Waiting for database connection..."
max_attempts=60
attempt=1

while [ $attempt -le $max_attempts ]; do
    echo "Database connection attempt $attempt/$max_attempts..."
    
    if npx prisma db push --accept-data-loss > /dev/null 2>&1; then
        echo "✅ Database connection successful!"
        break
    fi
    
    if [ $attempt -eq $max_attempts ]; then
        echo "❌ Database connection failed after $max_attempts attempts"
        exit 1
    fi
    
    echo "⏳ Database not ready, waiting 5 seconds..."
    sleep 5
    attempt=$((attempt + 1))
done

# Run database migrations
echo "📦 Running database migrations..."
npx prisma migrate deploy

# Start the application
echo "🎯 Starting application..."
exec npm start
SCRIPT

RUN chmod +x /app/start.sh

# Expose port
EXPOSE 4003

# Health check that doesn't depend on the database being ready immediately
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
  CMD curl -f http://localhost:4003/health || exit 1

# Use the startup script
CMD ["/app/start.sh"]
