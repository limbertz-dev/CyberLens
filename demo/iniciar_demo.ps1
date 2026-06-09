# CyberChat - red social simulada (independiente de CyberLens)
$ErrorActionPreference = 'SilentlyContinue'
Set-Location $PSScriptRoot

$venvPython = Join-Path $PSScriptRoot '..\venv\Scripts\python.exe'
if (-not (Test-Path $venvPython)) {
    Write-Host 'Creando entorno virtual...' -ForegroundColor Yellow
    python -m venv (Join-Path $PSScriptRoot '..\venv')
}

$python = $venvPython
if (-not (Test-Path $python)) {
    $python = 'python'
}

Write-Host 'Instalando dependencias de CyberChat...' -ForegroundColor Cyan
& $python -m pip install -q -r requirements.txt

Write-Host 'Cerrando procesos en puerto 8080...' -ForegroundColor Yellow
Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 1

$lanIp = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
  Select-Object -First 1 -ExpandProperty IPAddress)

Write-Host ''
Write-Host '  CyberChat - red social simulada' -ForegroundColor Cyan
Write-Host '  PC (pantalla demo):  http://localhost:8080' -ForegroundColor Green
if ($lanIp) {
  Write-Host "  Red WiFi (moviles):  http://${lanIp}:8080/movil.html" -ForegroundColor Green
  Write-Host "  Codigo QR:           http://${lanIp}:8080/acceso.html" -ForegroundColor Green
} else {
  Write-Host '  Red WiFi: no se detecto IP local (usa ipconfig)' -ForegroundColor Yellow
}
if (Test-Path (Join-Path $PSScriptRoot '.env')) {
    Write-Host '  API key detectada en .env' -ForegroundColor Green
} else {
    Write-Host '  Sin .env: usa plantillas (copia .env.example para IA)' -ForegroundColor Yellow
}
Write-Host '  Detener con Ctrl+C' -ForegroundColor DarkGray
Write-Host ''

& $python server.py
