function Resolve-YuzanWorkspace {
  [CmdletBinding()]
  param(
    [string]$WorkspaceRoot,
    [string]$StartPath = $PSScriptRoot
  )

  if ($WorkspaceRoot) {
    $candidate = [System.IO.Path]::GetFullPath($WorkspaceRoot)
    if ((Test-Path (Join-Path $candidate 'yuzan-next')) -and (Test-Path (Join-Path $candidate 'orchestration'))) {
      return $candidate
    }
    throw "WorkspaceRoot 无效：$candidate。必须同时包含 yuzan-next 和 orchestration。"
  }

  $current = [System.IO.DirectoryInfo]::new([System.IO.Path]::GetFullPath($StartPath))
  while ($null -ne $current) {
    if ((Test-Path (Join-Path $current.FullName 'yuzan-next')) -and (Test-Path (Join-Path $current.FullName 'orchestration'))) {
      return $current.FullName
    }
    $current = $current.Parent
  }

  throw '无法自动定位工作区。请使用 -WorkspaceRoot 传入包含 yuzan-next 和 orchestration 的目录。'
}
