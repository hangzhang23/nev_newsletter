[CmdletBinding()]
param(
    [switch]$SkipInitialRun
)

$ErrorActionPreference = "Stop"
$sourceRunner = Join-Path $PSScriptRoot "workbuddy-publisher.ps1"
$binDir = "E:\workbuddy\space\.workbuddy\bin"
$runnerTarget = Join-Path $binDir "workbuddy-publisher.ps1"
$launcherTarget = Join-Path $binDir "publish-nev.cmd"

function Assert-NoReparsePoint {
    param([Parameter(Mandatory = $true)][string]$Path)
    $cursor = New-Object IO.DirectoryInfo([IO.Path]::GetFullPath($Path))
    while ($null -ne $cursor) {
        if ($cursor.Exists -and (($cursor.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)) {
            throw "Installer path contains a junction or symbolic link; refusing to write."
        }
        $cursor = $cursor.Parent
    }
}

Assert-NoReparsePoint $binDir
New-Item -ItemType Directory -Force -Path $binDir | Out-Null
Assert-NoReparsePoint $binDir
foreach ($targetFile in @($runnerTarget, $launcherTarget)) {
    if (Test-Path -LiteralPath $targetFile) {
        $targetItem = Get-Item -LiteralPath $targetFile
        if (($targetItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "Installer target must not be a junction or symbolic link."
        }
    }
}
Copy-Item -LiteralPath $sourceRunner -Destination $runnerTarget -Force
$launcher = @"
@echo off
setlocal
powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$runnerTarget" -RequestPublication
exit /b %ERRORLEVEL%
"@
Set-Content -LiteralPath $launcherTarget -Value $launcher -Encoding ASCII

$taskName = "NEV WorkBuddy Publisher"
$taskArguments = '-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "{0}"' -f $runnerTarget
$taskAction = New-ScheduledTaskAction -Execute "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -Argument $taskArguments
$taskTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(15) -RepetitionInterval (New-TimeSpan -Minutes 15)
$taskPrincipal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
$taskSettings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 12)

Register-ScheduledTask -TaskName $taskName -Action $taskAction -Trigger $taskTrigger -Principal $taskPrincipal -Settings $taskSettings -Description "Retry pending NEV weekly data publication to GitHub every 15 minutes." -Force | Out-Null

Write-Host "Installed stable publisher entry: $launcherTarget"
Write-Host "Registered scheduled task: $taskName (every 15 minutes; runs only for pending requests)"
if (-not $SkipInitialRun) {
    & $launcherTarget
    exit $LASTEXITCODE
}
