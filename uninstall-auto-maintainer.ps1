[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$taskName = 'Antigravity Zh-TW Maintainer'
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if ($null -eq $task) {
    Write-Host 'Antigravity 繁中維護器目前未安裝。'
    exit 0
}

Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
Write-Host 'Antigravity 繁中維護器已停止並移除。既有繁中與備份不受影響。'
