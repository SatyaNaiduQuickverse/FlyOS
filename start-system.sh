#!/bin/bash
echo "🚀 Starting FlyOS System with WebSocket Support..."

# Stop any existing containers
echo "🛑 Stopping existing containers..."
docker-compose down

# Remove old images to force rebuild
echo "🗑️ Cleaning up old images..."
docker-compose rm -f
docker image prune -f

# Build and start services with enhanced logging
echo "🔨 Building and starting services..."
docker-compose up --build -d

# Wait for services to start
echo "⏳ Waiting for services to initialize..."
sleep 15

# Check service health
echo "🏥 Checking service health..."

echo "📊 Frontend status:"
curl -s http://localhost:3001 > /dev/null && echo "✅ Frontend: Running" || echo "❌ Frontend: Failed"

echo "📊 Database service status:"
curl -s http://localhost:4001/health > /dev/null && echo "✅ Database Service: Running" || echo "❌ Database Service: Failed"

echo "📊 WebSocket service status:"
curl -s http://localhost:4002/health > /dev/null && echo "✅ WebSocket Service: Running" || echo "❌ WebSocket Service: Failed"

echo "📊 Redis status:"
docker-compose exec redis redis-cli ping > /dev/null 2>&1 && echo "✅ Redis: Running" || echo "❌ Redis: Failed"

echo "📊 TimescaleDB status:"
docker-compose exec timescaledb pg_isready -U flyos_admin > /dev/null 2>&1 && echo "✅ TimescaleDB: Running" || echo "❌ TimescaleDB: Failed"

echo ""
echo "🎯 System URLs:"
echo "   Frontend: http://3.111.215.70:3001"
echo "   Database API: http://3.111.215.70:4001"
echo "   WebSocket: ws://3.111.215.70:4002"
echo ""
echo "📋 To view logs:"
echo "   docker-compose logs -f realtime-service"
echo "   docker-compose logs -f drone-db-service"
echo "   docker-compose logs -f frontend"
echo ""
echo "✅ System startup complete!"
