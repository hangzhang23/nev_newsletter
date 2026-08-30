[CmdletBinding()]
param(
    [switch]$RequestPublication
)

$ErrorActionPreference = "Stop"
$DataDir = "E:\workbuddy\space"
$Remote = "https://github.com/hangzhang23/nev_newsletter.git"
$Branch = "main"

$stateDir = "E:\workbuddy\space\.workbuddy\publisher"
$managedCheckout = Join-Path $stateDir "nev_web"
$logDir = "E:\workbuddy\space\.workbuddy\logs"
$logPath = Join-Path $logDir "nev-publisher.log"
$requestDir = Join-Path $stateDir "requests"
$lockPath = Join-Path $stateDir "publication.lock"

function Assert-NoReparsePoint {
    param([Parameter(Mandatory = $true)][string]$Path)
    $cursor = New-Object IO.DirectoryInfo([IO.Path]::GetFullPath($Path))
    while ($null -ne $cursor) {
        if ($cursor.Exists -and (($cursor.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)) {
            throw "Publisher path contains a junction or symbolic link; refusing to run."
        }
        $cursor = $cursor.Parent
    }
}

function Protect-LogText {
    param([string]$Text)
    if ($null -eq $Text) { return "" }
    $safe = $Text -replace '(?i)(https?://)[^/\s@]+@', '$1[redacted]@'
    return $safe -replace '(?i)((?:token|password|authorization)=)[^&\s]+', '$1[redacted]'
}

function Write-PublisherLog {
    param([string]$Message)
    $line = "{0} {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), (Protect-LogText $Message)
    Add-Content -LiteralPath $logPath -Value $line -Encoding UTF8
    Write-Host $line
}

function Invoke-LoggedNative {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string[]]$ArgumentList,
        [string]$WorkingDirectory
    )
    $savedErrorActionPreference = $ErrorActionPreference
    if ($WorkingDirectory) { Push-Location -LiteralPath $WorkingDirectory }
    try {
        $ErrorActionPreference = "Continue"
        $nativeOutput = @(& $FilePath @ArgumentList 2>&1)
        $nativeExitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $savedErrorActionPreference
        if ($WorkingDirectory) { Pop-Location }
    }
    foreach ($outputLine in $nativeOutput) { Write-PublisherLog ([string]$outputLine) }
    if ($nativeExitCode -ne 0) {
        throw "$FilePath failed with exit code $nativeExitCode"
    }
}

function Invoke-CapturedGit {
    param([Parameter(Mandatory = $true)][string[]]$ArgumentList)
    $output = & git.exe @ArgumentList 2>$null
    if ($LASTEXITCODE -ne 0) { throw "Git checkout validation failed." }
    $outputText = if ($null -eq $output) {
        ""
    } else {
        (@($output) | ForEach-Object { [string]$_ }) -join [Environment]::NewLine
    }
    return $outputText.Trim()
}

