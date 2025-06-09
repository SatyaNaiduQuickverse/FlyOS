#!/bin/bash
# get-auth-token.sh - Get valid auth token for testing

echo "🔐 Getting authentication token..."

# Get auth token using working credentials
echo "1. Getting auth token..."
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"main@flyos.mil","password":"FlyOS2025!"}' | \
  grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ Failed to get token. Trying alternative credentials..."
  
  # Try regional user
  AUTH_RESPONSE=$(curl -s -X POST "http://localhost:3001/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{
      "email": "east@flyos.mil", 
      "password": "password123"
    }')
  
  TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.token // empty')
fi

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ Could not get valid token"
  echo "Available users to try manually:"
  echo "- main@flyos.mil:password123 (MAIN_HQ)"
  echo "- east@flyos.mil:password123 (REGIONAL_HQ)" 
  echo "- op1@flyos.mil:password123 (OPERATOR)"
  exit 1
fi

echo "✅ Got token: ${TOKEN:0:20}..."
echo ""
echo "Testing command with valid token..."

# Test ARM command
ARM_RESPONSE=$(curl -s -X POST "http://localhost:3001/api/drones/drone-001/command" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "commandType": "arm",
    "parameters": {}
  }')

echo "ARM command response:"
echo "$ARM_RESPONSE" | jq '.'

if echo "$ARM_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
  echo "✅ Command system working!"
  
  # Monitor Redis for commands
  echo "Checking Redis for command..."
  timeout 3s docker exec flyos-redis-1 redis-cli MONITOR | grep "drone:.*:commands" || echo "No commands seen in Redis"
  
else
  echo "❌ Command failed"
fi