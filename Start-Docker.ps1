# Construye y arranca la web de Tercer Tiempo en Docker (tercer-tiempo-web). Si la API no está en marcha y el
# repositorio del backend está junto a este, la arranca antes con su propio script y en el mismo entorno.
#   -Environment  Development (por defecto), Production, Pilot o FakeDatos: entorno de la API (ver Start-Docker.ps1 del
#                 backend).
#   -SkipBuild    reutiliza las imágenes existentes.
#   -BackendPath  carpeta del repositorio del backend (por defecto ..\backend).
param(
    [ValidateSet('Development', 'Production', 'Pilot', 'FakeDatos')][string]$Environment = 'Development',
    [switch]$SkipBuild,
    [string]$BackendPath = (Join-Path (Split-Path $PSScriptRoot -Parent) 'backend')
)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

function Invoke-Native([scriptblock]$Command, [string]$Message) {
    $ErrorActionPreference = 'Continue'
    & $Command
    if ($LASTEXITCODE -ne 0) { throw $Message }
}

$dockerOs = docker info --format '{{.OSType}}' 2>$null
if ($LASTEXITCODE -ne 0 -or $dockerOs -ne 'linux') { throw 'Docker Desktop debe estar iniciado con contenedores Linux.' }

$apiRunning = [bool](docker ps --filter 'name=^tercer-tiempo-api$' --filter 'status=running' --format '{{.Names}}')
if (-not $apiRunning) {
    $backendScript = Join-Path $BackendPath 'Start-Docker.ps1'
    if (Test-Path -LiteralPath $backendScript) {
        Write-Host "Arrancando la API ($Environment) desde $BackendPath" -ForegroundColor Cyan
        & $backendScript -Environment $Environment -SkipBuild:$SkipBuild
    } else {
        Write-Warning "La API no está en marcha y no se encuentra $backendScript. La web arrancará, pero /api responderá con error hasta que la API esté disponible."
    }
}

$network = docker network ls --filter 'name=^tercer-tiempo-net$' --format '{{.Name}}'
if (-not $network) { Invoke-Native { docker network create tercer-tiempo-net | Out-Null } 'No se pudo crear la red tercer-tiempo-net.' }

if (-not $SkipBuild) {
    Invoke-Native { docker compose build } 'No se pudo construir la imagen de la web.'
}
Invoke-Native { docker compose up -d --wait --wait-timeout 120 } 'La web no alcanzó un estado saludable. Consulta docker compose logs.'
$port = if ($env:TT_WEB_PORT) { $env:TT_WEB_PORT } else { '8180' }
Write-Host "Web Docker lista: http://127.0.0.1:$port (/jobs para la administración)" -ForegroundColor Green
docker compose ps
