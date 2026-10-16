import styles from "./RazorpayButton.module.css";

export interface RazorpayButtonProps {
  orderId: string;
  orderNumber: string;
  keyId: string;
  providerOrderId: string;
  amountPaise: number;
  currency: string;
  totalLabel: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
}

/** Payment initiation remains unavailable until verified payment support is implemented. */
export function RazorpayButton(_props: RazorpayButtonProps) {
  void _props;
  return <p className={styles.notice} role="status">Payment is not available yet. Your order remains pending.</p>;
}
