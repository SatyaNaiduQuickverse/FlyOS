#!/bin/bash
echo "🔍 WebSocket Debugging Information"
echo "================================="

echo "📋 Container Status:"
docker-compose ps

echo ""
echo "📋 Network Information:"
docker network ls | grep flyos

echo ""
echo "📋 Port Bindings:"
docker-compose port realtime-service 4002

echo ""
echo "📋 WebSocket Service Logs (last 50 lines):"
docker-compose logs --tail=50 realtime-service

echo ""
echo "📋 Environment Variables:"
docker-compose exec realtime-service env | grep -E "(PORT|REDIS|SUPABASE|CORS)"

echo ""
echo "📋 Redis Connection Test:"
docker-compose exec redis redis-cli ping

echo ""
echo "📋 Health Check:"
curl -v http://localhost:4002/health

echo ""
echo "📋 WebSocket Port Test:"
nc -zv localhost 4002
