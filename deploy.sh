#!/bin/bash
# --- CONFIGURATION ---
VPS_USER="root"                         # Ganti dengan username VPS Anda
VPS_IP="148.230.98.192"                 # Ganti dengan IP VPS Anda
APP_DIR="/var/www/attendance"           # Folder tujuan di VPS
# ---------------------

echo "🚀 Starting Deployment Process..."

# 1. Build Backend (Golang)
echo "📦 Building Backend for Linux x64..."
GOOS=linux GOARCH=amd64 go build -o attendance-server cmd/server/main.go
if [ $? -ne 0 ]; then
    echo "❌ Backend build failed!"
    exit 1
fi

# 2. Build Frontend (React)
echo "🎨 Building Frontend..."
cd web
# npm install --quiet # Jalankan ini jika ada perubahan package.json
npm run build
cd ..
if [ $? -ne 0 ]; then
    echo "❌ Frontend build failed!"
    exit 1
fi

# 3. Create Remote Directory & Set Permissions
echo "📁 Preparing VPS Directory..."
ssh $VPS_USER@$VPS_IP "mkdir -p $APP_DIR/uploads/employees $APP_DIR/public"

# 4. Sync Files to VPS
echo "🔄 Syncing files to VPS..."
# Sync Binary, Docker Config, Migrations, and Face Service
rsync -avz attendance-server docker-compose.yml migrations face_service $VPS_USER@$VPS_IP:$APP_DIR/
# Sync Frontend Dist to public folder
rsync -avz --delete web/dist/ $VPS_USER@$VPS_IP:$APP_DIR/public/

# 5. Remote Execution (Docker & Systemd)
echo "🔧 Setting up environment on VPS..."
ssh $VPS_USER@$VPS_IP << 'EOF'
    cd /var/www/attendance
    
    # Jalankan Docker (Postgres & Redis)
    echo "🐳 Starting Databases (Docker)..."
    docker compose up -d postgres redis
    
    # Build and start Face Service
    echo "🤖 Building Face Service (this may take ~20 minutes first time)..."
    docker compose build face_service
    docker compose up -d face_service
    
    # Set Permission Binary
    echo "🔑 Setting executable permissions..."
    chmod +x attendance-server
    
    # Restart Systemd Service
    echo "🔄 Restarting Application Service..."
    systemctl daemon-reload
    systemctl restart attendance-system || echo "⚠️ Warning: systemd service not active yet"
EOF

echo "✅ Deployment Finished Successfully!"
echo "📡 Check status with: ssh $VPS_USER@$VPS_IP 'systemctl status attendance-system'"
