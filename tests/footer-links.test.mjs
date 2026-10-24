import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const exists = (path) => access(new URL(path, import.meta.url)).then(() => true, () => false);

test("every footer destination has a useful Next.js route", async () => {
  const [footer, routeSource] = await Promise.all([
    read("../components/layout/SiteFooter.tsx"),
    read("../lib/routes.ts"),
  ]);
  const expected = [
    ["All categories", "routes.categories()", "../app/categories/page.tsx"],
    ["New arrivals", "routes.newArrivals()", "../app/new-arrivals/page.tsx"],
    ["Popular", "routes.popular()", "../app/popular/page.tsx"],
    ["Free downloads", "routes.freeDownloads()", "../app/free-downloads/page.tsx"],
    ["Contact", "routes.contact()", "../app/contact/page.tsx"],
    ["Help centre", "routes.help()", "../app/help/page.tsx"],
    ["FAQs", "routes.faqs()", "../app/faqs/page.tsx"],
    ["Refund policy", "routes.refundPolicy()", "../app/refund-policy/page.tsx"],
    ["Login", "routes.login()", "../app/login/page.tsx"],
    ["Orders", "routes.login(routes.accountOrders())", "../app/account/orders/page.tsx"],
    ["Downloads", "routes.login(routes.accountDownloads())", "../app/account/downloads/page.tsx"],
    ["Wishlist", "routes.login(routes.accountWishlist())", "../app/account/wishlist/page.tsx"],
    ["About", "routes.about()", "../app/about/page.tsx"],
    ["Terms", "routes.terms()", "../app/terms/page.tsx"],
    ["Privacy", "routes.privacy()", "../app/privacy/page.tsx"],
  ];

  for (const [label, expression, page] of expected) {
    assert.match(footer, new RegExp(`label: "${label}"`), `${label} appears in footer`);
    assert.ok(footer.includes(`href: ${expression}`), `${label} uses its route helper`);
    assert.equal(await exists(page), true, `${label} route exists`);
    for (const [, helper] of expression.matchAll(/routes\.(\w+)\(/g)) {
      assert.ok(routeSource.includes(`${helper}:`), `${label} helper ${helper} exists`);
    }
  }
  assert.match(footer, /href=\{routes\.home\(\)\} aria-label=\{`\$\{SITE\.name\} .* home`\}/);
  assert.equal(await exists("../app/not-found.tsx"), true);
});

test("protected footer destinations retain the server-side login return path", async () => {
  const [layout, auth, login] = await Promise.all([
    read("../app/account/layout.tsx"),
    read("../lib/auth.ts"),
    read("../app/login/page.tsx"),
  ]);
  assert.match(layout, /requireUser\(\)/);
  assert.match(auth, /redirect\(routes\.login\(target\)\)/);
  assert.match(login, /isSafeNextPath\(requestedNext\)/);
  assert.match(login, /<input type="hidden" name="next" value=\{next\}/);
});

test("discovery pages filter paid and free collections before backend pagination", async () => {
  const [newArrivals, popular, free, search, wpIndex] = await Promise.all([
    read("../app/new-arrivals/page.tsx"),
    read("../app/popular/page.tsx"),
    read("../app/free-downloads/page.tsx"),
    read("../components/search/CuratedProductListing.tsx"),
    read("../wordpress/creative-hatti-search/creative-hatti-search.php"),
  ]);
  assert.match(newArrivals, /sort="newest"/);
  assert.match(popular, /sort="best-selling"/);
  assert.match(popular, /paidOnly/);
  assert.match(free, /freeOnly/);
  assert.match(search, /paidOnly \? \{ availability: "paid" \}/);
  assert.match(search, /freeOnly \? \{ availability: "free" \}/);
  assert.match(search, /getSearchService\(\)\.searchProducts/);
  assert.match(wpIndex, /'newest' => 'd\.published DESC'/);
  assert.match(wpIndex, /'best-selling' => 'd\.sales DESC'/);
  assert.match(wpIndex, /d\.price_valid=1 AND d\.has_paid_option=1/);
  assert.match(wpIndex, /d\.price_valid=1 AND d\.has_free_option=1 AND d\.has_paid_option=0/);
  assert.doesNotMatch(wpIndex, /d\.price=0/);
  assert.match(wpIndex, /'_edd_download_sales'/);
});

test("marketplace descriptions use customer-friendly copy without exposing ranking details", async () => {
  const [popular, free, arrivals, categories, footer, listing, constants, footerStyles] = await Promise.all([
    read("../app/popular/page.tsx"),
    read("../app/free-downloads/page.tsx"),
    read("../app/new-arrivals/page.tsx"),
    read("../app/categories/page.tsx"),
    read("../components/layout/SiteFooter.tsx"),
    read("../components/search/CuratedProductListing.tsx"),
    read("../lib/constants.ts"),
    read("../components/layout/SiteFooter.module.css"),
  ]);
  assert.match(popular, /title="Popular Designs"/);
  assert.match(popular, /Loved by creators\. Explore our most popular designs\./);
  assert.match(free, /Explore creative designs you can download for free\./);
  assert.match(arrivals, /Fresh ideas, new inspirations\. Discover our latest designs\./);
  assert.match(categories, /Find the perfect design for your next creative project\./);
  assert.match(constants, /Bringing ideas to life with unique Indian vector illustrations, creative characters, and ready-to-use designs\./);
  assert.match(footer, /Prices in \{SITE\.currency\}.*Secure checkout/);
  assert.doesNotMatch(listing, /Ordered by|recorded product sales|purchase options/);
  assert.match(footerStyles, /\.brand\s*\{[^}]*max-width/);
});

test("policy content is visibly marked for review and contact does not imply form delivery", async () => {
  const [contentPage, contact, refund, terms, privacy, licensing, routeSource] = await Promise.all([
    read("../components/content/ContentPage.tsx"),
    read("../app/contact/page.tsx"),
    read("../app/refund-policy/page.tsx"),
    read("../app/terms/page.tsx"),
    read("../app/privacy/page.tsx"),
    read("../app/licensing/page.tsx"),
    read("../lib/routes.ts"),
  ]);
  assert.match(contentPage, /Draft for owner review/);
  for (const page of [refund, terms, privacy, licensing]) assert.match(page, /policyDraft/);
  assert.match(contact, /routes\.contactEmail/);
  assert.match(contact, /does not confirm whether an email was sent or received/);
  assert.match(routeSource, /contactEmail:.*hello@creativehatti\.com/s);
});

test("historical WordPress policy URLs resolve to their Next.js counterparts", async () => {
  const redirects = await read("../next.config.ts");
  assert.match(redirects, /source: "\/terms-and-conditions", destination: routes\.terms\(\)/);
  assert.match(redirects, /source: "\/privacy-policy-2", destination: routes\.privacy\(\)/);
  assert.match(redirects, /source: "\/license", destination: routes\.licenseInformation\(\)/);
  assert.doesNotMatch(redirects, /source: "\/categories", destination: "\/"/);
});
