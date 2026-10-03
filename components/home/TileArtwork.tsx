import Image from "next/image";
import type { ProductImage } from "@/lib/types";
import { isLocalWordPressMediaUrl } from "@/lib/creative-hatti/media";
import styles from "./TileArtwork.module.css";

const paths: Record<string, string> = {
  logos: "M12 3 21 12 12 21 3 12Z M8 12h8M12 8v8",
  banners: "M3 5h18v14H3Z M3 9h18M7 13h6M7 16h10",
  characters: "M8 8a4 4 0 1 0 8 0 4 4 0 1 0-8 0 M4 21v-2a8 8 0 0 1 16 0v2",
  bundles: "m12 3 9 5-9 5-9-5Z M3 12l9 5 9-5M3 16l9 5 9-5",
  websites: "M3 4h18v16H3Z M3 9h18M6 6.5h.1M9 6.5h.1M7 13h4M7 16h10",
  flyers: "M6 3h12v18H6Z M9 7h6M9 11h6M9 15h3M9 18h6",
  freebies: "M3 8h18v4H3Z M5 12v9h14v-9M12 8v13 M12 8C4 8 6 1 9 3l3 5c8 0 6-7 3-5Z",
  cards: "M3 6h18v14H3Z m0 0 9 7 9-7",
  dussehra: "M7 3c12 5 12 13 0 18M7 3v18M3 12h18m-4-4 4 4-4 4",
  dhanteras: "M4 12h16l-2 9H6Z M9 12V8h6v4 M12 3v2M5 5l2 2M19 5l-2 2",
  diwali: "M3 14h18c-1 5-4 7-9 7s-8-2-9-7Z M12 3c4 4 4 7 0 10-4-3-4-6 0-10Z",
  wedding: "M3 14a5 5 0 1 0 10 0 5 5 0 1 0-10 0 M11 14a5 5 0 1 0 10 0 5 5 0 1 0-10 0 M6 6l2-3 2 3-2 3Z",
};

export function TileArtwork({ image, name }: { image?: ProductImage; name: string }) {
  const key = name.toLowerCase();
  const path = paths[key] ?? Object.entries(paths).find(([candidate]) => key.includes(candidate))?.[1] ?? paths.cards;
  return image ? (
    <Image src={image.url} alt="" width={image.width ?? 120} height={image.height ?? 120}
      sizes="(max-width: 639px) 50vw, 25vw" className={styles.image} unoptimized={isLocalWordPressMediaUrl(image.url) || image.url.endsWith(".svg")} />
  ) : (
    <svg className={styles.vector} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={path} /></svg>
  );
}
