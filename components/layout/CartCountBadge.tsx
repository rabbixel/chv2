"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Icon, IconButton } from "@/components/ui";
import { CART_COUNT_COOKIE, CART_UPDATED_EVENT } from "@/lib/constants";
import { routes } from "@/lib/routes";

export interface CartCountBadgeProps {
  initialCount: number;
}

function readCountCookie(): number | null {
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${CART_COUNT_COOKIE}=(\\d+)`),
  );
  const value = match?.[1];
  return value === undefined ? null : Number(value);
}

function subscribeCount(onChange: () => void): () => void {
  window.addEventListener(CART_UPDATED_EVENT, onChange);
  const channel = typeof BroadcastChannel === "undefined"
    ? null
    : new BroadcastChannel("ch:cart-updated");
  channel?.addEventListener("message", onChange);
  window.addEventListener("focus", onChange);
  return () => {
    window.removeEventListener(CART_UPDATED_EVENT, onChange);
    window.removeEventListener("focus", onChange);
    channel?.close();
  };
}

function LiveBadge({ initialCount }: CartCountBadgeProps) {
  const count = useSyncExternalStore(
    subscribeCount,
    () => readCountCookie() ?? initialCount,
    () => initialCount,
  );
  return (
    <IconButton label="Cart" href={routes.cart()} badge={count}>
      <Icon name="bag" />
    </IconButton>
  );
}

/**
 * Header cart button with a live count. Server-rendered with the sample
 * count (static-safe), then synced from the cart-count cookie on
 * navigation (per-route remount) and from `CART_UPDATED_EVENT` after
 * in-place mutations.
 */
export function CartCountBadge({ initialCount }: CartCountBadgeProps) {
  const pathname = usePathname();
  return <LiveBadge key={pathname} initialCount={initialCount} />;
}
