import { Card } from "@/components/ui";
import styles from "./section.module.css";

export default function AccountLoading() {
  return (
    <div className={styles.loading} role="status" aria-live="polite">
      <Card><p className={styles.rowMeta}>Loading your account…</p></Card>
    </div>
  );
}
