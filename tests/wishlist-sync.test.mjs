import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("WordPress wishlist requests use authenticated server bridge and no-store", async () => {
  const [service, endpoints] = await Promise.all([
    read("../lib/services/wishlistService.ts"),
    read("../lib/api/endpoints.ts"),
  ]);
  assert.match(endpoints, /wishlist: "\/wishlist"/);
  assert.match(service, /getWordPressSessionBridgeHeaders\(\)/);
  assert.match(service, /import \{ isLiveApiEnabled \} from "\.\/apiMode"/);
  assert.match(service, /isLiveApiEnabled\(\)[\s\S]*?new ApiWishlistService\(\)/);
  assert.match(service, /cache: "no-store"/);
  assert.match(service, /method: "POST"/);
  assert.match(service, /method: "DELETE"/);
  assert.doesNotMatch(service, /userId\s*:/);
});

test("wishlist controls synchronize membership and require sign-in for guests", async () => {
  const [button, actions, grid, detail] = await Promise.all([
    read("../components/product/WishlistButton.tsx"),
    read("../app/account/actions.ts"),
    read("../components/product/ProductGrid.tsx"),
    read("../app/product/[slug]/page.tsx"),
  ]);
  assert.match(button, /window\.addEventListener\(WISHLIST_COUNT_EVENT/);
  assert.match(button, /window\.dispatchEvent\(new CustomEvent\(WISHLIST_COUNT_EVENT/);
  assert.match(button, /requiresAuth && \([\s\S]*?<Link/);
  assert.match(actions, /error\.status === 401/);
  assert.match(actions, /requiresAuth: true/);
  assert.match(grid, /getSavedProductIds/);
  assert.match(detail, /getSavedProductIds/);
});

test("WordPress wishlist routes require the authenticated session owner", async () => {
  const [controller, service] = await Promise.all([
    read("../wordpress/creative-hatti-api/includes/class-ch-wishlist-controller.php"),
    read("../wordpress/creative-hatti-api/includes/class-ch-wishlist-service.php"),
  ]);
  assert.equal((controller.match(/'permission_callback' => array\( \$this->auth, 'session_permission' \)/g) ?? []).length, 3);
  assert.match(controller, /get_current_user_id\(\)/);
  assert.match(service, /UNIQUE KEY user_product \(user_id,product_id\)/);
  assert.match(service, /INSERT IGNORE/);
});
