# Starts the local MySQL 8.4.9 development instance on port 3307.
# Port 3306 is commonly occupied by XAMPP MariaDB on this machine.

$bin = 'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe'
$ini = 'C:\mysql84\my.ini'

if (-not (Test-Path $bin)) {
  Write-Error "MySQL Server 8.4 not found at $bin"
  exit 1
}

if (-not (Test-Path $ini)) {
  Write-Error "MySQL config not found at $ini. Re-run Phase 0 setup."
  exit 1
}

$listening = Get-NetTCPConnection -LocalPort 3307 -State Listen -ErrorAction SilentlyContinue
if ($listening) {
  Write-Output "MySQL already listening on 3307 (PID $($listening.OwningProcess))"
  exit 0
}

Start-Process -FilePath $bin -ArgumentList '--defaults-file=C:\mysql84\my.ini' -WindowStyle Hidden
Start-Sleep -Seconds 3

$listening = Get-NetTCPConnection -LocalPort 3307 -State Listen -ErrorAction SilentlyContinue
if ($listening) {
  Write-Output "MySQL 8.4 started on 127.0.0.1:3307"
} else {
  Write-Error "MySQL failed to start on port 3307"
  exit 1
}
