"use server";

import { createFreeCheckoutSession } from "@/lib/services";
import { routes } from "@/lib/routes";
import { assertSameOriginRequest } from "@/lib/auth";

/** Next server-action origin protection applies; no cart mutation is performed. */
export async function startFreeCheckout(slug: string, priceId: number | null): Promise<{ url?: string; error?: string }> {
  await assertSameOriginRequest();
  try {
    return { url: routes.freeCheckout(await createFreeCheckoutSession(slug, priceId)) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not start free checkout. Please try again." };
  }
}
