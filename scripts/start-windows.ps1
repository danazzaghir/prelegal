# Builds the Prelegal image and starts it at http://localhost:8000.
# Exit codes are checked by hand: in Windows PowerShell 5.1, ErrorActionPreference
# "Stop" would treat docker's progress output on stderr as a failure.

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "Docker is not installed or not on PATH. Install Docker Desktop and try again."
    exit 1
}

Set-Location (Join-Path $PSScriptRoot "..")
$Image = "prelegal"
$Container = "prelegal"
$Port = if ($env:PORT) { $env:PORT } else { "8000" }

docker build -t $Image .
if ($LASTEXITCODE -ne 0) { Write-Host "docker build failed."; exit 1 }

docker rm -f $Container *> $null

$runArgs = @("run", "-d", "--name", $Container, "-p", "${Port}:8000")
if (Test-Path ".env") { $runArgs += @("--env-file", ".env") }
$runArgs += $Image
docker @runArgs | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Host "docker run failed."; exit 1 }

Write-Host "Waiting for Prelegal to start..."
for ($i = 0; $i -lt 30; $i++) {
    try {
        Invoke-RestMethod "http://localhost:$Port/api/health" | Out-Null
        Write-Host "Prelegal is running at http://localhost:$Port"
        exit 0
    } catch {
        Start-Sleep -Seconds 1
    }
}

Write-Host "Prelegal did not become healthy. Logs:"
docker logs $Container
exit 1
