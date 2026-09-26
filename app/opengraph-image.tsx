import { ImageResponse } from "next/og";
import { SITE } from "@/lib/constants";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Default social card — pure code, no binary assets. Cached by Next.js
 * like any other route output.
 */
export default function OpenGraphImage() {
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
          backgroundColor: "#1f4f3f",
          color: "#f6f4ee",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 96,
            height: 96,
            borderRadius: 20,
            backgroundColor: "#f6f4ee",
            color: "#1f4f3f",
            fontSize: 56,
            fontWeight: 700,
          }}
        >
          H
        </div>
        <div style={{ fontSize: 76, fontWeight: 700, marginTop: 32 }}>
          {SITE.name}
        </div>
        <div style={{ fontSize: 36, opacity: 0.85, marginTop: 12 }}>
          {`${SITE.tagline} — Indian vectors, characters and templates`}
        </div>
      </div>
    ),
    { ...size },
  );
}