Assert-NoReparsePoint $stateDir
Assert-NoReparsePoint $logDir
Assert-NoReparsePoint $requestDir
New-Item -ItemType Directory -Force -Path $stateDir, $logDir, $requestDir | Out-Null
Assert-NoReparsePoint $stateDir
Assert-NoReparsePoint $logDir
Assert-NoReparsePoint $requestDir
foreach ($stateFile in @($lockPath, $logPath)) {
    if (Test-Path -LiteralPath $stateFile) {
        $stateItem = Get-Item -LiteralPath $stateFile
        if (($stateItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "Publisher state file must not be a junction or symbolic link."
        }
    }
}

if ($RequestPublication) {
    $requestPath = Join-Path $requestDir (([Guid]::NewGuid().ToString("N")) + ".pending")
    Set-Content -LiteralPath $requestPath -Value (Get-Date -Format "o") -Encoding ASCII
}
if (-not (Get-ChildItem -LiteralPath $requestDir -Filter "*.pending" -File)) {
    exit 0
}

$lockStream = $null
try {
    try {
        $lockStream = [IO.File]::Open($lockPath, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
    } catch [IO.IOException] {
        Write-PublisherLog "Another publisher holds the cross-session lock; keeping requests and returning failure."
        exit 2
    }

    $requestFiles = @(Get-ChildItem -LiteralPath $requestDir -Filter "*.pending" -File)
    if ($requestFiles.Count -eq 0) { exit 0 }
    foreach ($requestFile in $requestFiles) {
        if (($requestFile.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "Pending request file must not be a junction or symbolic link."
        }
    }

    $remoteUri = $null
    if (-not [Uri]::TryCreate($Remote, [UriKind]::Absolute, [ref]$remoteUri) -or
        $remoteUri.Scheme -ne "https" -or $remoteUri.UserInfo -or $remoteUri.Query -or $remoteUri.Fragment) {
        throw "Git remote must be an HTTPS URL without user info, query, or fragment."
    }
    if ($Branch -notmatch "^[A-Za-z0-9][A-Za-z0-9._/-]*$") { throw "Invalid Git branch name." }
    Invoke-CapturedGit @("check-ref-format", "--branch", $Branch) | Out-Null

    Write-PublisherLog "Processing pending weekly publication."
    if (-not (Test-Path -LiteralPath $DataDir -PathType Container)) {
        throw "Data directory does not exist: $DataDir"
    }

    Invoke-LoggedNative "git.exe" @("ls-remote", "--exit-code", $Remote, "refs/heads/$Branch")

    if (-not (Test-Path -LiteralPath $managedCheckout -PathType Container)) {
        Invoke-LoggedNative "git.exe" @("clone", "--single-branch", "--branch", $Branch, $Remote, $managedCheckout)
    }

    Assert-NoReparsePoint $managedCheckout
    $expectedCheckout = [IO.Path]::GetFullPath($managedCheckout).TrimEnd("\")
    $actualTopLevel = [IO.Path]::GetFullPath((Invoke-CapturedGit @("-C", $managedCheckout, "rev-parse", "--show-toplevel"))).TrimEnd("\")
    $actualGitDir = [IO.Path]::GetFullPath((Invoke-CapturedGit @("-C", $managedCheckout, "rev-parse", "--absolute-git-dir"))).TrimEnd("\")
    $expectedGitDir = [IO.Path]::GetFullPath((Join-Path $managedCheckout ".git")).TrimEnd("\")
    if ($actualTopLevel -ne $expectedCheckout -or $actualGitDir -ne $expectedGitDir) {
        throw "Managed checkout Git paths do not match; refusing to update."
    }

    $configuredRemote = Invoke-CapturedGit @("-C", $managedCheckout, "remote", "get-url", "origin")
    $currentBranch = Invoke-CapturedGit @("-C", $managedCheckout, "branch", "--show-current")
    $trackedStatus = Invoke-CapturedGit @("-C", $managedCheckout, "status", "--porcelain", "--untracked-files=no")
    if ($configuredRemote -ne $Remote -or $currentBranch -ne $Branch -or $trackedStatus) {
        throw "Managed checkout origin, branch, or tracked state is invalid; refusing to update."
    }

    Invoke-LoggedNative "git.exe" @("-C", $managedCheckout, "fetch", "--prune", "origin", $Branch)
    Invoke-LoggedNative "git.exe" @("-C", $managedCheckout, "merge", "--ff-only", "origin/$Branch")
    Invoke-LoggedNative "npm.cmd" @("--prefix", "scripts", "ci") $managedCheckout

    $env:NEV_DATA_DIR = $DataDir
    $env:NEV_GIT_REMOTE = $Remote
    $env:NEV_GIT_BRANCH = $Branch
    Invoke-LoggedNative "npm.cmd" @("run", "publish:data") $managedCheckout

    foreach ($requestFile in $requestFiles) {
        Remove-Item -LiteralPath $requestFile.FullName -Force
    }
    Write-PublisherLog "Publication succeeded; remote contains the latest data or no change was needed."
    exit 0
} catch {
    Write-PublisherLog ("Publication failed: " + $_.Exception.Message)
    $failurePosition = [string]$_.InvocationInfo.PositionMessage
    $failureStack = [string]$_.ScriptStackTrace
    if ($failurePosition) { Write-PublisherLog ("Failure position: " + $failurePosition) }
    if ($failureStack) { Write-PublisherLog ("Failure stack: " + $failureStack) }
    exit 1
} finally {
    if ($null -ne $lockStream) { $lockStream.Dispose() }
}
