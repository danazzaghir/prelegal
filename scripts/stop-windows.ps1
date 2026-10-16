# Stops and removes the Prelegal container. Its database goes with it.

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "Docker is not installed or not on PATH."
    exit 1
}

docker rm -f prelegal *> $null
if ($LASTEXITCODE -eq 0) {
    Write-Host "Prelegal stopped."
} else {
    Write-Host "Prelegal is not running."
}
