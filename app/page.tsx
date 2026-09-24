import { Breadcrumbs, Container } from "@/components/layout";
import { ProductGrid } from "@/components/product";
import { Badge, Button, Card, EmptyState, Input, Pagination } from "@/components/ui";
import { isApiConfigured } from "@/lib/api";
import { PAGINATION, SITE } from "@/lib/constants";
import { getCategoryService, getProductService } from "@/lib/services";
import styles from "./page.module.css";

/**
 * RUN 01 — foundation status page (NOT the homepage implementation).
 * Verifies the base layout, design system, service layer and pagination
 * end to end using server-side data fetching. The real homepage lands in
 * a later run.
 */

const PAGE_SIZE = 8;

interface FoundationPageProps {
  searchParams?: Promise<{ page?: string }>;
}

export default async function FoundationPage({
  searchParams,
}: FoundationPageProps) {
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params?.page ?? "1", 10) || 1);

  const [catalog, categories] = await Promise.all([
    getProductService().listProducts({
      page,
      pageSize: PAGE_SIZE,
      sort: "best-selling",
    }),
    getCategoryService().listFeaturedCategories(),
  ]);
  const { items, pagination } = catalog;
  const mockMode = !isApiConfigured() || process.env.USE_MOCK_API !== "false";

  return (
    <Container>
      {/* Status hero */}
      <section className={`ch-section ${styles.hero}`}>
        <div className={styles.heroBadges}>
          <Badge variant="brand" size="md">
            Run 01 · Foundation
          </Badge>
          <Badge variant={mockMode ? "accent" : "success"} size="md">
            {mockMode ? "Mock data layer" : "Live API"}
          </Badge>
        </div>
        <Breadcrumbs
          items={[{ label: "Home", href: "/" }, { label: "Foundation status" }]}
          className={styles.crumbs}
        />
        <h1 className={styles.heroTitle}>
          {SITE.name} storefront foundation is live.
        </h1>
        <p className={styles.heroCopy}>
          App Router, design tokens, reusable components and a service layer
          that pages the catalogue server-side — built for 44,000+ products.
          This status page proves the wiring; the real homepage arrives in a
          later run.
        </p>
        <div className={styles.heroActions}>
          <Button href="#catalogue">Preview the catalogue wiring</Button>
          <Button href="#system" variant="secondary">
            Inspect the design system
          </Button>
        </div>
        <dl className={styles.facts}>
          <div>
            <dt>Default page size</dt>
            <dd>{PAGINATION.defaultPageSize} / page</dd>
          </div>
          <div>
            <dt>Mock products</dt>
            <dd>{pagination.totalItems}</dd>
          </div>
          <div>
            <dt>Categories</dt>
            <dd>{categories.length} featured</dd>
          </div>
          <div>
            <dt>Currency</dt>
            <dd>{SITE.currency}</dd>
          </div>
        </dl>
      </section>

      {/* Design system spot-check */}
      <section id="system" className={`ch-section ${styles.section}`}>
        <h2 className={styles.sectionTitle}>Design system spot-check</h2>
        <p className={styles.sectionCopy}>
          Primitives render from tokens in <code>styles/tokens.css</code> —
          typography, buttons, inputs, cards and badges.
        </p>
        <div className={styles.showcase}>
          <Card>
            <p className={styles.cardLabel}>Buttons</p>
            <div className={styles.row}>
              <Button size="sm">Primary</Button>
              <Button size="sm" variant="secondary">
                Secondary
              </Button>
              <Button size="sm" variant="accent">
                Accent
              </Button>
              <Button size="sm" variant="ghost">
                Ghost
              </Button>
            </div>
          </Card>
          <Card>
            <p className={styles.cardLabel}>Badges</p>
            <div className={styles.row}>
              <Badge>Neutral</Badge>
              <Badge variant="brand">Brand</Badge>
              <Badge variant="accent">Bestseller</Badge>
              <Badge variant="danger">−31%</Badge>
              <Badge variant="success">In stock</Badge>
            </div>
          </Card>
          <Card>
            <p className={styles.cardLabel}>Inputs</p>
            <Input
              label="Email address"
              type="email"
              placeholder="you@example.com"
              hint="Order updates and download links land here."
            />
          </Card>
        </div>
      </section>

      {/* Paginated catalogue wiring */}
      <section id="catalogue" className={`ch-section ${styles.section}`}>
        <h2 className={styles.sectionTitle}>Catalogue wiring</h2>
        <p className={styles.sectionCopy}>
          Server-rendered via <code>getProductService().listProducts()</code> —{" "}
          {PAGE_SIZE} per page, page {pagination.page} of {pagination.totalPages}{" "}
          ({pagination.totalItems} mock products). Only the current page ever
          reaches the browser.
        </p>
        {items.length === 0 ? (
          <EmptyState
            title="No products on this page"
            description="Try an earlier page — the mock catalogue is small by design."
            action={<Button href="#catalogue">Back to page 1</Button>}
          />
        ) : (
          <>
            <ProductGrid products={items} />
            <div className={styles.pagination}>
              <Pagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                buildHref={(target) => `/?page=${target}#catalogue`}
              />
            </div>
          </>
        )}
      </section>
    </Container>
  );
}
