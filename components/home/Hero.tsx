import { SearchBar, type SearchBarCategory } from "@/components/search";
import { Badge } from "@/components/ui";
import { heroStats } from "@/lib/homepage";
import styles from "./Hero.module.css";

export interface HeroProps {
  categories: SearchBarCategory[];
  popularSearches: string[];
}

export function Hero({ categories, popularSearches }: HeroProps) {
  return (
    <section className={styles.hero} aria-labelledby="hero-heading">
      <div className="ch-container">
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
      </div>
    </section>
  );
}
