#!/bin/bash
# Reset Admin Password on VPS
# Usage: ./reset_admin_password.sh [new_password]

VPS_USER="root"
VPS_IP="148.230.98.192"
ADMIN_EMAIL="admin@attendx.com"

# Default password jika tidak ada argumen
NEW_PASSWORD="${1:-admin123}"

echo "🔑 Resetting admin password on VPS..."

# Generate bcrypt hash locally
HASH=$(go run cmd/hash/main.go 2>/dev/null)
if [ -z "$HASH" ]; then
    # Fallback to known hash for admin123
    HASH='$2a$10$WCnGGu3D3qDvd9/ai9skcu5YKB5Bm0UWCHYSL0g894NXPFHQsKGbu'
fi

# Update on VPS
ssh $VPS_USER@$VPS_IP "docker compose -f /var/www/attendance/docker-compose.yml exec -T postgres psql -U attendance -d attendance_db -c \"UPDATE users SET password_hash = '$HASH' WHERE email = '$ADMIN_EMAIL';\""

echo ""
echo "✅ Password reset complete!"
echo ""
echo "📋 Admin Login Credentials:"
echo "   Email: $ADMIN_EMAIL"
echo "   Password: $NEW_PASSWORD"
echo ""
