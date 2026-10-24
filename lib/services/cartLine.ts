export interface CartPayloadLine {
  product_id: number;
  price_id: number | null;
  quantity: number;
}

export function sameCartLine(
  left: Pick<CartPayloadLine, "product_id" | "price_id">,
  right: Pick<CartPayloadLine, "product_id" | "price_id">,
): boolean {
  return left.product_id === right.product_id && left.price_id === right.price_id;
}

export function hasCartLine(
  lines: ReadonlyArray<{ productId: string; priceId: number | null }>,
  productId: string,
  priceId: number | null,
): boolean {
  return lines.some((line) =>
    line.productId === productId && (line.priceId ?? null) === priceId,
  );
}

/** Quick add is idempotent for a product and its selected EDD price option. */
export function addCartLineOnce(
  lines: CartPayloadLine[],
  line: CartPayloadLine,
): { lines: CartPayloadLine[]; added: boolean } {
  if (lines.some((existing) => sameCartLine(existing, line))) {
    return { lines, added: false };
  }
  return { lines: [...lines, line], added: true };
}
