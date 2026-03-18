# OpenAEON Uninstaller for Windows
# Usage: iwr -useb https://raw.githubusercontent.com/gu2003li/OpenAEON/main/uninstall.ps1 | iex

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "  🦞 OpenAEON Uninstaller" -ForegroundColor Cyan
Write-Host ""

# 1. Stop and Uninstall Gateway Service
try {
    if (Get-Command openaeon -ErrorAction SilentlyContinue) {
        Write-Host "[*] Stopping and uninstalling OpenAEON gateway service..." -ForegroundColor Yellow
        openaeon gateway stop 2>$null | Out-Null
        openaeon gateway uninstall --force 2>$null | Out-Null
        Write-Host "[OK] Gateway service removed" -ForegroundColor Green
    }
} catch {
    Write-Host "[!] Failed to uninstall gateway service, continuing..." -ForegroundColor Gray
}

# 2. Remove Global NPM Package
try {
    if (Get-Command npm -ErrorAction SilentlyContinue) {
        Write-Host "[*] Removing global openaeon package..." -ForegroundColor Yellow
        npm uninstall -g openaeon 2>$null | Out-Null
        Write-Host "[OK] NPM package uninstalled" -ForegroundColor Green
    }
} catch {
    Write-Host "[!] Failed to uninstall NPM package, continuing..." -ForegroundColor Gray
}

# 3. Remove Local Wrapper
$userHome = [Environment]::GetFolderPath("UserProfile")
$cmdPath = Join-Path $userHome ".local\bin\openaeon.cmd"
if (Test-Path $cmdPath) {
    Write-Host "[*] Removing local wrapper at $cmdPath..." -ForegroundColor Yellow
    Remove-Item -Force $cmdPath
    Write-Host "[OK] Wrapper removed" -ForegroundColor Green
}

# 4. Remove Configuration (Optional/Confirm)
$configPath = Join-Path $userHome ".openaeon.json"
$dataDir = Join-Path $userHome ".openaeon"

Write-Host ""
Write-Host "[!] Configuration and session data were NOT removed automatically." -ForegroundColor Yellow
Write-Host "To completely wipe all data, manually delete:" -ForegroundColor Gray
Write-Host "  $configPath"
Write-Host "  $dataDir"
Write-Host "  $(Join-Path $userHome ".clawdbot")"
Write-Host "  $(Join-Path $userHome ".moltbot")"
Write-Host ""

Write-Host "[OK] OpenAEON has been uninstalled. Convergence reached. 🎯" -ForegroundColor Green
