/** Subtract purchased quantities by exact product and EDD price-option identity. */
export function removePurchasedCartLines(current, purchased) {
  const remainingByKey = new Map();
  for (const line of purchased) {
    const key = `${line.productId}:${line.priceId ?? "base"}`;
    remainingByKey.set(key, (remainingByKey.get(key) ?? 0) + line.quantity);
  }

  return current.flatMap((line) => {
    const key = `${line.product_id}:${line.price_id ?? "base"}`;
    const remove = remainingByKey.get(key) ?? 0;
    if (remove <= 0) return [{ ...line }];
    const quantity = Math.max(0, line.quantity - remove);
    remainingByKey.delete(key);
    return quantity > 0 ? [{ ...line, quantity }] : [];
  });
}

export function checkoutStatusAllowsCartCleanup(status) {
  return Boolean(status && (status.fulfilled === true || status.free_completed === true));
}
