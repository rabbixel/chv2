"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addToCart } from "@/app/cart/actions";
import { startFreeCheckout } from "@/app/checkout/free/actions";
import { useCartState } from "@/components/cart/CartStateProvider";
import { Badge, Button, Icon } from "@/components/ui";
import { CART_UPDATED_EVENT } from "@/lib/constants";
import { routes } from "@/lib/routes";
import { hasCartLine } from "@/lib/services/cartLine";
import type { License, LicenseCode, Money, Product } from "@/lib/types";
import { discountPercent, formatMoney } from "@/lib/utils";
import styles from "./PurchasePanel.module.css";

export interface PurchasePanelProps {
  product: Product;
  /** License records resolved server-side for `product.licenses`. */
  licenses: License[];
}

function scaledPrice(base: Money, multiplier: number): Money {
  return {
    amount: Math.round(base.amount * multiplier),
    currency: base.currency,
  };
}

/**
 * Buy box: license picker ("Choose your desired option", like the live
 * site's variable pricing), price, purchase actions and the customization
 * quote action (only when the product supports it).
 *
 * Cart writes go through the `addToCart` server action (session cart +
 * header badge sync); the added state mirrors the live site's flyout.
 */
export function PurchasePanel({ product, licenses }: PurchasePanelProps) {
  const router = useRouter();
  const [licenseCode, setLicenseCode] = useState<LicenseCode>(
    product.licenses[0] ?? "personal",
  );
  const [priceId, setPriceId] = useState<number | null>(() => {
    const selectedOption = product.priceOptions?.find((option) => option.isDefault) ?? product.priceOptions?.[0];
    return selectedOption?.id ?? null;
  });
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const cartState = useCartState();
  const cartItems = cartState?.items ?? null;
  const cartLoading = cartState !== null && cartItems === null;
  const alreadyInCart = cartItems !== null && hasCartLine(cartItems, product.id, priceId);

  const syncCart = (result: { itemCount: number; cartItems: Array<{ productId: string; priceId: number | null }> }) => {
    cartState?.setItems(result.cartItems);
    window.dispatchEvent(
      new CustomEvent(CART_UPDATED_EVENT, {
        detail: { count: result.itemCount, cartItems: result.cartItems },
      }),
    );
  };

  const handleAdd = () => {
    setActionError(null);
    startTransition(async () => {
      try {
        const result = await addToCart(product.id, licenseCode, priceId);
        syncCart(result);
      } catch {
        setActionError("Could not add to cart. Please try again.");
      }
    });
  };

  const handleBuyNow = () => {
    setActionError(null);
    startTransition(async () => {
      try {
        const result = await addToCart(product.id, licenseCode, priceId);
        syncCart(result);
        router.push(routes.checkout());
      } catch {
        setActionError("Could not add to cart. Please try again.");
      }
    });
  };

  const handleFreeCheckout = () => {
    setActionError(null);
    startTransition(async () => {
      try {
        const result = await startFreeCheckout(product.slug, product.priceOptions?.length ? priceId : null);
        if (result.url) router.push(result.url);
        else setActionError(result.error ?? "Could not prepare the free download. Please try again.");
      } catch {
        setActionError("Could not prepare the free download. Please try again.");
      }
    });
  };

  const selected =
    licenses.find((license) => license.code === licenseCode) ?? licenses[0];
  const multiplier = selected?.priceMultiplier ?? 1;
  const selectedPriceOption = product.priceOptions?.find((option) => option.id === priceId) ?? product.priceOptions?.[0];
  const price = selectedPriceOption?.price ?? scaledPrice(product.price, multiplier);
  const compareAt = product.compareAtPrice
    ? scaledPrice(product.compareAtPrice, multiplier)
    : undefined;
  const percent = discountPercent(compareAt, price);

  if (product.soldOut) {
    return <div className={styles.panel} data-product-id={product.id}>
      <p className={styles.soldOut}>Sold Out</p>
      <p className={styles.licenseNote}>This product has reached its purchase limit.</p>
    </div>;
  }

  if (product.purchasable === false || !Number.isFinite(price.amount) || price.amount < 0) {
    return <div className={styles.panel} data-product-id={product.id}>
      <p className={styles.soldOut}>Temporarily unavailable</p>
      <p className={styles.licenseNote}>Please refresh shortly to check availability again.</p>
    </div>;
  }

  const freePriceOptions = product.priceOptions ?? [];
  const zeroValueOptions = freePriceOptions.length === 0 || freePriceOptions.every((option) => option.price.amount === 0);

  if (product.isFree && zeroValueOptions) {
    return (
      <div className={styles.panel} data-product-id={product.id}>
        <p className={styles.free}>Free download</p>
        <p className={styles.licenseNote}>
          {selectedPriceOption?.name ?? (selected ? `${selected.name} license · ${selected.description}` : "")}
        </p>
        {freePriceOptions.length > 1 && (
          <fieldset className={styles.options}>
            <legend className={styles.optionsLegend}>Choose your desired option</legend>
            {freePriceOptions.map((option) => (
              <label key={option.id} className={styles.option}>
                <input
                  type="radio"
                  name={`price-${product.id}`}
                  value={option.id}
                  checked={option.id === priceId}
                  onChange={() => setPriceId(option.id)}
                  className={styles.radio}
                />
                <span className={styles.optionName}>{option.name}</span>
                <span className={styles.optionPrice}>Free</span>
              </label>
            ))}
          </fieldset>
        )}
        {actionError && <p role="alert" className={styles.error}>{actionError}</p>}
        <Button onClick={handleFreeCheckout} size="lg" fullWidth loading={pending} disabled={pending}>
          Get free download
        </Button>
        <Button variant="ghost" onClick={handleAdd} fullWidth loading={pending} disabled={pending || cartLoading || alreadyInCart}>
          {alreadyInCart ? "Already in your cart" : "Add to cart"}
        </Button>
        <p className={styles.licenseNote}>Download this design for free. Simply complete the checkout to get your files. No payment or account required.</p>
        {product.isCustomizable && (
          <Button variant="ghost" fullWidth href={routes.customize()}>
            Get Quote for Customization
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      className={styles.panel}
      data-product-id={product.id}
      data-license={licenseCode}
    >
      <div className={styles.priceRow}>
        <p className={styles.price}>{formatMoney(price)}</p>
        {compareAt && (
          <s className={styles.compareAt}>{formatMoney(compareAt)}</s>
        )}
        {percent !== null && (
          <Badge variant="danger" size="sm">
            −{percent}%
          </Badge>
        )}
      </div>
      {product.priceOptions?.length ? (
        <p className={styles.licenseNote}>{selectedPriceOption?.name}</p>
      ) : selected && (
        <p className={styles.licenseNote}>
          {selected.name} license · {selected.description}
        </p>
      )}

      {product.priceOptions && product.priceOptions.length > 0 ? (
        product.priceOptions.length > 1 && <fieldset className={styles.options}>
          <legend className={styles.optionsLegend}>Choose your desired option</legend>
          {product.priceOptions.map((option) => <label key={option.id} className={styles.option}>
            <input type="radio" name={`price-${product.id}`} value={option.id} checked={option.id === (selectedPriceOption?.id ?? null)} onChange={() => setPriceId(option.id)} className={styles.radio} />
            <span className={styles.optionName}>{option.name}</span><span className={styles.optionPrice}>{formatMoney(option.price)}</span>
          </label>)}
        </fieldset>
      ) : licenses.length > 1 && (
        <fieldset className={styles.options}>
          <legend className={styles.optionsLegend}>
            Choose your desired option
          </legend>
          {licenses.map((license) => (
            <label key={license.code} className={styles.option}>
              <input
                type="radio"
                name={`license-${product.id}`}
                value={license.code}
                checked={license.code === licenseCode}
                onChange={() => {
                  setLicenseCode(license.code);
                }}
                className={styles.radio}
              />
              <span className={styles.optionName}>{license.name}</span>
              <span className={styles.optionPrice}>
                {formatMoney(scaledPrice(product.price, license.priceMultiplier))}
              </span>
            </label>
          ))}
        </fieldset>
      )}

      {actionError && (
        <p role="alert" className={styles.error}>
          {actionError}
        </p>
      )}
      {price.amount === 0 ? (
        <>
          <Button onClick={handleFreeCheckout} size="lg" fullWidth loading={pending} disabled={pending}>
            Get free download
          </Button>
          <Button variant="ghost" onClick={handleAdd} fullWidth loading={pending} disabled={pending || cartLoading || alreadyInCart}>
            {alreadyInCart ? "Already in your cart" : "Add to cart"}
          </Button>
        </>
      ) : alreadyInCart ? (
        <>
          <p role="status" className={styles.added}>
            <Icon name="check" size={18} />
            Already in your cart
          </p>
          <Button href={routes.cart()} size="lg" fullWidth>
            View cart
          </Button>
          <Button variant="secondary" href={routes.checkout()} fullWidth>
            Proceed to checkout
          </Button>
        </>
      ) : (
        <>
          <Button
            size="lg"
            fullWidth
            onClick={handleAdd}
            loading={pending}
            disabled={pending || cartLoading}
          >
            Add to cart
          </Button>
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            onClick={handleBuyNow}
            loading={pending}
            disabled={pending || cartLoading}
          >
            Buy now
          </Button>
        </>
      )}

      {product.isCustomizable && (
        <Button variant="ghost" fullWidth href={routes.customize()}>
          Get Quote for Customization
        </Button>
      )}
    </div>
  );
}
