import type { Metadata } from "next";
import { ContactCta } from "@/components/ContactCta";
import { PageHeader } from "@/components/PageHeader";
import { Placeholder } from "@/components/Placeholder";
import { SectionHeading } from "@/components/SectionHeading";
import { cardClass } from "@/components/ServiceList";
import { site } from "@/content/site";

const description = `About ${site.name}.`;

export const metadata: Metadata = {
  title: "About",
  description,
  alternates: { canonical: "/about/" },
  openGraph: { title: `About | ${site.name}`, description, url: "/about/" },
};

const section = "mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20";
const label = "text-xs font-semibold uppercase tracking-widest text-brand-red";

export default function AboutPage() {
  const { usdot, mc } = site.credentials;
  return (
    <>
      <PageHeader title={`About ${site.name}`}>
        {site.owner && site.location && (
          <p>
            {site.owner.title} {site.owner.name}, based in {site.location}.
          </p>
        )}
      </PageHeader>

      <section aria-labelledby="background-heading" className={section}>
        <SectionHeading id="background-heading">Company background</SectionHeading>
        {(site.owner || site.location) && (
          <dl className="mt-8 grid max-w-2xl gap-6 sm:grid-cols-2">
            {site.owner && (
              <div className={cardClass}>
                <dt className={label}>{site.owner.title}</dt>
                <dd className="mt-2 text-lg font-semibold">{site.owner.name}</dd>
              </div>
            )}
            {site.location && (
              <div className={cardClass}>
                <dt className={label}>Based in</dt>
                <dd className="mt-2 text-lg font-semibold">{site.location}</dd>
              </div>
            )}
          </dl>
        )}
        <div className="mt-8 max-w-3xl space-y-4 text-lg">
          {site.about.length > 0 ? (
            site.about.map((paragraph) => <p key={paragraph}>{paragraph}</p>)
          ) : (
            <Placeholder block>
              Company background: how Otero Transport got started and how it works with customers.
              Do not include years in business, fleet size, or safety claims unless they are
              verified.
            </Placeholder>
          )}
        </div>
      </section>

      <section aria-labelledby="credentials-heading" className="border-t border-ink/10 bg-neutral">
        <div className={section}>
          <SectionHeading id="credentials-heading">Operating authority</SectionHeading>
          <dl className="mt-8 grid max-w-2xl gap-6 sm:grid-cols-2">
            <div className={cardClass}>
              <dt className={label}>USDOT number</dt>
              <dd className="mt-2 text-lg">
                {usdot ?? <Placeholder>USDOT number, if the company has one.</Placeholder>}
              </dd>
            </div>
            <div className={cardClass}>
              <dt className={label}>MC number</dt>
              <dd className="mt-2 text-lg">
                {mc ?? <Placeholder>MC number, if the company has one.</Placeholder>}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <ContactCta />
    </>
  );
}
