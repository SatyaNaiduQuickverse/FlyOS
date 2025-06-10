#!/bin/bash
# deep-drone-control-diagnostics.sh - Find PWM Control Token Issues

echo "🔍 DEEP DRONE CONTROL API DIAGNOSTICS"
echo "====================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Test configuration
DRONE_ID="drone-001"
TEST_DRONE_IDS=("drone-001" "drone-002" "drone-003")

# Step 1: Get authentication token
echo -e "\n${BLUE}🔐 STEP 1: Authentication${NC}"
echo "========================"

echo "Getting auth token from frontend login..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"main@flyos.mil","password":"FlyOS2025!"}')

echo "Login response (first 200 chars):"
echo "${LOGIN_RESPONSE:0:200}..."

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token' 2>/dev/null)

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Failed to get token${NC}"
  echo "Full login response:"
  echo "$LOGIN_RESPONSE" | jq '.' 2>/dev/null || echo "$LOGIN_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Token obtained: ${TOKEN:0:30}...${NC}"

# Step 2: Test direct service endpoints
echo -e "\n${BLUE}🏥 STEP 2: Service Health Checks${NC}"
echo "================================"

services=("frontend:3001" "user-management:4003" "drone-db:4001" "drone-connection:4005" "realtime:4002")

for service in "${services[@]}"; do
  name=$(echo "$service" | cut -d: -f1)
  port=$(echo "$service" | cut -d: -f2)
  
  echo -n "Testing $name ($port): "
  if curl -s --max-time 3 "http://localhost:$port/health" > /dev/null; then
    echo -e "${GREEN}✅ OK${NC}"
  else
    echo -e "${RED}❌ DOWN${NC}"
  fi
done

# Step 3: Test the exact PWM component API path
echo -e "\n${BLUE}🎮 STEP 3: PWM Component API Path Test${NC}"
echo "======================================"

echo "Testing the exact path that PWM component uses..."

# Test 1: Frontend proxy to drone command
echo -e "\n${CYAN}Test 3.1: Frontend proxy (/api/drones/{droneId}/command)${NC}"
for drone_id in "${TEST_DRONE_IDS[@]}"; do
  echo "Testing drone: $drone_id"
  
  # Test ARM command (what PWM component sends)
  ARM_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST \
    "http://localhost:3001/api/drones/$drone_id/command" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{
      "commandType": "arm",
      "parameters": {},
      "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"
    }')
  
  HTTP_CODE=$(echo "$ARM_RESPONSE" | tail -n1 | cut -d: -f2)
  RESPONSE_BODY=$(echo "$ARM_RESPONSE" | head -n -1)
  
  echo "  HTTP Code: $HTTP_CODE"
  echo "  Response: ${RESPONSE_BODY:0:100}..."
  
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    echo -e "  ${GREEN}✅ ARM command successful${NC}"
  else
    echo -e "  ${RED}❌ ARM command failed${NC}"
    echo "  Full response: $RESPONSE_BODY"
  fi
done

# Test 2: Direct drone-db-service
echo -e "\n${CYAN}Test 3.2: Direct drone-db-service${NC}"
DIRECT_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST \
  "http://localhost:4001/api/drones/$DRONE_ID/command" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "commandType": "disarm",
    "parameters": {},
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"
  }')

HTTP_CODE=$(echo "$DIRECT_RESPONSE" | tail -n1 | cut -d: -f2)
RESPONSE_BODY=$(echo "$DIRECT_RESPONSE" | head -n -1)

echo "Direct service HTTP Code: $HTTP_CODE"
echo "Direct service response: ${RESPONSE_BODY:0:100}..."

# Step 4: Test token validation
echo -e "\n${BLUE}🔑 STEP 4: Token Validation Test${NC}"
echo "==============================="

echo "Testing token with user info endpoint..."
USER_INFO_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  "http://localhost:3001/api/users" \
  -H "Authorization: Bearer $TOKEN")

