export function downloadFailureKind(status) {
  return [401, 403, 404].includes(status) ? "authorization" : "temporary";
}

export function downloadFailureMessage(kind) {
  return kind === "authorization"
    ? "Download access is unavailable in this checkout session. Return to the original checkout browser or use the verified purchase-claim process."
    : "Downloads are temporarily unavailable. Refresh the page or try again shortly.";
}
