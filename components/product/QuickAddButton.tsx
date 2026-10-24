"use client";

import { useEffect, useId, useRef, useState, useTransition, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { quickAddToCart } from "@/app/cart/actions";
import { CART_UPDATED_EVENT } from "@/lib/constants";
import { useCartState } from "@/components/cart/CartStateProvider";
import type { Product, ProductPriceOption } from "@/lib/types";
import { formatMoney } from "@/lib/utils";
import { Icon } from "@/components/ui";
import styles from "./QuickAddButton.module.css";

interface QuickAddButtonProps {
  product: Pick<Product, "id" | "slug" | "title" | "status" | "soldOut" | "purchasable">;
}

export function QuickAddButton({ product }: QuickAddButtonProps) {
  const optionsId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstOptionRef = useRef<HTMLButtonElement>(null);
  const [options, setOptions] = useState<ProductPriceOption[] | null>(null);
  const [optionsPosition, setOptionsPosition] = useState<{ left: number; top: number } | null>(null);
  const [unavailablePriceIds, setUnavailablePriceIds] = useState<number[]>([]);
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);
  const [isUnavailable, setIsUnavailable] = useState(product.status !== "active" || product.soldOut === true || product.purchasable === false);
  const [pending, startTransition] = useTransition();
  const cartState = useCartState();
  const cartItems = cartState?.items ?? null;
  const cartLoading = cartItems === null;
  const productCartItems = cartItems?.filter((item) => item.productId === product.id) ?? [];

  useEffect(() => {
    if (!options) return;
    const positionOptions = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(304, window.innerWidth - 32);
      const height = 64 + options.length * 44;
      const left = Math.max(16, Math.min(window.innerWidth - width - 16, rect.right - width));
      const top = rect.bottom + 8 + height > window.innerHeight
        ? Math.max(16, rect.top - height - 8)
        : rect.bottom + 8;
      setOptionsPosition({ left, top });
    };
    positionOptions();
    window.addEventListener("resize", positionOptions);
    window.addEventListener("scroll", positionOptions, true);
    return () => {
      window.removeEventListener("resize", positionOptions);
      window.removeEventListener("scroll", positionOptions, true);
    };
  }, [options]);

  useEffect(() => {
    if (options && optionsPosition) firstOptionRef.current?.focus();
  }, [options, optionsPosition]);

  function closeOptions() {
    setOptions(null);
    triggerRef.current?.focus();
  }

  function run(priceId?: number) {
    setMessage("");
    setHasError(false);
    startTransition(async () => {
      const result = await quickAddToCart(product.slug, priceId);
      if (result.status === "needs-options") {
        setOptions(result.options);
        cartState?.setItems(result.cartItems);
        return;
      }
      if (result.status === "unavailable") {
        setHasError(true);
        if (options && priceId !== undefined) {
          setUnavailablePriceIds((current) => [...new Set([...current, priceId])]);
        } else {
          setIsUnavailable(true);
          setOptions(null);
        }
        setMessage(result.message);
        return;
      }
      if (result.status === "error") {
        setHasError(true);
        setMessage(result.message);
        return;
      }
      if (result.status !== "added" && result.status !== "already") return;
      setMessage(result.status === "already" ? "Already in your cart." : "Added to your cart.");
      cartState?.setItems(result.cartItems);
      window.dispatchEvent(new CustomEvent(CART_UPDATED_EVENT, {
        detail: { count: result.itemCount, cartItems: result.cartItems },
      }));
    });
  }

  function handleTrigger(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (pending || isUnavailable || cartLoading) return;
    if (options) {
      closeOptions();
      return;
    }
    run();
  }

  function handleOption(event: MouseEvent<HTMLButtonElement>, priceId: number) {
    event.preventDefault();
    event.stopPropagation();
    const inCart = productCartItems.some((item) => item.priceId === priceId);
    if (!pending && !inCart) run(priceId);
  }

  const fixedInCart = productCartItems.some((item) => item.priceId === null);
  const added = productCartItems.length > 0;
  const visibleMessage =
    (message === "Added to your cart." || message === "Already in your cart.") && !added
      ? ""
      : message;
  const stateMessage = visibleMessage ||
    (fixedInCart ? "Already in Cart" : added ? "An option is already in Cart" : "");
  const triggerLabel = product.soldOut ? `Sold Out: ${product.title}` : product.purchasable === false ? `Temporarily unavailable: ${product.title}` : cartLoading ? `Checking cart for ${product.title}` : isUnavailable
    ? `Quick add unavailable for ${product.title}`
    : fixedInCart
      ? `Already in Cart: ${product.title}`
      : added
        ? `An option for ${product.title} is already in your cart. Choose another option.`
      : `Quick add ${product.title} to cart`;

  return (
    <div className={styles.root} onKeyDown={(event) => { if (event.key === "Escape") closeOptions(); }}>
      <button
        type="button"
        ref={triggerRef}
        className={styles.button}
        aria-label={triggerLabel}
        title={fixedInCart ? "Already in Cart" : undefined}
        aria-expanded={Boolean(options)}
        aria-controls={options ? optionsId : undefined}
        aria-busy={pending || cartLoading}
        disabled={pending || isUnavailable || fixedInCart || cartLoading}
        onClick={handleTrigger}
      >
        {product.soldOut ? <span>Sold Out</span> : product.purchasable === false ? <span>Unavailable</span> : added ? <Icon name="check" size={19} /> : <Icon name="cart" size={19} />}
      </button>
      {options && optionsPosition && createPortal(<div id={optionsId} style={optionsPosition} className={styles.options} role="group" aria-label={`Choose a price for ${product.title}`}>
        <div className={styles.optionsHeader}>
          <span>Choose an option</span>
          <button type="button" className={styles.close} aria-label="Close price options" onClick={closeOptions}>×</button>
        </div>
        {options.map((option, optionIndex) => {
          const inCart = productCartItems.some((item) => item.priceId === option.id);
          const unavailable = unavailablePriceIds.includes(option.id);
          return <button
            type="button"
            key={option.id}
            className={styles.option}
            ref={optionIndex === 0 ? firstOptionRef : undefined}
            disabled={pending || inCart || unavailable}
            aria-label={`${option.name}, ${formatMoney(option.price)}${inCart ? ", already in cart" : unavailable ? ", unavailable" : ""}`}
            onClick={(event) => handleOption(event, option.id)}
          >
            <span>{option.name}</span>
            <span>{inCart ? "Already in Cart" : unavailable ? "Unavailable" : formatMoney(option.price)}</span>
          </button>;
        })}
      </div>, document.body)}
      {(stateMessage || isUnavailable) && <span role={isUnavailable || hasError ? "alert" : "status"} className={isUnavailable || hasError ? styles.error : styles.feedback}>
        {product.soldOut ? "Sold Out" : product.purchasable === false ? "Temporarily unavailable" : isUnavailable ? stateMessage || "This product is unavailable." : stateMessage}
      </span>}
    </div>
  );
}
