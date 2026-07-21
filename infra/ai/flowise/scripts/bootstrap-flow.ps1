# bootstrap-flow.ps1 — Create or update the Yuzan Lesson Planner workflow in Flowise
# Usage: .\scripts\bootstrap-flow.ps1
#
# This script:
#   1. Checks Flowise health
#   2. Looks for an existing "Yuzan Lesson Planner V0" workflow
#   3. Creates it if not found, updates if version differs
#   4. Writes the flowId to runtime-local (NOT to tracked config)
#
# Prerequisites:
#   - Flowise must be running (use start.ps1 first)
#   - .env must contain FLOWISE_USERNAME and FLOWISE_PASSWORD
$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$composeDir = Split-Path -Parent $scriptDir
$rootDir = Split-Path -Parent (Split-Path -Parent $composeDir)
$flowiseUrl = "http://127.0.0.1:4300"
$flowFile = Join-Path $composeDir "flows\lesson-planner-v0.json"
$flowIdFile = Join-Path $rootDir "runtime-local\flowise\flow-id.txt"

# Step 1: Check health
Write-Host "[INFO] Checking Flowise health ..." -ForegroundColor Cyan
try {
    $null = Invoke-WebRequest -Uri "$flowiseUrl/api/v1/ping" -UseBasicParsing -TimeoutSec 5
    Write-Host "[OK] Flowise is running" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Flowise is not reachable at $flowiseUrl. Run start.ps1 first." -ForegroundColor Red
    exit 1
}

# Step 2: Read .env for auth
$envFile = Join-Path $composeDir ".env"
if (-not (Test-Path $envFile)) {
    Write-Host "[ERROR] .env not found at $envFile" -ForegroundColor Red
    exit 1
}

$envContent = Get-Content $envFile -ErrorAction SilentlyContinue
$username = ($envContent | Where-Object { $_ -match "^FLOWISE_USERNAME=(.+)$" }) -replace "^FLOWISE_USERNAME=", ""
$password = ($envContent | Where-Object { $_ -match "^FLOWISE_PASSWORD=(.+)$" }) -replace "^FLOWISE_PASSWORD=", ""

if (-not $password) {
    Write-Host "[WARN] FLOWISE_PASSWORD is empty in .env. Login may fail." -ForegroundColor Yellow
}

# Step 3: Authenticate
Write-Host "[INFO] Authenticating with Flowise ..." -ForegroundColor Cyan
$loginBody = @{ username = $username; password = $password } | ConvertTo-Json
try {
    $loginResp = Invoke-RestMethod -Uri "$flowiseUrl/api/v1/login" -Method Post -Body $loginBody -ContentType "application/json" -ErrorAction Stop
    $token = $loginResp.token ?? $loginResp.accessToken ?? $loginResp
    Write-Host "[OK] Authenticated" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Flowise login failed: $_" -ForegroundColor Red
    exit 1
}

$headers = @{ Authorization = "Bearer $token" }

# Step 4: Check for existing flow
Write-Host "[INFO] Looking for existing 'Yuzan Lesson Planner V0' workflow ..." -ForegroundColor Cyan
$flowName = "Yuzan Lesson Planner V0"
$existingFlowId = $null

try {
    $flows = Invoke-RestMethod -Uri "$flowiseUrl/api/v1/chatflows" -Headers $headers -ErrorAction Stop
    $existing = $flows | Where-Object { $_.name -eq $flowName }
    if ($existing) {
        $existingFlowId = $existing[0].id
        Write-Host "[OK] Found existing flow: $existingFlowId" -ForegroundColor Green
    } else {
        Write-Host "[INFO] No existing flow found. Will create new." -ForegroundColor Yellow
    }
} catch {
    Write-Host "[WARN] Could not list flows: $_" -ForegroundColor Yellow
}

# Step 5: Read flow definition
if (-not (Test-Path $flowFile)) {
    Write-Host "[ERROR] Flow definition not found: $flowFile" -ForegroundColor Red
    Write-Host "[INFO] Run commit 2 first to create the flow definition." -ForegroundColor Yellow
    exit 1
}

$flowJson = Get-Content $flowFile -Raw

# Step 6: Create or update
if ($existingFlowId) {
    Write-Host "[INFO] Updating existing flow $existingFlowId ..." -ForegroundColor Cyan
    try {
        $updateBody = @{ id = $existingFlowId; name = $flowName } + (ConvertFrom-Json $flowJson -AsHashtable) | ConvertTo-Json -Depth 20
        $result = Invoke-RestMethod -Uri "$flowiseUrl/api/v1/chatflows/$existingFlowId" -Method Put -Body $updateBody -ContentType "application/json" -Headers $headers -ErrorAction Stop
        Write-Host "[OK] Flow updated: $($result.id)" -ForegroundColor Green
        $flowIdOut = $result.id
    } catch {
        Write-Host "[ERROR] Failed to update flow: $_" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[INFO] Creating new flow ..." -ForegroundColor Cyan
    try {
        $createBody = @{ name = $flowName } + (ConvertFrom-Json $flowJson -AsHashtable) | ConvertTo-Json -Depth 20
        $result = Invoke-RestMethod -Uri "$flowiseUrl/api/v1/chatflows" -Method Post -Body $createBody -ContentType "application/json" -Headers $headers -ErrorAction Stop
        Write-Host "[OK] Flow created: $($result.id)" -ForegroundColor Green
        $flowIdOut = $result.id
    } catch {
        Write-Host "[ERROR] Failed to create flow: $_" -ForegroundColor Red
        exit 1
    }
}

# Step 7: Write flowId to runtime-local (gitignored)
if ($flowIdOut) {
    $flowIdDir = Split-Path -Parent $flowIdFile
    if (-not (Test-Path $flowIdDir)) {
        New-Item -ItemType Directory -Path $flowIdDir -Force | Out-Null
    }
    Set-Content -Path $flowIdFile -Value $flowIdOut -NoNewline
    Write-Host "[OK] Flow ID written to $flowIdFile" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== Bootstrap Complete ===" -ForegroundColor Green
Write-Host "Flow ID: $flowIdOut" -ForegroundColor Cyan
Write-Host "Set FLOWISE_FLOW_ID=$flowIdOut in your environment or .env" -ForegroundColor Yellow
