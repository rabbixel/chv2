import { Container } from "@/components/layout";
import styles from "./page.module.css";

export default function BlogLoading() {
  return (
    <Container size="wide">
      <div className={styles.loading} aria-busy="true">
        <p className={styles.loadingStatus} role="status">Loading articles…</p>
        <div className={styles.loadingGrid} aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => <div className={styles.loadingCard} key={index} />)}
        </div>
      </div>
    </Container>
  );
}
