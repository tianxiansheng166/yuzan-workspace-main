# start-ai.ps1 — Unified local startup for AI lesson planning pipeline
# Usage: .\scripts\local-runtime\start-ai.ps1 [-SkipFlowise] [-SkipApi] [-SkipWorker]
#
# Starts the following services in order:
#   1. Flowise (Docker) — unless -SkipFlowise
#   2. API server        — unless -SkipApi
#   3. Worker            — always
#
# Prerequisites:
#   - Docker running
#   - PostgreSQL container running on port 55432
#   - .env files configured (flowise/.env, runtime-local/secrets/ai-provider.env)
param(
    [switch]$SkipFlowise,
    [switch]$SkipApi,
    [switch]$SkipWorker
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent (Split-Path -Parent $scriptDir)
$flowiseDir = Join-Path $rootDir "infra\ai\flowise"
$envFile = Join-Path $rootDir "runtime-local\secrets\ai-provider.env"
$flowIdFile = Join-Path $rootDir "runtime-local\flowise\flow-id.txt"

Write-Host "=== Yuzan AI Lesson Planning — Local Startup ===" -ForegroundColor Cyan
Write-Host ""

# ── Load environment variables from gitignored env file ──
function Import-EnvFile([string]$Path) {
    if (-not (Test-Path $Path)) {
        Write-Host "[WARN] Env file not found: $Path" -ForegroundColor Yellow
        return
    }
    $lineCount = 0
    Get-Content $Path | ForEach-Object {
        $line = $_.Trim()
        # Skip comments and empty lines
        if ($line -and -not $line.StartsWith('#')) {
            $idx = $line.IndexOf('=')
            if ($idx -gt 0) {
                $key = $line.Substring(0, $idx).Trim()
                $val = $line.Substring($idx + 1).Trim()
                # Remove surrounding quotes if present
                if ($val.Length -ge 2 -and $val.StartsWith('"') -and $val.EndsWith('"')) {
                    $val = $val.Substring(1, $val.Length - 2)
                }
                # Only set if not already defined in outer environment
                if (-not [Environment]::GetEnvironmentVariable($key)) {
                    [Environment]::SetEnvironmentVariable($key, $val, 'Process')
                    $lineCount++
                }
            }
        }
    }
    Write-Host "[OK] Loaded $lineCount env vars from $Path" -ForegroundColor Green
}

Import-EnvFile $envFile

# ── Auto-inject FLOWISE_FLOW_ID from bootstrap output ──
if ((Test-Path $flowIdFile) -and -not [Environment]::GetEnvironmentVariable('FLOWISE_FLOW_ID')) {
    $flowId = (Get-Content $flowIdFile -Raw).Trim()
    if ($flowId) {
        [Environment]::SetEnvironmentVariable('FLOWISE_FLOW_ID', $flowId, 'Process')
        Write-Host "[OK] FLOWISE_FLOW_ID loaded from flow-id.txt" -ForegroundColor Green
    }
}

# ── Check PostgreSQL ──
Write-Host "[INFO] Checking PostgreSQL ..." -ForegroundColor Cyan
$pgRunning = docker ps --filter "name=yuzan-four-port-postgres-55432" --format "{{.Status}}" 2>$null
if ($pgRunning -match "Up") {
    Write-Host "[OK] PostgreSQL is running" -ForegroundColor Green
} else {
    Write-Host "[ERROR] PostgreSQL container not running. Start it first." -ForegroundColor Red
    Write-Host "  docker start yuzan-four-port-postgres-55432" -ForegroundColor Yellow
    exit 1
}

# ── Step 1: Flowise ──
if (-not $SkipFlowise) {
    Write-Host ""
    Write-Host "[INFO] Starting Flowise ..." -ForegroundColor Cyan
    $startScript = Join-Path $flowiseDir "scripts\start.ps1"
    if (Test-Path $startScript) {
        & $startScript
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[WARN] Flowise start failed. Continuing without Flowise." -ForegroundColor Yellow
        }
    } else {
        Write-Host "[WARN] Flowise start script not found at $startScript" -ForegroundColor Yellow
    }

    # Import workflow into Flowise after it's healthy
    $bootstrapScript = Join-Path $flowiseDir "scripts\bootstrap-flow.ps1"
    if (Test-Path $bootstrapScript) {
        Write-Host "[INFO] Importing lesson planner workflow into Flowise ..." -ForegroundColor Cyan
        & $bootstrapScript
        if ($LASTEXITCODE -eq 0) {
            # Re-read flowId that bootstrap wrote to flow-id.txt
            if (Test-Path $flowIdFile) {
                $flowId = (Get-Content $flowIdFile -Raw).Trim()
                if ($flowId) {
                    [Environment]::SetEnvironmentVariable('FLOWISE_FLOW_ID', $flowId, 'Process')
                    Write-Host "[OK] FLOWISE_FLOW_ID set to $flowId" -ForegroundColor Green
                }
            }
        } else {
            Write-Host "[WARN] Workflow import failed. Worker may not have a valid flowId." -ForegroundColor Yellow
        }
    } else {
        Write-Host "[WARN] Bootstrap script not found at $bootstrapScript" -ForegroundColor Yellow
    }
} else {
    Write-Host "[INFO] Skipping Flowise (-SkipFlowise)" -ForegroundColor Yellow
}

