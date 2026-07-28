$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$nodePath = 'C:\Users\hassa\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$stdoutLog = Join-Path $projectRoot '.expo\rider-dev-server-offline.log'
$stderrLog = Join-Path $projectRoot '.expo\rider-dev-server-offline-error.log'

# Some Codex terminal sessions inherit duplicate Path/PATH keys. Start-Process
# treats those as duplicate dictionary keys, so normalize them for this process.
$runtimePath = ([System.Environment]::GetEnvironmentVariables())['Path']
[System.Environment]::SetEnvironmentVariable('PATH', $null, 'Process')
[System.Environment]::SetEnvironmentVariable('Path', $runtimePath, 'Process')

$process = Start-Process `
  -FilePath $nodePath `
  -ArgumentList @('node_modules/expo/bin/cli', 'start', '--clear', '--offline') `
  -WorkingDirectory $projectRoot `
  -RedirectStandardOutput $stdoutLog `
  -RedirectStandardError $stderrLog `
  -WindowStyle Hidden `
  -PassThru

Write-Output $process.Id
