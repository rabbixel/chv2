import Link from "next/link";
import { SearchBar } from "@/components/search";
import { Badge } from "@/components/ui";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";
import { getCartService, getCategoryService } from "@/lib/services";
import styles from "./SiteHeader.module.css";

function Wordmark() {
  return (
    <span className={styles.brand}>
      <svg
        className={styles.mark}
        viewBox="0 0 32 32"
        aria-hidden="true"
        focusable="false"
      >
        <rect width="32" height="32" rx="7" fill="currentColor" opacity="0.12" />
        <path
          d="M9 23V9h3.4v5.6h7.2V9H23v14h-3.4v-5.7h-7.2V23H9Z"
          fill="currentColor"
        />
      </svg>
      <span className={styles.wordmark}>
        Creative&nbsp;Hatti
        <span className={styles.tagline}>{SITE.tagline}</span>
      </span>
    </span>
  );
}

export async function SiteHeader() {
  const [categories, cart] = await Promise.all([
    getCategoryService().listFeaturedCategories(),
    getCartService().getCart(),
  ]);

  return (
    <header className={styles.header}>
      <p className={styles.announcement}>
        Festive sale is live — up to 40% off invitations, patterns &amp; fonts.
      </p>
      <div className={styles.main}>
        <div className={`ch-container ${styles.mainInner}`}>
          <Link
            href={routes.home()}
            className={styles.brandLink}
            aria-label={`${SITE.name} — home`}
          >
            <Wordmark />
          </Link>
          <div className={styles.searchDesktop}>
            <SearchBar id="site-search" />
          </div>
          <nav aria-label="Account" className={styles.actions}>
            <Link href={routes.wishlist()} className={styles.actionLink}>
              Wishlist
            </Link>
            <Link href={routes.signIn()} className={styles.actionLink}>
              Sign in
            </Link>
            <Link
              href={routes.cart()}
              className={styles.cartLink}
              aria-label={`Cart, ${cart.itemCount} items`}
            >
              Cart
              {cart.itemCount > 0 && (
                <Badge variant="brand" size="sm">
                  {cart.itemCount}
                </Badge>
              )}
            </Link>
          </nav>
        </div>
        <div className={`ch-container ${styles.searchMobile}`}>
          <SearchBar id="site-search-mobile" />
        </div>
      </div>
      <nav aria-label="Categories" className={styles.categoryNav}>
        <div className={`ch-container ${styles.categoryList}`}>
          {categories.map((category) => (
            <Link
              key={category.id}
              href={routes.category(category.slug)}
              className={styles.categoryLink}
            >
              {category.name}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
