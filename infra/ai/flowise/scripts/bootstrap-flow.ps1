# bootstrap-flow.ps1 — Create or update the Yuzan Lesson Planner workflow in Flowise
# Usage: .\scripts\bootstrap-flow.ps1
#
# This script:
#   1. Checks Docker is running
#   2. Checks Flowise health
#   3. Looks for an existing "Yuzan Lesson Planner V0" workflow
#   4. Creates it if not found, updates if version differs
#   5. Writes the flowId to runtime-local (NOT to tracked config)
#
# Prerequisites:
#   - Docker must be running
#   - Flowise must be running (use start.ps1 first)
#   - .env must contain FLOWISE_USERNAME and FLOWISE_PASSWORD
#
# Flowise API contract:
#   POST /api/v1/chatflows  — body: { name, flowData: "<json string>" }
#   PUT  /api/v1/chatflows/:id — body: { name, flowData: "<json string>" }
#   flowData = JSON.stringify({ nodes, edges, ... }) — stringified inner flow
$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$composeDir = Split-Path -Parent $scriptDir
# rootDir = repository root (3 levels up from infra/ai/flowise/)
$rootDir = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $composeDir))
$flowiseUrl = "http://127.0.0.1:4300"
$flowFile = Join-Path $composeDir "flows\lesson-planner-v0.json"
$flowIdFile = Join-Path $rootDir "runtime-local\flowise\flow-id.txt"
$flowName = "Yuzan Lesson Planner V0"

# Step 0: Check Docker
Write-Host "[INFO] Checking Docker ..." -ForegroundColor Cyan
try {
    $null = docker info 2>&1
    if ($LASTEXITCODE -ne 0) { throw "docker info failed" }
    Write-Host "[OK] Docker is running" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Docker is not running. Start Docker first." -ForegroundColor Red
    exit 1
}

# Step 1: Check Flowise health
Write-Host "[INFO] Checking Flowise health ..." -ForegroundColor Cyan
$maxHealthAttempts = 30
$healthy = $false
for ($i = 1; $i -le $maxHealthAttempts; $i++) {
    try {
        $null = Invoke-WebRequest -Uri "$flowiseUrl/api/v1/ping" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        $healthy = $true
        Write-Host "[OK] Flowise is running (attempt $i)" -ForegroundColor Green
        break
    } catch {
        if ($i -eq $maxHealthAttempts) {
            Write-Host "[ERROR] Flowise not reachable at $flowiseUrl after $maxHealthAttempts attempts. Run start.ps1 first." -ForegroundColor Red
            exit 1
        }
        Start-Sleep -Seconds 2
    }
}

# Step 2: Read .env for auth
$envFile = Join-Path $composeDir ".env"
if (-not (Test-Path $envFile)) {
    Write-Host "[ERROR] .env not found at $envFile" -ForegroundColor Red
    Write-Host "[INFO] Copy .env.example to .env and fill in values" -ForegroundColor Yellow
    exit 1
}

$envContent = Get-Content $envFile -ErrorAction SilentlyContinue
$username = (($envContent | Where-Object { $_ -match "^FLOWISE_USERNAME=(.+)$" }) -replace "^FLOWISE_USERNAME=", "") | Select-Object -First 1
$password = (($envContent | Where-Object { $_ -match "^FLOWISE_PASSWORD=(.+)$" }) -replace "^FLOWISE_PASSWORD=", "") | Select-Object -First 1

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
Write-Host "[INFO] Looking for existing '$flowName' workflow ..." -ForegroundColor Cyan
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

# Step 5: Read flow definition and prepare flowData
if (-not (Test-Path $flowFile)) {
    Write-Host "[ERROR] Flow definition not found: $flowFile" -ForegroundColor Red
    Write-Host "[INFO] The flow definition file must exist before bootstrapping." -ForegroundColor Yellow
    exit 1
}

$flowJson = Get-Content $flowFile -Raw

# Parse the flow file to extract the inner flow data
$flowObj = ConvertFrom-Json $flowJson -AsHashtable

# Build the flowData string — Flowise API expects flowData as a JSON string
# containing { nodes, edges, ... }
# The file may have flowData already (real export) or raw nodes/edges (template)
$innerFlowData = $null
if ($flowObj.ContainsKey("flowData") -and $flowObj.flowData -is [string]) {
    # Already has flowData string — use as-is (real export format)
    $innerFlowData = $flowObj.flowData
} elseif ($flowObj.ContainsKey("nodes")) {
    # Template format with raw nodes/edges — wrap into flowData string
    $innerObj = @{}
    foreach ($key in @("nodes", "edges")) {
        if ($flowObj.ContainsKey($key)) {
            $innerObj[$key] = $flowObj[$key]
        }
    }
    $innerFlowData = ConvertTo-Json $innerObj -Depth 50 -Compress
} else {
    Write-Host "[ERROR] Flow file has neither flowData nor nodes field" -ForegroundColor Red
    exit 1
}

# Step 6: Create or update — use proper Flowise API contract
$flowIdOut = $null
if ($existingFlowId) {
    Write-Host "[INFO] Updating existing flow $existingFlowId ..." -ForegroundColor Cyan
    try {
        $updateBody = @{
            name = $flowName
            flowData = $innerFlowData
        } | ConvertTo-Json -Depth 10
        $result = Invoke-RestMethod -Uri "$flowiseUrl/api/v1/chatflows/$existingFlowId" -Method Put -Body $updateBody -ContentType "application/json" -Headers $headers -ErrorAction Stop
        $flowIdOut = $result.id
        Write-Host "[OK] Flow updated: $flowIdOut" -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] Failed to update flow: $_" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[INFO] Creating new flow ..." -ForegroundColor Cyan
    try {
        $createBody = @{
            name = $flowName
            flowData = $innerFlowData
        } | ConvertTo-Json -Depth 10
        $result = Invoke-RestMethod -Uri "$flowiseUrl/api/v1/chatflows" -Method Post -Body $createBody -ContentType "application/json" -Headers $headers -ErrorAction Stop
        $flowIdOut = $result.id
        Write-Host "[OK] Flow created: $flowIdOut" -ForegroundColor Green
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
Write-Host "Set FLOWISE_FLOW_ID=$flowIdOut in your .env or environment" -ForegroundColor Yellow
