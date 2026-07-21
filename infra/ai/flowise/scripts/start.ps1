# start.ps1 — Start Flowise container
# Usage: .\scripts\start.ps1
$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$composeDir = Split-Path -Parent $scriptDir

# Check .env exists
if (-not (Test-Path "$composeDir\.env")) {
    Write-Host "[ERROR] .env not found. Copy .env.example to .env and fill in values." -ForegroundColor Red
    Write-Host "  cp $composeDir\.env.example $composeDir\.env" -ForegroundColor Yellow
    exit 1
}

# Ensure runtime directories exist
# rootDir = workers/p0-integration/ (3 levels up from infra/ai/flowise/)
$rootDir = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $composeDir))
@("runtime-local\flowise\data", "runtime-local\flowise\logs", "runtime-local\flowise\storage", "runtime-local\flowise\secret") | ForEach-Object {
    $dir = Join-Path $rootDir $_
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "[OK] Created $dir" -ForegroundColor Green
    }
}

Write-Host "[INFO] Starting Flowise on http://127.0.0.1:4300 ..." -ForegroundColor Cyan
Push-Location $composeDir
try {
    docker compose up -d
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] docker compose up failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] Flowise started. Waiting for health check ..." -ForegroundColor Green
    # Wait for health
    $maxAttempts = 30
    for ($i = 1; $i -le $maxAttempts; $i++) {
        try {
            $response = Invoke-WebRequest -Uri "http://127.0.0.1:4300/api/v1/ping" -UseBasicParsing -TimeoutSec 3 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                Write-Host "[OK] Flowise is healthy (attempt $i/$maxAttempts)" -ForegroundColor Green
                break
            }
        } catch {
            # Still starting
        }
        if ($i -eq $maxAttempts) {
            Write-Host "[WARN] Flowise not healthy after $maxAttempts attempts. Check: docker logs yuzan-flowise" -ForegroundColor Yellow
        } else {
            Start-Sleep -Seconds 2
        }
    }
} finally {
    Pop-Location
}
