[CmdletBinding()]
param(
    [string]$InstallDir = "$env:LOCALAPPDATA\Programs\antigravity"
)

$ErrorActionPreference = 'Stop'
$taskName = 'Antigravity Zh-TW Maintainer'
$projectDir = $PSScriptRoot
$workerPath = Join-Path $projectDir 'auto-localization-maintainer.js'
$runnerPath = Join-Path $projectDir 'run-auto-maintainer.ps1'
$nodePath = (Get-Command node -ErrorAction Stop).Source
$powerShellPath = (Get-Process -Id $PID).Path
$userId = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$stateDir = Join-Path $env:LOCALAPPDATA 'AntigravityZhTW'

if (-not (Test-Path -LiteralPath $workerPath)) {
    throw "找不到繁中維護器：$workerPath"
}

if (-not (Test-Path -LiteralPath $runnerPath)) {
    throw "找不到排程執行器：$runnerPath"
}

if (-not (Test-Path -LiteralPath (Join-Path $projectDir 'node_modules\@electron\asar'))) {
    throw '尚未安裝本地相依套件，請先在專案目錄執行 npm install。'
}

$arguments = '-NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "{0}" -NodePath "{1}" -InstallDir "{2}" -StateDir "{3}"' -f $runnerPath, $nodePath, $InstallDir, $stateDir
$action = New-ScheduledTaskAction `
    -Execute $powerShellPath `
    -Argument $arguments `
    -WorkingDirectory $projectDir

$logonTrigger = New-ScheduledTaskTrigger -AtLogOn -User $userId
$repeatTrigger = New-ScheduledTaskTrigger `
    -Once `
    -At (Get-Date).AddMinutes(1) `
    -RepetitionInterval (New-TimeSpan -Minutes 1)

$settings = New-ScheduledTaskSettingsSet `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 10) `
    -StartWhenAvailable `
    -DontStopIfGoingOnBatteries `
    -AllowStartIfOnBatteries `
    -Hidden

$principal = New-ScheduledTaskPrincipal `
    -UserId $userId `
    -LogonType Interactive `
    -RunLevel Limited

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger @($logonTrigger, $repeatTrigger) `
    -Settings $settings `
    -Principal $principal `
    -Description '偵測 Antigravity 官方更新，程式關閉後自動重新套用已確認的台灣繁中翻譯。' `
    -Force `
    -ErrorAction Stop | Out-Null

if ($null -eq (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue)) {
    throw 'Windows 工作排程器未回傳已建立的繁中維護器。'
}

& $nodePath $workerPath --install-dir $InstallDir --state-dir $stateDir --status
if ($LASTEXITCODE -ne 0) {
    throw '繁中維護器初次檢查失敗，請查看 %LOCALAPPDATA%\AntigravityZhTW\maintainer.log。'
}

Write-Host 'Antigravity 繁中維護器已安裝。'
Write-Host '檢查頻率：每分鐘一次，並於登入 Windows 時檢查。'
Write-Host '原則：Antigravity 使用中不強制關閉；關閉後自動套用。'
