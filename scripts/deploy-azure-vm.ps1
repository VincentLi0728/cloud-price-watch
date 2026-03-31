param(
  [Parameter(Mandatory = $true)]
  [string]$Target,

  [string]$AppRoot = "/opt/cloud-price-watch/current",

  [string]$RemoteHealthUrl = "http://127.0.0.1:3000/api/health",

  [string]$PublicHealthUrl = ""
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path (Join-Path $scriptDir "..")).Path
$archivePath = Join-Path $env:TEMP "cloud-price-watch-deploy.tar.gz"
$remoteArchivePath = "/tmp/cloud-price-watch-deploy.tar.gz"
$targetHost = if ($Target.Contains("@")) { $Target.Split("@")[-1] } else { $Target }

Write-Host "Creating deployment archive from $repoRoot"
if (Test-Path $archivePath) {
  Remove-Item -LiteralPath $archivePath -Force
}

tar.exe `
  --exclude=".git" `
  --exclude=".env" `
  --exclude="node_modules" `
  -czf `
  $archivePath `
  -C `
  $repoRoot `
  .

Write-Host "Uploading archive to $Target"
scp.exe $archivePath "${Target}:${remoteArchivePath}" | Out-Host

$remoteCommand = @"
set -euo pipefail
sudo mkdir -p '${AppRoot}'
sudo tar -xzf '${remoteArchivePath}' -C '${AppRoot}'
sudo chown -R www-data:www-data '${AppRoot}'
sudo systemctl restart cloud-price-watch
sleep 2
curl -fsS --max-time 10 '${RemoteHealthUrl}'
sudo systemctl status cloud-price-watch --no-pager
rm -f '${remoteArchivePath}'
"@

Write-Host "Restarting service and verifying internal health"
ssh.exe $Target $remoteCommand | Out-Host

if ($PublicHealthUrl) {
  Write-Host ""
  Write-Host "Verifying public endpoint: $PublicHealthUrl"
  curl.exe --fail --silent --show-error --max-time 15 $PublicHealthUrl | Out-Host
} elseif ($targetHost -match '^\d{1,3}(\.\d{1,3}){3}$') {
  $defaultHealthUrl = "http://${targetHost}/api/health"
  Write-Host ""
  Write-Host "Verifying public endpoint: $defaultHealthUrl"
  curl.exe --fail --silent --show-error --max-time 15 $defaultHealthUrl | Out-Host
} else {
  Write-Host ""
  Write-Host "Skipping public health check because Target does not expose an IPv4 host."
  Write-Host "Pass -PublicHealthUrl to verify a custom domain or HTTPS endpoint."
}

if (Test-Path $archivePath) {
  Remove-Item -LiteralPath $archivePath -Force
}
