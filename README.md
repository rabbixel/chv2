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

### Category + collection listings (Run 06)

- `/category/[slug]` serves taxonomy groups (Vector Creatives, Character
  Bundle, Freebies) and subcategories (Flyers, Mythological, …);
  `/collections/[slug]` serves curated collections (Diwali, Holi,
  Logo Templates, …). One dynamic route each — no manual pages.
- Both reuse the search pipeline: the slug becomes a base constraint
  (group → `groups`, subcategory → `categorySlugs`, collection →
  collection id) merged with URL filters, then `searchProducts()`.
  Shared UI: `ProductGrid`, `FilterPanel`/`FilterDrawer`,
  `ActiveFilters`, `SortSelect`, `NoResults`, `ListingPage.module.css`.
- Dynamic title / description / canonical / OG per slug. Legacy
  `/categories/:slug` URLs permanently redirect (308) to
  `/category/:slug`.
- No `loading.tsx` in these segments on purpose: a Suspense fallback
  would absorb `notFound()` and serve unknown slugs as HTTP 200
  (vercel/next.js#98954). Unknown slugs return 404 + noindex and the
  not-found UI hydrates from the Flight payload; per the same
  upstream issue the SSR body of a `notFound()` 404 is an empty
  shell for no-JS clients, while unmatched URLs render the full
  not-found page server-side.

## Project structure

```
app/                  layout, homepage, search, category + collection listings
styles/tokens.css     design tokens (single source of truth)
components/
  ui/                 Button, IconButton, Icon, Input, Badge, Card, Spinner,
                      EmptyState, Pagination
  layout/             Container, SiteHeader, PrimaryNav, MobileMenu,
                      Breadcrumbs, SiteFooter
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
  routes.ts           storefront URL builders (incl. placeholder routes)
  navigation.ts       popular searches + nav config (API-owned in future)
  homepage.ts         discovery tiles, character cats, keywords (Run 03)
  taxonomy.ts         product groups/subcategories — single source of truth
  cache.ts            ISR revalidation windows + cache tags
  design-tokens.ts    TS mirror of breakpoints/containers
data/                 mock licences, taxonomy categories, collections, 53-product seed
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

- Homepage (Run 03 — hero, discovery, Hatti's Choice, characters, packs, collections)
- Category + collection listing pages (Run 06 — shared filter/sort/pagination)
- Product detail pages (licence picker, gallery)
- Search results page (Run 05 — facets, URL-synced filters, sort)
- Cart drawer + cart page, checkout (Razorpay via backend), account area
- Real API integration, CDN imagery, auth, sitemaps/SEO pass
