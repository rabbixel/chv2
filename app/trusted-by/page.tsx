import type { Metadata } from "next";
import { ClientLogoGrid } from "@/components/clients";
import { ContentPage } from "@/components/content";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";
import { getHomepageService } from "@/lib/services";

const pageIntroduction =
  "We at Creative Hatti, make sure that every design is unique and has a meaningful touch of the portrayed character. We aspire to be the quickest source of high-quality vector illustrations and images present in the marketplace.";

export const metadata: Metadata = {
  title: "Trusted By | Creative Hatti",
  description: pageIntroduction,
  alternates: { canonical: `${SITE.url}${routes.trustedBy()}` },
  openGraph: {
    title: "Trusted By | Creative Hatti",
    description: pageIntroduction,
    url: `${SITE.url}${routes.trustedBy()}`,
  },
};

export default async function TrustedByPage() {
  const { trustedBrands } = await getHomepageService().getSections();

  return (
    <ContentPage title="Trusted By" description={pageIntroduction}>
      <ClientLogoGrid brands={trustedBrands} />
    </ContentPage>
  );
}
