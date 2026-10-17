const LOCAL_WORDPRESS_HOSTNAMES = new Set([
  "creativehatti.test",
  "www.creativehatti.test",
]);
const WORDPRESS_MEDIA_HOSTNAMES = new Set([
  "creativehatti.com",
  "www.creativehatti.com",
  "api.creativehatti.com",
]);
const DEFAULT_PRODUCTION_WORDPRESS_URL = "https://www.creativehatti.com";

export function isLocalWordPressMediaUrl(value: string): boolean {
  try {
    return LOCAL_WORDPRESS_HOSTNAMES.has(new URL(value).hostname);
  } catch {
    return false;
  }
}

function productionWordPressUrl(): URL {
  const configured =
    process.env.WORDPRESS_URL ??
    process.env.NEXT_PUBLIC_WORDPRESS_URL ??
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
    const local = isLocalWordPressMediaUrl(value);
    const knownWordPressMediaHost =
      local ||
      WORDPRESS_MEDIA_HOSTNAMES.has(url.hostname) ||
      url.hostname === productionWordPressHostname();
    if (
      !knownWordPressMediaHost ||
      !url.pathname.includes("/wp-content/uploads/")
    ) {
      return value;
    }

    // WordPress APIs and indexed search can return a registered image size
    // (`-300x300`, `-150x150`, etc.). Resolve that suffix to the attachment
    // file so deleted generated variations are never requested.
    url.pathname = url.pathname.replace(/-\d+x\d+(\.[^./]+)$/i, "$1");

    // Local API records point at Laragon. On production builds map only that
    // known local host to the configured production WordPress origin.
    if (local && process.env.NODE_ENV === "production") {
      const production = productionWordPressUrl();
      url.protocol = production.protocol;
      url.hostname = production.hostname;
      url.port = production.port;
    }
    return url.toString();
  } catch {
    return value;
  }
}
