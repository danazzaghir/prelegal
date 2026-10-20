# Stops and removes the Prelegal container. Its database goes with it.

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "Docker is not installed or not on PATH."
    exit 1
}

# docker rm -f succeeds even when there is no container, so check first.
if (docker ps -aq --filter "name=^prelegal$") {
    docker rm -f prelegal *> $null
    Write-Host "Prelegal stopped."
} else {
    Write-Host "Prelegal is not running."
}
