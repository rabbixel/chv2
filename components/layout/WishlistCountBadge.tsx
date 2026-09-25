"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Icon, IconButton } from "@/components/ui";
import { WISHLIST_COUNT_COOKIE } from "@/lib/constants";
import { routes } from "@/lib/routes";

function readCountCookie(): number {
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${WISHLIST_COUNT_COOKIE}=(\\d+)`),
  );
  const value = match?.[1];
  return value === undefined ? 0 : Number(value);
}

function subscribe(): () => void {
  // Wishlist mutations always navigate (server actions), so the per-route
  // remount below is the sync point — no event subscription needed.
  return () => {};
}

function LiveBadge() {
  const count = useSyncExternalStore(subscribe, readCountCookie, () => 0);
  return (
    <IconButton
      label="Wishlist"
      href={routes.wishlist()}
      badge={count}
    >
      <Icon name="heart" />
    </IconButton>
  );
}

/**
 * Header wishlist button with a live count. Reads the count mirror
 * cookie client-side so the header (and every catalogue page) stays
 * statically renderable — no session reads on the server path.
 */
export function WishlistCountBadge() {
  const pathname = usePathname();
  return <LiveBadge key={pathname} />;
}
