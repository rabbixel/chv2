/** Parent checkout state is derived only from a validated server response. */
export function getCheckoutParentNotice(result) {
  if (!result || result.verified !== true || typeof result.fulfilled !== "boolean") return null;
  if (result.status === "captured" && result.fulfilled) {
    return { kind: "complete", title: "Order complete", message: "Payment was verified and EDD confirmed order completion." };
  }
  if (result.status === "captured") {
    return { kind: "fulfillment-pending", title: "Payment verified", message: "Payment was captured. Order fulfillment is pending; downloads remain unavailable until EDD completes the order." };
  }
  if (result.status === "authorized") {
    return { kind: "authorized", title: "Payment authorized", message: "Payment is authorized but not captured. The order remains pending." };
  }
  return null;
}
