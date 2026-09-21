[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$NodePath,

    [Parameter(Mandatory = $true)]
    [string]$InstallDir,

    [Parameter(Mandatory = $true)]
    [string]$StateDir
)

$ErrorActionPreference = 'Stop'
$workerPath = Join-Path $PSScriptRoot 'auto-localization-maintainer.js'
$heartbeatPath = Join-Path $StateDir 'task-run.json'

New-Item -ItemType Directory -Path $StateDir -Force | Out-Null

$heartbeat = [ordered]@{
    startedAt = (Get-Date).ToUniversalTime().ToString('o')
    finishedAt = $null
    exitCode = $null
    message = '維護器執行中。'
}
$heartbeat | ConvertTo-Json | Set-Content -LiteralPath $heartbeatPath -Encoding UTF8

try {
    $output = & $NodePath $workerPath --install-dir $InstallDir --state-dir $StateDir 2>&1
    $exitCode = $LASTEXITCODE
    $heartbeat.finishedAt = (Get-Date).ToUniversalTime().ToString('o')
    $heartbeat.exitCode = $exitCode
    $heartbeat.message = if ($exitCode -eq 0) { '維護器執行完成。' } else { '維護器回報失敗。' }
    if ($output) {
        $heartbeat.output = @($output | Select-Object -Last 10)
    }
    $heartbeat | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath $heartbeatPath -Encoding UTF8
    exit $exitCode
} catch {
    $heartbeat.finishedAt = (Get-Date).ToUniversalTime().ToString('o')
    $heartbeat.exitCode = 1
    $heartbeat.message = $_.Exception.Message
    $heartbeat | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath $heartbeatPath -Encoding UTF8
    exit 1
}