HTTP_CODE=$(echo "$USER_INFO_RESPONSE" | tail -n1 | cut -d: -f2)
RESPONSE_BODY=$(echo "$USER_INFO_RESPONSE" | head -n -1)

echo "User info HTTP Code: $HTTP_CODE"
if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✅ Token is valid${NC}"
  USER_COUNT=$(echo "$RESPONSE_BODY" | jq '.totalCount // .users | length' 2>/dev/null)
  echo "User count returned: $USER_COUNT"
else
  echo -e "${RED}❌ Token validation failed${NC}"
  echo "Response: $RESPONSE_BODY"
fi

# Step 5: Test localStorage simulation (browser context)
echo -e "\n${BLUE}💾 STEP 5: Browser Storage Simulation${NC}"
echo "==================================="

echo "Testing how PWM component gets token from localStorage..."

# Check if token would be accessible via localStorage (simulate browser)
echo "Token length: ${#TOKEN}"
echo "Token starts with: ${TOKEN:0:10}..."
echo "Token format valid: $(echo "$TOKEN" | grep -E '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$' && echo 'YES' || echo 'NO')"

# Step 6: Test with different authorization formats
echo -e "\n${BLUE}🔧 STEP 6: Authorization Header Variations${NC}"
echo "========================================"

AUTH_VARIATIONS=(
  "Bearer $TOKEN"
  "bearer $TOKEN"
  "$TOKEN"
)

for i in "${!AUTH_VARIATIONS[@]}"; do
  auth_header="${AUTH_VARIATIONS[$i]}"
  echo "Testing variation $((i+1)): '$auth_header'"
  
  TEST_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
    "http://localhost:3001/api/drones/$DRONE_ID/command" \
    -H "Content-Type: application/json" \
    -H "Authorization: $auth_header" \
    -d '{"commandType": "stabilize", "parameters": {}}')
  
  HTTP_CODE=$(echo "$TEST_RESPONSE" | tail -n1 | cut -d: -f2)
  echo "  Result: HTTP $HTTP_CODE"
done

# Step 7: Simulate PWM component exact request
echo -e "\n${BLUE}🎯 STEP 7: PWM Component Exact Simulation${NC}"
echo "======================================"

echo "Simulating exact request that PWM component would make..."

# This is exactly what the PWM component does
PWM_REQUEST=$(cat << EOF
{
  "commandType": "arm",
  "parameters": {},
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)"
}
EOF
)

echo "Request payload:"
echo "$PWM_REQUEST" | jq '.'

PWM_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST \
  "http://localhost:3001/api/drones/$DRONE_ID/command" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "$PWM_REQUEST")

HTTP_CODE=$(echo "$PWM_RESPONSE" | tail -n1 | cut -d: -f2)
RESPONSE_BODY=$(echo "$PWM_RESPONSE" | head -n -1)

echo "PWM simulation HTTP Code: $HTTP_CODE"
echo "PWM simulation response:"
echo "$RESPONSE_BODY" | jq '.' 2>/dev/null || echo "$RESPONSE_BODY"

# Step 8: Check authentication middleware
echo -e "\n${BLUE}🛡️ STEP 8: Authentication Middleware Test${NC}"
echo "====================================="

echo "Testing authentication middleware responses..."

# Test with no auth header
NO_AUTH_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST \
  "http://localhost:3001/api/drones/$DRONE_ID/command" \
  -H "Content-Type: application/json" \
  -d '{"commandType": "test"}')

HTTP_CODE=$(echo "$NO_AUTH_RESPONSE" | tail -n1 | cut -d: -f2)
echo "No auth header: HTTP $HTTP_CODE"

# Test with invalid token
INVALID_AUTH_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST \
  "http://localhost:3001/api/drones/$DRONE_ID/command" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid_token_12345" \
  -d '{"commandType": "test"}')

HTTP_CODE=$(echo "$INVALID_AUTH_RESPONSE" | tail -n1 | cut -d: -f2)
echo "Invalid token: HTTP $HTTP_CODE"

