import { Button, Card } from "@/components/ui";
import { routes } from "@/lib/routes";
import type { Cart } from "@/lib/types";
import { formatMoney } from "@/lib/utils";
import styles from "./CartSummary.module.css";

export interface CartSummaryProps {
  cart: Cart;
}

export function CartSummary({ cart }: CartSummaryProps) {
  return (
    <Card padding="md" className={styles.summary}>
      <h2 className={styles.heading}>Order summary</h2>
      <dl className={styles.rows}>
        <div className={styles.row}>
          <dt>Subtotal ({cart.itemCount} items)</dt>
          <dd>{formatMoney(cart.subtotal)}</dd>
        </div>
        <div className={styles.row}>
          <dt>Taxes</dt>
          <dd>Calculated at checkout</dd>
        </div>
        <div className={`${styles.row} ${styles.total}`}>
          <dt>Total</dt>
          <dd>{formatMoney(cart.subtotal)}</dd>
        </div>
      </dl>
      <Button href={routes.checkout()} fullWidth>
        Proceed to checkout
      </Button>
      <p className={styles.note}>
        Instant digital delivery · GST invoice on every order
      </p>
    </Card>
  );
}
