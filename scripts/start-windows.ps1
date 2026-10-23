# Builds the Prelegal image and starts it at http://localhost:8000.
# Asks for confirmation first, because starting replaces any existing
# container and its database. Pass -Yes to skip the question.
# Exit codes are checked by hand: in Windows PowerShell 5.1, ErrorActionPreference
# "Stop" would treat docker's progress output on stderr as a failure.
param([switch]$Yes)

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "Docker is not installed or not on PATH. Install Docker Desktop and try again."
    exit 1
}

Set-Location (Join-Path $PSScriptRoot "..")
$Image = "prelegal"
$Container = "prelegal"
$Port = if ($env:PORT) { $env:PORT } else { "8000" }

# Counts accounts and saved agreements in the container's database.
# Single quotes only: PowerShell 5.1 mangles double quotes in native arguments.
$CountPy = "import os, sqlite3; db = sqlite3.connect(os.environ['DATABASE_PATH']); print(*(db.execute('SELECT COUNT(*) FROM ' + t).fetchone()[0] for t in ('users', 'agreements')))"

function Plural($n, $word) { if ($n -eq "1") { "1 $word" } else { "$n ${word}s" } }

function Get-DataLoss {
    $counts = docker exec $Container python -c $CountPy 2> $null
    if ($LASTEXITCODE -eq 0 -and $counts) {
        $users, $agreements = "$counts".Trim() -split "\s+"
        "$(Plural $users 'account') and $(Plural $agreements 'saved agreement')"
    } else {
        "all accounts and saved agreements (could not count them)"
    }
}

function Confirm-Action($question) {
    if ($Yes) { return }
    if ([Console]::IsInputRedirected) {
        Write-Host "No terminal to ask for confirmation. Re-run with -Yes to continue."
        exit 1
    }
    $answer = Read-Host "$question [y/N]"
    if ($answer -notmatch '^(y|yes)$') {
        Write-Host "Cancelled. Nothing was changed."
        exit 1
    }
}

$status = docker ps -a --filter "name=^${Container}$" --format "{{.Status}}"
if ($LASTEXITCODE -ne 0) { Write-Host "Could not reach Docker. Is Docker Desktop running?"; exit 1 }
Write-Host "This will build the `"$Image`" image and start Prelegal at http://localhost:$Port."
if ($status) {
    Write-Host "  Container: $Container ($status) - will be removed and replaced"
    Write-Host "  Data lost: $(Get-DataLoss)"
} else {
    Write-Host "  Container: $Container (new)"
    Write-Host "  Data lost: none"
}
Confirm-Action "Start Prelegal?"

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
