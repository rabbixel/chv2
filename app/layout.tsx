import type { Metadata } from "next";
// Self-hosted variable fonts (Fontsource) — no Google Fonts round-trip,
// works offline and behind strict proxies.
import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces";
import { SiteFooter, SiteHeader } from "@/components/layout";
import { SITE } from "@/lib/constants";
import "./globals.css";
import styles from "./layout.module.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  openGraph: {
    siteName: SITE.name,
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-IN">
      <body>
        <a href="#main-content" className="ch-skip-link">
          Skip to content
        </a>
        <div className={styles.shell}>
          <SiteHeader />
          <main id="main-content" className={styles.main}>
            {children}
          </main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
