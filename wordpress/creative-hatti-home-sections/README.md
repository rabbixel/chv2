# Creative Hatti Homepage Sections

An installable WordPress plugin for curating the storefront's **Featured
Character Categories** and **Featured Graphics & Illustration Packs** from
EDD's `download_category` taxonomy.

Version 1.1 also manages discovery tiles, scheduled celebrations, keyword
themes and trusted clients. Existing character/pack settings are preserved.

## Handpicked Packs

The **Handpicked Packs** tab manages the existing `packs` entries in the
`ch_home_sections` WordPress option. Existing cards, including Social Media,
remain enabled as evergreen collections in Manual mode when first saved with
the new controls. This is an additive Settings API update; it does not rename
options, change attachment IDs, or run a database migration.

Each pack can use an EDD category, a URL, or a search query as its destination,
and can keep its own Media Library thumbnail. Manual mode preserves row order
and ignores seasonal dates. Automatic mode selects active seasonal entries by
priority first, then fills remaining slots with enabled evergreen entries.
Destinations are deduplicated and the visible-card limit defaults to five
(maximum eight). Seasonal start/end dates are evaluated in Asia/Kolkata. Date
windows may cross New Year; annual recurrence compares month/day and should be
used only for fixed-date campaigns. Movable festivals require explicit dates
for each year. The admin date preview evaluates the saved pack configuration
for the selected India date.

The REST endpoint returns only the selected cards in `featured_packs` when
`featured_packs_enabled` is true. The Next.js homepage uses the WordPress list
instead of its default featured collections whenever the section is enabled.
In development, the homepage-section fetch is uncached. In production, its
60-second revalidation bounds a scheduled change's visibility delay to about a
minute without requiring cron.

## Discovery and celebrations

Unchecked sections use editorial defaults. Default artwork is drawn from
one published product per category/search, cached for seven days; these are
previews, not paid download files. Enable custom choices to pick Media Library
artwork or enter a published EDD product ID to reuse its featured image.
An image choice takes precedence over the product thumbnail. Missing artwork
uses a real inline SVG fallback. No unrestricted SVG upload support is added.

Each tile targets an EDD category or a search query. Discovery supports 12
cards and ordering. Celebrations supports 40 scheduled entries; at most 10
active cards are returned. Dates use Asia/Kolkata. An event date defaults to
a window from 60 days before through 2 days after; explicit visibility dates
override either boundary. Undated entries are evergreen fallbacks. Active
pins rank first, followed by dated entries, priority (descending), and date.
Pins do not bypass expiry. There is no cron dependency.

The initial calendar includes Dussehra (20 October 2026), Dhanteras
(6 November 2026) and Diwali (8 November 2026). Lunar festivals need a new
dated entry each year; they do not recur automatically.
Date references: https://www.indiapost.gov.in/holidays-list and
https://www.drikpanchang.com/festivals/dhanteras/festivals-dhanteras-puja-timings.html

## Keywords and trusted clients

The default keyword list contains 30 curated themes, labelled "Explore
popular themes" because it is not backed by search analytics. A custom pool
supports 100 unique entries, one per line or comma-separated. Display is
limited to 30; optional weekly rotation applies when the pool exceeds 30.

Trusted clients are read from the published `trusted-by` page by default,
or a selected page ID. WPBakery single-image/carousel/gallery shortcodes,
WordPress gallery shortcodes, Gutenberg image/gallery block metadata and
`wp-image-ID` markup are supported. Up to 30 unique images retain source order.
Missing attachments are skipped. Set accurate image alt text or attachment
titles for brand names. Disable sync to hide this section. No second list of
logo IDs is maintained and no page HTML is scraped by the frontend.

The existing `/wp-json/ch/v1/homepage-sections` response now includes
`discovery_tiles`, `seasonal_collections`, `keywords`, and `trusted_brands`.
The frontend reads through `getHomepageService()`, with a 60-second API cache.
Mock mode uses vector tiles, the same initial calendar and 30 keywords;
trusted clients are hidden when no genuine images are available.

After migration, preserve attachment IDs and update WordPress site/media
URLs to HTTPS on `api.creativehatti.com`. Next.js allows that media host.

## Install in Laragon

Copy the `creative-hatti-home-sections` folder into:

```text
wp-content/plugins/creative-hatti-home-sections/
```

Then activate **Creative Hatti Homepage Sections** from **WordPress Admin →
Plugins**. Open **Settings → Homepage Sections** to choose EDD categories,
edit card titles/descriptions, select an image from the Media Library, and
set each card's illustration fallback and accent hue. Enable a section to
replace that section's built-in storefront content. An enabled section with
no rows is hidden; an unchecked section keeps the existing defaults.

The image upload is an editorial thumbnail only. It does not alter the EDD
download, product files, pricing, or taxonomy.

## Storefront API

Public, read-only endpoint:

```text
GET /wp-json/ch/v1/homepage-sections
```

The endpoint returns only published category names/slugs/counts and selected
image metadata. Editing is restricted to WordPress administrators through
the Settings API. Set the storefront's server-only `CH_API_URL` to
`http://creativehatti.test/wp-json/ch/v1` and set `USE_MOCK_API=false` for the
storefront to read the saved homepage choices.
