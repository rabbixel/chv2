Write-Output 'Processes:'
Get-Process -Name httpd,nginx,mysqld,php-cgi -ErrorAction SilentlyContinue | ForEach-Object { [pscustomobject]@{Name=$_.ProcessName;Id=$_.Id} }
Write-Output 'Laragon tools:'
Get-ChildItem 'C:\laragon\bin\php' -Directory -ErrorAction SilentlyContinue | ForEach-Object { Write-Output "PHP_VERSION_DIR=$($_.Name)" }
Write-Output "WPCLI_BAT=$((Test-Path 'C:\laragon\bin\wp-cli\wp.bat'))"
Write-Output "PROJECT_WP_LOAD=$((Test-Path 'C:\laragon\www\creativehatti\wp-load.php'))"
Write-Output 'Local REST check:'
try {
    $response = Invoke-WebRequest -Uri 'http://127.0.0.1/wp-json/ch/v1/homepage-sections' -Headers @{Host='creativehatti.test'} -TimeoutSec 6
    Write-Output "REST_STATUS=$([int]$response.StatusCode);LENGTH=$($response.RawContentLength)"
} catch {
    $status = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 'unavailable' }
    Write-Output "REST_ERROR=$status;$($_.Exception.Message)"
}
