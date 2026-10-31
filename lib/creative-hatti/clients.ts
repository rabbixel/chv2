import type { TrustedBrand } from "@/lib/services/homepageService";
import { normalizeWordPressMediaUrl } from "@/lib/creative-hatti/media";

export interface FeaturedClientBrand extends TrustedBrand {
  colorImageUrl?: string;
}

const HOMEPAGE_CLIENTS = [
  { key: "amazonindia", name: "Amazon India", url: "http://creativehatti.test/wp-content/uploads/2021/08/Amazon-India.png" },
  { key: "flipkart", name: "Flipkart", url: "http://creativehatti.test/wp-content/uploads/2021/07/Flipkart-1.png" },
  { key: "paytm", name: "Paytm", url: "http://creativehatti.test/wp-content/uploads/2021/07/Paytm-Blue-2.png" },
  { key: "mygov", name: "myGov", url: "http://creativehatti.test/wp-content/uploads/2021/07/MyGOv-1.png" },
  { key: "ht", name: "HT", url: "http://creativehatti.test/wp-content/uploads/2021/07/HT-1.png" },
  { key: "indriver", name: "InDriver", url: "http://creativehatti.test/wp-content/uploads/2021/07/InDriver-1.png" },
  { key: "khatabook", name: "KhataBook", url: "http://creativehatti.test/wp-content/uploads/2021/07/Khata-Book-1.png" },
  { key: "meesho", name: "Meesho", url: "http://creativehatti.test/wp-content/uploads/2021/07/Meesho-1.png" },
] as const;

function clientKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function selectFeaturedClientBrands(brands: TrustedBrand[]): FeaturedClientBrand[] {
  return HOMEPAGE_CLIENTS.map(({ key, name, url }) => {
    const sourceBrand = brands.find((entry) => clientKey(entry.name) === key);
    const imageUrl = normalizeWordPressMediaUrl(url);

    return {
      id: sourceBrand?.id ?? `homepage-${key}`,
      name,
      image: {
        id: sourceBrand?.image.id ?? `homepage-${key}`,
        url: imageUrl,
        originalUrl: imageUrl,
        alt: name,
        width: sourceBrand?.image.width ?? 240,
        height: sourceBrand?.image.height ?? 120,
      },
      colorImageUrl: sourceBrand?.image.url,
    };
  });
}
