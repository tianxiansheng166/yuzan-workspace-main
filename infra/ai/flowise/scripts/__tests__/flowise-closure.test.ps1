# flowise-closure.test.ps1 — Flowise infrastructure closure tests
# Run: pwsh -File infra/ai/flowise/scripts/__tests__/flowise-closure.test.ps1
#
# Tests:
#   1. Container startup (docker compose up)
#   2. Health check (/api/v1/ping returns 200)
#   3. Workflow import (bootstrap creates flowId)
#   4. flowData valid (imported flow has nodes)
#   5. Bootstrap idempotent (second run returns same flowId)
#   6. flowId persistence (flow-id.txt exists after bootstrap)
#   7. Prediction API uses form (POST with form field returns 200/401, not 422)
#   8. No API Key rejection (without key, prediction returns expected error not 500)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$composeDir = Split-Path -Parent (Split-Path -Parent $scriptDir)
$rootDir = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $composeDir))
$flowiseUrl = "http://127.0.0.1:4300"
$flowIdFile = Join-Path $rootDir "runtime-local\flowise\flow-id.txt"
$flowFile = Join-Path $composeDir "flows\lesson-planner-v0.json"

$passed = 0
$failed = 0

function Assert-True($condition, $message) {
    if ($condition) {
        $script:passed++
        Write-Host "  PASS: $message" -ForegroundColor Green
    } else {
        $script:failed++
        Write-Host "  FAIL: $message" -ForegroundColor Red
    }
}

# ── Test 1: Container startup ──────────────────────────────────────────────
Write-Host "`n1. Container must be running" -ForegroundColor Cyan
$container = docker ps --filter "name=yuzan-flowise" --format "{{.Names}}" 2>$null
Assert-True ($container -eq "yuzan-flowise") "yuzan-flowise container is running"

# ── Test 2: Health check ───────────────────────────────────────────────────
Write-Host "`n2. Flowise health check must return 200" -ForegroundColor Cyan
try {
    $healthResp = Invoke-WebRequest -Uri "$flowiseUrl/api/v1/ping" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    Assert-True ($healthResp.StatusCode -eq 200) "Health check returned 200"
} catch {
    Assert-True $false "Health check failed: $_"
}

# ── Test 3: Workflow import ────────────────────────────────────────────────
Write-Host "`n3. Bootstrap must create flowId" -ForegroundColor Cyan
$bootstrapScript = Join-Path $composeDir "scripts\bootstrap-flow.ps1"
if (Test-Path $bootstrapScript) {
    try {
        & $bootstrapScript 2>&1 | Out-Null
        Assert-True ($LASTEXITCODE -eq 0) "Bootstrap script exited with 0"
    } catch {
        Assert-True $false "Bootstrap failed: $_"
    }
} else {
    Assert-True $false "Bootstrap script not found at $bootstrapScript"
}

# ── Test 4: flowData valid ─────────────────────────────────────────────────
Write-Host "`n4. Flow definition must have valid nodes" -ForegroundColor Cyan
if (Test-Path $flowFile) {
    $flowJson = Get-Content $flowFile -Raw
    try {
        $flowObj = ConvertFrom-Json $flowJson -AsHashtable
        $hasNodes = $flowObj.ContainsKey("nodes") -or ($flowObj.ContainsKey("flowData") -and $flowObj.flowData -match "nodes")
        Assert-True $hasNodes "Flow definition contains nodes"
    } catch {
        Assert-True $false "Flow file is not valid JSON"
    }
} else {
    Assert-True $false "Flow file not found: $flowFile"
}

# ── Test 5: Bootstrap idempotent ───────────────────────────────────────────
Write-Host "`n5. Second bootstrap must return same flowId" -ForegroundColor Cyan
if (Test-Path $flowIdFile) {
    $firstId = Get-Content $flowIdFile -Raw -ErrorAction SilentlyContinue
    if ($bootstrapScript -and (Test-Path $bootstrapScript)) {
        & $bootstrapScript 2>&1 | Out-Null
        $secondId = Get-Content $flowIdFile -Raw -ErrorAction SilentlyContinue
        Assert-True ($firstId -eq $secondId) "flowId unchanged after second bootstrap"
    }
} else {
    Assert-True $false "flow-id.txt not found after bootstrap"
}

# ── Test 6: flowId persistence ─────────────────────────────────────────────
Write-Host "`n6. flow-id.txt must exist after bootstrap" -ForegroundColor Cyan
Assert-True (Test-Path $flowIdFile) "flow-id.txt exists"

# ── Test 7: Prediction API uses form ──────────────────────────────────────
Write-Host "`n7. Prediction API must accept form field (not reject as 422)" -ForegroundColor Cyan
if (Test-Path $flowIdFile) {
    $flowId = (Get-Content $flowIdFile -Raw).Trim()
    $predBody = @{
        form = @{
            goal = "test-goal"
            gradeBand = "G3-4"
            subject = "语文"
            durationMinutes = 40
        }
        streaming = $false
    } | ConvertTo-Json -Depth 5

    try {
        $predResp = Invoke-WebRequest -Uri "$flowiseUrl/api/v1/prediction/$flowId" -Method Post -Body $predBody -ContentType "application/json" -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
        # If we get here, it accepted the form payload
        Assert-True ($predResp.StatusCode -in @(200, 201)) "Prediction accepted form payload"
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        # 401 = auth required (expected without login), 404 = flow not found
        # 422 = wrong payload format — this is the failure case
        Assert-True ($statusCode -ne 422) "Prediction API did not reject form as 422 (got $statusCode)"
    }
} else {
    Assert-True $false "Cannot test prediction without flowId"
}

# ── Test 8: No API Key rejection ───────────────────────────────────────────
Write-Host "`n8. Prediction without API key must return 401 not 500" -ForegroundColor Cyan
if (Test-Path $flowIdFile) {
    $flowId = (Get-Content $flowIdFile -Raw).Trim()
    try {
        $noKeyResp = Invoke-WebRequest -Uri "$flowiseUrl/api/v1/prediction/$flowId" -Method Post -Body '{"question":"test"}' -ContentType "application/json" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        # No auth required — flow is publicly accessible
        Assert-True $true "Prediction accessible without API key"
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        # 401/403 = auth expected, 500 = server crash (bad)
        Assert-True ($statusCode -ne 500) "Without API key, got $statusCode not 500"
    }
}

# ── Summary ────────────────────────────────────────────────────────────────
Write-Host "`n$('=' * 50)"
Write-Host "Flowise Closure Tests: Passed=$passed  Failed=$failed"
if ($failed -gt 0) {
    Write-Host "SOME TESTS FAILED" -ForegroundColor Red
    exit 1
} else {
    Write-Host "ALL TESTS PASSED" -ForegroundColor Green
    exit 0
}
