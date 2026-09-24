# Creative Hatti — Storefront (Next.js rebuild)

Clean Next.js rebuild of the Creative Hatti frontend — a digital creative
asset marketplace with 44,000+ products. This project will eventually replace
the WordPress + Mayosis + Easy Digital Downloads frontend.

> **Run 01 — Foundation, Architecture & Design System.** Base layout, design
> tokens, reusable components, domain types and a mock service layer. No real
> homepage, backend, payments or storage yet — all by design.

## Stack

- **Next.js 16** (App Router) · **React 19** · **TypeScript** (strict)
- CSS Modules + CSS custom-property design tokens (no CSS framework)
- Self-hosted variable fonts (Inter + Fraunces via Fontsource — no Google
  Fonts round-trip, builds work offline)
- Runtime dependencies limited to Next.js, React and font assets

## Quick start

```bash
cp .env.example .env.local   # optional; mock mode works without it
npm install
npm run dev                  # http://localhost:3000
```

| Script            | Purpose                                   |
| ----------------- | ----------------------------------------- |
| `npm run dev`     | Development server                        |
| `npm run build`   | Production build (also type-checks)       |
| `npm run start`   | Serve a production build                  |
| `npm run lint`    | ESLint (Next.js core-web-vitals + TS)     |
| `npm run typecheck` | `tsc --noEmit`                          |

## Architecture

```
                     ┌──────────────────────┐
                     │  Cloudflare / CDN    │  (future)
                     └──────────┬───────────┘
                                ▼
┌──────────────────────────────────────────────┐
│  Next.js App Router (this repo)              │
│                                              │
│  app/            routes, layouts, metadata   │
│  components/     ui · layout · product ·     │
│                  search · cart · account     │
│  lib/services    ProductService, Search…     │  ← pages/components
│  lib/api         typed fetch client +        │     stop here; they
│                  endpoint builders          │     never touch fetch/data
│  lib/types       domain model                │
│  lib/utils       formatting, pagination, cn  │
│  data/           mock catalogue (dev only)   │
└──────────────────────┬───────────────────────┘
                       ▼
            ┌─────────────────────┐
            │  API (future)       │  Database / Search / Auth
            └─────────┬───────────┘
                      ▼
            Razorpay + AWS S3 (backend only —
            secrets must never enter this repo)
```

### Data-flow rules

1. **Pages and components fetch only through `lib/services` accessors**
   (`getProductService()`, `getSearchService()`, …). Never `fetch()` directly,
   never import from `@/data` or `@/lib/api` in components.
2. **Every service has an interface + mock implementation today** and an
   API-backed implementation behind `USE_MOCK_API=false` for read paths.
   Swapping to the real backend changes services, not components.
3. **Catalogue reads are server-side, paginated and cached**
   (`lib/cache.ts` revalidation windows + tags). The browser only ever
   receives the current page — never thousands of products.
4. URLs are built via `lib/routes.ts`; money renders via `formatMoney()`.

## Project structure

```
app/                  layout, foundation page, not-found, error, globals.css
styles/tokens.css     design tokens (single source of truth)
components/
  ui/                 Button, Input, Badge, Card, Spinner, EmptyState, Pagination
  layout/             Container, SiteHeader, SiteFooter
  product/            ProductCard, ProductGrid
  search/             SearchBar
  cart/               CartItemRow, CartSummary
  account/            AccountMenu
lib/
  types/              Product, Category, ProductImage, Customer, Cart, CartItem,
                      Order, OrderItem, Download, WishlistItem, License,
                      SearchResult, Pagination (+ common primitives)
  services/           interfaces + mock/API implementations + accessors
  api/                typed client (ApiError, apiFetch) + endpoint builders
  utils/              cn, format (INR/dates/files), pagination helpers
  constants.ts        site + pagination defaults (env-aware, browser-safe)
  routes.ts           storefront URL builders
  cache.ts            ISR revalidation windows + cache tags
  design-tokens.ts    TS mirror of breakpoints/containers
data/                 mock licences, categories, 32-product seed catalogue
public/               favicon, robots.txt
```

## Design system

Tokens in `styles/tokens.css` cover typography (Inter UI + Fraunces display),
type scale, weights, spacing, radius, shadows, containers, breakpoints,
buttons, inputs, cards, badges and links. Components consume tokens via CSS
Modules — no hardcoded colours, spacing or breakpoints.

Deliberately **restrained**: warm paper neutrals, one deep-green brand colour,
marigold reserved for ratings/highlights, flat placeholder art (no gradients),
subtle shadows, minimal motion with `prefers-reduced-motion` support.

## Environment

See `.env.example`. Only `NEXT_PUBLIC_*` values reach the browser.
`USE_MOCK_API=false` + `NEXT_PUBLIC_API_BASE_URL` (or server-only
`API_BASE_URL`) switches read paths to the typed API client. Payment and
storage credentials are backend-only and must never be added here.

## Roadmap (upcoming runs)

- Homepage implementation (hero, rails, merchandising)
- Category / product-listing pages with filters + sorting
- Product detail pages (licence picker, gallery)
- Search results page (facets, URL-synced state)
- Cart drawer + cart page, checkout (Razorpay via backend), account area
- Real API integration, CDN imagery, auth, sitemaps/SEO pass
