import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";

interface SuccessPageProps { params: Promise<{ orderId: string }> }

/** This route must not imply a successful payment before verified payment support exists. */
export default async function CheckoutSuccessPage({ params }: SuccessPageProps) {
  const { orderId } = await params;
  redirect(routes.checkoutPay(orderId));
}
