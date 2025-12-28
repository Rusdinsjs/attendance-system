#!/bin/bash

# Configuration
LOCAL_CONTAINER="attendance_postgres"
VPS_USER="root"
VPS_IP="148.230.98.192"
VPS_DIR="/var/www/attendance"
DUMP_FILE="local_backup.sql"

# Admin credentials (password: admin123)
ADMIN_EMAIL="admin@attendx.com"
ADMIN_PASSWORD_HASH='$2a$10$WCnGGu3D3qDvd9/ai9skcu5YKB5Bm0UWCHYSL0g894NXPFHQsKGbu'

echo "🚀 Starting Database Synchronization (Local -> VPS)..."

# 1. Dump Local Database
echo "📦 Dumping local database..."
docker exec -t $LOCAL_CONTAINER pg_dump -U attendance attendance_db > $DUMP_FILE
if [ $? -ne 0 ]; then
    echo "❌ Failed to dump local database."
    exit 1
fi
echo "✅ Local database dumped to $DUMP_FILE"

# 2. Upload Dump to VPS
echo "📤 Uploading dump to VPS..."
scp $DUMP_FILE $VPS_USER@$VPS_IP:$VPS_DIR/$DUMP_FILE
if [ $? -ne 0 ]; then
    echo "❌ Failed to upload dump."
    rm $DUMP_FILE
    exit 1
fi

# 3. Restore on VPS
echo "📥 Restoring database on VPS..."
ssh $VPS_USER@$VPS_IP << EOF
    cd $VPS_DIR
    
    echo "🛑 Stopping API service to release DB locks..."
    systemctl stop attendance-system

    echo "🧹 Clearing existing data (Schema Reset)..."
    docker compose exec -T postgres psql -U attendance -d attendance_db -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

    echo "🔄 Importing data..."
    cat $DUMP_FILE | docker compose exec -T postgres psql -U attendance -d attendance_db

    echo "🔑 Resetting admin password..."
    docker compose exec -T postgres psql -U attendance -d attendance_db -c "UPDATE users SET password_hash = '$ADMIN_PASSWORD_HASH' WHERE email = '$ADMIN_EMAIL';"

    echo "🧹 Cleaning up..."
    rm $DUMP_FILE

    echo "✅ Restarting Application Service..."
    systemctl start attendance-system
EOF

# 4. Cleanup Local
rm $DUMP_FILE
echo ""
echo "✅ Database Sync Complete! 🚀"
echo ""
echo "📋 Admin Login Credentials:"
echo "   Email: $ADMIN_EMAIL"
echo "   Password: admin123"
echo ""
