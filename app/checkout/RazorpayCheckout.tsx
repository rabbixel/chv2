"use client";

import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { loadRazorpayScript, openRazorpayCheckout } from "@/lib/payments/razorpay";
import { createRazorpayOrder, verifyRazorpayPayment } from "./actions";
import styles from "./page.module.css";

interface RazorpayCheckoutProps {
  orderReference?: string;
  name: string;
  email: string;
  phone: string;
}

export interface RazorpayCheckoutHandle {
  startCheckout(orderReference: string): Promise<void>;
}

export const RazorpayCheckout = forwardRef<RazorpayCheckoutHandle, RazorpayCheckoutProps>(function RazorpayCheckout(
  { orderReference, name, email, phone },
  ref,
) {
  const opened = useRef(false);
  const [activeOrderReference, setActiveOrderReference] = useState(orderReference ?? "");
  const [loading, setLoading] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [finalState, setFinalState] = useState<"captured" | "authorized" | null>(null);

  const startCheckout = useCallback(async (reference: string) => {
    if (!reference || opened.current || loading || checkoutOpen || finalState) return;
    opened.current = true;
    setActiveOrderReference(reference);
    setLoading(true);
    setMessage("");
    try {
      const order = await createRazorpayOrder(reference);
      await loadRazorpayScript();
      setLoading(false);
      setCheckoutOpen(true);
      openRazorpayCheckout({
        key: order.key_id,
        providerOrderId: order.razorpay_order_id,
        amount: order.amount,
        currency: order.currency,
        name: "Creative Hatti",
        description: `Order ${order.edd_order_reference}`,
        prefill: { name, email, contact: phone },
        onDismiss: () => {
          opened.current = false;
          setCheckoutOpen(false);
          setLoading(false);
          setMessage("Checkout was closed. Your order remains pending. You can try payment again.");
        },
        onFailure: (failure) => {
          opened.current = false;
          setCheckoutOpen(false);
          setLoading(false);
          setMessage(failure.error.description || "Payment did not complete. Your order remains pending; you can retry.");
        },
        onSuccess: async (result) => {
          setCheckoutOpen(false);
          setLoading(true);
          setMessage("Verifying payment securely…");
          try {
            const verification = await verifyRazorpayPayment(reference, result);
            setFinalState(verification.status);
            setMessage(verification.status === "captured"
              ? `Payment verified for order ${verification.edd_order_reference}. The order remains pending until fulfillment is enabled.`
              : `Payment is authorized but not captured. Order ${verification.edd_order_reference} remains pending.`);
          } catch (error) {
            opened.current = false;
            setCheckoutOpen(false);
            setMessage(error instanceof Error ? error.message : "Payment could not be verified. Your order remains pending.");
          } finally {
            setLoading(false);
          }
        },
      });
    } catch (error) {
      opened.current = false;
      setCheckoutOpen(false);
      setLoading(false);
      setMessage(error instanceof Error ? error.message : "Payment setup failed. Your order remains pending; please retry.");
    }
  }, [checkoutOpen, email, finalState, loading, name, phone]);

  useImperativeHandle(ref, () => ({ startCheckout }), [startCheckout]);

  if (!activeOrderReference) return null;

  return <div className={styles.paymentPanel}>
    {!finalState && !checkoutOpen && <Button type="button" variant="primary" size="lg" onClick={() => void startCheckout(activeOrderReference)} loading={loading} disabled={loading}>
      {loading ? "Preparing secure checkout…" : message ? "Retry secure payment" : "Pay securely with Razorpay"}
    </Button>}
    {message && <p role={finalState ? "status" : "alert"} className={finalState ? styles.methodHint : styles.error}>{message}</p>}
    <p className={styles.methodHint}>Your order stays pending until payment is verified. Downloads are enabled only by a later fulfillment step.</p>
  </div>;
});
