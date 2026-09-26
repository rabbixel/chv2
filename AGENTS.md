# AGENTS.md — Creative Hatti storefront

Working agreements for automated runs on this repo. See `README.md` for full
architecture docs.

## Commands

- `npm run dev` — develop · `npm run build` — verify · `npm run lint` —
  lint · `npm run typecheck` — types
- Always run `lint` + `typecheck` (or `build`) before finishing a run.

## Data layer (strict)

- Components/pages fetch **only** via `@/lib/services` accessors
  (`getProductService()`, …). No direct `fetch`, no `@/data` imports, no
  hardcoded API URLs in components.
- New backend needs → add a service interface + mock implementation first,
  keep the API-backed variant beside it.
- Catalogue reads stay server-side + paginated. Never load unbounded lists
  into the browser.

## Components & styling

- CSS Modules colocated with components; values come from
  `styles/tokens.css` custom properties — no hardcoded colours/spacing.
- URLs via `@/lib/routes.ts`; money via `formatMoney()`; classes via `cn()`.
- Keep the premium-marketplace restraint: no gradients, no neon, no heavy
  animation, no bubbly radii. Match existing primitives before inventing new
  ones; barrels (`index.ts`) per folder.

## Constraints

- Frontend only: no database, no payment processing, no secrets.
  Never add `NEXT_PUBLIC_*` credentials of any kind.
- No new dependencies without a clear, stated need.
- Don't replace working code unnecessarily; keep diffs focused per run.
