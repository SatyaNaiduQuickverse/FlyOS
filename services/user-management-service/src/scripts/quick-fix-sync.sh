#!/bin/bash
# services/user-management-service/scripts/quick-fix-sync.sh

echo "🔧 FlyOS User Sync Quick Fix"
echo "============================"
echo

# Function to run commands in Docker container
run_in_container() {
    docker exec -it flyos-user-management-service-1 "$@"
}

echo "1. 🔍 Checking current sync status..."
run_in_container npm run list-users --quick

echo
echo "2. 🔧 Running sync repair..."
run_in_container npm run repair-sync

echo
echo "3. 🔄 Running full database initialization with enhanced sync..."
run_in_container npm run init-db

echo
echo "4. 📊 Final sync diagnostic..."
run_in_container npm run list-users

echo
echo "5. ✅ Testing authentication..."
echo "   You can now try logging in with:"
echo "   - main@flyos.mil / FlyOS2025!"
echo "   - east@flyos.mil / FlyOS2025!"
echo "   - west@flyos.mil / FlyOS2025!"
echo "   - operator1@flyos.mil / FlyOS2025!"
echo "   - operator2@flyos.mil / FlyOS2025!"

echo
echo "🎉 Quick fix completed!"
echo "If issues persist, check the logs above for specific errors."