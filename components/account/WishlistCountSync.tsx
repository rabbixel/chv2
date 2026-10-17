"use client";

import { useEffect } from "react";
import { WISHLIST_COUNT_COOKIE, WISHLIST_COUNT_EVENT } from "@/lib/constants";

export function WishlistCountSync({ count }: { count: number }) {
  useEffect(() => {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${WISHLIST_COUNT_COOKIE}=${Math.max(0, count)}; Path=/; Max-Age=2592000; SameSite=Lax${secure}`;
    window.dispatchEvent(new Event(WISHLIST_COUNT_EVENT));
  }, [count]);

  return null;
}
