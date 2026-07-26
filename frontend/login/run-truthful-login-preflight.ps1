[CmdletBinding()]
param(
    [int]$FrontendPort = 44175,
    [int]$UnavailableApiPort = 44999,
    [int]$RealApiPort = 4000
)

$ErrorActionPreference = 'Stop'
$env:PYTHONUTF8 = '1'
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$verifier = Join-Path $PSScriptRoot 'verify_truthful_login.py'

function Wait-Listener {
    param([int]$Port, [System.Diagnostics.Process]$Process)
    $deadline = [DateTime]::UtcNow.AddSeconds(15)
    while ([DateTime]::UtcNow -lt $deadline) {
        if ($Process.HasExited) { throw "frontend server exited with code $($Process.ExitCode)" }
        $client = [System.Net.Sockets.TcpClient]::new()
        try {
            $client.Connect('127.0.0.1', $Port)
            return
        } catch {
            Start-Sleep -Milliseconds 100
        } finally {
            $client.Dispose()
        }
    }
    throw "frontend server did not listen on port $Port"
}

function Invoke-BrowserCase {
    param([string]$Mode, [string]$ApiBaseUrl)

    $existing = Get-NetTCPConnection -LocalPort $FrontendPort -State Listen -ErrorAction SilentlyContinue
    if ($existing) { throw "port $FrontendPort is already in use; refusing to reuse an unknown runtime" }

    $oldPort = $env:PORT
    $oldApiBaseUrl = $env:API_BASE_URL
    $env:PORT = [string]$FrontendPort
    $env:API_BASE_URL = $ApiBaseUrl
    $process = $null
    try {
        $process = Start-Process -FilePath 'node' -ArgumentList 'frontend/server.mjs' -WorkingDirectory $repoRoot -WindowStyle Hidden -PassThru
        Wait-Listener -Port $FrontendPort -Process $process
        & python $verifier --base-url "http://127.0.0.1:$FrontendPort" --mode $Mode --screenshot (Join-Path $env:TEMP "yuzan-login-$Mode.png")
        if ($LASTEXITCODE -ne 0) { throw "browser case $Mode failed with exit code $LASTEXITCODE" }
    } finally {
        if ($process -and -not $process.HasExited) {
            Stop-Process -Id $process.Id
            $process.WaitForExit(5000) | Out-Null
        }
        $env:PORT = $oldPort
        $env:API_BASE_URL = $oldApiBaseUrl
    }
}

Invoke-BrowserCase -Mode 'api-unavailable' -ApiBaseUrl "http://127.0.0.1:$UnavailableApiPort"
Invoke-BrowserCase -Mode 'revoked-session' -ApiBaseUrl "http://127.0.0.1:$UnavailableApiPort"

$realApi = Get-NetTCPConnection -LocalPort $RealApiPort -State Listen -ErrorAction SilentlyContinue
if (-not $realApi) { throw "real API is not listening on port $RealApiPort" }
Invoke-BrowserCase -Mode 'invalid-credentials' -ApiBaseUrl "http://127.0.0.1:$RealApiPort"
Invoke-BrowserCase -Mode 'authenticated-student' -ApiBaseUrl "http://127.0.0.1:$RealApiPort"

Write-Host '[PASS] truthful login browser preflight completed without leaving a frontend listener'
