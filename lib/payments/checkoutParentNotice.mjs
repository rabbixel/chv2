/** Parent checkout state is derived only from a validated server response. */
export function getCheckoutParentNotice(result) {
  if (!result || result.verified !== true || typeof result.fulfilled !== "boolean") return null;
  if (result.status === "captured" && result.fulfilled) {
    return { kind: "complete", title: "Order complete", message: "Your payment is confirmed and your order is complete." };
  }
  if (result.status === "captured") {
    return { kind: "fulfillment-pending", title: "Payment confirmed", message: "Your payment was received. Downloads will be available when your order is complete." };
  }
  if (result.status === "authorized") {
    return { kind: "authorized", title: "Payment approved", message: "Your payment has been approved but hasn’t been confirmed yet." };
  }
  return null;
}
