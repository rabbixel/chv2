import assert from "node:assert/strict";

const endpoint = process.argv[2] ?? "http://creativehatti.test/wp-json/ch/v1/indexed-search";
const frontend = process.argv[3] ?? "http://localhost:3000";

async function collection(availability, page) {
  const url = new URL(endpoint);
  url.searchParams.set("avail", availability);
  url.searchParams.set("sort", "best-selling");
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", "24");
  const response = await fetch(url);
  assert.equal(response.status, 200, `${availability} page ${page} should return HTTP 200`);
  return response.json();
}

const [paidFirst, paidSecond, freeFirst, freeSecond] = await Promise.all([
  collection("paid", 1), collection("paid", 2), collection("free", 1), collection("free", 2),
]);
assert.equal(paidFirst.pagination.total, 44323);
assert.equal(freeFirst.pagination.total, 101);
assert.equal(paidFirst.pagination.total_pages, Math.ceil(44323 / 24));
assert.equal(freeFirst.pagination.total_pages, Math.ceil(101 / 24));
for (const card of [...paidFirst.data, ...paidSecond.data]) {
  assert.ok(["paid", "mixed"].includes(card.price.class));
  assert.ok(card.price.amount > 0);
}
for (const card of [...freeFirst.data, ...freeSecond.data]) {
  assert.equal(card.price.class, "free");
  assert.equal(card.price.amount, 0);
}
const paidIds = [...paidFirst.data, ...paidSecond.data].map((card) => card.id);
const freeIds = [...freeFirst.data, ...freeSecond.data].map((card) => card.id);
assert.equal(new Set(paidIds).size, paidIds.length, "paid pagination must not repeat products");
assert.equal(new Set(freeIds).size, freeIds.length, "free pagination must not repeat products");
const frontendRoutes = ["/popular", "/free-downloads", "/product/sidhu-moose-wala-indian-singer-lyricist-rapper-vector-illustration"];
const routeStatuses = await Promise.all(frontendRoutes.map(async (route) => {
  const response = await fetch(new URL(route, frontend));
  assert.equal(response.status, 200, `${route} should render successfully`);
  return response.status;
}));
console.log(JSON.stringify({ paid: paidFirst.pagination.total, freeOnly: freeFirst.pagination.total, invalidExcluded: true, pagesChecked: [1, 2], frontendRoutes: routeStatuses }));
