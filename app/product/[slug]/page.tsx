import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs, Container } from "@/components/layout";
import {
  ProductGallery,
  ProductGrid,
  ProductInfoTable,
  PurchasePanel,
  WishlistButton,
} from "@/components/product";
import { Badge, Icon } from "@/components/ui";
import { PAGINATION, SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";
import {
  getCollectionService,
  getLicenseService,
  getProductService,
} from "@/lib/services";
import { categoryDisplayName } from "@/lib/taxonomy";
import type { Collection, Product, ProductKind } from "@/lib/types";
import { formatCompact, formatMoney } from "@/lib/utils";
import styles from "./page.module.css";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

const KIND_LABELS: Record<ProductKind, string> = {
  vector: "Vector",
  bundle: "Bundle",
  freebie: "Freebie",
};

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  const service = getProductService();
  const slugs: string[] = [];
  let page = 1;
  for (;;) {
    const result = await service.listProducts({
      page,
      pageSize: PAGINATION.maxPageSize,
    });
    slugs.push(...result.items.map((product) => product.slug));
    if (page >= result.pagination.totalPages) break;
    page += 1;
  }
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductService().getProductBySlug(slug);
  if (!product) return { title: "Product not found" };
  const url = `${SITE.url}/product/${slug}`;
  const description =
    product.shortDescription ??
    product.description ??
    `${product.title} — Indian vectors, characters and creative assets on ${SITE.name}.`;
  return {
    title: product.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${product.title} · ${SITE.name}`,
      description,
      url,
      siteName: SITE.name,
      type: "website",
    },
  };
}

/**
 * Collections whose search query fully matches the product — the same
 * "every token" rule the search service uses, so a related collection
 * always links to a listing that contains this product.
 */
function findRelatedCollections(
  product: Product,
  collections: Collection[],
  limit = 2,
): Collection[] {
  const haystack = new Set(
    [
      product.title,
      product.productGroup,
      ...product.categorySlugs,
      ...product.tags,
      ...product.keywords,
    ]
      .join(" ")
      .toLowerCase()
      .split(/[^a-z0-9]+/g)
      .filter(Boolean),
  );
  return collections
    .filter((collection) =>
      collection.query
        .toLowerCase()
        .split(/[^a-z0-9]+/g)
        .filter(Boolean)
        .every((token) => haystack.has(token)),
    )
    .slice(0, limit);
}

function productJsonLd(product: Product, url: string): Record<string, unknown> {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    sku: product.slug,
    url,
    category: categoryDisplayName(product.productGroup),
    description: product.shortDescription ?? product.description,
    offers: {
      "@type": "Offer",
      priceCurrency: product.price.currency,
      price: (product.price.amount / 100).toFixed(2),
      availability: "https://schema.org/InStock",
      url,
    },
  };
  if (product.ratingCount > 0) {
    data.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: product.ratingAverage.toFixed(1),
      reviewCount: product.ratingCount,
    };
  }
  return data;
}

/**
 * Product detail page mirroring the live Creative Hatti experience:
 * gallery + buy box (license picker, purchase actions, wishlist,
 * customization quote), description, Product Information, license,
 * keywords and related products / collection / category.
 */
export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductService().getProductBySlug(slug);
  // No loading.tsx in this segment on purpose: a Suspense fallback would
  // absorb this notFound() and serve HTTP 200 with the skeleton forever
  // (vercel/next.js#98954).
  if (!product) notFound();

  const [related, collections, licenses] = await Promise.all([
    getProductService().listRelatedProducts(slug, 8),
    getCollectionService().listCollections(),
    getLicenseService().getLicensesByCodes(product.licenses),
  ]);
  const relatedCollections = findRelatedCollections(product, collections);
  const url = `${SITE.url}/product/${slug}`;
  const [primarySlug, groupSlug] = product.categorySlugs;
  const kicker = [
    KIND_LABELS[product.kind],
    categoryDisplayName(primarySlug ?? product.productGroup),
    product.isCustomizable ? "Customizable" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Container>
      <div className={styles.page}>
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            ...(groupSlug
              ? [
                  {
                    label: categoryDisplayName(groupSlug),
                    href: routes.category(groupSlug),
                  },
                ]
              : []),
            ...(primarySlug && primarySlug !== groupSlug
              ? [
                  {
                    label: categoryDisplayName(primarySlug),
                    href: routes.category(primarySlug),
                  },
                ]
              : []),
            { label: product.title },
          ]}
        />

        <div className={styles.top}>
          <ProductGallery images={product.images} title={product.title} />
          <div className={styles.summary}>
            <div className={styles.titleRow}>
              <div>
                <p className={styles.kicker}>{kicker}</p>
                <h1 className={styles.title}>{product.title}</h1>
                <p className={styles.meta}>
                  <span
                    className={styles.rating}
                    aria-label={`Rated ${product.ratingAverage} out of 5`}
                  >
                    ★ {product.ratingAverage.toFixed(1)}
                  </span>{" "}
                  <span className={styles.counts}>
                    ({formatCompact(product.ratingCount)}) ·{" "}
                    {formatCompact(product.salesCount)} sales
                  </span>
                </p>
              </div>
              <div className={styles.wishlist}>
                <WishlistButton
                  productId={product.id}
                  productTitle={product.title}
                />
                <span className={styles.wishlistLabel}>Wishlist</span>
              </div>
            </div>
            {(product.bestseller || product.isNew) && (
              <p className={styles.badges}>
                {product.bestseller && (
                  <Badge variant="accent" size="sm">
                    Bestseller
                  </Badge>
                )}
                {product.isNew && (
                  <Badge variant="brand" size="sm">
                    New
                  </Badge>
                )}
              </p>
            )}
            <PurchasePanel product={product} licenses={licenses} />
          </div>
        </div>

        {product.description && (
          <section aria-labelledby="description" className={styles.section}>
            <h2 id="description" className={styles.sectionHeading}>
              Description
            </h2>
            <p className={styles.description}>{product.description}</p>
          </section>
        )}

        <ProductInfoTable product={product} />

        {licenses.length > 0 && (
          <section aria-labelledby="license" className={styles.section}>
            <h2 id="license" className={styles.sectionHeading}>
              License
            </h2>
            <div className={styles.licenseGrid}>
              {licenses.map((license) => (
                <article key={license.code} className={styles.licenseCard}>
                  <h3 className={styles.licenseName}>{license.name}</h3>
                  {!product.isFree && (
                    <p className={styles.licensePrice}>
                      {formatMoney({
                        amount: Math.round(
                          product.price.amount * license.priceMultiplier,
                        ),
                        currency: product.price.currency,
                      })}
                    </p>
                  )}
                  <p className={styles.licenseDescription}>
                    {license.description}
                  </p>
                  <ul className={styles.licenseUses}>
                    {license.allowedUses.map((use) => (
                      <li key={use}>
                        <Icon name="check" size={16} />
                        <span>{use}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
            <p className={styles.licenseContact}>
              For any queries related to this document or license please{" "}
              <Link href={routes.contact()}>contact our team</Link>.
            </p>
          </section>
        )}

        {product.keywords.length > 0 && (
          <section aria-labelledby="keywords" className={styles.section}>
            <h2 id="keywords" className={styles.sectionHeading}>
              Keywords
            </h2>
            <ul className={styles.keywords}>
              {product.keywords.map((keyword) => (
                <li key={keyword}>
                  <Link
                    href={routes.search(keyword)}
                    className={styles.keyword}
                  >
                    {keyword}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="related" className={styles.section}>
          <h2 id="related" className={styles.sectionHeading}>
            Related products
          </h2>
          <ProductGrid products={related} />
          <div className={styles.relatedMeta}>
            {relatedCollections.length > 0 && (
              <div>
                <h3 className={styles.relatedHeading}>Related collection</h3>
                <ul className={styles.relatedLinks}>
                  {relatedCollections.map((collection) => (
                    <li key={collection.slug}>
                      <Link href={routes.collection(collection.slug)}>
                        {collection.title}
                      </Link>
                      <span className={styles.relatedTagline}>
                        {" "}
                        — {collection.tagline}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <h3 className={styles.relatedHeading}>Related category</h3>
              <ul className={styles.relatedLinks}>
                {product.categorySlugs.map((categorySlug) => (
                  <li key={categorySlug}>
                    <Link href={routes.category(categorySlug)}>
                      {categoryDisplayName(categorySlug)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(productJsonLd(product, url)).replace(
              /</g,
              "\\u003c",
            ),
          }}
        />
      </div>
    </Container>
  );
}
