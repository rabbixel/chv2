import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("free product action enters the idempotent cart and zero-value checkout flow", async () => {
  const [panel, cartActions, checkoutForm] = await Promise.all([
    read("../components/product/PurchasePanel.tsx"),
    read("../app/cart/actions.ts"),
    read("../app/checkout/CheckoutForm.tsx"),
  ]);

  assert.match(panel, /quickAddToCart\(\s*product\.slug/);
  assert.match(panel, /syncCart\(result\);\s*router\.push\(routes\.checkout\(\)\)/);
  assert.match(panel, /Continue to free checkout|Get free download/);
  assert.match(panel, /Download this design for free\. Simply complete the checkout to get your files\. No payment or account required\./);
  assert.doesNotMatch(panel, /href=\{routes\.accountDownloads\(\)\}/);
  assert.match(cartActions, /if \(existing\) return \{ status: "already"/);
  assert.match(checkoutForm, /if \(prepared\.order\.status === "complete"\)[\s\S]*?getCompletedOrderDownloads/);
  assert.match(checkoutForm, /await paymentRef\.current\?\.startCheckout/);
});

test("zero-value EDD orders use the existing guest capability and native EDD download authorization", async () => {
  const [checkout, payment, tests] = await Promise.all([
    read("../wordpress/creative-hatti-api/includes/class-ch-checkout-controller.php"),
    read("../wordpress/creative-hatti-api/includes/class-ch-payment-controller.php"),
    read("./wordpress-checkout-controller.php"),
  ]);

  assert.match(checkout, /ch_checkout_type', 'zero_total'/);
  assert.match(checkout, /complete_zero_total_order\( \$order_id \)/);
  assert.match(payment, /'manual' === \(string\) \( \$order->gateway \?\? '' \).*'zero_total'/);
  assert.match(payment, /edd_get_download_file_url\( \$item, \(string\) \$order->email, \$file_key \)/);
  assert.match(tests, /zero-total guest order completes through native EDD status API/);
  assert.match(tests, /zero-total order records checkout metadata and completes once/);
});
