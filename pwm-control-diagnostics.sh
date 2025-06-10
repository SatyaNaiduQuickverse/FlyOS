#!/bin/bash
# pwm-control-diagnostics.sh - Find PWM Control Issues

echo "🔍 PWM CONTROL DIAGNOSTICS"
echo "=========================="

# Get auth token
echo "1. Getting auth token..."
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"main@flyos.mil","password":"FlyOS2025!"}' | \
  jq -r '.token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Failed to get token"
  exit 1
fi

echo "✅ Token: ${TOKEN:0:20}..."

# Test the exact PWM ARM command
echo -e "\n2. Testing ARM command (PWM component path)..."
DRONE_ID="drone-001"

ARM_RESPONSE=$(curl -s -w "\nHTTP:%{http_code}" -X POST \
  "http://localhost:3001/api/drones/$DRONE_ID/command" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "commandType": "arm",
    "parameters": {},
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"
  }')

HTTP_CODE=$(echo "$ARM_RESPONSE" | tail -n1 | cut -d: -f2)
RESPONSE_BODY=$(echo "$ARM_RESPONSE" | head -n -1)

echo "HTTP Code: $HTTP_CODE"
echo "Response: $RESPONSE_BODY"

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ ARM command works via API"
else
  echo "❌ ARM command failed"
  echo "Full response: $RESPONSE_BODY"
fi

# Test direct drone-db-service
echo -e "\n3. Testing direct drone-db-service..."
DIRECT_RESPONSE=$(curl -s -w "\nHTTP:%{http_code}" -X POST \
  "http://localhost:4001/api/drones/$DRONE_ID/command" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "commandType": "disarm",
    "parameters": {}
  }')

HTTP_CODE=$(echo "$DIRECT_RESPONSE" | tail -n1 | cut -d: -f2)
echo "Direct service HTTP: $HTTP_CODE"

# Test token validation
echo -e "\n4. Testing token validation..."
USER_RESPONSE=$(curl -s -w "\nHTTP:%{http_code}" \
  "http://localhost:3001/api/users" \
  -H "Authorization: Bearer $TOKEN")

HTTP_CODE=$(echo "$USER_RESPONSE" | tail -n1 | cut -d: -f2)
echo "Token validation HTTP: $HTTP_CODE"

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Token is valid"
else
  echo "❌ Token validation failed"
fi

# Test without auth
echo -e "\n5. Testing without authorization..."
NO_AUTH_RESPONSE=$(curl -s -w "\nHTTP:%{http_code}" -X POST \
  "http://localhost:3001/api/drones/$DRONE_ID/command" \
  -H "Content-Type: application/json" \
  -d '{"commandType": "test"}')

HTTP_CODE=$(echo "$NO_AUTH_RESPONSE" | tail -n1 | cut -d: -f2)
echo "No auth HTTP: $HTTP_CODE (should be 401)"

# Check service logs
echo -e "\n6. Recent error logs..."
echo "Frontend logs:"
docker-compose logs --tail=5 frontend | grep -i error || echo "No errors"

echo "Drone-db-service logs:"
docker-compose logs --tail=5 drone-db-service | grep -i error || echo "No errors"

echo -e "\n📊 SUMMARY:"
echo "If ARM command works via API but fails in PWM component:"
echo "- Issue is likely in the React component's token access"
echo "- Check useAuth() hook token retrieval"
echo "- Verify localStorage token storage"
echo "- Check component authorization headers"