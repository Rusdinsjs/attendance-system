#!/bin/bash
# --- CONFIGURATION ---
VPS_USER="root"                         # Ganti dengan username VPS Anda
VPS_IP="148.230.98.192"                 # Ganti dengan IP VPS Anda
APP_DIR="/var/www/attendance"           # Folder tujuan di VPS
# ---------------------

# Parse arguments
SKIP_BACKEND=false
SKIP_FRONTEND=false
SKIP_FACE_SERVICE=false
FORCE_REBUILD=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --frontend-only|-f)
            SKIP_BACKEND=true
            SKIP_FACE_SERVICE=true
            shift
            ;;
        --backend-only|-b)
            SKIP_FRONTEND=true
            SKIP_FACE_SERVICE=true
            shift
            ;;
        --no-face|-nf)
            SKIP_FACE_SERVICE=true
            shift
            ;;
        --force|-F)
            FORCE_REBUILD=true
            shift
            ;;
        --help|-h)
            echo "Usage: ./deploy.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -f, --frontend-only   Deploy frontend only (skip backend build)"
            echo "  -b, --backend-only    Deploy backend only (skip frontend build)"
            echo "  -nf, --no-face        Skip face service rebuild"
            echo "  -F, --force           Force rebuild all"
            echo "  -h, --help            Show this help"
            echo ""
            echo "Examples:"
            echo "  ./deploy.sh -f        # Quick frontend deploy"
            echo "  ./deploy.sh -b        # Quick backend deploy"
            echo "  ./deploy.sh -nf       # Skip face service (faster)"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo "🚀 Starting Deployment Process..."

# Check what files changed (for info only)
echo "📊 Checking for changes..."

# 1. Build Backend (Golang)
if [ "$SKIP_BACKEND" = false ]; then
    # Check if Go files changed
    BACKEND_CHANGED=$(find . -name "*.go" -newer attendance-server 2>/dev/null | head -1)
    if [ -n "$BACKEND_CHANGED" ] || [ ! -f "attendance-server" ] || [ "$FORCE_REBUILD" = true ]; then
        echo "📦 Building Backend for Linux x64..."
        GOOS=linux GOARCH=amd64 go build -o attendance-server cmd/server/main.go
        if [ $? -ne 0 ]; then
            echo "❌ Backend build failed!"
            exit 1
        fi
    else
        echo "⏭️  Backend unchanged, skipping build..."
    fi
else
    echo "⏭️  Skipping backend build (--frontend-only)"
fi

# 2. Build Frontend (React)
if [ "$SKIP_FRONTEND" = false ]; then
    # Check if frontend files changed
    FRONTEND_CHANGED=$(find web/src -newer web/dist/index.html 2>/dev/null | head -1)
    if [ -n "$FRONTEND_CHANGED" ] || [ ! -f "web/dist/index.html" ] || [ "$FORCE_REBUILD" = true ]; then
        echo "🎨 Building Frontend..."
        cd web
        npm run build
        BUILD_RESULT=$?
        cd ..
        if [ $BUILD_RESULT -ne 0 ]; then
            echo "❌ Frontend build failed!"
            exit 1
        fi
    else
        echo "⏭️  Frontend unchanged, skipping build..."
    fi
else
    echo "⏭️  Skipping frontend build (--backend-only)"
fi

# 3. Create Remote Directory & Set Permissions
echo "📁 Preparing VPS Directory..."
ssh $VPS_USER@$VPS_IP "mkdir -p $APP_DIR/uploads/employees $APP_DIR/public"

# 4. Sync Files to VPS (rsync only syncs changed files)
echo "🔄 Syncing files to VPS..."

# Sync Backend (only if not skipped)
if [ "$SKIP_BACKEND" = false ]; then
    rsync -avz --checksum attendance-server $VPS_USER@$VPS_IP:$APP_DIR/
    rsync -avz --checksum docker-compose.yml migrations $VPS_USER@$VPS_IP:$APP_DIR/
fi

# Sync Face Service (only if not skipped)
if [ "$SKIP_FACE_SERVICE" = false ]; then
    rsync -avz --checksum face_service $VPS_USER@$VPS_IP:$APP_DIR/
fi

# Sync Frontend (only if not skipped)
if [ "$SKIP_FRONTEND" = false ]; then
    rsync -avz --delete --checksum web/dist/ $VPS_USER@$VPS_IP:$APP_DIR/public/
fi

# 5. Remote Execution
echo "🔧 Setting up environment on VPS..."

if [ "$SKIP_FACE_SERVICE" = true ]; then
    # Quick deploy without face service rebuild
    ssh $VPS_USER@$VPS_IP << 'EOF'
        cd /var/www/attendance
        
        # Start Docker services (won't restart if already running)
        echo "🐳 Starting Databases (Docker)..."
        docker compose up -d postgres redis face_service
        
        # Set Permission Binary
        echo "🔑 Setting executable permissions..."
        chmod +x attendance-server
        
        # Restart Systemd Service
        echo "🔄 Restarting Application Service..."
        systemctl daemon-reload
        systemctl restart attendance-system || echo "⚠️ Warning: systemd service not active yet"
EOF
else
    # Full deploy with face service rebuild
    ssh $VPS_USER@$VPS_IP << 'EOF'
        cd /var/www/attendance
        
        # Start Docker (Postgres & Redis)
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
fi

echo "✅ Deployment Finished Successfully!"
echo "📡 Check status with: ssh $VPS_USER@$VPS_IP 'systemctl status attendance-system'"
