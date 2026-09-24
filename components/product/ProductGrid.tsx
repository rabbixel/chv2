import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ProductCard } from "./ProductCard";
import styles from "./ProductGrid.module.css";

export interface ProductGridProps {
  products: Product[];
  className?: string;
}

export function ProductGrid({ products, className }: ProductGridProps) {
  return (
    <ul className={cn(styles.grid, className)}>
      {products.map((product) => (
        <li key={product.id} className={styles.cell}>
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}
