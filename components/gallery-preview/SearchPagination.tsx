"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { getPaginationWindow } from "./pagination-window.mjs";
import styles from "./SearchPagination.module.css";

interface SearchPaginationProps {
  currentPage: number;
  totalPages: number;
  hrefBase: string;
  label: string;
  resultsId?: string;
}

function PageLink({
  page,
  currentPage,
  totalPages,
  hrefForPage,
  kind,
}: {
  page: number;
  currentPage: number;
  totalPages: number;
  hrefForPage: (page: number) => string;
  kind: "first" | "previous" | "next" | "last";
}) {
  const disabled = kind === "first" || kind === "previous" ? currentPage === 1 : currentPage === totalPages;
  const labels = { first: "First page", previous: "Previous page", next: "Next page", last: "Last page" };
  const symbols = { first: "«", previous: "‹", next: "›", last: "»" };
  const words = { first: "First", previous: "Previous", next: "Next", last: "Last" };
  const className = `${styles.control} ${disabled ? styles.disabled : ""}`;

  if (disabled) {
    return <button className={className} type="button" disabled aria-label={labels[kind]}><span aria-hidden="true">{symbols[kind]}</span><span className={styles.controlText}>{words[kind]}</span></button>;
  }

  return <Link className={className} href={hrefForPage(page)} scroll={false} aria-label={labels[kind]} title={labels[kind]}><span aria-hidden="true">{symbols[kind]}</span><span className={styles.controlText}>{words[kind]}</span></Link>;
}

export function SearchPagination({
  currentPage,
  totalPages,
  hrefBase,
  label,
  resultsId = "search-results",
}: SearchPaginationProps) {
  const previousPage = useRef(currentPage);
  const desktopPages = getPaginationWindow(currentPage, totalPages, 1);
  const mobilePages = getPaginationWindow(currentPage, totalPages, 0);
  const hrefForPage = (page: number) => `${hrefBase}${hrefBase.includes("?") ? "&" : "?"}page=${page}`;

  useEffect(() => {
    if (previousPage.current === currentPage) return;
    previousPage.current = currentPage;

    const target = document.getElementById(resultsId);
    if (!target) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    Array.from(document.querySelectorAll<HTMLElement>(`[aria-current="page"]`))
      .find((element) => element.getClientRects().length > 0)
      ?.focus({ preventScroll: true });
    target.scrollIntoView({ block: "start", behavior: reducedMotion ? "instant" : "smooth" });
  }, [currentPage, resultsId]);

  if (totalPages < 1) return null;

  const renderPages = (items: ReturnType<typeof getPaginationWindow>, windowName: "desktop" | "mobile") => items.map((item) => {
    if (item.type === "ellipsis") return <span className={styles.ellipsis} aria-hidden="true" key={`${windowName}-${item.key}`}>…</span>;
    if (item.page === currentPage) return <span className={`${styles.pageNumber} ${styles.current}`} aria-current="page" aria-label={`Page ${item.page}, current page`} tabIndex={-1} key={`${windowName}-${item.page}`}>{item.page}</span>;
    return <Link className={styles.pageNumber} href={hrefForPage(item.page)} scroll={false} aria-label={`Go to page ${item.page}`} key={`${windowName}-${item.page}`}>{item.page}</Link>;
  });

  return (
    <nav className={styles.pagination} aria-label={label}>
      <div className={`${styles.controls} ${styles.desktopPages}`}>
        <PageLink kind="first" page={1} currentPage={currentPage} totalPages={totalPages} hrefForPage={hrefForPage} />
        <PageLink kind="previous" page={currentPage - 1} currentPage={currentPage} totalPages={totalPages} hrefForPage={hrefForPage} />
        {renderPages(desktopPages, "desktop")}
        <PageLink kind="next" page={currentPage + 1} currentPage={currentPage} totalPages={totalPages} hrefForPage={hrefForPage} />
        <PageLink kind="last" page={totalPages} currentPage={currentPage} totalPages={totalPages} hrefForPage={hrefForPage} />
      </div>
      <div className={`${styles.controls} ${styles.mobilePages}`}>
        <PageLink kind="first" page={1} currentPage={currentPage} totalPages={totalPages} hrefForPage={hrefForPage} />
        <PageLink kind="previous" page={currentPage - 1} currentPage={currentPage} totalPages={totalPages} hrefForPage={hrefForPage} />
        {renderPages(mobilePages, "mobile")}
        <PageLink kind="next" page={currentPage + 1} currentPage={currentPage} totalPages={totalPages} hrefForPage={hrefForPage} />
        <PageLink kind="last" page={totalPages} currentPage={currentPage} totalPages={totalPages} hrefForPage={hrefForPage} />
      </div>
      <p className={styles.pageSummary} aria-live="polite">Page {currentPage} of {totalPages}</p>
    </nav>
  );
}
