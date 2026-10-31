# Creative Hatti API Plugin — Staging Release Manifest

**Prepared:** 2026-10-31 (Asia/Kolkata)
**Release source candidate:** current repository working tree at base commit `65e9e06`, plugin directory `wordpress/creative-hatti-api/`
**Active comparison:** `C:\laragon\www\creativehatti\wp-content\plugins\creative-hatti-api`
**Disposition:** Read-only reconciliation. No plugin files were copied, no options/database were touched, and nothing was deployed.

## Authoritative source decision

For a future staging package, use the **complete repository plugin directory** as the candidate source, subject to normal review of its current uncommitted changes. The active Laragon copy is stale in core checkout/cart behavior and omits a repository class that the repository bootstrap loads. The repository version has matching PHP controller tests for the stricter behavior. Do not patch the active plugin file-by-file or use it as the release source.

The repository is not yet an immutable release: `README.md` and `includes/class-ch-api.php` have uncommitted repository changes (the latter contains the previously reviewed `ch/v1` CORS handling). Hashes below describe the working-tree bytes at the time of this report, not a commit or signed artifact. Review those changes, then create an approved immutable release artifact before staging deployment. Never include local environment files, credentials, database dumps, uploads or S3 objects.

## Comparison findings

| File | Difference | Why repository source is preferred |
|---|---|---|
| `creative-hatti-api.php` | Active bootstrap omits the `class-ch-communications.php` require and does not register `CH_Communications` hooks. | Repository bootstrap loads the complete shipped class. The class formats EDD purchase receipts, suppresses receipts for incomplete orders, and provides safe frontend links. Because the active bootstrap does not instantiate it, the missing active file currently causes absent receipt customization rather than an immediate include fatal. Ship the complete directory; do not copy only the entry file. |
| `includes/class-ch-cart-controller.php` | Active implementation casts EDD price-helper results directly to float and emits variable price options without the repository's raw numeric/range checks. | Repository implementation checks raw fixed/variable amounts, effective EDD price, finite/nonnegative values, and excludes malformed options. Without those checks, malformed or missing values can be coerced to `0` and represented as available/free. The repository PHP controller test explicitly checks malformed fixed/variable values, missing `edd_price` metadata, and legitimate explicit zero. |
| `includes/class-ch-checkout-controller.php` | Active version lacks 101 lines present in repository: guest/auth checkout rate limiting and the independent-free checkout invariants. | Repository limits quote attempts (default 60/minute) and prepare attempts (default 10/hour), validates the signed guest identity token, allows safe idempotent replay, and returns retry-after on throttling. It also enforces the independent-free request's one free item, quantity one, no discount, zero-total requirement and owner/payload safeguards. The active controller ignores the `independent_free` request flag and has no matching rate-limiter. Frontend checkout code and tests use the token and independent-free flow, so the server implementation should remain aligned. |
| `includes/class-ch-communications.php` | Missing from active Laragon; present in repository and required by its bootstrap. | Must ship alongside the repository bootstrap. It changes EDD receipt presentation only; EDD remains the email sender. It does not expose payment keys, activation keys, signed download tokens, or storage paths. |

The repository and active versions of the remaining 15 PHP files matched byte-for-byte. `README.md` also differs; its repository hash includes the current CORS documentation. No active-only plugin files were found in the bounded comparison.

## Candidate package inventory and SHA-256

Include these 20 files in the plugin directory; hashes are lowercase SHA-256 of current repository working-tree files:

