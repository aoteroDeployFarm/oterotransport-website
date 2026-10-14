import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { site } from "@/content/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const description = site.tagline ?? `Official website of ${site.name}.`;

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: site.name, template: `%s | ${site.name}` },
  description,
  alternates: { canonical: "/" },
  robots: site.indexable ? undefined : { index: false, follow: false },
  openGraph: {
    type: "website",
    siteName: site.name,
    title: site.name,
    description,
    url: "/",
    locale: "en_US",
  },
};

// Only verified facts belong here: the name, domain, description, confirmed services, and
// confirmed places served.
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: site.name,
  url: site.url,
  ...(site.tagline && { description: site.tagline }),
  ...(site.areaServed.length > 0 && {
    areaServed: site.areaServed.map((area) =>
      area.type === "State"
        ? { "@type": "State", name: area.name, description: area.description }
        : {
            "@type": "City",
            name: area.name,
            containedInPlace: { "@type": "State", name: area.state },
          },
    ),
  }),
  ...(site.services.length > 0 && {
    makesOffer: site.services.map((service) => ({
      "@type": "Offer",
      itemOffered: { "@type": "Service", name: service.name, description: service.description },
    })),
  }),
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <Header />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
      </body>
    </html>
  );
}
