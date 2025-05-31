#!/bin/bash
# services/user-management-service/test-fix.sh

echo "🔧 Testing FlyOS Data Persistence Fix"
echo "====================================="

# Step 1: Restart the service to apply changes
echo "1. 🔄 Restarting user management service..."
docker-compose restart user-management-service

# Wait for service to start
echo "   Waiting for service to initialize..."
sleep 10

# Step 2: Test Supabase connection
echo "2. 🔗 Testing Supabase connection..."
docker exec flyos-user-management-service-1 node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
supabase.from('profiles').select('count', { count: 'exact', head: true })
  .then(({ count, error }) => {
    if (error) throw error;
    console.log('✅ Supabase connected, profiles count:', count);
  })
  .catch(err => {
    console.log('❌ Supabase connection failed:', err.message);
  });
"

# Step 3: Check current data
echo "3. 📊 Checking current data..."
docker exec flyos-user-management-service-1 npm run verify-sync

# Step 4: Create test data via API
echo "4. 🧪 Creating test data..."

# Get a token first (you'll need to adjust this based on your auth)
echo "   Getting auth token..."
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"main@flyos.mil","password":"FlyOS2025!"}' | \
  grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to get auth token"
  exit 1
fi

echo "   ✅ Got auth token"

# Create test user
echo "   Creating test user..."
TEST_RESPONSE=$(curl -s -X POST http://localhost:4003/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "username": "test_persistence",
    "fullName": "Test Persistence User",
    "email": "test.persistence@flyos.mil",
    "password": "TestPass123!",
    "role": "OPERATOR"
  }')

echo "   Response: $TEST_RESPONSE"

# Step 5: Verify in Supabase
echo "5. 🔍 Verifying data in Supabase..."
docker exec flyos-user-management-service-1 node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
supabase.from('profiles').select('username').eq('username', 'test_persistence')
  .then(({ data, error }) => {
    if (error) throw error;
    if (data && data.length > 0) {
      console.log('✅ Test user found in Supabase!');
    } else {
      console.log('❌ Test user NOT found in Supabase');
    }
  })
  .catch(err => console.log('❌ Error checking Supabase:', err.message));
"

# Step 6: Restart and check persistence
echo "6. 🔄 Testing persistence across restart..."
docker-compose restart user-management-service
sleep 10

echo "   Checking if data persisted..."
docker exec flyos-user-management-service-1 node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.user.findFirst({ where: { username: 'test_persistence' } })
  .then(user => {
    if (user) {
      console.log('✅ Test user persisted across restart!');
      console.log('🎉 DATA PERSISTENCE IS WORKING!');
    } else {
      console.log('❌ Test user lost after restart');
      console.log('💥 DATA PERSISTENCE STILL BROKEN');
    }
    process.exit(0);
  })
  .catch(err => {
    console.log('❌ Error checking persistence:', err.message);
    process.exit(1);
  });
"

echo ""
echo "🏁 Test completed. Check the results above."