param([switch]$Foreground)
# Alternate local ports avoid Windows' reserved 1025 range. No relay is inherited.
$ErrorActionPreference = 'Stop'
Get-ChildItem Env:MP_* | Remove-Item
$mailpitExecutable = 'C:/laragon/bin/mailpit/1.22.3/mailpit.exe'
$mailpitArguments = @(
    '--listen', '127.0.0.1:18025', '--smtp', '127.0.0.1:11025',
    '--smtp-allowed-recipients', '@example[.]test$'
)
if ($Foreground) { & $mailpitExecutable @mailpitArguments; exit $LASTEXITCODE }
Start-Process -WindowStyle Hidden -FilePath $mailpitExecutable -ArgumentList $mailpitArguments -PassThru | Select-Object Id
