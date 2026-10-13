import type { Metadata } from "next";
import { ContactCta } from "@/components/ContactCta";
import { PageHeader } from "@/components/PageHeader";
import { Placeholder } from "@/components/Placeholder";
import { SectionHeading } from "@/components/SectionHeading";
import { ServiceList } from "@/components/ServiceList";
import { site } from "@/content/site";

const description = `Transportation services offered by ${site.name}.`;

export const metadata: Metadata = {
  title: "Services",
  description,
  alternates: { canonical: "/services/" },
  openGraph: { title: `Services | ${site.name}`, description, url: "/services/" },
};

const section = "mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20";

export default function ServicesPage() {
  return (
    <>
      <PageHeader title="Services">
        <p>What {site.name} can move for you, and where.</p>
      </PageHeader>

      <section aria-labelledby="list-heading" className="bg-neutral">
        <div className={section}>
          <SectionHeading id="list-heading">What we offer</SectionHeading>
          <div className="mt-8">
            <ServiceList headingLevel="h3" />
          </div>
        </div>
      </section>

      <section aria-labelledby="area-heading" className={section}>
        <SectionHeading id="area-heading">Service area</SectionHeading>
        <div className="mt-6 max-w-3xl text-lg">
          {site.serviceArea ? (
            <p>{site.serviceArea}</p>
          ) : (
            <Placeholder block>
              The states, regions, or lanes Otero Transport actually serves.
            </Placeholder>
          )}
        </div>
      </section>

      <ContactCta />
    </>
  );
}
