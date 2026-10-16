import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";

interface FailedPageProps { params: Promise<{ orderId: string }> }

/** Payment failure pages remain unavailable until a real payment flow exists. */
export default async function CheckoutFailedPage({ params }: FailedPageProps) {
  const { orderId } = await params;
  redirect(routes.checkoutPay(orderId));
}
