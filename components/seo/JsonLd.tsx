export interface JsonLdProps {
  /** One schema.org node (or `@graph` document) from `lib/seo.ts`. */
  data: Record<string, unknown>;
}

/**
 * Server-rendered JSON-LD block. Zero client JavaScript — crawlers get
 * structured data in the initial HTML.
 */
export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        // Escape `<` so product copy can never break out of the block.
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
