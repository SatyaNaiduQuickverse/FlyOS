#!/bin/bash
# test-user-login-flow.sh - Comprehensive User Creation & Authentication Test

echo "🧪 COMPREHENSIVE USER CREATION → LOGIN TEST"
echo "==========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration - USE EXISTING AUTH USER
TEST_EMAIL="cmd.mumbai@flyos.mil"
TEST_USERNAME="cmd_mumbai_profile"
TEST_PASSWORD="Mumbai2025!"

# Helper functions
success() { echo -e "${GREEN}✅ $1${NC}"; }
error() { echo -e "${RED}❌ $1${NC}"; }
warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
info() { echo -e "${BLUE}ℹ️  $1${NC}"; }

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

run_test() {
    local test_name="$1"
    local test_command="$2"
    
    echo -e "\n${BLUE}🔍 Testing: $test_name${NC}"
    
    if eval "$test_command"; then
        success "$test_name passed"
        ((TESTS_PASSED++))
        return 0
    else
        error "$test_name failed"
        ((TESTS_FAILED++))
        return 1
    fi
}

check_response_success() {
    local response="$1"
    echo "$response" | grep -q '"success"[[:space:]]*:[[:space:]]*true'
}

check_response_token() {
    local response="$1"
    echo "$response" | grep -q '"token"[[:space:]]*:[[:space:]]*"[^"]\+'
}

# Step 1: Service Health Check
echo -e "\n${BLUE}🏥 HEALTH CHECKS${NC}"
echo "==============="

