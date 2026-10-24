import Link from "next/link";
import { routes } from "@/lib/routes";
import styles from "./PurchaseRecoveryPrompt.module.css";

export function PurchaseRecoveryPrompt() {
  return (
    <p className={styles.prompt}>
      Missing a previous purchase?{" "}
      <Link href={routes.claimAccount()}>Recover it here.</Link>
    </p>
  );
}