| Relative path | SHA-256 | Active Laragon state |
|---|---|---|
| `README.md` | `ea02e177b89357156e46697c1b291a794d79585534812f3b5c1e63fbc6544864` | Differs |
| `creative-hatti-api.php` | `7f1df1ac1d6194c20a266dca805531c43026bfae0c0b7b076abca0ad80e676c7` | Differs |
| `includes/class-ch-api.php` | `97079dee1ab57c29da27c2da2f3d01f13773d4674b2a327a5080a80630595673` | Matches |
| `includes/class-ch-auth-controller.php` | `e5af23701c9197395e15fbc4263ac3a03bf8ceeb0b970446609ebdcf2c21eb43` | Matches |
| `includes/class-ch-cache.php` | `d6e65688c36f8a49c1b51d333ace46334da2d2fdde45ae1c7505d762a29dc3e6` | Matches |
| `includes/class-ch-cart-controller.php` | `5caab0ea1f0e0a41ac2a26bc21335eb8b3e8d6f8edd02253f8b76c586b876b68` | Differs |
| `includes/class-ch-categories-controller.php` | `70b237f3977dcb9fd2ebb1dac60cd764d66f9791604dc65a48e3809e0d9f37f6` | Matches |
| `includes/class-ch-checkout-controller.php` | `83381873cee0772500782fcb6cf2051b3fabc1d77b6e8d74c6765f9ea1b37246` | Differs |
| `includes/class-ch-claim-controller.php` | `3787d718129d1c55bd326e3497c84a608e3de2f8efb8b034453bb6cc6ae1ab24` | Matches |
| `includes/class-ch-communications.php` | `ca2bb47bbedae314f6d543b8cd3ee4fad00a585e9967f6e1bb326534491e254f` | Missing |
| `includes/class-ch-customer-controller.php` | `1834dcc663e1604bfce346d0010ad7408faf814b2506486ae96a49e311b285b0` | Matches |
| `includes/class-ch-downloads-controller.php` | `707fd81c34e8fb428c0aa5a97ccab0baebf3b38ae07e50bff5da6650314a23c2` | Matches |
| `includes/class-ch-media.php` | `f3197d9dac0681f75674c3c3e50df4a35de1d8aeaed99e53fbd2b7a1e91455ce` | Matches |
| `includes/class-ch-orders-controller.php` | `8efc2c900b0290c63ce173d14a8ea9c14cbcb419d931385f49081af0c4d34120` | Matches |
| `includes/class-ch-payment-controller.php` | `a504779bd9db25d7c5baa773d24c0c6be247754c2b99133f849eed21a490f7c8` | Matches |
| `includes/class-ch-product-transformer.php` | `8011f14b62926219199f36733988cfbafbe33450ccc7587f3cc71d2822ee93f9` | Matches |
| `includes/class-ch-products-controller.php` | `a89c9b8774a91658e3db51cacdada0874b5e979adf9010982d6fda4c1bd40513` | Matches |
| `includes/class-ch-purchase-limit-service.php` | `030ce4acc8ea0653a6f6f7e500d3e216ff46059612156acc3f8e8b19704d5f88` | Matches |
| `includes/class-ch-wishlist-controller.php` | `095541a8ecce0f471aea22d874343fb3a4b669120dcc57ae66f73caea4cb46ca` | Matches |
| `includes/class-ch-wishlist-service.php` | `c7927607d077b472eda20864261aa21bb84c6c52eab5ab44bdcc48747847f6e0` | Matches |

## Runtime and deployment prerequisites

- Local tested stack: WordPress 7.1.4, EDD 3.7.3, PHP 8.3.33 CLI, MySQL 8.4.3. This is local compatibility evidence only; validate the staging host and required PHP extensions.
- Activate WordPress and EDD first, then this API plugin; activate Indexed Search after API/EDD and Homepage Sections after EDD/API. Confirm the exact plugin dependencies and route registration on the clean staging site.
- API plugin header version is `0.1.0`; it does not declare a minimum WordPress/PHP version in the main file. The receipt class uses EDD order/email APIs and therefore must run with compatible EDD installed before its `plugins_loaded` callback.
- The plugin bundle must contain the bootstrap and every included `includes/*.php` file together. Do not copy only the three differing PHP files.
- Review `CH_API_ALLOWED_ORIGINS` for the exact staging frontend origin and keep `CH_AUTH_BRIDGE_SECRET` server-only and paired with Next. Keep payment in approved test mode and S3 files private.
- No database migration is required by this file reconciliation. Do not rebuild the search index as part of plugin packaging without a separate approved plan.

## Validation evidence

- PHP 8.3 syntax: repository bootstrap, cart controller, checkout controller and communications class all pass `php -l`.
- `tests/wordpress-api-cors.php`: 11 assertions passed.
- `tests/wordpress-cart-controller.php`: synthetic controller tests passed, including invalid/missing price rejection.
- `tests/wordpress-checkout-controller.php`: synthetic controller tests passed, including independent free checkout and rate limits.
- Node checkout/free-flow suites: 9/9 passed (`independent-free-checkout.test.mjs`, `checkout-rate-limit-identity.test.mjs`).
- `npm run lint` and `npm run typecheck`: passed.
- These controller tests use local stubs; they do not constitute staging WordPress/EDD integration, authenticated browser, payment, order, or email-delivery tests.

## Release gate

This is a **candidate manifest**, not deployment authorization. Before staging: review the two modified repository files, produce a clean immutable archive from the reviewed repository tree, verify archive hashes, back up the target staging plugin directory, install the whole plugin package, and run read-only route/price checks plus approved test-account checkout and email tests. Do not alter the active Laragon copy during this audit.
