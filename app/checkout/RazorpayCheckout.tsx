"use client";

import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { loadRazorpayScript, openRazorpayCheckout } from "@/lib/payments/razorpay";
import { getRazorpayCheckoutOutcomeCopy } from "@/lib/payments/razorpayVerificationResponse.mjs";
import { createRazorpayOrder, verifyRazorpayPayment, type RazorpayVerificationResult } from "./actions";
import styles from "./page.module.css";

interface RazorpayCheckoutProps {
  orderReference?: string;
  name: string;
  email: string;
  phone: string;
  onVerified(result: RazorpayVerificationResult): void;
  initialVerification?: RazorpayVerificationResult | null;
}

export interface RazorpayCheckoutHandle {
  startCheckout(orderReference: string): Promise<void>;
}

export const RazorpayCheckout = forwardRef<RazorpayCheckoutHandle, RazorpayCheckoutProps>(function RazorpayCheckout(
  { orderReference, name, email, phone, onVerified, initialVerification },
  ref,
) {
  const opened = useRef(false);
  const [activeOrderReference, setActiveOrderReference] = useState(orderReference ?? "");
  const [loading, setLoading] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [message, setMessage] = useState(() => initialVerification ? getRazorpayCheckoutOutcomeCopy(initialVerification).message : "");
  const [finalState, setFinalState] = useState<"captured" | "authorized" | null>(initialVerification?.status ?? null);
  const [fulfilled, setFulfilled] = useState(initialVerification?.fulfilled ?? false);

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
            onVerified(verification);
            setFinalState(verification.status);
            setFulfilled(verification.fulfilled);
            setMessage(getRazorpayCheckoutOutcomeCopy(verification).message);
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
  }, [checkoutOpen, email, finalState, loading, name, onVerified, phone]);

  useImperativeHandle(ref, () => ({ startCheckout }), [startCheckout]);

  if (!activeOrderReference) return null;

  return <div className={styles.paymentPanel}>
    {!finalState && !checkoutOpen && <Button type="button" variant="primary" size="lg" onClick={() => void startCheckout(activeOrderReference)} loading={loading} disabled={loading}>
      {loading ? "Preparing secure checkout…" : message ? "Retry secure payment" : "Pay securely with Razorpay"}
    </Button>}
    {message && <p role={finalState ? "status" : "alert"} className={finalState ? styles.methodHint : styles.error}>{message}</p>}
    <p className={styles.methodHint}>
      {finalState
        ? getRazorpayCheckoutOutcomeCopy({ status: finalState, verified: true, fulfilled: finalState === "captured" && fulfilled, edd_order_reference: activeOrderReference }).note
        : "Your order remains pending until payment is verified. Downloads are enabled only after EDD fulfillment."}
    </p>
  </div>;
});
