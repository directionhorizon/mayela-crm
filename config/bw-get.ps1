param(
    [string]$ItemId = "03c7c0fc-fb18-40eb-b1a0-b4cf0021ee36",
    [switch]$Raw
)

$ErrorActionPreference = "Stop"

$bw = $null
foreach ($candidate in @(
    "C:\pinokio\bin\npm\bw.cmd",
    "C:\pinokio\bin\npm\bw.ps1",
    (Join-Path $env:APPDATA "npm\bw.cmd")
)) {
    if (Test-Path $candidate) { $bw = $candidate; break }
}
if (-not $bw) {
    $g = Get-Command bw -ErrorAction SilentlyContinue
    if ($g) { $bw = $g.Source }
}
if (-not $bw) { Write-Host "Bitwarden CLI introuvable." -ForegroundColor Red; exit 1 }

$sessionFile = Join-Path $PSScriptRoot "..\supabase\.bw-session"
if (-not (Test-Path $sessionFile)) {
    Write-Host "Session absente. Lance config\bw-login.ps1 d'abord." -ForegroundColor Red
    exit 1
}
$env:BW_SESSION = (Get-Content $sessionFile -Raw).Trim()
$env:BW_NOINTERACTION = "true"

$out = & $bw get item $ItemId 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) { Write-Host "Erreur lecture Bitwarden." -ForegroundColor Red; exit 1 }
$item = $out | ConvertFrom-Json

$pass = $item.login.password
if ($Raw) {
    Write-Host $pass
} else {
    Write-Host ("Item   : " + $item.name)
    Write-Host ("User   : " + $item.login.username)
    Write-Host ("Secret : " + $pass)
}