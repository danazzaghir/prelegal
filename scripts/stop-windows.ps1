# Stops and removes the Prelegal container. Its database goes with it.
# Asks for confirmation first. Pass -Yes to skip the question.
param([switch]$Yes)

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "Docker is not installed or not on PATH."
    exit 1
}

$Container = "prelegal"

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

# docker rm -f succeeds even when there is no container, so check first.
$status = docker ps -a --filter "name=^${Container}$" --format "{{.Status}}"
if ($LASTEXITCODE -ne 0) { Write-Host "Could not reach Docker. Is Docker Desktop running?"; exit 1 }
if (-not $status) {
    Write-Host "Prelegal is not running."
    exit 0
}

Write-Host "This will stop and remove the Prelegal container."
Write-Host "  Container: $Container ($status)"
Write-Host "  Data lost: $(Get-DataLoss)"
Confirm-Action "Stop Prelegal and delete its data?"

docker rm -f $Container *> $null
Write-Host "Prelegal stopped."