run_test "Frontend Health" '
    HEALTH=$(curl -s -w "%{http_code}" http://localhost:3001/health -o /dev/null)
    [ "$HEALTH" = "200" ]
'

run_test "User Service Health" '
    HEALTH=$(curl -s -w "%{http_code}" http://localhost:4003/health -o /dev/null)
    [ "$HEALTH" = "200" ]
'

run_test "Supabase Connection" '
    docker exec flyos-user-management-service-1 node -e "
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        supabase.auth.admin.listUsers()
            .then(({ error }) => process.exit(error ? 1 : 0))
            .catch(() => process.exit(1));
    " > /dev/null 2>&1
'

# Step 2: Admin Authentication
echo -e "\n${BLUE}🔐 ADMIN AUTHENTICATION${NC}"
echo "======================="

run_test "Admin Login" '
    ADMIN_RESPONSE=$(curl -s -X POST http://localhost:3001/api/auth/login \
        -H "Content-Type: application/json" \
        -d '"'"'{"email":"cmd.mumbai@flyos.mil","password":"Mumbai2025!"}'"'"')
    
    check_response_success "$ADMIN_RESPONSE" && check_response_token "$ADMIN_RESPONSE"
'

if [ $? -eq 0 ]; then
    ADMIN_TOKEN=$(echo "$ADMIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    info "Admin token obtained: ${ADMIN_TOKEN:0:20}..."
else
    error "Cannot proceed without admin token"
    exit 1
fi

# Step 3: User Creation Process
echo -e "\n${BLUE}👤 USER CREATION PROCESS${NC}"
echo "========================"

info "Creating user: $TEST_USERNAME ($TEST_EMAIL)"

run_test "User Creation API Call" '
    CREATE_RESPONSE=$(curl -s -X POST http://localhost:3001/api/users \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -d '"'"'{
            "username": "'"$TEST_USERNAME"'",
            "fullName": "Test User",
            "email": "'"$TEST_EMAIL"'",
            "password": "'"$TEST_PASSWORD"'",
            "role": "REGIONAL_HQ"
        }'"'"')
    
    check_response_success "$CREATE_RESPONSE"
'

if [ $? -eq 0 ]; then
    USER_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    SUPABASE_USER_ID=$(echo "$CREATE_RESPONSE" | grep -o '"supabaseUserId":"[^"]*"' | cut -d'"' -f4)
    success "User created with ID: $USER_ID"
    if [ "$SUPABASE_USER_ID" != "null" ] && [ -n "$SUPABASE_USER_ID" ]; then
        success "Supabase Auth ID: $SUPABASE_USER_ID"
    else
        warning "No Supabase Auth ID - this will cause login failure"
    fi
else
    error "User creation failed"
    echo "Response: $CREATE_RESPONSE"
    exit 1
fi

# Step 4: Data Verification
echo -e "\n${BLUE}🔍 DATA VERIFICATION${NC}"
echo "==================="

run_test "Local Database Check" '
    docker exec flyos-user-management-service-1 node -e "
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        prisma.user.findFirst({ where: { email: '"'"'$TEST_EMAIL'"'"' } })
            .then(user => process.exit(user ? 0 : 1))
            .catch(() => process.exit(1));
    " > /dev/null 2>&1
'

run_test "Supabase Auth Check" '
    docker exec flyos-user-management-service-1 node -e "
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        supabase.auth.admin.listUsers()
            .then(({ data, error }) => {
                if (error) throw error;
                const user = data.users.find(u => u.email === '"'"'$TEST_EMAIL'"'"');
                process.exit(user ? 0 : 1);
            })
            .catch(() => process.exit(1));
    " > /dev/null 2>&1
'

run_test "Supabase Profiles Check" '
    docker exec flyos-user-management-service-1 node -e "
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        supabase.from('"'"'profiles'"'"').select('"'"'*'"'"').eq('"'"'email'"'"', '"'"'$TEST_EMAIL'"'"')
            .then(({ data, error }) => {
                if (error) throw error;
                process.exit(data && data.length > 0 ? 0 : 1);
            })
            .catch(() => process.exit(1));
    " > /dev/null 2>&1
'

# Step 5: Authentication Test
echo -e "\n${BLUE}🔑 AUTHENTICATION TEST${NC}"
echo "====================="

info "Waiting 3 seconds for sync completion..."
sleep 3

run_test "User Login" '
    LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3001/api/auth/login \
        -H "Content-Type: application/json" \
        -d '"'"'{"email":"'"$TEST_EMAIL"'","password":"'"$TEST_PASSWORD"'"}'"'"')
    
    check_response_success "$LOGIN_RESPONSE" && check_response_token "$LOGIN_RESPONSE"
'

if [ $? -eq 0 ]; then
    USER_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    success "User login successful"
    success "User token: ${USER_TOKEN:0:20}..."
    
    # Step 6: Authenticated API Test
    echo -e "\n${BLUE}🔐 AUTHENTICATED API TEST${NC}"
    echo "========================="
    
    run_test "Authenticated API Call" '
        API_RESPONSE=$(curl -s -X GET http://localhost:3001/api/users \
            -H "Authorization: Bearer $USER_TOKEN")
        
        check_response_success "$API_RESPONSE"
    '
else
    error "User login failed"
    echo "Response: $LOGIN_RESPONSE"
    
    # Debug information
    echo -e "\n${YELLOW}🔧 DEBUG INFORMATION${NC}"
    echo "==================="
    
    echo "Checking Supabase Auth user details..."
    docker exec flyos-user-management-service-1 node -e "
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        supabase.auth.admin.listUsers()
            .then(({ data, error }) => {
                if (error) throw error;
                const user = data.users.find(u => u.email === '$TEST_EMAIL');
                if (user) {
                    console.log('User found in Supabase Auth:');
                    console.log('- ID:', user.id);
                    console.log('- Email confirmed:', !!user.email_confirmed_at);
                    console.log('- Created at:', user.created_at);
                } else {
                    console.log('User NOT found in Supabase Auth');
                }
            })
            .catch(err => console.log('Error:', err.message));
    "
fi

# Step 7: Cleanup Test
echo -e "\n${BLUE}🧹 CLEANUP TEST${NC}"
echo "==============="

if [ -n "$USER_ID" ]; then
    run_test "User Deletion" '
        DELETE_RESPONSE=$(curl -s -X DELETE http://localhost:3001/api/users/$USER_ID \
            -H "Authorization: Bearer $ADMIN_TOKEN")
        
        check_response_success "$DELETE_RESPONSE"
    '
fi

# Final Results
echo -e "\n${BLUE}📊 TEST RESULTS${NC}"
echo "==============="

TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))
PASS_RATE=$((TESTS_PASSED * 100 / TOTAL_TESTS))

echo "Total Tests: $TOTAL_TESTS"
echo "Passed: $TESTS_PASSED"
echo "Failed: $TESTS_FAILED"
echo "Pass Rate: ${PASS_RATE}%"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}🎉 ALL TESTS PASSED!${NC}"
    echo -e "${GREEN}✅ User creation → login flow is working perfectly!${NC}"
    exit 0
else
    echo -e "\n${RED}❌ SOME TESTS FAILED${NC}"
    echo -e "${RED}Issues detected in the user creation → login flow${NC}"
    exit 1
fi