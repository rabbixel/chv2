"use client";

import { useEffect, type ReactNode } from "react";
import { CART_UPDATED_CHANNEL, CART_UPDATED_EVENT } from "@/lib/constants";

export function CartEventBridge({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(CART_UPDATED_CHANNEL);
    const broadcast = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      channel.postMessage(detail ?? null);
    };
    window.addEventListener(CART_UPDATED_EVENT, broadcast);
    return () => {
      window.removeEventListener(CART_UPDATED_EVENT, broadcast);
      channel.close();
    };
  }, []);

  return children;
}
