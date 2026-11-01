"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/** Reset forward client-side page navigation without breaking history restoration. */
export function NavigationScrollReset() {
  const pathname = usePathname();
  const previousPath = useRef(pathname);
  const historyNavigation = useRef(false);

  useEffect(() => {
    const onPopState = () => { historyNavigation.current = true; };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    if (historyNavigation.current) {
      historyNavigation.current = false;
      return;
    }
    // Let in-page anchor navigation retain its target position.
    if (window.location.hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  return null;
}
