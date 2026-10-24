export function getCustomerDownloadPresentation(item) {
  if (item.availability === "product_unavailable") {
    return { state: "unavailable", message: "Download unavailable." };
  }
  if (item.availability === "no_entitled_files" || item.entitledFileCount === 0) {
    return { state: "no-files", message: "No files are available for this purchase." };
  }
  if (item.availability !== "available" || !item.downloadEnabled || !item.files?.length) {
    return { state: "unavailable", message: "Download unavailable or access may have expired." };
  }
  return { state: "available", message: "Available" };
}
