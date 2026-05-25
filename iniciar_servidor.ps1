# CyberLens — reinicia la API en puerto 8000 (limpia procesos colgados)
$ErrorActionPreference = "SilentlyContinue"
Set-Location $PSScriptRoot

Write-Host "Cerrando procesos en puerto 8000..." -ForegroundColor Yellow
Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 2

Write-Host "Activando entorno virtual..." -ForegroundColor Cyan
& "$PSScriptRoot\venv\Scripts\Activate.ps1"

Write-Host "Iniciando API en http://127.0.0.1:8000" -ForegroundColor Green
Write-Host "Documentacion: http://localhost:8000/docs" -ForegroundColor Green
Write-Host "Detener con Ctrl+C`n" -ForegroundColor DarkGray

# Sin --reload evita cuelgues frecuentes en Windows
uvicorn main:app --host 127.0.0.1 --port 8000
