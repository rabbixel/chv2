# Creative Hatti — Production Build Verification

**Date:** 2026-10-31 (Asia/Kolkata)
**Environment:** Windows/Laragon; Node 24.19.0, npm 11.17.0, Next 16.3.6. Local WordPress `http://creativehatti.test`.

## Method and isolation

- Confirmed the existing Next development server was serving port 3000 before the build. It was not stopped.
- Built an isolated copy under `%TEMP%\creative-hatti-audit-kAm1jL`; its `.next` output did not share the active development `.next`. The copy used a junction to the existing dependency tree and included `.env.local` without printing values.
- The first default Turbopack attempt failed before compilation because Turbopack rejected the dependency junction as outside its filesystem root. Retried the isolated build with the supported webpack builder.
- The webpack build exposed invalid CSS Module global selectors in receipt print styles. Those selectors were moved to a receipt-scoped global print rule; the production build then passed.
- Ran the built output with `next start --port 3100`, checked bounded routes, then stopped only that audit-launched production process. The active dev server remained untouched.

## Result

`next build --webpack`: **passed**. Compilation and TypeScript passed; static generation completed for 53 routes and traces finalized. No Next build warnings/errors remained in the successful run. The helper emitted a Node deprecation warning because it launched npm with `shell: true`; that warning was from the temporary audit harness, not application code.

## Route smoke

Against the built server on port 3100, homepage, `/search?q=diwali`, and `/category/freebies` returned 200. `/account/wishlist` redirected as expected without a session. `/cart` and `/checkout` returned 500 because the local production-mode environment has `CH_API_URL=http://creativehatti.test`; the existing auth bridge correctly fails closed unless production API traffic uses HTTPS. This is a local configuration mismatch and staging acceptance blocker, not a reason to relax authentication. No payment or checkout transaction was created.

Public pages rendered with private/no-store HTTP headers in this output; this is safe but not CDN HTML caching. Direct WordPress indexed search returned 200 but no `Cache-Control` header. See `reports/final-local-performance-audit.md` for the bounded timing sample and cache discussion.

## Local API dependency and deployment blockers

- Build prerender depended on the configured local WordPress API and completed while it was reachable.
- Staging must use `CH_API_URL=https://api.creativehatti.in`, `WORDPRESS_URL=https://api.creativehatti.in`, `NEXT_PUBLIC_SITE_URL=https://creativehatti.in`, `CH_AUTH_FRONTEND_URL=https://creativehatti.in`, `USE_MOCK_API=false`, WordPress-backed auth mode, and the same server-only `CH_AUTH_BRIDGE_SECRET` on Next and WordPress. Set values only in approved secret/environment stores; never expose the bridge secret through a `NEXT_PUBLIC_` variable.
- `api.creativehatti.in` is now included in Next's image host allowlist. The successful build only verifies local config compilation; verify actual staging media URLs at deployment.
- Local default canonical origin remains the existing `.com` fallback unless `NEXT_PUBLIC_SITE_URL` is set. Do not deploy staging without explicitly setting the `.in` origin and checking canonical, robots and sitemap output.
- Repository and active Laragon API plugin copies differ in three PHP files and one communications file is absent from the active copy. Reconcile reviewed release files before staging. The homepage sections plugin is byte-for-byte in sync; search runtime PHP matches, though docs/test files differ.

## Not verified

No authenticated staging smoke, product detail route, real checkout, payment, download authorization, public-network SEO/crawl, CDN cache, browser viewport, or visual accessibility check was performed. No production deployment occurred.
