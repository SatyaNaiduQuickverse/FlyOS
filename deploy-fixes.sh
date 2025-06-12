#!/bin/bash
# Deploy all infrastructure fixes

echo "Deploying production fixes..."

# Rebuild containers with fixes
docker-compose build --no-cache frontend user-management-service realtime-service

# Apply database migrations if needed
docker-compose exec user-management-service npm run migrate:deploy

# Restart services in dependency order
docker-compose restart redis
docker-compose restart timescaledb postgres-users
docker-compose restart user-management-service
docker-compose restart drone-db-service  
docker-compose restart drone-connection-service
docker-compose restart realtime-service
docker-compose restart frontend

# Wait for services to be healthy
echo "Waiting for services to be healthy..."
sleep 30

# Verify deployment
curl -f http://localhost:3001/health && echo "✅ Frontend healthy"
curl -f http://localhost:4002/health && echo "✅ Realtime healthy" 
curl -f http://localhost:4005/health && echo "✅ Drone service healthy"
curl -f http://localhost:4003/health && echo "✅ User service healthy"

echo "🎉 Production fixes deployed successfully"
