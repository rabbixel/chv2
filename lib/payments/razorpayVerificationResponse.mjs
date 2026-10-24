/**
 * @typedef {{ status: "authorized" | "captured", verified: true, fulfilled: boolean, edd_order_reference: string }} RazorpayVerificationResult
 * @typedef {{ success: boolean, data: RazorpayVerificationResult }} RazorpayVerificationEnvelope
 */

/**
 * Validate the server response before the checkout UI treats it as final.
 * The frontend reports EDD completion only when the backend explicitly says
 * the captured payment was fulfilled.
 *
 * @param {unknown} response
 * @returns {RazorpayVerificationResult}
 */
export function parseRazorpayVerificationResponse(response) {
  if (typeof response !== "object" || response === null) {
    throw new Error("We couldn’t confirm your payment. Your order remains pending.");
  }

  const envelope = /** @type {Partial<RazorpayVerificationEnvelope>} */ (response);
  const result = envelope.data;
  if (
    envelope.success !== true ||
    !result ||
    result.verified !== true ||
    typeof result.fulfilled !== "boolean" ||
    !["authorized", "captured"].includes(result.status) ||
    (result.fulfilled && result.status !== "captured") ||
    typeof result.edd_order_reference !== "string" ||
    !/^[A-Za-z0-9-]{1,40}$/.test(result.edd_order_reference)
  ) {
    throw new Error("We couldn’t confirm your payment. Your order remains pending.");
  }

  return result;
}

/** @param {RazorpayVerificationResult} result */
export function getRazorpayCheckoutOutcomeCopy(result) {
  if (result.status === "captured" && result.fulfilled) {
    return {
      message: `Payment received and order ${result.edd_order_reference} is complete.`,
      note: "Your order is complete. Download limits and access rules still apply.",
    };
  }

  if (result.status === "captured") {
    return {
      message: `Payment confirmed for order ${result.edd_order_reference}. Order completion is pending.`,
      note: "Payment succeeded. Your downloads will be available when the order is complete.",
    };
  }

  return {
    message: `Your payment was approved but hasn’t been confirmed yet. Order ${result.edd_order_reference} remains pending.`,
    note: "Downloads remain unavailable until your payment is complete and your order is complete.",
  };
}
