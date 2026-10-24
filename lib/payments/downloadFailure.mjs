export function downloadFailureKind(status) {
  return [401, 403, 404].includes(status) ? "authorization" : "temporary";
}

export function downloadFailureMessage(kind) {
  return kind === "authorization"
    ? "Download access isn’t available in this checkout session. Return to the browser where you placed the order, or use the purchase recovery page to connect it to your account."
    : "Downloads are temporarily unavailable. Refresh the page or try again shortly.";
}
