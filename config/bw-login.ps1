param(
    [string]$Email = "direction.horizon.cg@gmail.com"
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
if (-not $bw) {
    Write-Host "bw (Bitwarden CLI) introuvable. Installez-le : npm i -g @bitwarden/cli" -ForegroundColor Red
    Read-Host "Appuyez sur Entree pour fermer..."
    exit 1
}

Write-Host "Connexion a Bitwarden pour $Email" -ForegroundColor Cyan
$sec = Read-Host "Mot de passe maitre" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
try {
    $pass = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
}
finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
}

$out = & $bw login $Email $pass --raw 2>&1 | Out-String
$code = $LASTEXITCODE
$pass = $null
if ($code -ne 0) {
    Write-Host "Echec de connexion (code $code) : " -ForegroundColor Red
    Write-Host $out
    Read-Host "Appuyez sur Entree pour fermer..."
    exit 1
}

$session = $out.Trim()
if (-not $session) {
    Write-Host "Aucune session retournee." -ForegroundColor Red
    Read-Host "Appuyez sur Entree pour fermer..."
    exit 1
}

$dir = (Resolve-Path (Join-Path $PSScriptRoot "..\supabase")).Path
[IO.File]::WriteAllText((Join-Path $dir ".bw-session"), $session)
Write-Host "OK : session Bitwarden enregistree dans supabase\.bw-session (gitignore)" -ForegroundColor Green
Read-Host "Appuyez sur Entree pour fermer..."