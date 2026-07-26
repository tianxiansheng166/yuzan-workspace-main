[CmdletBinding()]
param(
    [string]$RepositoryRoot
)

$ErrorActionPreference = 'Stop'
if (-not $RepositoryRoot) {
    $RepositoryRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
}
$rootDir = [System.IO.Path]::GetFullPath($RepositoryRoot)

function Get-ListenerPid([int]$Port) {
    $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique)
    if ($listeners.Count -eq 0) { return @() }
    return @($listeners | Sort-Object)
}

function Test-Health([string]$Url, [string]$ExpectedPattern) {
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        return [pscustomobject]@{
            ok = ([int]$response.StatusCode -eq 200 -and $response.Content -match $ExpectedPattern)
            http_status = [int]$response.StatusCode
            error = $null
        }
    } catch {
        $status = $null
        if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
            $status = [int]$_.Exception.Response.StatusCode
        }
        return [pscustomobject]@{ ok = $false; http_status = $status; error = $_.Exception.Message }
    }
}

function Get-CanonicalWorkerPids {
    $needle = $rootDir.ToLowerInvariant()
    $matches = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
        $command = [string]$_.CommandLine
        $lower = $command.ToLowerInvariant()
        $lower.Contains($needle) -and
        $lower.Contains('backend\worker') -and
        ($lower.Contains('src/main.ts') -or $lower.Contains('dist/main.js') -or $lower.Contains('dist\main.js'))
    } | Select-Object -ExpandProperty ProcessId -Unique | Sort-Object)
    return @($matches)
}

$apiPids = @(Get-ListenerPid 4000)
$frontendPids = @(Get-ListenerPid 4175)
$speechPids = @(Get-ListenerPid 8100)
$workerPids = @(Get-CanonicalWorkerPids)
$api = Test-Health 'http://127.0.0.1:4000/api/v1/health/ready' '"status"\s*:\s*"ok"'
$proxy = Test-Health 'http://127.0.0.1:4175/api/v1/health/ready' '"status"\s*:\s*"ok"'
$speech = Test-Health 'http://127.0.0.1:8100/health' '"status"\s*:\s*"ok"'

$services = [ordered]@{
    api = [ordered]@{ port = 4000; pids = $apiPids; healthy = $api.ok; http_status = $api.http_status; error = $api.error }
    frontend_proxy = [ordered]@{ port = 4175; pids = $frontendPids; healthy = $proxy.ok; http_status = $proxy.http_status; error = $proxy.error }
    speech = [ordered]@{ port = 8100; pids = $speechPids; healthy = $speech.ok; http_status = $speech.http_status; error = $speech.error }
    worker = [ordered]@{ port = $null; pids = $workerPids; healthy = ($workerPids.Count -gt 0); http_status = $null; error = $(if ($workerPids.Count -eq 0) { 'No canonical worker process was detected.' } else { $null }) }
}

$allReady = $services.api.healthy -and $services.frontend_proxy.healthy -and
    $services.speech.healthy -and $services.worker.healthy
$occupiedPorts = @($apiPids + $frontendPids + $speechPids).Count
$head = (git -C $rootDir rev-parse HEAD 2>$null).Trim()

[pscustomobject]@{
    schema_version = 1
    checked_at = [DateTime]::UtcNow.ToString('o')
    repository_root = $rootDir
    repository_commit = $head
    fixed_ports = [ordered]@{ api = 4000; frontend = 4175; speech = 8100 }
    all_ready = [bool]$allReady
    any_service_detected = ($occupiedPorts -gt 0 -or $workerPids.Count -gt 0)
    worker_process_count = $workerPids.Count
    duplicate_worker_warning = ($workerPids.Count -gt 1)
    provenance = 'OBSERVED_RUNTIME_NOT_COMMIT_ATTESTED'
    services = $services
}
