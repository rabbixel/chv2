import Link from "next/link";
import type { CSSProperties } from "react";
import { Icon } from "@/components/ui";
import { routes } from "@/lib/routes";
import type { ProductImage } from "@/lib/types";
import { SectionHeading } from "./SectionHeading";
import styles from "./CharacterCategories.module.css";
import { getProductService } from "@/lib/services";
import { CardArtwork, type CardArtworkVariant } from "./CardArtwork";

export interface CharacterCategoryWithCount {
  name: string;
  blurb: string;
  query: string;
  categorySlug: string;
  hue: number;
  count: number;
  artwork: CardArtworkVariant;
  image?: ProductImage;
}

export interface CharacterCategoriesProps {
  categories: CharacterCategoryWithCount[];
}

export async function CharacterCategories({ categories }: CharacterCategoriesProps) {
  const productService = getProductService();
  const categoriesWithImages = await Promise.all(
    categories.map(async (category) => {
      if (category.image) return category;
      const { items } = await productService.listProducts({
        categorySlug: category.categorySlug,
        pageSize: 4,
      });
      const image = items
        .flatMap((product) => product.images)
        .find((productImage): productImage is ProductImage => Boolean(productImage.url));
      return { ...category, image };
    }),
  );

  return (
    <section aria-labelledby="characters-heading">
      <SectionHeading
        eyebrow="Same character, every pose"
        title="Featured Character Categories"
        copy="Consistent characters in varied actions and poses — mythology, professions, culture and festivals."
      />
      <h2 id="characters-heading" className="ch-visually-hidden">
        Featured character categories
      </h2>
      <ul className={styles.grid}>
        {categoriesWithImages.map((category) => (
          <li key={category.name}>
            <Link
              href={routes.category(category.categorySlug)}
              className={styles.card}
              style={{ "--card-hue": category.hue } as CSSProperties}
            >
              <span className={styles.art}>
                <CardArtwork
                  variant={category.artwork}
                  hue={category.hue}
                  image={category.image}
                  sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 25vw"
                />
              </span>
              <span className={styles.body}>
                <span className={styles.name}>{category.name}</span>
                <span className={styles.blurb}>{category.blurb}</span>
                <span className={styles.meta}>
                  {category.count} {category.count === 1 ? "asset" : "assets"}
                  <Icon name="arrow-right" size={16} />
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
