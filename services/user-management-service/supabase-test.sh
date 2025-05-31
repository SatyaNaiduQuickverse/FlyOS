#!/bin/bash
# supabase-test.sh - Direct Supabase Auth Test

echo "🔍 Testing Supabase Auth Direct Connection"
echo "=========================================="

# Create temporary test script
cat > temp_test.js << 'EOF'
const { createClient } = require('@supabase/supabase-js');

async function testSupabase() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('Testing Supabase connection...');
    
    // Test 1: List users
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) throw listError;
    console.log('✅ Can list users:', users.users.length);
    
    // Test 2: Create user
    const testEmail = `test${Date.now()}@test.com`;
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: 'test123',
      email_confirm: true
    });
    
    if (createError) {
      console.log('❌ Create user failed:', createError.message);
      process.exit(1);
    }
    
    console.log('✅ User created successfully:', newUser.user.id);
    
    // Test 3: Delete test user
    const { error: deleteError } = await supabase.auth.admin.deleteUser(newUser.user.id);
    if (deleteError) {
      console.log('⚠️  Delete failed:', deleteError.message);
    } else {
      console.log('✅ User deleted successfully');
    }
    
    console.log('🎉 All Supabase tests passed!');
    
  } catch (error) {
    console.log('❌ Supabase test failed:', error.message);
    process.exit(1);
  }
}

testSupabase();
EOF

# Copy test file to container and run
docker cp temp_test.js flyos-user-management-service-1:/app/
docker exec flyos-user-management-service-1 node /app/temp_test.js

# Cleanup
rm temp_test.js
docker exec flyos-user-management-service-1 rm /app/temp_test.js