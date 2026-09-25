"use client";

import { useState } from "react";
import { Badge, Button, Icon } from "@/components/ui";
import { routes } from "@/lib/routes";
import type { License, Money, Product } from "@/lib/types";
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
 * Cart writes are UI-only in this run (instant optimistic state).
 * Persistence moves to the cart API (server action + `cartService`) once
 * sessions exist — `data-product-id` / `data-license` are the hooks.
 */
export function PurchasePanel({ product, licenses }: PurchasePanelProps) {
  const [licenseCode, setLicenseCode] = useState<string>(
    product.licenses[0] ?? "personal",
  );
  const [added, setAdded] = useState(false);

  const selected =
    licenses.find((license) => license.code === licenseCode) ?? licenses[0];
  const multiplier = selected?.priceMultiplier ?? 1;
  const price = scaledPrice(product.price, multiplier);
  const compareAt = product.compareAtPrice
    ? scaledPrice(product.compareAtPrice, multiplier)
    : undefined;
  const percent = discountPercent(compareAt, price);

  if (product.isFree) {
    return (
      <div className={styles.panel} data-product-id={product.id}>
        <p className={styles.free}>Free download</p>
        <Button href={routes.accountDownloads()} size="lg" fullWidth>
          Download free
        </Button>
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
      {selected && (
        <p className={styles.licenseNote}>
          {selected.name} license · {selected.description}
        </p>
      )}

      {licenses.length > 1 && (
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
                  setAdded(false);
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

      {added ? (
        <>
          <p role="status" className={styles.added}>
            <Icon name="check" size={18} />
            Added to your cart
          </p>
          <Button href={routes.checkout()} size="lg" fullWidth>
            Proceed to checkout
          </Button>
          <Button variant="ghost" fullWidth onClick={() => setAdded(false)}>
            Continue shopping
          </Button>
        </>
      ) : (
        <>
          <Button size="lg" fullWidth onClick={() => setAdded(true)}>
            Add to cart
          </Button>
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            href={routes.checkout()}
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
