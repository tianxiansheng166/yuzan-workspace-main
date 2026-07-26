param(
    [string]$Python = 'python',
    [string]$HostAddress = '127.0.0.1',
    [int]$Port = 8100
)

$ErrorActionPreference = 'Stop'
$rootDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$envFile = Join-Path $rootDir '.env'
$serviceDir = Join-Path $rootDir 'backend\speech-scoring'

if (-not (Test-Path -LiteralPath $envFile)) {
    throw "Missing environment file: $envFile"
}

foreach ($rawLine in Get-Content -LiteralPath $envFile) {
    $line = $rawLine.Trim()
    if (-not $line -or $line.StartsWith('#')) { continue }
    $separator = $line.IndexOf('=')
    if ($separator -le 0) { continue }
    $key = $line.Substring(0, $separator).Trim()
    $value = $line.Substring($separator + 1).Trim().Trim('"')
    [Environment]::SetEnvironmentVariable($key, $value, 'Process')
}

Push-Location $serviceDir
try {
    & $Python -m uvicorn app.main:app --host $HostAddress --port $Port
} finally {
    Pop-Location
}
