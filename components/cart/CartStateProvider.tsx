"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { getQuickAddCartState } from "@/app/cart/actions";
import { CART_UPDATED_CHANNEL, CART_UPDATED_EVENT } from "@/lib/constants";
import type { CartLineIdentity } from "@/lib/types";

interface CartStateValue {
  items: CartLineIdentity[] | null;
  setItems: (items: CartLineIdentity[]) => void;
}

const CartStateContext = createContext<CartStateValue | null>(null);

export function useThumbnailCartState() {
  return useContext(CartStateContext);
}

export function CartStateProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartLineIdentity[] | null>(null);

  const refresh = useCallback(async () => {
    try {
      setItems(await getQuickAddCartState());
    } catch {
      // Quick add still verifies the persisted cart before any write.
    }
  }, []);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refresh(), 0);
    const channel = typeof BroadcastChannel === "undefined"
      ? null
      : new BroadcastChannel(CART_UPDATED_CHANNEL);
    const onCartUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ cartItems?: CartLineIdentity[] }>).detail;
      if (detail?.cartItems) setItems(detail.cartItems);
      else void refresh();
    };
    const onChannelMessage = () => void refresh();
    const onFocus = () => void refresh();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener(CART_UPDATED_EVENT, onCartUpdated);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    channel?.addEventListener("message", onChannelMessage);
    return () => {
      window.clearTimeout(initialRefresh);
      window.removeEventListener(CART_UPDATED_EVENT, onCartUpdated);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      channel?.removeEventListener("message", onChannelMessage);
      channel?.close();
    };
  }, [refresh]);

  return <CartStateContext.Provider value={{ items, setItems }}>{children}</CartStateContext.Provider>;
}
