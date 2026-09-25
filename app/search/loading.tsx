import { Container } from "@/components/layout";
import { ProductGridSkeleton } from "@/components/product";
import styles from "./page.module.css";

export default function SearchLoading() {
  return (
    <Container>
      <div className={styles.page}>
        <ProductGridSkeleton count={8} />
      </div>
    </Container>
  );
}
