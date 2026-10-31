# WordPress REST CORS security review — local

**Date:** 2026-10-31  
**Scope:** Local custom `ch/v1` REST API and WordPress core behavior only. No production requests, real customer credentials, orders or payments used.

## Finding and root cause

WordPress core's `rest_send_cors_headers()` emits the request's `Origin` as `Access-Control-Allow-Origin` and sets `Access-Control-Allow-Credentials: true`. The custom API plugin had an optional exact-origin callback, but it ran at the same priority as core and only added an allowed origin; it did not remove the origin that core had already reflected. As a result, untrusted origins received credentialed CORS headers on `ch/v1` responses.

This is a confirmed permissive CORS policy, but **no authenticated data exposure was demonstrated**. Public product/category/search responses are designed for public read. The custom account/checkout/order/download routes retain their bridge/session permissions. An unauthenticated request to `/customer/me` returns a generic bridge-unavailable 503 locally. No authenticated browser/cookie/nonce test was performed.

## Narrow local fix

Modified only the approved custom API plugin:

- Register the `ch/v1` CORS response filter at priority 99, after WordPress core.
- For only the `ch/v1` namespace, remove core's reflected `Access-Control-Allow-Origin` and `Access-Control-Allow-Credentials` headers, then re-add them only for an exact configured origin.
- For untrusted or absent origins, also remove allow-method, allow-header and expose-header CORS policy headers. WordPress core's handling of every other REST namespace remains unchanged.
- Configure exact comma-separated origins with `CH_API_ALLOWED_ORIGINS`. A site may instead supply the existing `ch_api_allowed_origins` filter. With no environment value, `.test`/loopback local WordPress defaults to `http://localhost:3000`; non-local hosts get no implicit origin. An explicitly empty environment value disables origins. No Creative Hatti production domain is hardcoded.
- Updated the API README with this behavior and added `tests/wordpress-api-cors.php` (11 assertions).

The Next.js storefront uses server-to-server API calls, which do not depend on CORS. Same-origin WordPress admin requests also do not require CORS. The local WordPress origin was not added as a cross-origin allowlist entry.

## Live local response tests after synchronization

The active Laragon plugin was synchronized from the repository after backups. Only `includes/class-ch-api.php` was copied. The active file's pre-change SHA-256 matched the repository baseline; the original and first-patch backups are in the temp directory. No WordPress options were changed.

| Request | Status | Allow-Origin | Allow-Credentials | Preflight methods/headers |
|---|---:|---|---|---|
| `GET /wp-json/ch/v1/products`, no Origin | 200 | absent | absent | absent |
| OPTIONS from `http://localhost:3000` | 200 | exact `http://localhost:3000` | true | core REST methods and headers preserved |
| OPTIONS from `https://evil.example` | 200 | absent | absent | allow-method/header/expose headers absent |
| OPTIONS from `http://creativehatti.test` | 200 | absent | absent | absent; same-origin WP admin is not governed by cross-origin CORS |
| `GET /wp-json/ch/v1/customer/me` from untrusted origin, unauthenticated | 503 | absent | absent | no account data returned; bridge unavailable |
| local Next `/search?q=diwali` after sync | 200 | n/a | n/a | server-to-server API path remains functional |

An unrelated core route, `/wp-json/wp/v2/types`, still echoes an external origin with credentials. That response contains public route metadata. This plugin deliberately leaves non-`ch/v1` namespaces alone to avoid breaking unrelated WordPress REST integrations. A no-credential request to an authenticated WordPress endpoint was not used to infer authenticated exposure. Staging security review should confirm whether a global WordPress CORS policy is needed and test authenticated endpoints with a non-production account.

## Tests

- `tests/wordpress-api-cors.php`: 11 assertions passed (configured origins, local fallback, explicit empty deny-all, filter override, malformed/path/null/non-HTTP and unrelated-origin rejection).
- Live local header probes above passed.
- Public product/search API requests and the local Next search integration remained HTTP 200.
- PHP syntax checks passed for all files under `wordpress/creative-hatti-api`.
- Real search integration: 5 passed, 0 failed (including Next render); `node --test tests/*.test.mjs`: 195 passed, 6 skipped, 0 failed.
- TypeScript typecheck, ESLint and `git diff --check` passed.
- Admin UI was not authenticated or visually browser-tested because no browser surface was available. No account, checkout, payment or download action was invoked.

## Remaining risk and deployment notes

- WordPress core still reflects origins for routes outside `/ch/v1`; no sensitive response leakage has been confirmed. Review core namespaces, all plugins and actual staging auth/nonce requirements before launch.
- Production must set `CH_API_ALLOWED_ORIGINS` if a browser on a separate origin must call the custom API. The server-side storefront does not need this header. Verify trusted origins, cookies, SameSite/Secure policy, proxy headers and CDN cache variation on staging.
- This local synchronization is not deployment approval. Do not copy this change to production without the normal review and backup process.

## Rollback

- Active pre-sync file backup: `%TEMP%\creative-hatti-cors-backup-class-ch-api.php` (original pre-change file). A second backup of the first patch is `%TEMP%\creative-hatti-cors-backup-class-ch-api-v1.php`.
- Restore only the active Laragon `includes/class-ch-api.php` from the original backup if the local behavior must be reverted. Revert only the CORS changes in the repository class, README and test; do not reset the worktree or restore unrelated files.
- Remove/unset `CH_API_ALLOWED_ORIGINS` to use environment-specific defaults; set it explicitly empty to disable cross-origin `ch/v1` access.

### Additional unauthenticated core-route probe

`GET /wp-json/wp/v2/users/me?context=edit` from an unrelated origin, without cookies or a nonce, returned HTTP 401 `rest_not_logged_in`; no user data was returned, although WordPress core still emitted the reflected Origin and credentials headers. This confirms the unauthenticated request could not read the protected response, but it does not substitute for a controlled logged-in browser test with a non-production account.
