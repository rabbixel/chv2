"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui";
import { cn } from "@/lib/utils";
import { FilterPanel, type FilterPanelProps } from "./FilterPanel";
import styles from "./FilterDrawer.module.css";

export interface FilterDrawerProps extends Omit<FilterPanelProps, "idPrefix"> {
  activeCount: number;
  className?: string;
}

/** Mobile filter entry point: button + accessible left drawer. */
export function FilterDrawer({
  activeCount,
  className,
  ...panelProps
}: FilterDrawerProps) {
  const [open, setOpen] = useState(false);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const openButton = openButtonRef.current;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        return;
      }
      if (event.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      openButton?.focus();
    };
  }, [open ]);

  return (
    <span className={cn(styles.root, className)}>
      <button
        ref={openButtonRef}
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls="listing-filters"
        onClick={() => setOpen(true)}
      >
        <Icon name="menu" size={18} />
        Filters
        {activeCount > 0 && (
          <span className={styles.badge} aria-label={`${activeCount} active`}>
            {activeCount}
          </span>
        )}
      </button>
      {open && (
        <span className={styles.portal}>
          <span className={styles.overlay} aria-hidden="true" onClick={close} />
          <div
            ref={panelRef}
            id="listing-filters"
            role="dialog"
            aria-modal="true"
            aria-label="Filters"
            className={styles.panel}
          >
            <div className={styles.panelHead}>
              <span className={styles.panelTitle}>Filters</span>
              <button
                ref={closeButtonRef}
                type="button"
                className={styles.close}
                aria-label="Close filters"
                onClick={close}
              >
                <Icon name="close" />
              </button>
            </div>
            <div className={styles.panelBody}>
              <FilterPanel {...panelProps} idPrefix="drawer-filter" />
            </div>
            <div className={styles.panelFoot}>
              <button
                type="button"
                className={styles.apply}
                onClick={close}
              >
                Show results
              </button>
            </div>
          </div>
        </span>
      )}
    </span>
  );
}
