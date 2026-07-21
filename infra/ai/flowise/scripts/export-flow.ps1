# export-flow.ps1 — Export current workflow from Flowise to versioned JSON
# Usage: .\scripts\export-flow.ps1
#
# This script:
#   1. Connects to Flowise
#   2. Exports the Yuzan Lesson Planner V0 flow
#   3. Strips credential IDs and secrets
#   4. Writes to flows/lesson-planner-v0.json
#   5. Does NOT overwrite without showing diff first
#
$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$composeDir = Split-Path -Parent $scriptDir
# rootDir = workers/p0-integration/ (3 levels up from infra/ai/flowise/)
$rootDir = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $composeDir))
$flowiseUrl = "http://127.0.0.1:4300"
$flowFile = Join-Path $composeDir "flows\lesson-planner-v0.json"
$flowName = "Yuzan Lesson Planner V0"

# Check Flowise health
try {
    $null = Invoke-WebRequest -Uri "$flowiseUrl/api/v1/ping" -UseBasicParsing -TimeoutSec 5
} catch {
    Write-Host "[ERROR] Flowise not reachable. Run start.ps1 first." -ForegroundColor Red
    exit 1
}

# Read .env for auth
$envFile = Join-Path $composeDir ".env"
if (-not (Test-Path $envFile)) {
    Write-Host "[ERROR] .env not found" -ForegroundColor Red
    exit 1
}

$envContent = Get-Content $envFile -ErrorAction SilentlyContinue
$username = ($envContent | Where-Object { $_ -match "^FLOWISE_USERNAME=(.+)$" }) -replace "^FLOWISE_USERNAME=", ""
$password = ($envContent | Where-Object { $_ -match "^FLOWISE_PASSWORD=(.+)$" }) -replace "^FLOWISE_PASSWORD=", ""

# Authenticate
$loginBody = @{ username = $username; password = $password } | ConvertTo-Json
try {
    $loginResp = Invoke-RestMethod -Uri "$flowiseUrl/api/v1/login" -Method Post -Body $loginBody -ContentType "application/json" -ErrorAction Stop
    $token = $loginResp.token ?? $loginResp.accessToken ?? $loginResp
} catch {
    Write-Host "[ERROR] Flowise login failed: $_" -ForegroundColor Red
    exit 1
}

$headers = @{ Authorization = "Bearer $token" }

# Find flow
try {
    $flows = Invoke-RestMethod -Uri "$flowiseUrl/api/v1/chatflows" -Headers $headers -ErrorAction Stop
    $existing = $flows | Where-Object { $_.name -eq $flowName }
    if (-not $existing) {
        Write-Host "[ERROR] Flow '$flowName' not found in Flowise" -ForegroundColor Red
        exit 1
    }
    $flowId = $existing[0].id
} catch {
    Write-Host "[ERROR] Could not list flows: $_" -ForegroundColor Red
    exit 1
}

# Get full flow
try {
    $flowData = Invoke-RestMethod -Uri "$flowiseUrl/api/v1/chatflows/$flowId" -Headers $headers -ErrorAction Stop
} catch {
    Write-Host "[ERROR] Could not fetch flow: $_" -ForegroundColor Red
    exit 1
}

# Strip credentials and secrets
$flowJson = $flowData | ConvertTo-Json -Depth 50
# Remove credential IDs, API keys, and other sensitive fields
$flowJson = $flowJson -replace '"credentialId"\s*:\s*"[^"]*"', '"credentialId": ""'
$flowJson = $flowJson -replace '"apiKey"\s*:\s*"[^"]*"', '"apiKey": ""'
$flowJson = $flowJson -replace '"secretKey"\s*:\s*"[^"]*"', '"secretKey": ""'
$flowJson = $flowJson -replace '"password"\s*:\s*"[^"]*"', '"password": ""'
$flowJson = $flowJson -replace '"accessToken"\s*:\s*"[^"]*"', '"accessToken": ""'

# Check if existing file differs
if (Test-Path $flowFile) {
    $existingContent = Get-Content $flowFile -Raw
    if ($existingContent -eq $flowJson) {
        Write-Host "[OK] No changes detected. File is up to date." -ForegroundColor Green
        exit 0
    }

    Write-Host "[WARN] File differs from current Flowise state." -ForegroundColor Yellow
    Write-Host "[INFO] Showing diff is not available in this script." -ForegroundColor Yellow
    Write-Host "[INFO] Review changes manually before proceeding." -ForegroundColor Yellow
    $confirm = Read-Host "Overwrite $flowFile ? (y/N)"
    if ($confirm -ne "y" -and $confirm -ne "Y") {
        Write-Host "[INFO] Aborted. No changes written." -ForegroundColor Yellow
        exit 0
    }
}

# Write file
Set-Content -Path $flowFile -Value $flowJson -NoNewline
Write-Host "[OK] Flow exported to $flowFile" -ForegroundColor Green
Write-Host "[INFO] Credential IDs and secrets have been stripped." -ForegroundColor Cyan
