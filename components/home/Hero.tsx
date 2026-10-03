import { SearchBar, type SearchBarCategory } from "@/components/search";
import { Badge } from "@/components/ui";
import { heroStats } from "@/lib/homepage";
import Link from "next/link";
import { ProductImage } from "@/components/product";
import type { Product } from "@/lib/types";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import styles from "./Hero.module.css";

export interface HeroProps {
  categories: SearchBarCategory[];
  popularSearches: string[];
  products: Product[];
}

export function Hero({ categories, popularSearches, products }: HeroProps) {
  const previews = products.filter((product) => product.images.some((image) => image.url)).slice(0, 4);
  return (
    <section className={styles.hero} aria-labelledby="hero-heading">
      <div className="ch-container">
        <div className={cn(styles.layout, previews.length > 0 && styles.withArtwork)}>
        <div className={styles.inner}>
          <Badge variant="accent" size="md" className={styles.eyebrow}>
            India&apos;s creative marketplace
          </Badge>
          <h1 id="hero-heading" className={styles.title}>
            The Ultimate Collection of Indian Vector Assets
          </h1>
          <p className={styles.copy}>
            Characters, festival creatives, banners, bundles and ready-to-use
            templates — crafted with authentic Indian tadka for your next
            project.
          </p>
          <div className={styles.search}>
            <SearchBar
              id="hero-search"
              placeholder="What are you searching for today…"
              categories={categories}
              popularSearches={popularSearches}
            />
          </div>
          <dl className={styles.stats}>
            {heroStats.map((stat) => (
              <div key={stat.label} className={styles.stat}>
                <dt>{stat.label}</dt>
                <dd>{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        {previews.length > 0 && (
          <ul className={styles.gallery} aria-label="Explore featured artwork">
            {previews.map((product, index) => (
              <li key={product.id}>
                <Link href={routes.product(product.slug)} className={styles.preview} aria-label={product.title}>
                  <ProductImage image={product.images.find((image) => image.url)!} title={product.title}
                    sizes="(max-width: 767px) 44vw, (max-width: 1023px) 22vw, 240px"
                    priority={index === 0} decorative className={styles.previewImage} />
                </Link>
              </li>
            ))}
          </ul>
        )}
        </div>
      </div>
    </section>
  );
}
