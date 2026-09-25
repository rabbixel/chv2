import { SectionHeading } from "./SectionHeading";
import styles from "./TrustedBy.module.css";

const PLACEHOLDERS = [
  "Partner One",
  "Partner Two",
  "Partner Three",
  "Partner Four",
  "Partner Five",
  "Partner Six",
];

export function TrustedBy() {
  return (
    <section aria-labelledby="trusted-heading">
      <SectionHeading
        eyebrow="Loved across India"
        title="We are trusted by"
        copy="Studios, brands and creators build with Creative Hatti assets every day."
      />
      <h2 id="trusted-heading" className="ch-visually-hidden">
        Trusted by leading brands
      </h2>
      <ul className={styles.grid} aria-label="Partner logo placeholders">
        {PLACEHOLDERS.map((label) => (
          <li key={label} className={styles.tile} aria-hidden="true">
            <span className={styles.mark}>◆</span>
            <span className={styles.label}>{label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
