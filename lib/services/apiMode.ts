/** Keep catalogue, cart and checkout on the same configured backend. */
export function isLiveApiEnabled(): boolean {
  return process.env.USE_MOCK_API !== "true" && Boolean(process.env.CH_API_URL);
}
