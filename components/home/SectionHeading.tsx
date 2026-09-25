import Link from "next/link";
import { Icon } from "@/components/ui";
import styles from "./SectionHeading.module.css";

export interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  copy?: string;
  actionHref?: string;
  actionLabel?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  copy,
  actionHref,
  actionLabel,
}: SectionHeadingProps) {
  return (
    <div className={styles.heading}>
      <div className={styles.text}>
        {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
        <h2 className={styles.title}>{title}</h2>
        {copy && <p className={styles.copy}>{copy}</p>}
      </div>
      {actionHref && actionLabel && (
        <Link href={actionHref} className={styles.action}>
          {actionLabel}
          <Icon name="arrow-right" size={16} />
        </Link>
      )}
    </div>
  );
}
