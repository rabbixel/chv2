import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Breadcrumbs, Container } from "@/components/layout";
import {
  ProductGallery,
  ProductGrid,
  ProductImage,
  ProductInfoTable,
  PurchasePanel,
  WishlistButton,
} from "@/components/product";
import { JsonLd } from "@/components/seo";
import { Badge } from "@/components/ui";
import { SHOW_PRODUCT_SOCIAL_PROOF, SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";
import {
  breadcrumbJsonLd,
  productJsonLd,
  productMetaDescription,
  productMetaTitle,
  productSeoCanonical,
} from "@/lib/seo";
import {
  getCategoryService,
  getCollectionDirectoryService,
  getCollectionService,
  getCachedProductBySlug,
  getLicenseService,
  getProductService,
  getWishlistService,
} from "@/lib/services";
import { categoryDisplayName } from "@/lib/taxonomy";
import type { ProductKind } from "@/lib/types";
import { formatCompact } from "@/lib/utils";
import { selectRelatedCategories, selectRelatedCollections } from "@/lib/creative-hatti/related-explore.mjs";
import styles from "./page.module.css";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

const KIND_LABELS: Record<ProductKind, string> = {
  vector: "Vector",
  bundle: "Bundle",
  freebie: "Freebie",
};

export const dynamicParams = true;
// Matches REVALIDATE_SECONDS.product in lib/cache.ts (segment
// configs must be literals — keep the two in sync).
export const revalidate = 1800;

/** Build-time static set cap — the 44k+ long tail renders on demand (ISR). */
const STATIC_PRODUCT_LIMIT = 10;

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  const service = getProductService();
  const [featured, bestsellers, arrivals] = await Promise.all([
    service.listFeaturedProducts(STATIC_PRODUCT_LIMIT),
    service.listBestsellers(STATIC_PRODUCT_LIMIT),
    service.listNewArrivals(STATIC_PRODUCT_LIMIT),
  ]);
  const slugs = new Set(
    [...featured, ...bestsellers, ...arrivals].map((product) => product.slug),
  );
  return [...slugs].map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getCachedProductBySlug(slug);
  if (!product) return { title: "Product not found" };
  const url = productSeoCanonical(product);
  const description = productMetaDescription(product);
  const title = productMetaTitle(product);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${title} · ${SITE.name}`,
      description,
      url,
      siteName: SITE.name,
      type: "website",
    },
  };
}

/**
 * Product detail page mirroring the live Creative Hatti experience:
 * gallery + buy box (license picker, purchase actions, wishlist,
 * customization quote and license details), description, Product Information,
 * keywords and related products / collection / category.
 */
export default async function ProductPage({ params }: ProductPageProps) {
  // Render the availability overlay on every request; explicitly cached
  // product/media fetches remain cached for fast SEO-friendly page output.
  await connection();
  const { slug } = await params;
  const product = await getCachedProductBySlug(slug);
  // No loading.tsx in this segment on purpose: a Suspense fallback would
  // absorb this notFound() and serve HTTP 200 with the skeleton forever
  // (vercel/next.js#98954).
  if (!product) notFound();

  const [related, collections, availableCategories, licenses, wishlistState] = await Promise.all([
    getProductService().listRelatedProducts(slug, 8),
    getCollectionService().listCollections(),
    getCategoryService().listCategories().catch(() => []),
    getLicenseService().getLicensesByCodes(product.licenses),
    getWishlistService().getSavedProductIds([product.id]).catch(() => new Set<string>()),
  ]);
  const relatedCollectionCandidates = selectRelatedCollections(product, collections, 4, [product.slug]);
  const relatedCollectionEntries = relatedCollectionCandidates.length
    ? await getCollectionDirectoryService()
      .getEntriesBySlugs(relatedCollectionCandidates.map((collection) => collection.slug))
      .catch(() => [])
    : [];
  const relatedCategories = selectRelatedCategories(product.categorySlugs, availableCategories, 6, [product.slug]);
  const [primarySlug, groupSlug] = product.categorySlugs;
  const trail = [
    { name: "Home", path: routes.home() },
    ...(groupSlug
      ? [
          {
            name: categoryDisplayName(groupSlug),
            path: routes.category(groupSlug),
          },
        ]
      : []),
    ...(primarySlug && primarySlug !== groupSlug
      ? [
          {
            name: categoryDisplayName(primarySlug),
            path: routes.category(primarySlug),
          },
        ]
      : []),
    { name: product.title, path: routes.product(product.slug) },
  ];
  const kicker = [
    KIND_LABELS[product.kind],
    categoryDisplayName(primarySlug ?? product.productGroup),
    product.isCustomizable ? "Customizable" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Container size="wide">
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
                {SHOW_PRODUCT_SOCIAL_PROOF && product.ratingCount > 0 && product.salesCount > 0 && (
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
                )}
              </div>
              <div className={styles.wishlist}>
                <WishlistButton
                  key={product.id}
                  productId={product.id}
                  productTitle={product.title}
                  initialWishlisted={wishlistState.has(product.id)}
                  returnTo={routes.product(product.slug)}
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
        </section>

        {(relatedCollectionEntries.length > 0 || relatedCategories.length > 0) && (
          <section aria-labelledby="explore-more-heading" className={styles.exploreMore}>
            <div className={styles.exploreIntro}>
              <h2 id="explore-more-heading" className={styles.sectionHeading}>Explore More</h2>
              <p className={styles.exploreDescription}>Discover similar designs and creative resources.</p>
            </div>

            {relatedCollectionEntries.length > 0 && (
              <div className={styles.exploreGroup}>
                <h3 className={styles.exploreGroupHeading}>Related collections</h3>
                <ul className={styles.collectionGrid}>
                  {relatedCollectionEntries.slice(0, 4).map((collection) => (
                    <li key={collection.slug}>
                      <Link
                        className={styles.collectionCard}
                        href={collection.href ?? routes.collection(collection.slug)}
                      >
                        <span className={styles.collectionArtwork}>
                          {collection.image?.url ? (
                            <ProductImage
                              image={collection.image}
                              title={collection.title}
                              sizes="(max-width: 639px) 45vw, (max-width: 1023px) 46vw, 24vw"
                              className={styles.collectionImage}
                              decorative
                            />
                          ) : (
                            <span className={styles.collectionFallback}>Collection</span>
                          )}
                        </span>
                        <span className={styles.collectionTitle}>{collection.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {relatedCategories.length > 0 && (
              <div className={styles.exploreGroup}>
                <h3 className={styles.exploreGroupHeading}>Related categories</h3>
                <ul className={styles.categoryChips}>
                  {relatedCategories.map((category) => (
                    <li key={category.slug}>
                      <Link className={styles.categoryChip} href={routes.category(category.slug)}>
                        {category.name}<span aria-hidden="true">→</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        <JsonLd
          data={productJsonLd(product, {
            categoryName: categoryDisplayName(
              primarySlug ?? product.productGroup,
            ),
          })}
        />
        <JsonLd data={breadcrumbJsonLd(trail)} />
      </div>
    </Container>
  );
}
