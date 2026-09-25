import { ImageResponse } from "next/og";
import { SITE } from "@/lib/constants";
import { getProductService } from "@/lib/services";
import { categoryDisplayName } from "@/lib/taxonomy";
import { formatMoney } from "@/lib/utils";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface ProductOgImageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Per-product social card, generated on demand and cached (ISR) — safe
 * for the 44k catalogue since nothing pre-renders at build time.
 */
export default async function ProductOpenGraphImage({
  params,
}: ProductOgImageProps) {
  const { slug } = await params;
  const product = await getProductService().getProductBySlug(slug);
  const title = product?.title ?? "Creative Hatti product";
  const category = product
    ? categoryDisplayName(
        product.categorySlugs[0] ?? product.productGroup,
      )
    : "";
  const price = product ? (product.isFree ? "Free" : formatMoney(product.price)) : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          backgroundColor: "#f6f4ee",
          color: "#1f2937",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: 2,
            color: "#1f4f3f",
          }}
        >
          {`${category.toUpperCase()} · ${SITE.name.toUpperCase()}`}
        </div>
        <div
          style={{
            fontSize: 68,
            fontWeight: 700,
            lineHeight: 1.15,
            marginTop: 20,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 44, fontWeight: 700, marginTop: 24 }}>
          {price}
        </div>
      </div>
    ),
    { ...size },
  );
}
