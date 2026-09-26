"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  recordFailedPayment,
  verifyRazorpayPayment,
} from "@/app/checkout/actions";
import { Button, Spinner } from "@/components/ui";
import { SITE } from "@/lib/constants";
import {
  loadRazorpayScript,
  openRazorpayCheckout,
} from "@/lib/payments/razorpay";
import { routes } from "@/lib/routes";
import styles from "./RazorpayButton.module.css";

export interface RazorpayButtonProps {
  orderId: string;
  orderNumber: string;
  /** Publishable key id — never a secret. */
  keyId: string;
  /** Backend-created Razorpay order id. */
  providerOrderId: string;
  amountPaise: number;
  currency: string;
  totalLabel: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
}

/**
 * Real-mode payment button (mock mode uses the sandbox panel instead).
 * Opens the Razorpay modal; success verifies server-side before the order
 * is marked paid, failure records server-side, dismiss keeps the order
 * pending so the shopper can retry.
 */
export function RazorpayButton({
  orderId,
  orderNumber,
  keyId,
  providerOrderId,
  amountPaise,
  currency,
  totalLabel,
  customerName,
  customerEmail,
  customerPhone,
}: RazorpayButtonProps) {
  const router = useRouter();
  const [processing, setProcessing] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const fail = (reason: string) => {
    startTransition(async () => {
      const result = await recordFailedPayment({ orderId, reason });
      router.push(
        result.orderId
          ? routes.checkoutFailed(result.orderId)
          : `${routes.checkout()}?error=order`,
      );
    });
  };

  const pay = async () => {
    setError(null);
    setDismissed(false);
    setProcessing(true);
    try {
      await loadRazorpayScript();
    } catch {
      setProcessing(false);
      setError("Razorpay could not be loaded. Check your connection.");
      return;
    }
    setProcessing(false);
    try {
      openRazorpayCheckout({
        key: keyId,
        providerOrderId,
        amount: amountPaise,
        currency,
        name: SITE.name,
        description: `Order ${orderNumber}`,
        prefill: {
          name: customerName,
          email: customerEmail,
          contact: customerPhone,
        },
        onSuccess: (response) => {
          setProcessing(true);
          startTransition(async () => {
            try {
              const result = await verifyRazorpayPayment({
                orderId,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpayOrderId: response.razorpay_order_id,
                razorpaySignature: response.razorpay_signature,
              });
              router.push(routes.checkoutSuccess(result.orderId));
            } catch {
              fail("The payment could not be verified.");
            }
          });
        },
        onFailure: (response) => {
          fail(response.error?.description || "The payment failed.");
        },
        onDismiss: () => setDismissed(true),
      });
    } catch {
      setError("Razorpay could not be opened. Please try again.");
    }
  };

  return (
    <div className={styles.wrap}>
      <Button
        size="lg"
        fullWidth
        onClick={pay}
        loading={processing}
        disabled={processing}
      >
        {processing ? "Processing…" : `Pay ${totalLabel} with Razorpay`}
      </Button>
      {dismissed && !processing && (
        <p role="status" className={styles.notice}>
          Payment window closed — no money was charged. You can try again.
        </p>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {processing && (
        <div
          className={styles.overlay}
          role="status"
          aria-label="Processing payment"
        >
          <span className={styles.overlayCard}>
            <Spinner label="Processing payment…" />
          </span>
        </div>
      )}
    </div>
  );
}
