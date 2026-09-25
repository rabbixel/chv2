import Link from "next/link";
import { Fragment } from "react";
import { routes } from "@/lib/routes";
import { categoryDisplayName } from "@/lib/taxonomy";
import type { Product } from "@/lib/types";
import { formatFileSize, formatMoney } from "@/lib/utils";
import styles from "./ProductInfoTable.module.css";

export interface ProductInfoTableProps {
  product: Product;
}

/**
 * "Product Information" spec list mirroring the live site (Price, File
 * Included, File Size, Compatible With, Documentation, Categories). Every
 * row renders only from product data and disappears when the field is
 * absent — nothing here is hardcoded per product.
 */
export function ProductInfoTable({ product }: ProductInfoTableProps) {
  return (
    <section aria-labelledby="product-information" className={styles.section}>
      <h2 id="product-information" className={styles.heading}>
        Product Information
      </h2>
      <dl className={styles.list}>
        <div className={styles.row}>
          <dt className={styles.term}>Price</dt>
          <dd className={styles.value}>
            {product.isFree ? (
              "Free"
            ) : (
              <>
                {formatMoney(product.price)}
                {product.compareAtPrice && (
                  <>
                    {" "}
                    <s className={styles.compareAt}>
                      {formatMoney(product.compareAtPrice)}
                    </s>
                  </>
                )}
              </>
            )}
          </dd>
        </div>
        {product.fileTypes.length > 0 && (
          <div className={styles.row}>
            <dt className={styles.term}>File Included</dt>
            <dd className={styles.value}>{product.fileTypes.join(", ")}</dd>
          </div>
        )}
        {product.fileSizeBytes !== undefined && (
          <div className={styles.row}>
            <dt className={styles.term}>File Size</dt>
            <dd className={styles.value}>
              {formatFileSize(product.fileSizeBytes)}
            </dd>
          </div>
        )}
        {product.compatibleWith.length > 0 && (
          <div className={styles.row}>
            <dt className={styles.term}>Compatible With</dt>
            <dd className={styles.value}>{product.compatibleWith.join(", ")}</dd>
          </div>
        )}
        {product.documentationUrl && (
          <div className={styles.row}>
            <dt className={styles.term}>Documentation</dt>
            <dd className={styles.value}>
              <Link href={product.documentationUrl}>Yes</Link>
            </dd>
          </div>
        )}
        {product.categorySlugs.length > 0 && (
          <div className={styles.row}>
            <dt className={styles.term}>Categories</dt>
            <dd className={styles.value}>
              {product.categorySlugs.map((slug, position) => (
                <Fragment key={slug}>
                  {position > 0 && ", "}
                  <Link href={routes.category(slug)}>
                    {categoryDisplayName(slug)}
                  </Link>
                </Fragment>
              ))}
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}
