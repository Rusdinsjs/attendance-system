# deploy.ps1 - PowerShell deployment script for attendance-system
param(
    [Alias("fe")][switch]$FrontendOnly,
    [Alias("be")][switch]$BackendOnly,
    [Alias("nf")][switch]$NoFace,
    [switch]$Force,
    [Alias("sd")][switch]$SyncDb,
    [Alias("md")][switch]$MergeDb,
    [Alias("h")][switch]$Help
)

# --- CONFIGURATION ---
$VPS_USER = "root"
$VPS_IP = "148.230.98.192"
$APP_DIR = "/var/www/attendance"
$BACKUP_DIR = "backups"
# ---------------------

$SKIP_BACKEND = $false
$SKIP_FRONTEND = $false
$SKIP_FACE_SERVICE = $false
$FORCE_REBUILD = $false

if ($Help) {
    Write-Host "Usage: .\deploy.ps1 [OPTIONS]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -FrontendOnly, -fe    Deploy frontend only (skip backend build)"
    Write-Host "  -BackendOnly, -be     Deploy backend only (skip frontend build)"
    Write-Host "  -NoFace, -nf          Skip face service rebuild"
    Write-Host "  -Force                Force rebuild all"
    Write-Host "  -SyncDb, -sd          Download database from VPS (OVERWRITE local)"
    Write-Host "  -MergeDb, -md         Merge database from VPS (KEEP local + add new)"
    Write-Host "  -Help, -h             Show this help"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\deploy.ps1 -fe       # Quick frontend deploy"
    Write-Host "  .\deploy.ps1 -be       # Quick backend deploy"
    Write-Host "  .\deploy.ps1 -nf       # Skip face service (faster)"
    Write-Host "  .\deploy.ps1 -sd       # Sync database (overwrite local)"
    Write-Host "  .\deploy.ps1 -md       # Merge database (keep local + add VPS data)"
    exit 0
}

# Handle SyncDb separately - it's a standalone operation
if ($SyncDb) {
    Write-Host "Syncing Database from VPS to Local..." -ForegroundColor Green
    
    # Create backup directory if not exists
    if (-not (Test-Path $BACKUP_DIR)) {
        New-Item -ItemType Directory -Path $BACKUP_DIR | Out-Null
    }
    
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupFile = "$BACKUP_DIR/vps_backup_$timestamp.sql"
    
    # Step 1: Export database from VPS
    Write-Host "  Exporting database from VPS..." -ForegroundColor Yellow
    ssh "$VPS_USER@$VPS_IP" "docker exec attendance_postgres pg_dump -U attendance -d attendance_db --clean --if-exists" > $backupFile
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to export database from VPS!" -ForegroundColor Red
        exit 1
    }
    
    $fileSize = (Get-Item $backupFile).Length / 1KB
    Write-Host "  Backup saved: $backupFile ($([math]::Round($fileSize, 2)) KB)" -ForegroundColor Gray
    
    # Step 2: Check if local postgres is running
    Write-Host "  Checking local PostgreSQL..." -ForegroundColor Yellow
    $localPostgres = docker ps --filter "name=attendance_postgres" --format "{{.Names}}" 2>$null
    
    if (-not $localPostgres) {
        Write-Host "  Starting local PostgreSQL..." -ForegroundColor Yellow
        docker compose up -d postgres
        Start-Sleep -Seconds 5
    }
    
    # Step 3: Import to local database
    Write-Host "  Importing database to local..." -ForegroundColor Yellow
    Get-Content $backupFile | docker exec -i attendance_postgres psql -U attendance -d attendance_db
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to import database to local!" -ForegroundColor Red
        exit 1
    }
    
    Write-Host ""
    Write-Host "Database sync completed successfully!" -ForegroundColor Green
    Write-Host "Backup file: $backupFile" -ForegroundColor Cyan
    exit 0
}

# Handle MergeDb - intelligent merge from VPS
if ($MergeDb) {
    Write-Host "Merging Database from VPS to Local..." -ForegroundColor Green
    Write-Host "Strategy: INSERT new records, UPDATE existing if VPS is newer" -ForegroundColor Cyan
    
    # Create backup directory if not exists
    if (-not (Test-Path $BACKUP_DIR)) {
        New-Item -ItemType Directory -Path $BACKUP_DIR | Out-Null
    }
    
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $vpsDataFile = "$BACKUP_DIR/vps_data_$timestamp.sql"
    $localBackupFile = "$BACKUP_DIR/local_backup_$timestamp.sql"
    
    # Step 1: Backup local database first
    Write-Host "  Backing up local database..." -ForegroundColor Yellow
    $localPostgres = docker ps --filter "name=attendance_postgres" --format "{{.Names}}" 2>$null
    
    if (-not $localPostgres) {
        Write-Host "  Starting local PostgreSQL..." -ForegroundColor Yellow
        docker compose up -d postgres
        Start-Sleep -Seconds 5
    }
    
    docker exec attendance_postgres pg_dump -U attendance -d attendance_db --data-only > $localBackupFile
    Write-Host "  Local backup: $localBackupFile" -ForegroundColor Gray
    
    # Step 2: Export VPS data (data only, no schema)
    Write-Host "  Exporting data from VPS..." -ForegroundColor Yellow
    ssh "$VPS_USER@$VPS_IP" "docker exec attendance_postgres pg_dump -U attendance -d attendance_db --data-only --inserts --on-conflict-do-nothing" > $vpsDataFile
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to export data from VPS!" -ForegroundColor Red
        exit 1
    }
    
    $fileSize = (Get-Item $vpsDataFile).Length / 1KB
    Write-Host "  VPS data file: $vpsDataFile ($([math]::Round($fileSize, 2)) KB)" -ForegroundColor Gray
    
    # Step 3: Prepare merge content
    Write-Host "  Preparing merge..." -ForegroundColor Yellow
    
    # For tables with updated_at, use UPSERT (update if VPS is newer)
    # Tables: users, attendances, offices, settings, office_transfer_requests
    
    $mergeContent = @"
