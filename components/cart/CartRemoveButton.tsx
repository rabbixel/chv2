"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeFromCart } from "@/app/cart/actions";
import { CART_UPDATED_EVENT } from "@/lib/constants";

export function CartRemoveButton({
  itemKey,
  label,
  className,
}: {
  itemKey: string;
  label: string;
  className: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function remove() {
    setError("");
    startTransition(async () => {
      try {
        const result = await removeFromCart(itemKey);
        window.dispatchEvent(new CustomEvent(CART_UPDATED_EVENT, { detail: result }));
        router.refresh();
      } catch {
        setError("Could not remove that item. Please try again.");
      }
    });
  }

  return (
    <span>
      <button type="button" className={className} aria-label={label} disabled={pending} onClick={remove}>
        {pending ? "Removing…" : "Remove"}
      </button>
      {error && <span role="alert">{error}</span>}
    </span>
  );
}
