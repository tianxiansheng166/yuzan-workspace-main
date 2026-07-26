$ErrorActionPreference = 'Stop'

function Repair-ProcessPathEnvironment {
    $variables = [Environment]::GetEnvironmentVariables('Process')
    $pathValue = [string]$variables['Path']; if (-not $pathValue) { $pathValue = [string]$variables['PATH'] }
    [Environment]::SetEnvironmentVariable('PATH', $null, 'Process')
    [Environment]::SetEnvironmentVariable('Path', $pathValue, 'Process')
}

function Get-TextSha256([string]$Text) {
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Text)))).Replace('-', '').ToLowerInvariant() } finally { $sha.Dispose() }
}

function Get-FileSha256([string]$Path) {
    (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

if (-not ('Yuzan.Runtime.NativeCommandLine' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

namespace Yuzan.Runtime {
    public static class NativeCommandLine {
        [DllImport("shell32.dll", SetLastError = true)]
        private static extern IntPtr CommandLineToArgvW(
            [MarshalAs(UnmanagedType.LPWStr)] string commandLine,
            out int argumentCount);

        [DllImport("kernel32.dll")]
        private static extern IntPtr LocalFree(IntPtr memory);

        public static string[] Parse(string commandLine) {
            int argumentCount;
            IntPtr arguments = CommandLineToArgvW(commandLine, out argumentCount);
            if (arguments == IntPtr.Zero) {
                throw new Win32Exception(Marshal.GetLastWin32Error());
            }
            try {
                string[] result = new string[argumentCount];
                for (int index = 0; index < argumentCount; index++) {
                    IntPtr value = Marshal.ReadIntPtr(arguments, index * IntPtr.Size);
                    result[index] = Marshal.PtrToStringUni(value);
                }
                return result;
            } finally {
                LocalFree(arguments);
            }
        }
    }
}
'@
}

function Get-ProcessCommandArgv([int]$ProcessId) {
    $instance = Get-CimInstance -ClassName Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
    if (-not $instance -or -not [string]$instance.CommandLine) { return @() }
    @([Yuzan.Runtime.NativeCommandLine]::Parse([string]$instance.CommandLine))
}

function Get-CommandArgvSha256([string[]]$Argv) {
    if (-not $Argv -or $Argv.Count -eq 0) { return $null }
    Get-TextSha256 (ConvertTo-Json -InputObject @($Argv) -Compress)
}

function Get-ProcessSnapshot([int]$ProcessId) {
    $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    if (-not $process) { return $null }
    $argv = @(Get-ProcessCommandArgv $ProcessId)
    [pscustomobject]@{
        pid = $ProcessId
        executable_path = [IO.Path]::GetFullPath([string]$process.Path)
        start_time_utc = $process.StartTime.ToUniversalTime().ToString('o')
        command_argv_sha256 = Get-CommandArgvSha256 $argv
    }
}

function Test-LockHeld([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { return $false }
    $stream = $null
    try {
        $stream = [IO.File]::Open($Path, [IO.FileMode]::Open, [IO.FileAccess]::ReadWrite, [IO.FileShare]::ReadWrite)
        try { $stream.Lock(0, 1); $stream.Unlock(0, 1); return $false } catch [IO.IOException] { return $true }
    } finally { if ($stream) { $stream.Dispose() } }
}

function New-ManagedProcessRecord {
    param(
        [string]$Name,
        [Diagnostics.Process]$WrapperProcess,
        [string]$AttestationPath,
        [string]$LockPath,
        [string]$WrapperScript,
        [string]$WrapperArgvSha256,
        [string]$CommandArgvSha256,
        [AllowNull()][Nullable[int]]$Port
    )
    $attestation = $null
    for ($attempt = 0; $attempt -lt 50 -and -not $attestation; $attempt++) {
        if ($WrapperProcess.HasExited) { throw "Managed wrapper for $Name exited with code $($WrapperProcess.ExitCode)." }
        if (Test-Path -LiteralPath $AttestationPath) {
            try { $attestation = Get-Content -LiteralPath $AttestationPath -Raw -Encoding UTF8 | ConvertFrom-Json } catch { }
        }
        if (-not $attestation) { Start-Sleep -Milliseconds 100 }
    }
    if (-not $attestation) { throw "Managed wrapper did not publish attestation for $Name." }
    $wrapper = Get-ProcessSnapshot ([int]$attestation.wrapper_pid)
    $child = Get-ProcessSnapshot ([int]$attestation.child_pid)
    if (-not $wrapper -or -not $child -or -not (Test-LockHeld $LockPath)) { throw "Incomplete live attestation for $Name." }
    [ordered]@{
        name = $Name; wrapper_pid = $wrapper.pid; wrapper_executable_path = $wrapper.executable_path; wrapper_start_time_utc = $wrapper.start_time_utc
        child_pid = $child.pid; child_executable_path = $child.executable_path; child_start_time_utc = $child.start_time_utc
        attestation_path = $AttestationPath; lock_path = $LockPath
        wrapper_script = [IO.Path]::GetFullPath($WrapperScript); wrapper_script_sha256 = Get-FileSha256 $WrapperScript
        wrapper_argv_sha256 = $WrapperArgvSha256; command_argv_sha256 = $CommandArgvSha256; port = $Port
    }
}

function Test-ManagedProcessRecord {
    param(
        $Record,
        [string]$ManifestNonce,
        [string]$RepositoryRoot,
        [string]$ExpectedCommit,
        [string]$ExpectedWrapperArgvSha256,
        [string]$ExpectedCommandArgvSha256
    )
    if (-not $Record) { return [pscustomobject]@{ valid = $false; reason = 'MANIFEST_RECORD_MISSING'; pid = $null } }
    $wrapper = Get-ProcessSnapshot ([int]$Record.wrapper_pid); $child = Get-ProcessSnapshot ([int]$Record.child_pid)
    if (-not $wrapper -or -not $child) { return [pscustomobject]@{ valid = $false; reason = 'PROCESS_NOT_RUNNING'; pid = [int]$Record.child_pid } }
    if (-not $wrapper.command_argv_sha256 -or -not $child.command_argv_sha256) {
        return [pscustomobject]@{ valid = $false; reason = 'LIVE_COMMAND_ARGV_UNAVAILABLE'; pid = $child.pid }
    }
    if ([string]$Record.wrapper_argv_sha256 -ne $ExpectedWrapperArgvSha256 -or
        [string]$Record.command_argv_sha256 -ne $ExpectedCommandArgvSha256 -or
        $wrapper.command_argv_sha256 -ne $ExpectedWrapperArgvSha256 -or
        $child.command_argv_sha256 -ne $ExpectedCommandArgvSha256) {
        return [pscustomobject]@{ valid = $false; reason = 'COMMAND_ARGV_MISMATCH'; pid = $child.pid }
    }
    $checks = @(
        $wrapper.executable_path.Equals([IO.Path]::GetFullPath([string]$Record.wrapper_executable_path), [StringComparison]::OrdinalIgnoreCase),
        $wrapper.start_time_utc -eq [string]$Record.wrapper_start_time_utc,
        $child.executable_path.Equals([IO.Path]::GetFullPath([string]$Record.child_executable_path), [StringComparison]::OrdinalIgnoreCase),
        $child.start_time_utc -eq [string]$Record.child_start_time_utc,
        (Test-LockHeld ([string]$Record.lock_path)),
        ((Get-FileSha256 ([string]$Record.wrapper_script)) -eq [string]$Record.wrapper_script_sha256),
        ([string]$Record.wrapper_argv_sha256 -eq $ExpectedWrapperArgvSha256),
        ([string]$Record.command_argv_sha256 -eq $ExpectedCommandArgvSha256)
    )
    if ($checks -contains $false) { return [pscustomobject]@{ valid = $false; reason = 'PROCESS_IDENTITY_OR_LOCK_MISMATCH'; pid = $child.pid } }
    try { $attestation = Get-Content -LiteralPath ([string]$Record.attestation_path) -Raw -Encoding UTF8 | ConvertFrom-Json } catch { return [pscustomobject]@{ valid = $false; reason = 'ATTESTATION_FILE_INVALID'; pid = $child.pid } }
    if ([string]$attestation.nonce -ne $ManifestNonce -or [string]$attestation.repository_root -ne $RepositoryRoot -or
        [string]$attestation.commit -ne $ExpectedCommit -or [string]$attestation.role -ne [string]$Record.name -or
        [int]$attestation.wrapper_pid -ne $wrapper.pid -or [int]$attestation.child_pid -ne $child.pid -or
        [string]$attestation.wrapper_argv_sha256 -ne [string]$Record.wrapper_argv_sha256 -or
        [string]$attestation.command_argv_sha256 -ne [string]$Record.command_argv_sha256) {
        return [pscustomobject]@{ valid = $false; reason = 'NONCE_ROOT_COMMIT_OR_ARGV_MISMATCH'; pid = $child.pid }
    }
    [pscustomobject]@{ valid = $true; reason = 'OWNED_NONCE_BOUND'; pid = $child.pid }
}

function Write-JsonAtomic([string]$Path, $Value) {
    $parent = Split-Path -Parent $Path; New-Item -ItemType Directory -Path $parent -Force | Out-Null
    $temp = "$Path.$([Guid]::NewGuid().ToString('N')).tmp"
    [IO.File]::WriteAllText($temp, ($Value | ConvertTo-Json -Depth 12), [Text.UTF8Encoding]::new($false))
    Move-Item -LiteralPath $temp -Destination $Path -Force
}
