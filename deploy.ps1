# deploy.ps1 - PowerShell deployment script for attendance-system
param(
    [Alias("fe")][switch]$FrontendOnly,
    [Alias("be")][switch]$BackendOnly,
    [Alias("nf")][switch]$NoFace,
    [switch]$Force,
    [Alias("h")][switch]$Help
)

# --- CONFIGURATION ---
$VPS_USER = "root"
$VPS_IP = "148.230.98.192"
$APP_DIR = "/var/www/attendance"
# ---------------------

$SKIP_BACKEND = $false
$SKIP_FRONTEND = $false
$SKIP_FACE_SERVICE = $false
$FORCE_REBUILD = $false

if ($Help) {
    Write-Host "Usage: .\deploy.ps1 [OPTIONS]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -FrontendOnly, -f     Deploy frontend only (skip backend build)"
    Write-Host "  -BackendOnly, -b      Deploy backend only (skip frontend build)"
    Write-Host "  -NoFace, -nf          Skip face service rebuild"
    Write-Host "  -Force, -F            Force rebuild all"
    Write-Host "  -Help, -h             Show this help"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\deploy.ps1 -f        # Quick frontend deploy"
    Write-Host "  .\deploy.ps1 -b        # Quick backend deploy"
    Write-Host "  .\deploy.ps1 -nf       # Skip face service (faster)"
    exit 0
}

if ($FrontendOnly) {
    $SKIP_BACKEND = $true
    $SKIP_FACE_SERVICE = $true
}

if ($BackendOnly) {
    $SKIP_FRONTEND = $true
    $SKIP_FACE_SERVICE = $true
}

if ($NoFace) {
    $SKIP_FACE_SERVICE = $true
}

if ($Force) {
    $FORCE_REBUILD = $true
}

Write-Host "Starting Deployment Process..." -ForegroundColor Green

# Check what files changed (for info only)
Write-Host "Checking for changes..." -ForegroundColor Cyan

# 1. Build Backend (Golang)
if (-not $SKIP_BACKEND) {
    $binaryExists = Test-Path "attendance-server"
    $shouldBuild = $FORCE_REBUILD -or (-not $binaryExists)
    
    if ((-not $shouldBuild) -and $binaryExists) {
        $binaryTime = (Get-Item "attendance-server").LastWriteTime
        $goFiles = Get-ChildItem -Recurse -Filter "*.go" -ErrorAction SilentlyContinue
        foreach ($file in $goFiles) {
            if ($file.LastWriteTime -gt $binaryTime) {
                $shouldBuild = $true
                break
            }
        }
    }
    
    if ($shouldBuild) {
        Write-Host "Building Backend for Linux x64..." -ForegroundColor Yellow
        $env:GOOS = "linux"
        $env:GOARCH = "amd64"
        go build -o attendance-server cmd/server/main.go
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Backend build failed!" -ForegroundColor Red
            exit 1
        }
        Remove-Item Env:GOOS -ErrorAction SilentlyContinue
        Remove-Item Env:GOARCH -ErrorAction SilentlyContinue
    }
    else {
        Write-Host "Backend unchanged, skipping build..." -ForegroundColor Gray
    }
}
else {
    Write-Host "Skipping backend build (--frontend-only)" -ForegroundColor Gray
}

# 2. Build Frontend (React)
if (-not $SKIP_FRONTEND) {
    $indexExists = Test-Path "web/dist/index.html"
    $shouldBuild = $FORCE_REBUILD -or (-not $indexExists)
    
    if ((-not $shouldBuild) -and $indexExists) {
        $indexTime = (Get-Item "web/dist/index.html").LastWriteTime
        $srcFiles = Get-ChildItem -Path "web/src" -Recurse -ErrorAction SilentlyContinue
        foreach ($file in $srcFiles) {
            if ($file.LastWriteTime -gt $indexTime) {
                $shouldBuild = $true
                break
            }
        }
    }
    
    if ($shouldBuild) {
        Write-Host "Building Frontend..." -ForegroundColor Yellow
        Push-Location web
        npm run build
        $buildResult = $LASTEXITCODE
        Pop-Location
        if ($buildResult -ne 0) {
            Write-Host "Frontend build failed!" -ForegroundColor Red
            exit 1
        }
    }
    else {
        Write-Host "Frontend unchanged, skipping build..." -ForegroundColor Gray
    }
}
else {
    Write-Host "Skipping frontend build (--backend-only)" -ForegroundColor Gray
}

# 3. Create Remote Directory & Set Permissions
Write-Host "Preparing VPS Directory..." -ForegroundColor Cyan
ssh "$VPS_USER@$VPS_IP" "mkdir -p $APP_DIR/uploads/employees $APP_DIR/public"

# 4. Sync Files to VPS using scp
Write-Host "Syncing files to VPS..." -ForegroundColor Cyan

# Sync Backend (only if not skipped)
if (-not $SKIP_BACKEND) {
    Write-Host "  Uploading backend files..." -ForegroundColor Gray
    scp attendance-server "$VPS_USER@$VPS_IP`:$APP_DIR/"
    scp docker-compose.yml "$VPS_USER@$VPS_IP`:$APP_DIR/"
    scp -r migrations "$VPS_USER@$VPS_IP`:$APP_DIR/"
}

# Sync Face Service (only if not skipped)
if (-not $SKIP_FACE_SERVICE) {
    Write-Host "  Uploading face service..." -ForegroundColor Gray
    scp -r face_service "$VPS_USER@$VPS_IP`:$APP_DIR/"
}

# Sync Frontend (only if not skipped)
if (-not $SKIP_FRONTEND) {
    Write-Host "  Uploading frontend files..." -ForegroundColor Gray
    ssh "$VPS_USER@$VPS_IP" "rm -rf $APP_DIR/public/*"
    scp -r web/dist/* "$VPS_USER@$VPS_IP`:$APP_DIR/public/"
}

# 5. Remote Execution
Write-Host "Setting up environment on VPS..." -ForegroundColor Cyan

if ($SKIP_FACE_SERVICE) {
    $remoteScript = "cd $APP_DIR && echo 'Starting Databases...' && docker compose up -d postgres redis face_service && echo 'Setting permissions...' && chmod +x attendance-server && echo 'Restarting service...' && systemctl daemon-reload && systemctl restart attendance-system"
}
else {
    $remoteScript = "cd $APP_DIR && echo 'Starting Databases...' && docker compose up -d postgres redis && echo 'Building Face Service...' && docker compose build face_service && docker compose up -d face_service && echo 'Setting permissions...' && chmod +x attendance-server && echo 'Restarting service...' && systemctl daemon-reload && systemctl restart attendance-system"
}

ssh "$VPS_USER@$VPS_IP" $remoteScript

Write-Host ""
Write-Host "Deployment Finished Successfully!" -ForegroundColor Green
Write-Host "Check status with: ssh $VPS_USER@$VPS_IP 'systemctl status attendance-system'" -ForegroundColor Cyan
