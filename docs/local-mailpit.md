# Local Mailpit setup

Mailpit is loopback-only and captures mail from the Laragon WordPress install.
Do not enable Mailpit relay options for local development.

## Start Mailpit

Run this in PowerShell (the terminal can remain open):

```powershell
& 'C:\laragon\bin\mailpit\1.22.3\mailpit.exe' --smtp '127.0.0.1:11025' --listen '127.0.0.1:18025'
```

- Web UI: <http://127.0.0.1:18025/>
- SMTP: `127.0.0.1:11025`

The SMTP listener and web UI bind only to loopback. Mailpit's SMTP relay is
disabled by default, so captured messages are not sent to their recipients.

## WordPress configuration

`C:\laragon\www\creativehatti\wp-content\mu-plugins\ch-local-auth-bridge.php`
sets `WP_ENVIRONMENT_TYPE` to `local`, changes the sender to
`creativehatti@example.invalid`, and configures PHPMailer to use
`127.0.0.1:11025` without authentication or TLS. The `phpmailer_init` callback
returns without changing mail settings outside the local environment. Keep this
file in the Laragon WordPress install; it is not part of production settings.

## Verify capture

For a safe synthetic test, use `synthetic-claim@example.invalid` as the
recipient. Example through local WordPress:

```powershell
& 'C:\laragon\bin\php\php-8.3.33-Win32-vs16-x64\php.exe' -r "`$_SERVER['REQUEST_SCHEME']='http'; `$_SERVER['HTTP_HOST']='creativehatti.test'; require 'C:/laragon/www/creativehatti/wp-load.php'; var_export(wp_mail('synthetic-claim@example.invalid', 'Creative Hatti account-claim capture test', 'Synthetic local verification only.')); echo PHP_EOL;"
```

`wp_mail()` should return `true`; the message should appear in the Mailpit UI.
The account-claim endpoint also sends its verification link with `wp_mail()`,
so it uses the same local capture route.
