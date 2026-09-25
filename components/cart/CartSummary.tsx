import type { ReactNode } from "react";
import { Button, Card } from "@/components/ui";
import { routes } from "@/lib/routes";
import type { Cart } from "@/lib/types";
import { formatMoney } from "@/lib/utils";
import styles from "./CartSummary.module.css";

export interface CartSummaryProps {
  cart: Cart;
  /**
   * Primary action. Defaults to the checkout link; pass `null` where the
   * surrounding page owns the action (checkout, drawer).
   */
  action?: ReactNode | null;
}

export function CartSummary({ cart, action }: CartSummaryProps) {
  return (
    <Card padding="md" className={styles.summary}>
      <h2 className={styles.heading}>Order summary</h2>
      <dl className={styles.rows}>
        <div className={styles.row}>
          <dt>Subtotal ({cart.itemCount} items)</dt>
          <dd>{formatMoney(cart.subtotal)}</dd>
        </div>
        {cart.discount && (
          <div className={styles.row}>
            <dt>
              Discount{cart.couponCode ? ` (${cart.couponCode})` : ""}
            </dt>
            <dd>−{formatMoney(cart.discount)}</dd>
          </div>
        )}
        <div className={`${styles.row} ${styles.total}`}>
          <dt>Total</dt>
          <dd>{formatMoney(cart.total)}</dd>
        </div>
      </dl>
      {action === undefined ? (
        <Button href={routes.checkout()} fullWidth>
          Proceed to checkout
        </Button>
      ) : (
        action
      )}
      <p className={styles.note}>
        Instant digital delivery · GST invoice on every order
      </p>
    </Card>
  );
}
