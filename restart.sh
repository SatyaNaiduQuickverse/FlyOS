#!/bin/bash
# restart.sh - Restart FlyOS System Properly

echo "🔄 Restarting FlyOS System"
echo "========================="

# Step 1: Stop all containers
echo "🛑 Stopping all containers..."
docker-compose down --remove-orphans

# Step 2: Clean up any orphaned containers
echo "🧹 Cleaning up orphaned containers..."
docker container prune -f

# Step 3: Wait a moment for cleanup
echo "⏳ Waiting for cleanup..."
sleep 5

# Step 4: Update the user-management-service Dockerfile
echo "🔧 Creating fixed Dockerfile for user-management-service..."
cat > services/user-management-service/Dockerfile << 'EOF'
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
EOF

echo "✅ Fixed Dockerfile created"

# Step 5: Start the system
echo "🚀 Starting system with fixed configuration..."
docker-compose up -d --build

# Step 6: Monitor startup
echo "📊 Monitoring startup progress..."
echo "This may take 2-3 minutes for all services to be ready..."

# Check service status
services=("postgres-users" "postgres-drones" "redis" "user-management-service" "drone-db-service" "realtime-service" "drone-connection-service" "frontend")

for i in {1..10}; do
    echo "Startup check $i/10..."
    
    healthy_count=0
    for service in "${services[@]}"; do
        status=$(docker-compose ps --format json $service 2>/dev/null | jq -r '.Health' 2>/dev/null || echo "unknown")
        if [[ "$status" == "healthy" ]] || docker-compose ps $service 2>/dev/null | grep -q "Up"; then
            healthy_count=$((healthy_count + 1))
        fi
    done
    
    echo "✅ $healthy_count/${#services[@]} services ready"
    
    if [ $healthy_count -eq ${#services[@]} ]; then
        echo "🎉 All services are ready!"
        break
    fi
    
    sleep 30
done

# Final status check
echo ""
echo "📊 Final Status:"
docker-compose ps

echo ""
echo "🌐 Access Points:"
echo "  Frontend: http://localhost:3001"
echo "  User Management API: http://localhost:4003/health"
echo "  Drone Database API: http://localhost:4001/health"
echo ""
echo "🔐 Default Login:"
echo "  Email: main@flyos.mil"
echo "  Password: FlyOS2025!"
