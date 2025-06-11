#!/bin/bash
# revert-changes.sh - Restore original state

echo "🔄 REVERTING ALL CHANGES"

# 1. Restore original websocket.ts
docker exec flyos-realtime-service-1 sh -c 'git checkout HEAD -- src/websocket.ts 2>/dev/null || echo "No git, manual restore needed"'

# 2. Remove temp files
docker exec flyos-realtime-service-1 rm -f src/enhanced-auth.ts temp_*.js /app/prod_auth_test.js

# 3. Remove test files
docker exec flyos-realtime-service-1 rm -f /app/ws_retest.js /app/websocket_camera_test.js /app/camera_flow_test.js /app/quick_ws_test.js
docker exec flyos-drone-connection-service-1 rm -f /app/create_test_data.js

# 4. Restore original frontend hook
git checkout HEAD -- lib/hooks/useCameraStream.ts 2>/dev/null || rm -f lib/hooks/useCameraStream-fix.ts

# 5. Rebuild services to original state
docker-compose build realtime-service
docker-compose restart realtime-service

# 6. Clean Redis test data
docker exec flyos-redis-1 redis-cli EVAL "
for i, name in ipairs(redis.call('KEYS', 'camera:*test*'))
do redis.call('DEL', name); end
return 'OK'
" 0

echo "✅ All changes reverted"