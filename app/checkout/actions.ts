"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";
import { getCartService, getOrderService } from "@/lib/services";
import type { ID, OrderCustomer } from "@/lib/types";

/**
 * Checkout + payment actions. Order placement and the mock payment sandbox
 * live here; real Razorpay callbacks (success/failure/dismiss) route
 * through `verifyRazorpayPayment` / `recordFailedPayment` so capture and
 * signature verification stay server-side, on the future backend.
 */

function isMockPayments(): boolean {
  return process.env.USE_MOCK_API !== "false";
}

function checkoutError(message: string): never {
  redirect(`${routes.checkout()}?error=${encodeURIComponent(message)}`);
}

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

export async function placeOrder(formData: FormData): Promise<void> {
  const customer: OrderCustomer = {
    fullName: field(formData, "fullName"),
    email: field(formData, "email"),
    phone: field(formData, "phone"),
    line1: field(formData, "line1") || undefined,
    city: field(formData, "city") || undefined,
    state: field(formData, "state") || undefined,
    postalCode: field(formData, "postalCode") || undefined,
    country: field(formData, "country") || undefined,
  };
  if (!customer.fullName || !customer.email || !customer.phone) {
    checkoutError("Please fill your name, email and phone.");
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customer.email)) {
    checkoutError("That email address does not look right.");
  }
  if (customer.phone.replace(/\D/g, "").length < 7) {
    checkoutError("That phone number does not look right.");
  }
  if (!formData.get("terms")) {
    checkoutError("Please accept the Terms and Privacy Policy.");
  }
  if (field(formData, "paymentMethod") !== "razorpay") {
    checkoutError("Please choose a payment method.");
  }
  const cart = await getCartService().getSessionCart();
  if (cart.items.length === 0) {
    checkoutError("Your cart is empty.");
  }
  let orderId: ID;
  try {
    const order = await getOrderService().createOrder({ customer, cart });
    orderId = order.id;
  } catch {
    checkoutError("Could not place your order. Please try again.");
  }
  // The cart survives until payment succeeds, so failed/cancelled payments
  // can retry from an intact cart.
  revalidatePath(routes.checkout());
  redirect(routes.checkoutPay(orderId));
}

/**
 * Mock-mode test sandbox. Explicitly labelled in the UI as a simulation —
 * it never represents a real money movement and refuses to run outside
 * mock mode.
 */
export async function simulateTestPayment(
  formData: FormData,
): Promise<void> {
  if (!isMockPayments()) {
    throw new Error("Test payments are disabled outside mock mode.");
  }
  const orderId = field(formData, "orderId");
  const outcome = field(formData, "outcome");
  const orderService = getOrderService();
  if (outcome === "success") {
    const order = await orderService.markOrderPaid(
      orderId,
      `pay_mock_${Date.now().toString(36)}`,
    );
    if (!order) checkoutError("That order is no longer payable.");
    await getCartService().clearCart();
    revalidatePath(routes.cart());
    revalidatePath(routes.checkout());
    redirect(routes.checkoutSuccess(order.id));
  }
  if (outcome === "failure") {
    const reason = field(formData, "reason") || "The payment was declined.";
    const order = await orderService.markOrderFailed(orderId, reason);
    if (!order) checkoutError("That order is no longer payable.");
    revalidatePath(routes.checkout());
    redirect(routes.checkoutFailed(order.id));
  }
  throw new Error(`Unknown test outcome "${outcome}".`);
}

export async function cancelPayment(formData: FormData): Promise<void> {
  const orderId = field(formData, "orderId");
  await getOrderService().markOrderCancelled(orderId);
  revalidatePath(routes.checkout());
  redirect(routes.checkoutPay(orderId));
}

/** Real-mode Razorpay callback: verify signature + capture via backend. */
export async function verifyRazorpayPayment(input: {
  orderId: ID;
  razorpayPaymentId: string;
  razorpayOrderId: string;
  razorpaySignature: string;
}): Promise<{ orderId: ID }> {
  if (isMockPayments()) {
    throw new Error("Test payments use the sandbox panel.");
  }
  const order = await getOrderService().verifyPayment({
    orderId: input.orderId,
    razorpayPaymentId: input.razorpayPaymentId,
    razorpayOrderId: input.razorpayOrderId,
    razorpaySignature: input.razorpaySignature,
  });
  await getCartService().clearCart();
  revalidatePath(routes.cart());
  revalidatePath(routes.checkout());
  return { orderId: order.id };
}

/** Real-mode Razorpay `payment.failed` callback. */
export async function recordFailedPayment(input: {
  orderId: ID;
  reason: string;
}): Promise<{ orderId: ID | null }> {
  const order = await getOrderService().markOrderFailed(
    input.orderId,
    input.reason,
  );
  revalidatePath(routes.checkout());
  return { orderId: order?.id ?? null };
}
