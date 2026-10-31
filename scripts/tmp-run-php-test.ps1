& 'C:\laragon\bin\php\php-8.3.33-Win32-vs16-x64\php.exe' 'tests/wordpress-homepage-packs.php'
Write-Output "PHP_EXIT=$LASTEXITCODE"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& 'C:\laragon\bin\php\php-8.3.33-Win32-vs16-x64\php.exe' -l 'wordpress/creative-hatti-home-sections/creative-hatti-home-sections.php'
Write-Output "PLUGIN_LINT_EXIT=$LASTEXITCODE"
