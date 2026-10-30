import test from "node:test";
import assert from "node:assert/strict";
import { normalizeWordPressMediaUrl } from "../lib/creative-hatti/media.ts";

test("normalizes known WordPress thumbnail URLs to attachment originals", () => {
  assert.equal(
    normalizeWordPressMediaUrl(
      "https://www.creativehatti.com/wp-content/uploads/2021/04/asset-300x300.jpg",
    ),
    "https://www.creativehatti.com/wp-content/uploads/2021/04/asset.jpg",
  );
});

test("preserves ordinary image filenames and untrusted remote URLs", () => {
  assert.equal(
    normalizeWordPressMediaUrl(
      "https://www.creativehatti.com/wp-content/uploads/2021/04/asset-small.jpg",
    ),
    "https://www.creativehatti.com/wp-content/uploads/2021/04/asset-small.jpg",
  );
  assert.equal(
    normalizeWordPressMediaUrl("https://example.invalid/uploads/asset-300x300.jpg"),
    "https://example.invalid/uploads/asset-300x300.jpg",
  );
});

test("maps local uploads to the configured production API origin", () => {
  const previous = {
    nodeEnv: process.env.NODE_ENV,
    wordpressUrl: process.env.WORDPRESS_URL,
    publicWordPressUrl: process.env.NEXT_PUBLIC_WORDPRESS_URL,
  };
  process.env.NODE_ENV = "production";
  process.env.WORDPRESS_URL = "https://api.creativehatti.com";
  delete process.env.NEXT_PUBLIC_WORDPRESS_URL;

  try {
    assert.equal(
      normalizeWordPressMediaUrl(
        "http://creativehatti.test/wp-content/uploads/2024/01/asset-300x300.jpg",
      ),
      "https://api.creativehatti.com/wp-content/uploads/2024/01/asset.jpg",
    );
  } finally {
    if (previous.nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous.nodeEnv;
    if (previous.wordpressUrl === undefined) delete process.env.WORDPRESS_URL;
    else process.env.WORDPRESS_URL = previous.wordpressUrl;
    if (previous.publicWordPressUrl === undefined) delete process.env.NEXT_PUBLIC_WORDPRESS_URL;
    else process.env.NEXT_PUBLIC_WORDPRESS_URL = previous.publicWordPressUrl;
  }
});

test("uses the API subdomain as the production media default", () => {
  const previous = {
    nodeEnv: process.env.NODE_ENV,
    wordpressUrl: process.env.WORDPRESS_URL,
    publicWordPressUrl: process.env.NEXT_PUBLIC_WORDPRESS_URL,
  };
  delete process.env.WORDPRESS_URL;
  delete process.env.NEXT_PUBLIC_WORDPRESS_URL;
  process.env.NODE_ENV = "production";

  try {
    assert.equal(
      normalizeWordPressMediaUrl(
        "http://creativehatti.test/wp-content/uploads/2024/01/asset.jpg",
      ),
      "https://api.creativehatti.com/wp-content/uploads/2024/01/asset.jpg",
    );
  } finally {
    if (previous.nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous.nodeEnv;
    if (previous.wordpressUrl === undefined) delete process.env.WORDPRESS_URL;
    else process.env.WORDPRESS_URL = previous.wordpressUrl;
    if (previous.publicWordPressUrl === undefined) delete process.env.NEXT_PUBLIC_WORDPRESS_URL;
    else process.env.NEXT_PUBLIC_WORDPRESS_URL = previous.publicWordPressUrl;
  }
});

test("maps production-shaped API media URLs to local uploads during local development", () => {
  const previous = {
    nodeEnv: process.env.NODE_ENV,
    apiUrl: process.env.CH_API_URL,
  };
  process.env.NODE_ENV = "development";
  process.env.CH_API_URL = "http://creativehatti.test/wp-json/ch/v1";

  try {
    assert.equal(
      normalizeWordPressMediaUrl(
        "https://api.creativehatti.com/wp-content/uploads/2021/01/character-300x300.jpg",
      ),
      "http://creativehatti.test/wp-content/uploads/2021/01/character.jpg",
    );
  } finally {
    if (previous.nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous.nodeEnv;
    if (previous.apiUrl === undefined) delete process.env.CH_API_URL;
    else process.env.CH_API_URL = previous.apiUrl;
  }
});