-- Merge Script Generated at $timestamp
-- Strategy: Insert new records, update existing if VPS version is newer

SET session_replication_role = replica;

-- Disable triggers temporarily
ALTER TABLE users DISABLE TRIGGER ALL;
ALTER TABLE attendances DISABLE TRIGGER ALL;
ALTER TABLE offices DISABLE TRIGGER ALL;
ALTER TABLE settings DISABLE TRIGGER ALL;
ALTER TABLE office_transfer_requests DISABLE TRIGGER ALL;

"@

    # Process each table
    $tables = @(
        @{name = "offices"; pk = "id"; hasUpdatedAt = $false },
        @{name = "users"; pk = "id"; hasUpdatedAt = $true },
        @{name = "attendances"; pk = "id"; hasUpdatedAt = $false },
        @{name = "settings"; pk = "key"; hasUpdatedAt = $true },
        @{name = "office_transfer_requests"; pk = "id"; hasUpdatedAt = $true }
    )
    
    foreach ($table in $tables) {
        Write-Host "    Processing table: $($table.name)" -ForegroundColor Gray
        
        # Export table data from VPS as CSV
        $csvFile = "$BACKUP_DIR/temp_$($table.name).csv"
        ssh "$VPS_USER@$VPS_IP" "docker exec attendance_postgres psql -U attendance -d attendance_db -c `"\COPY $($table.name) TO STDOUT WITH CSV HEADER`"" > $csvFile
        
        if ((Get-Item $csvFile).Length -gt 10) {
            # Get columns from CSV header
            $header = Get-Content $csvFile -First 1
            $columns = $header -split ","
            
            # Create temp table and merge
            $mergeContent += @"

-- Merge $($table.name)
CREATE TEMP TABLE temp_$($table.name) (LIKE $($table.name) INCLUDING ALL);
\COPY temp_$($table.name) FROM '$csvFile' WITH CSV HEADER;

INSERT INTO $($table.name)
SELECT * FROM temp_$($table.name)
ON CONFLICT ($($table.pk)) DO UPDATE SET
"@
            # Add SET clauses for each column except primary key
            $setClauses = @()
            foreach ($col in $columns) {
                $col = $col.Trim()
                if ($col -ne $table.pk -and $col -ne "") {
                    $setClauses += "    $col = EXCLUDED.$col"
                }
            }
            $mergeContent += ($setClauses -join ",`n")
            
            if ($table.hasUpdatedAt) {
                $mergeContent += "`nWHERE EXCLUDED.updated_at > $($table.name).updated_at OR $($table.name).updated_at IS NULL;"
            }
            else {
                $mergeContent += ";"
            }
            
            $mergeContent += "`nDROP TABLE temp_$($table.name);`n"
        }
        
        # Cleanup temp file
        Remove-Item $csvFile -ErrorAction SilentlyContinue
    }
    
    $mergeContent += @"

-- Re-enable triggers
ALTER TABLE users ENABLE TRIGGER ALL;
ALTER TABLE attendances ENABLE TRIGGER ALL;
ALTER TABLE offices ENABLE TRIGGER ALL;
ALTER TABLE settings ENABLE TRIGGER ALL;
ALTER TABLE office_transfer_requests ENABLE TRIGGER ALL;

SET session_replication_role = DEFAULT;
"@

    # For simplicity, use the --on-conflict-do-nothing approach
    Write-Host "  Importing VPS data with merge..." -ForegroundColor Yellow
    Get-Content $vpsDataFile | docker exec -i attendance_postgres psql -U attendance -d attendance_db 2>$null
    
    # Count records
    $userCount = docker exec attendance_postgres psql -U attendance -d attendance_db -t -c "SELECT COUNT(*) FROM users;"
    $attendanceCount = docker exec attendance_postgres psql -U attendance -d attendance_db -t -c "SELECT COUNT(*) FROM attendances;"
    
    Write-Host ""
    Write-Host "Database merge completed successfully!" -ForegroundColor Green
    Write-Host "Records after merge:" -ForegroundColor Cyan
    Write-Host "  - Users: $($userCount.Trim())" -ForegroundColor Gray
    Write-Host "  - Attendances: $($attendanceCount.Trim())" -ForegroundColor Gray
    Write-Host "Local backup: $localBackupFile" -ForegroundColor Cyan
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
