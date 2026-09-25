import Link from "next/link";
import { SearchBar } from "@/components/search";
import { Icon, IconButton } from "@/components/ui";
import { popularSearches } from "@/lib/navigation";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";
import {
  getCartService,
  getCategoryService,
  getWishlistService,
} from "@/lib/services";
import { MobileMenu } from "./MobileMenu";
import { PrimaryNav } from "./PrimaryNav";
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
  const [categories, cart, wishlist] = await Promise.all([
    getCategoryService().listCategories(),
    getCartService().getCart(),
    getWishlistService().getWishlist(),
  ]);
  const navCategories = categories.map((category) => ({
    name: category.name,
    slug: category.slug,
  }));

  return (
    <header className={styles.header}>
      <p className={styles.announcement}>
        Festive sale is live — up to 40% off invitations, patterns &amp; fonts.
      </p>
      <div className={styles.main}>
        <div className={`ch-container ${styles.mainInner}`}>
          <MobileMenu
            categories={navCategories}
            popularSearches={popularSearches}
            cartCount={cart.itemCount}
            wishlistCount={wishlist.items.length}
            className={styles.mobileMenu}
          />
          <Link
            href={routes.home()}
            className={styles.brandLink}
            aria-label={`${SITE.name} — home`}
          >
            <Wordmark />
          </Link>
          <div className={styles.searchDesktop}>
            <SearchBar
              id="site-search"
              categories={navCategories}
              popularSearches={popularSearches}
            />
          </div>
          <nav aria-label="Account" className={styles.actions}>
            <IconButton
              label="Wishlist"
              href={routes.wishlist()}
              badge={wishlist.items.length}
            >
              <Icon name="heart" />
            </IconButton>
            <IconButton label="Sign in" href={routes.signIn()}>
              <Icon name="user" />
            </IconButton>
            <IconButton label="Cart" href={routes.cart()} badge={cart.itemCount}>
              <Icon name="bag" />
            </IconButton>
          </nav>
        </div>
        <div className={`ch-container ${styles.searchMobile}`}>
          <SearchBar
            id="site-search-mobile"
            categories={navCategories}
            popularSearches={popularSearches}
          />
        </div>
      </div>
      <PrimaryNav
        categories={categories.filter(
          (category) => category.parentId === null,
        )}
        className={styles.primaryNav}
      />
    </header>
  );
}