# ── Step 2: API Server ──
if (-not $SkipApi) {
    Write-Host ""
    Write-Host "[INFO] Starting API server ..." -ForegroundColor Cyan
    
    # Generate Prisma client and run migrations if needed
    Push-Location $rootDir
    try {
        Write-Host "[INFO] Generating Prisma client ..." -ForegroundColor Cyan
        pnpm --filter @yuzan/database generate 2>&1 | ForEach-Object { Write-Host "  $_" }
        
        Write-Host "[INFO] Running database migrations ..." -ForegroundColor Cyan
        pnpm --filter @yuzan/database migrate:deploy 2>&1 | ForEach-Object { Write-Host "  $_" }
        
        Write-Host "[INFO] Starting API server in background ..." -ForegroundColor Cyan
        # Use Start-Process with inherited environment (env vars already set in current process)
        Start-Process -FilePath "pnpm" -ArgumentList "--filter", "@yuzan/api", "dev" -NoNewWindow -PassThru | Out-Null
        
        # Wait for API to be ready
        $maxApiAttempts = 30
        for ($i = 1; $i -le $maxApiAttempts; $i++) {
            try {
                $null = Invoke-WebRequest -Uri "http://127.0.0.1:4000/api/v1/health/ready" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
                Write-Host "[OK] API server is ready (attempt $i)" -ForegroundColor Green
                break
            } catch {
                if ($i -eq $maxApiAttempts) {
                    Write-Host "[WARN] API server not ready after $maxApiAttempts attempts" -ForegroundColor Yellow
                } else {
                    Start-Sleep -Seconds 2
                }
            }
        }
    } finally {
        Pop-Location
    }
} else {
    Write-Host "[INFO] Skipping API server (-SkipApi)" -ForegroundColor Yellow
}

# ── Step 3: Worker ──
if (-not $SkipWorker) {
    Write-Host ""
    Write-Host "[INFO] Starting Worker ..." -ForegroundColor Cyan

    # Verify critical Worker env vars are set
    $workerEnvVars = @('FLOWISE_BASE_URL','FLOWISE_FLOW_ID','API_INTERNAL_URL','API_INTERNAL_KEY','REDIS_HOST','REDIS_PORT')
    $missing = $workerEnvVars | Where-Object { -not [Environment]::GetEnvironmentVariable($_) }
    if ($missing) {
        Write-Host "[WARN] Missing Worker env vars: $($missing -join ', ')" -ForegroundColor Yellow
        Write-Host "  Configure them in runtime-local/secrets/ai-provider.env" -ForegroundColor Yellow
    }

    if ($env:AI_PROVIDER_STUB -eq "true") {
        Write-Host "[INFO] AI Provider Stub is ENABLED (scenario: $($env:AI_STUB_SCENARIO ?? 'valid-output'))" -ForegroundColor Yellow
    }

    Push-Location $rootDir
    try {
        # Start worker in foreground (env vars already injected into process)
        pnpm --filter @yuzan/worker dev
    } finally {
        Pop-Location
    }
}

Write-Host ""
Write-Host "=== Startup Complete ===" -ForegroundColor Green
