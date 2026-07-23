$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$failures = [System.Collections.Generic.List[string]]::new()

$requiredFiles = @(
    'AGENTS.md',
    'README-FIRST.md',
    'project-ops/AI-DEVELOPMENT-CONTRACT.md',
    'project-ops/CONTEXT-ROUTER.md',
    'project-ops/DEVELOPMENT-WORKFLOW.md',
    'project-ops/NEXT-DEVELOPMENT-QUEUE.md',
    'project-ops/templates/task.template.json',
    'project-ops/templates/HANDOFF.template.md',
    'project-ops/prompts/TASK-PLANNING-PROMPT.md',
    'project-ops/prompts/IMPLEMENTATION-PROMPT.md',
    'project-ops/prompts/REVIEW-PROMPT.md',
    'scripts/repo/task-gate.ps1'
)

foreach ($relativePath in $requiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $repoRoot $relativePath) -PathType Leaf)) {
        $failures.Add("Missing framework file: $relativePath")
    }
}

$jsonFiles = @('project-ops/templates/task.template.json') + @(
    Get-ChildItem -LiteralPath (Join-Path $repoRoot 'project-ops/tasks/active') -Filter '*.json' |
        ForEach-Object { $_.FullName }
)
foreach ($jsonPath in $jsonFiles) {
    $candidate = if ([System.IO.Path]::IsPathRooted($jsonPath)) {
        $jsonPath
    } else {
        Join-Path $repoRoot $jsonPath
    }
    $displayPath = $candidate.Substring($repoRoot.Length).TrimStart('\', '/')
    try {
        Get-Content -LiteralPath $candidate -Raw -Encoding UTF8 |
            ConvertFrom-Json | Out-Null
    } catch {
        $failures.Add("Invalid JSON: $displayPath - $($_.Exception.Message)")
    }
}

$powerShellFiles = Get-ChildItem -LiteralPath (Join-Path $repoRoot 'scripts/repo') -Filter '*.ps1'
foreach ($file in $powerShellFiles) {
    $tokens = $null
    $errors = $null
    [void][System.Management.Automation.Language.Parser]::ParseFile(
        $file.FullName,
        [ref]$tokens,
        [ref]$errors
    )
    foreach ($error in @($errors)) {
        $failures.Add("PowerShell parse error in $($file.Name): $($error.Message)")
    }
}

$contentChecks = @(
    @{
        Path = 'AGENTS.md'
        Patterns = @('AI-DEVELOPMENT-CONTRACT.md', 'task-gate.ps1 -Mode preflight', 'allowed_paths')
    },
    @{
        Path = 'project-ops/AI-DEVELOPMENT-CONTRACT.md'
        Patterns = @('P0', 'minimal_tests', 'git status')
    },
    @{
        Path = 'project-ops/DEVELOPMENT-WORKFLOW.md'
        Patterns = @('-Mode preflight', '-Mode review', '-Mode finish', 'git push')
    },
    @{
        Path = 'project-ops/prompts/IMPLEMENTATION-PROMPT.md'
        Patterns = @('context.required', 'minimal_tests', 'READY_FOR_REVIEW')
    },
    @{
        Path = 'project-ops/prompts/REVIEW-PROMPT.md'
        Patterns = @('base_commit...HEAD', 'allowed_paths', 'findings')
    }
)
foreach ($check in $contentChecks) {
    $content = Get-Content -LiteralPath (Join-Path $repoRoot $check.Path) -Raw -Encoding UTF8
    foreach ($pattern in $check.Patterns) {
        if (-not $content.Contains($pattern)) {
            $failures.Add("Reader contract missing '$pattern' in $($check.Path)")
        }
    }
}

if ($failures.Count -gt 0) {
    foreach ($failure in $failures) {
        Write-Host "[FAIL] $failure" -ForegroundColor Red
    }
    throw "Development framework smoke failed with $($failures.Count) issue(s)."
}

Write-Host "[PASS] development framework smoke: $($requiredFiles.Count) files, $($jsonFiles.Count) JSON documents, $($powerShellFiles.Count) PowerShell scripts"
