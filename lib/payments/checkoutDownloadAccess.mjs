/** Resolve the order reference only from a server-validated completion response. */
export function getCompletedDownloadOrderReference(status) {
  if (!status || typeof status.edd_order_reference !== "string" || !/^[A-Za-z0-9-]{1,40}$/.test(status.edd_order_reference)) return "";
  const paidAndFulfilled = status.fulfilled === true &&
    ["complete", "partially_refunded"].includes(status.order_status) &&
    status.payment_status === "captured";
  const freeAndComplete = status.free_completed === true &&
    status.order_status === "complete" && status.payment_status === "" &&
    status.fulfilled === false;
  return paidAndFulfilled || freeAndComplete ? status.edd_order_reference : "";
}
