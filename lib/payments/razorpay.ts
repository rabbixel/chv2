/**
 * Razorpay checkout.js integration (client-safe).
 *
 * Only the PUBLISHABLE key id (`NEXT_PUBLIC_RAZORPAY_KEY_ID`) ever reaches
 * the browser. Order creation and signature verification stay on the future
 * backend: the frontend opens the modal with a backend-created `order_id`
 * and posts the callback payload to `POST /v1/payments/verify`. Secret
 * credentials must never be added here.
 */

export interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface RazorpayFailureResponse {
  error: {
    code: string;
    description: string;
    reason?: string;
    metadata?: Record<string, unknown>;
  };
}

interface RazorpayInstance {
  open(): void;
  on(
    event: "payment.failed",
    handler: (response: RazorpayFailureResponse) => void,
  ): void;
}

declare global {
  interface Window {
    Razorpay?: new (
      options: Record<string, unknown>,
    ) => RazorpayInstance;
  }
}

const CHECKOUT_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

let scriptPromise: Promise<void> | null = null;

/** Load checkout.js once; resolves when `window.Razorpay` is ready. */
export function loadRazorpayScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Razorpay needs a browser."));
  }
  if (window.Razorpay) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CHECKOUT_SCRIPT;
    script.async = true;
    script.onload = () => {
      if (window.Razorpay) resolve();
      else reject(new Error("Razorpay failed to load."));
    };
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Razorpay failed to load."));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export interface OpenRazorpayOptions {
  /** Publishable key id — never a secret. */
  key: string;
  /** Backend-created Razorpay order id (`order_*`). */
  providerOrderId: string;
  /** Amount in paise; must match the provider order. */
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill: {
    name?: string;
    email?: string;
    contact?: string;
  };
  onSuccess: (response: RazorpaySuccessResponse) => void;
  onFailure: (response: RazorpayFailureResponse) => void;
  /** Modal dismissed without completing (order stays pending). */
  onDismiss: () => void;
}

/** Open the Razorpay modal. Call `loadRazorpayScript()` first. */
export function openRazorpayCheckout(options: OpenRazorpayOptions): void {
  if (!window.Razorpay) {
    throw new Error("Razorpay checkout.js is not loaded.");
  }
  const razorpay = new window.Razorpay({
    key: options.key,
    order_id: options.providerOrderId,
    amount: options.amount,
    currency: options.currency,
    name: options.name,
    description: options.description,
    prefill: options.prefill,
    handler: options.onSuccess,
    modal: { ondismiss: options.onDismiss },
  });
  razorpay.on("payment.failed", options.onFailure);
  razorpay.open();
}
