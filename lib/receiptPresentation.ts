export function isReceiptStatus(status: string): boolean {
  return ["complete", "partially_refunded", "refunded"].includes(status);
}

export function receiptActionLabel(status: string): string {
  return isReceiptStatus(status) ? "View Receipt" : "View Order Summary";
}

export function receiptDocumentTitle(documentType: "receipt" | "order_summary"): string {
  return documentType === "receipt" ? "Purchase receipt" : "Order summary";
}
