#!/bin/bash
# complete-api-fix.sh - Fix API routing issues

echo "🔧 FIXING API ROUTE ISSUES"
echo "=========================="

# Step 1: Navigate to correct directory
cd ~/flyos

# Step 2: Remove old incorrect file
echo "1. Removing old incorrect API route..."
rm -f app/api/drone-telemetry/route.ts

# Step 3: Create correct directory structure (escape brackets for bash)
echo "2. Creating correct directory structure..."
mkdir -p app/api/drone-telemetry/\[droneId\]

# Step 4: Create the correct API route file
echo "3. Creating correct API route file..."
cat > app/api/drone-telemetry/\[droneId\]/route.ts << 'EOF'
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { droneId: string } }
) {
  try {
    const { droneId } = params;
    
    console.log(`Fetching telemetry for drone: ${droneId}`);
    
    // Fetch Redis data from drone-connection-service
    const response = await fetch(`http://drone-connection-service:4005/redis/${droneId}`, {
      headers: {
        'Content-Type': 'application/json'
      },
      cache: 'no-store' // Ensure fresh data
    });
    
    if (!response.ok) {
      console.log(`Drone service response not ok: ${response.status}`);
      return NextResponse.json({});
    }
    
    const data = await response.json();
    console.log(`Retrieved data for ${droneId}:`, data ? 'SUCCESS' : 'EMPTY');
    
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Error fetching drone telemetry:', error);
    return NextResponse.json({});
  }
}
EOF

# Step 5: Verify file structure
echo "4. Verifying file structure..."
ls -la app/api/drone-telemetry/\[droneId\]/

# Step 6: Restart frontend to load new routes
echo "5. Restarting frontend to load new API routes..."
docker-compose restart frontend

echo "6. Waiting for frontend to start..."
sleep 15

# Step 7: Test the connection chain
echo "7. Testing connection chain..."

echo "   a) Testing drone-connection-service directly..."
DIRECT_TEST=$(curl -s http://localhost:4005/redis/drone-001 | jq -r '.latitude // "null"')
echo "      Direct test result: $DIRECT_TEST"

echo "   b) Testing from inside frontend container..."
INTERNAL_TEST=$(docker-compose exec frontend curl -s http://drone-connection-service:4005/redis/drone-001 2>/dev/null | head -1)
echo "      Internal test result: ${INTERNAL_TEST:0:50}..."

echo "   c) Testing frontend API route..."
FRONTEND_TEST=$(curl -s http://localhost:3001/api/drone-telemetry/drone-001)
echo "      Frontend API result: ${FRONTEND_TEST:0:100}..."

# Step 8: Parse and display results
echo "8. Final test results..."
if [[ "$FRONTEND_TEST" == *"latitude"* ]]; then
    echo "   ✅ Frontend API working!"
    curl -s http://localhost:3001/api/drone-telemetry/drone-001 | jq '.latitude, .longitude, .percentage'
else
    echo "   ❌ Frontend API still not working"
    echo "   Checking frontend logs..."
    docker-compose logs frontend | tail -5
fi

echo ""
echo "🎯 API ROUTE FIX COMPLETED"
echo "If still having issues, the problem might be in Next.js route caching."
echo "Try: docker-compose restart frontend && sleep 15"