# Step 9: Check service logs for authentication errors
echo -e "\n${BLUE}📋 STEP 9: Service Logs Analysis${NC}"
echo "=============================="

echo "Checking recent authentication errors in drone-db-service..."
docker-compose logs --tail=10 drone-db-service | grep -i "auth\|token\|unauthorized\|forbidden" || echo "No recent auth errors found"

echo -e "\nChecking recent errors in frontend..."
docker-compose logs --tail=10 frontend | grep -i "auth\|token\|error" || echo "No recent auth errors found"

# Step 10: Network connectivity test
echo -e "\n${BLUE}🌐 STEP 10: Network Connectivity${NC}"
echo "=============================="

echo "Testing internal service communication..."

# Test if frontend can reach drone-db-service internally
docker exec flyos-frontend-1 curl -s --max-time 3 "http://drone-db-service:4001/health" > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Frontend → drone-db-service communication OK${NC}"
else
  echo -e "${RED}❌ Frontend → drone-db-service communication FAILED${NC}"
fi

# Test if drone-db-service can reach Redis
docker exec flyos-drone-db-service-1 curl -s --max-time 3 "http://redis:6379" > /dev/null 2>&1
REDIS_RESULT=$?
if [ $REDIS_RESULT -eq 0 ] || [ $REDIS_RESULT -eq 52 ]; then  # 52 = empty reply (Redis responding)
  echo -e "${GREEN}✅ drone-db-service → Redis communication OK${NC}"
else
  echo -e "${RED}❌ drone-db-service → Redis communication FAILED${NC}"
fi

# Step 11: Final diagnosis
echo -e "\n${BLUE}🔬 STEP 11: DIAGNOSIS SUMMARY${NC}"
echo "=========================="

echo "Based on the tests above, the issue is likely one of:"
echo ""
echo "1. ${YELLOW}Token Issues:${NC}"
echo "   - PWM component not getting token from localStorage correctly"
echo "   - Token format/encoding problems"
echo "   - Token expiration"
echo ""
echo "2. ${YELLOW}API Routing Issues:${NC}"
echo "   - Frontend proxy not forwarding requests correctly"
echo "   - Docker network communication problems"
echo "   - CORS or middleware blocking requests"
echo ""
echo "3. ${YELLOW}Component Issues:${NC}"
echo "   - PWM component not using the correct droneId from URL"
echo "   - Authorization header not being set correctly"
echo "   - Request payload format issues"
echo ""

echo "📝 To fix the PWM component:"
echo "1. Check if useAuth().token is returning the correct token"
echo "2. Verify the droneId is being extracted correctly from useParams()"
echo "3. Ensure the API call includes proper error handling"
echo "4. Test the exact request format in the component"

# Create a test script for PWM component debugging
echo -e "\n${CYAN}Creating debug test for PWM component...${NC}"

cat > test_pwm_component.js << 'EOF'
// test_pwm_component.js - Test PWM component token access
console.log('Testing PWM component token access...');

// Simulate localStorage token
const mockToken = 'REPLACE_WITH_ACTUAL_TOKEN';
localStorage.setItem('token', mockToken);

// Test token retrieval
const retrievedToken = localStorage.getItem('token');
console.log('Token retrieved:', retrievedToken ? 'YES' : 'NO');
console.log('Token length:', retrievedToken?.length || 0);

// Test API call format
const testApiCall = async (droneId, command) => {
  try {
    const response = await fetch(`/api/drones/${droneId}/command`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${retrievedToken}`
      },
      body: JSON.stringify({
        commandType: command,
        parameters: {},
        timestamp: new Date().toISOString()
      })
    });
    
    console.log('API Response Status:', response.status);
    const data = await response.json();
    console.log('API Response Data:', data);
    
  } catch (error) {
    console.error('API Call Error:', error);
  }
};

// Test with drone-001
testApiCall('drone-001', 'arm');
EOF

echo "Created test_pwm_component.js - run this in browser console to debug"

echo -e "\n${GREEN}🎯 Diagnostic Complete!${NC}"
echo "Check the results above to identify the specific issue."