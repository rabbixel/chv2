import { SearchBar, type SearchBarCategory } from "@/components/search";
import { Badge } from "@/components/ui";
import Link from "next/link";
import { ProductImage } from "@/components/product";
import type { Product, ProductImage as ProductImageData } from "@/lib/types";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { HomepageHeroConfig } from "@/lib/homepage-config";
import styles from "./Hero.module.css";

export interface HeroProps {
  categories: SearchBarCategory[];
  popularSearches: string[];
  products: Product[];
  config: HomepageHeroConfig<ProductImageData>;
}

export function Hero({ categories, popularSearches, products, config }: HeroProps) {
  if (!config.enabled) return null;
  const previews = config.showImages
    ? products.filter((product) => product.images.some((image) => image.url)).slice(0, 4)
    : [];
  const gallery = config.showImages ? config.images.flatMap((slot, index) => {
    if (slot.mode === "custom") {
      return slot.image ? [{ image: slot.image, product: previews[index], href: slot.href || (previews[index] ? routes.product(previews[index].slug) : undefined), key: `custom-${index}` }] : [];
    }
    const product = previews[index];
    const image = product?.images.find((entry) => entry.url);
    return product && image ? [{ image, product, href: routes.product(product.slug), key: product.id }] : [];
  }) : [];
  return (
    <section className={cn(styles.hero, !config.showImages && styles.centeredHero)} aria-labelledby="hero-heading">
      <div className="ch-container">
        <div className={cn(styles.layout, gallery.length > 0 ? styles.withArtwork : styles.centered)}>
        <div className={styles.inner}>
          {config.eyebrow && <Badge variant="accent" size="md" className={styles.eyebrow}>{config.eyebrow}</Badge>}
          <h1 id="hero-heading" className={styles.title}>
            {config.heading}
          </h1>
          {config.description && <p className={styles.copy}>{config.description}</p>}
          <div className={styles.search}>
            <SearchBar
              id="hero-search"
              placeholder={config.searchPlaceholder}
              buttonText={config.searchButtonText}
              categories={categories}
              popularSearches={popularSearches}
            />
          </div>
          <dl className={styles.stats}>
            {config.stats.filter((stat) => stat.visible).map((stat, index) => (
              <div key={`${stat.label}-${index}`} className={styles.stat}>
                <dt>{stat.label}</dt>
                <dd>{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        {gallery.length > 0 && (
          <ul className={styles.gallery} aria-label="Explore featured artwork">
            {gallery.map((entry, index) => (
              <li key={entry.key}>
                {entry.href ? <Link href={entry.href} className={styles.preview} aria-label={entry.product?.title || entry.image.alt || `Featured artwork ${index + 1}`}>
                  <ProductImage image={entry.image} title={entry.product?.title || entry.image.alt || "Featured artwork"}
                    sizes="(max-width: 767px) 44vw, (max-width: 1023px) 22vw, 240px"
                    priority={index === 0} decorative className={styles.previewImage} />
                </Link> : <div className={styles.preview}>
                  <ProductImage image={entry.image} title={entry.image.alt || "Featured artwork"}
                    sizes="(max-width: 767px) 44vw, (max-width: 1023px) 22vw, 240px"
                    priority={index === 0} decorative className={styles.previewImage} />
                </div>}
              </li>
            ))}
          </ul>
        )}
        </div>
      </div>
    </section>
  );
}
