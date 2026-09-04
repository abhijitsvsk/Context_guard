<# 
  ContextGuard Installer for Google Antigravity
  1-line install: irm https://raw.githubusercontent.com/abhijitsvsk/Context_guard/main/install.ps1 | iex
#>

$ErrorActionPreference = "Stop"

# --- Configuration ---
$repoUrl     = "https://github.com/abhijitsvsk/Context_guard.git"
$geminiRoot  = Join-Path $env:USERPROFILE ".gemini"
$configRoot  = Join-Path $geminiRoot "config"
$pluginDir   = Join-Path $configRoot "plugins\contextguard"
$sidecarDir  = Join-Path $configRoot "sidecars\contextguard"
$configJson  = Join-Path $configRoot "config.json"
$startupDir  = [System.Environment]::GetFolderPath("Startup")

# --- Banner ---
Write-Host ""
Write-Host "  ============================================" -ForegroundColor DarkGray
Write-Host "    Context Guard  -  Installer v1.0" -ForegroundColor White
Write-Host "    Real-time context monitor for Antigravity" -ForegroundColor Gray
Write-Host "  ============================================" -ForegroundColor DarkGray
Write-Host ""

# --- Step 1: Clone or update plugin ---
Write-Host "[1/5] Installing plugin..." -ForegroundColor Cyan
if (Test-Path (Join-Path $pluginDir ".git")) {
    Write-Host "      Plugin directory exists. Pulling latest..." -ForegroundColor Yellow
    git -C $pluginDir pull --ff-only origin main 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "      Pull failed. Removing and re-cloning..." -ForegroundColor Yellow
        Remove-Item -Path $pluginDir -Recurse -Force
        git clone $repoUrl $pluginDir
    }
} else {
    if (Test-Path $pluginDir) { Remove-Item -Path $pluginDir -Recurse -Force }
    git clone $repoUrl $pluginDir
}

if (-not (Test-Path (Join-Path $pluginDir "plugin.json"))) {
    Write-Host "      ERROR: Clone failed. Check your internet connection." -ForegroundColor Red
    exit 1
}
Write-Host "      Plugin installed at: $pluginDir" -ForegroundColor Green

# --- Step 2: Set up sidecar ---
Write-Host "[2/5] Configuring Antigravity sidecar..." -ForegroundColor Cyan
New-Item -ItemType Directory -Path $sidecarDir -Force | Out-Null

$skillsDir = Join-Path $pluginDir "skills\contextguard"
$filesToCopy = @(
    "cdp-service.js", "engine.js", "handoff.js", "doodle-ui.js",
    "history.js", "contextguard.js", "autostart.js", "scan_activity.js",
    "session-watcher.js", "SKILL.md"
)

foreach ($file in $filesToCopy) {
    $src = Join-Path $skillsDir $file
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination $sidecarDir -Force
    }
}

$dataDir = Join-Path $sidecarDir "data"
if (-not (Test-Path $dataDir)) { New-Item -ItemType Directory -Path $dataDir -Force | Out-Null }

$sidecarJson = @{
    description    = "ContextGuard real-time context window monitor and in-DOM telemetry daemon"
    command        = "node"
    args           = @("cdp-service.js")
    restart_policy = "always"
    display_name   = "ContextGuard"
} | ConvertTo-Json -Depth 5

[System.IO.File]::WriteAllText((Join-Path $sidecarDir "sidecar.json"), $sidecarJson)
Write-Host "      Sidecar configured at: $sidecarDir" -ForegroundColor Green

# --- Step 3: Enable in config.json ---
Write-Host "[3/5] Enabling in Antigravity config..." -ForegroundColor Cyan

if (Test-Path $configJson) {
    $cfg = Get-Content $configJson -Raw | ConvertFrom-Json
} else {
    $cfg = [PSCustomObject]@{}
}

# Enable plugin
if (-not $cfg.plugins) {
    $cfg | Add-Member -MemberType NoteProperty -Name "plugins" -Value ([PSCustomObject]@{}) -Force
}
$cfg.plugins | Add-Member -MemberType NoteProperty -Name "contextguard" -Value ([PSCustomObject]@{ enabled = $true }) -Force

# Enable sidecar
if (-not $cfg.sidecars) {
    $cfg | Add-Member -MemberType NoteProperty -Name "sidecars" -Value ([PSCustomObject]@{}) -Force
}
$cfg.sidecars | Add-Member -MemberType NoteProperty -Name "contextguard" -Value ([PSCustomObject]@{ enabled = $true }) -Force

$newJson = $cfg | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText($configJson, $newJson)
Write-Host "      Plugin and sidecar enabled in config.json" -ForegroundColor Green

# --- Step 4: Windows Startup auto-launch ---
Write-Host "[4/5] Setting up Windows startup service..." -ForegroundColor Cyan

$vbsPath     = Join-Path $startupDir "contextguard-autostart.vbs"
$servicePath = Join-Path $sidecarDir "cdp-service.js"
$vbsContent  = "Set WshShell = CreateObject(""WScript.Shell"")`nWshShell.Run ""node """"$servicePath"""""", 0, False"

[System.IO.File]::WriteAllText($vbsPath, $vbsContent)
Write-Host "      Startup script created at: $vbsPath" -ForegroundColor Green

# --- Step 5: Launch daemon now ---
Write-Host "[5/5] Starting ContextGuard daemon..." -ForegroundColor Cyan

$existing = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like '*cdp-service.js*' }

if ($existing) {
    Write-Host "      Daemon already running (PID: $($existing.ProcessId))" -ForegroundColor Yellow
} else {
    Start-Process -FilePath "node" -ArgumentList $servicePath -WorkingDirectory $sidecarDir -WindowStyle Hidden
    Write-Host "      Daemon launched successfully" -ForegroundColor Green
}

# --- Done ---
Write-Host ""
Write-Host "  ============================================" -ForegroundColor DarkGray
Write-Host "    ContextGuard installed successfully!" -ForegroundColor Green
Write-Host "  ============================================" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Plugin:   $pluginDir" -ForegroundColor Gray
Write-Host "  Sidecar:  $sidecarDir" -ForegroundColor Gray
Write-Host "  Startup:  $vbsPath" -ForegroundColor Gray
Write-Host ""
Write-Host "  Restart Antigravity to see the live badge." -ForegroundColor White
Write-Host "  Or type '/contextguard status' in any chat." -ForegroundColor White
Write-Host ""
