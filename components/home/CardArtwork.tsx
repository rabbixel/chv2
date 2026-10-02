import Image from "next/image";
import type { CSSProperties } from "react";
import { isLocalWordPressMediaUrl } from "@/lib/creative-hatti/media";
import type { CardArtworkVariant, ProductImage } from "@/lib/types";
import styles from "./CardArtwork.module.css";

export type { CardArtworkVariant } from "@/lib/types";

interface CardArtworkProps {
  variant: CardArtworkVariant;
  hue: number;
  image?: ProductImage;
  sizes: string;
}

export function CardArtwork({ variant, hue, image, sizes }: CardArtworkProps) {
  return (
    <span
      className={styles.frame}
      style={{ "--art-hue": hue } as CSSProperties}
      aria-hidden="true"
    >
      {image?.url ? (
        <Image
          src={image.url}
          alt=""
          fill
          sizes={sizes}
          className={styles.image}
          unoptimized={
            process.env.NODE_ENV !== "production" &&
            isLocalWordPressMediaUrl(image.url)
          }
          draggable={false}
        />
      ) : (
        <svg
          className={styles.illustration}
          viewBox="0 0 640 280"
          preserveAspectRatio="xMidYMid slice"
          focusable="false"
        >
          <rect width="640" height="280" fill="hsl(var(--art-hue) 34% 91%)" />
          <circle cx="510" cy="58" r="54" fill="hsl(var(--art-hue) 36% 84%)" />
          <path
            d="M0 231c95-34 181-22 271 5s208 23 369-23v67H0z"
            fill="hsl(var(--art-hue) 33% 84%)"
          />
          <g className={styles.linework}>
            {variant === "mythology" && (
              <>
                <path d="M205 226V126a115 115 0 0 1 230 0v100" />
                <path d="M184 226h272M223 129h194M252 226V143m136 83v-83" />
                <path d="M320 67v129m-20-109 20-29 20 29m-48 24h56" />
                <circle cx="320" cy="133" r="25" className={styles.accent} />
                <path d="M290 207c3-31 16-47 30-47s27 16 30 47m-49-8h38" />
                <path d="M277 104c10-12 24-18 43-18s33 6 43 18" />
              </>
            )}
            {variant === "profession" && (
              <>
                <circle cx="320" cy="86" r="34" className={styles.skin} />
                <path d="M286 85c3-29 19-45 34-45s31 16 34 45" />
                <path d="M260 228v-75c0-24 19-42 43-42h34c24 0 43 18 43 42v75" />
                <path d="m291 116 29 36 29-36m-57 5 28 32 28-32" />
                <path d="M320 151v46m0 0c0 21 28 21 28 0v-11" />
                <circle cx="348" cy="182" r="7" className={styles.accent} />
                <path d="M304 169h32m-16-16v32" className={styles.accent} />
              </>
            )}
            {variant === "cultural" && (
              <>
                <circle cx="320" cy="75" r="26" className={styles.skin} />
                <path d="M294 73c4-27 19-41 38-35 12 4 17 15 16 28" />
                <path d="m299 108-58-36m58 36 59-42m-59 42-55 48m55-48 58 48" />
                <path d="M302 111c-7 22-24 49-52 85 41 31 99 31 140 0-28-36-45-63-52-85" className={styles.accent} />
                <path d="M272 196h96m-79-26h62m-44-24h26" />
                <circle cx="239" cy="71" r="7" className={styles.accent} />
                <circle cx="360" cy="66" r="7" className={styles.accent} />
              </>
            )}
            {variant === "festival" && (
              <>
                <path d="M196 90c59-62 189-62 248 0M222 91v20m49-38v26m49-32v26m49-20v26m49-8v20" />
                <circle cx="320" cy="91" r="24" className={styles.skin} />
                <path d="M296 89c2-25 15-40 29-40s28 15 29 40" />
                <path d="m298 118-58-30m58 30 58-30m-58 30-49 43m49-43 49 43" />
                <path d="M302 119c-7 25-21 49-44 75 37 25 87 25 124 0-23-26-37-50-44-75" className={styles.accent} />
                <path d="M277 195h86m-72-27h58" />
                <path d="m251 89-18-20m156 20 18-20" className={styles.accent} />
              </>
            )}
            {variant === "shivratri" && (
              <>
                <path d="M261 221h118m-98-22h78l-12-34h-54z" className={styles.accent} />
                <path d="M290 165h60m-50-12h40m-33-10h26" />
                <path d="M320 136V53m-27 26 27-36 27 36m-67 0h80" />
                <path d="M326 59c18-3 29-16 27-33-12 9-24 9-34 3" className={styles.accent} />
                <path d="M279 224c15-12 28-12 41 0 13-12 26-12 41 0" />
                <circle cx="320" cy="111" r="6" className={styles.accent} />
              </>
            )}
            {variant === "republic-day" && (
              <>
                <path d="M267 221V62m106 159V62" />
                <path d="M267 72h84v23h-84z" fill="#e88942" stroke="none" />
                <path d="M267 95h84v23h-84z" fill="#fff" stroke="none" />
                <path d="M267 118h84v23h-84z" fill="#50835d" stroke="none" />
                <path d="M373 72h-84v23h84z" fill="#e88942" stroke="none" />
                <path d="M373 95h-84v23h84z" fill="#fff" stroke="none" />
                <path d="M373 118h-84v23h84z" fill="#50835d" stroke="none" />
                <circle cx="320" cy="106" r="9" className={styles.accent} />
                <path d="M320 97v18m-9-9h18m-15-6 12 12m0-12-12 12" className={styles.accent} />
                <path d="M225 221h190" />
              </>
            )}
            {variant === "vasant-panchami" && (
              <>
                <path d="M252 197h136l-13 28H265z" className={styles.accent} />
                <path d="M269 187h102m-81-14h60m-44-13h28" />
                <path d="M320 158V84m0 22c-30-31-48-15-28 4m28-4c30-31 48-15 28 4" className={styles.accent} />
                <path d="M320 84c-23-31-45-17-28 5m28-5c23-31 45-17 28 5" />
                <circle cx="320" cy="74" r="14" className={styles.skin} />
                <path d="M294 74c4-22 15-32 27-32s23 10 27 32m-67 27 39 25 39-25" />
                <path d="m282 151-34 19m110-19 34 19" />
              </>
            )}
            {variant === "valentine" && (
              <>
                <path d="M320 203s-89-53-89-105c0-44 57-54 89-13 32-41 89-31 89 13 0 52-89 105-89 105z" className={styles.accent} />
                <path d="M320 218v-58m0 25-30-20m30 8 31-24" />
                <path d="M289 185c-22-6-31-22-28-39 20 1 34 13 38 30m42 0c5-22 21-34 41-34-1 19-14 34-36 40" />
                <circle cx="320" cy="120" r="15" fill="hsl(var(--art-hue) 28% 94%)" stroke="none" />
              </>
            )}
            {variant === "navratri" && (
              <>
                <circle cx="278" cy="81" r="20" className={styles.skin} />
                <circle cx="365" cy="81" r="20" className={styles.skin} />
                <path d="M258 81c2-21 13-33 23-33s20 12 22 33m42 0c2-21 13-33 23-33s20 12 22 33" />
                <path d="m260 108-43-35m43 35-37 42m137-42 43-35m-43 35 37 42" />
                <path d="M270 111c-8 25-17 46-34 68 27 23 57 23 83 0-17-22-26-43-34-68m38 0c-8 25-17 46-34 68 27 23 57 23 83 0-17-22-26-43-34-68" className={styles.accent} />
                <path d="M241 183h60m49 0h60m-153-20h47m20 0h47" />
              </>
            )}
          </g>
        </svg>
      )}
      <span className={styles.wash} />
    </span>
  );
}
