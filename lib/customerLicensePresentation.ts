export type LicensePurchaseType = "order" | "legacy_payment" | "unavailable";

/** Only validated EDD 3 order references may navigate to the order detail route. */
export function licenseOrderLinkId(
  purchaseType: LicensePurchaseType,
  purchaseId: string | null,
): string | null {
  return purchaseType === "order" ? purchaseId : null;
}
