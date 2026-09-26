"use client";

import { usePathname } from "next/navigation";
import { AccountMenu, type AccountSection } from "./AccountMenu";

const SECTION_BY_PATH: Record<string, AccountSection> = {
  "/account": "dashboard",
  "/account/profile": "profile",
  "/account/orders": "orders",
  "/account/downloads": "downloads",
  "/account/wishlist": "wishlist",
  "/account/licenses": "licenses",
  "/account/settings": "settings",
};

/**
 * Route-aware account nav. Only the highlight is client-side — route
 * protection itself stays server-side in the account layout.
 */
export function AccountSidebar() {
  const pathname = usePathname();
  return <AccountMenu active={SECTION_BY_PATH[pathname] ?? "dashboard"} />;
}
