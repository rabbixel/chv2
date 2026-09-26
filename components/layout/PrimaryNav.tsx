"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui";
import { PRIMARY_NAV_VISIBLE_COUNT } from "@/lib/navigation";
import { routes } from "@/lib/routes";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";
import styles from "./PrimaryNav.module.css";

export interface PrimaryNavProps {
  /** Top-level categories, already sorted. */
  categories: Category[];
  className?: string;
}

/**
 * Desktop primary navigation. Renders the first N categories inline and the
 * remainder inside an accessible "More" disclosure — the list is data-driven,
 * so API-backed categories slot in without layout changes.
 */
export function PrimaryNav({ categories, className }: PrimaryNavProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  const visible = categories.slice(0, PRIMARY_NAV_VISIBLE_COUNT);
  const overflow = categories.slice(PRIMARY_NAV_VISIBLE_COUNT);

  useEffect(() => {
    if (!moreOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!navRef.current?.contains(event.target as Node)) setMoreOpen(false);
    };
    const onKeyDown = (event:globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [moreOpen]);

  return (
    <nav ref={navRef} aria-label="Primary" className={cn(styles.nav, className)}>
      <div className="ch-container">
        <ul className={styles.list}>
          {visible.map((category) => (
            <li key={category.id}>
              <Link
                href={routes.category(category.slug)}
                className={styles.link}
              >
                {category.name}
              </Link>
            </li>
          ))}
          {overflow.length > 0 && (
            <li className={styles.more}>
              <button
                type="button"
                className={cn(styles.link, styles.moreButton)}
                aria-expanded={moreOpen}
                aria-haspopup="true"
                onClick={() => setMoreOpen((wasOpen) => !wasOpen)}
              >
                More
                <Icon
                  name="chevron-down"
                  size={16}
                  className={cn(styles.chevron, moreOpen && styles.chevronOpen)}
                />
              </button>
              {moreOpen && (
                <ul className={styles.morePanel} aria-label="More categories">
                  {overflow.map((category) => (
                    <li key={category.id}>
                      <Link
                        href={routes.category(category.slug)}
                        className={styles.moreLink}
                        onClick={() => setMoreOpen(false)}
                      >
                        {category.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )}
        </ul>
      </div>
    </nav>
  );
}
