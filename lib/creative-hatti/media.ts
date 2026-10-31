const LOCAL_WORDPRESS_HOSTNAMES = new Set([
  "creativehatti.test",
  "www.creativehatti.test",
]);
const WORDPRESS_MEDIA_HOSTNAMES = new Set([
  "creativehatti.com",
  "www.creativehatti.com",
  "api.creativehatti.com",
]);
const DEFAULT_PRODUCTION_WORDPRESS_URL = "https://api.creativehatti.com";

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

function localApiOrigin(): URL | null {
  try {
    const apiUrl = new URL(process.env.CH_API_URL ?? "");
    return LOCAL_WORDPRESS_HOSTNAMES.has(apiUrl.hostname) ? apiUrl : null;
  } catch {
    return null;
  }
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
    } else if (
      process.env.NODE_ENV !== "production" &&
      url.hostname === "api.creativehatti.com"
    ) {
      // The local WordPress API can retain production-shaped media URLs even
      // though its uploads live in Laragon. In local development, serve those
      // paths from the configured local API host; production URLs stay intact.
      const localApi = localApiOrigin();
      if (localApi) {
        url.protocol = localApi.protocol;
        url.hostname = localApi.hostname;
        url.port = localApi.port;
      }
    }
    return url.toString();
  } catch {
    return value;
  }
}
