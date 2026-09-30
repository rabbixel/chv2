const LOCAL_WORDPRESS_HOSTNAMES = new Set(["creativehatti.test"]);
const DEFAULT_PRODUCTION_WORDPRESS_URL = "https://www.creativehatti.com";

function productionWordPressUrl(): URL {
  const configured =
    process.env.NEXT_PUBLIC_WORDPRESS_URL ??
    process.env.WORDPRESS_URL ??
    DEFAULT_PRODUCTION_WORDPRESS_URL;

  try {
    const url = new URL(configured);
    if (LOCAL_WORDPRESS_HOSTNAMES.has(url.hostname)) {
      return new URL(DEFAULT_PRODUCTION_WORDPRESS_URL);
    }
    return url;
  } catch {
    return new URL(DEFAULT_PRODUCTION_WORDPRESS_URL);
  }
}

export function productionWordPressHostname(): string {
  return productionWordPressUrl().hostname;
}

export function normalizeWordPressMediaUrl(value: string): string {
  try {
    const url = new URL(value);
    if (!LOCAL_WORDPRESS_HOSTNAMES.has(url.hostname)) return value;
    const production = productionWordPressUrl();
    url.protocol = production.protocol;
    url.hostname = production.hostname;
    url.port = production.port;
    return url.toString();
  } catch {
    return value;
  }
}
