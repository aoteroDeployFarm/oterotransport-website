import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { Placeholder } from "@/components/Placeholder";
import { SectionHeading } from "@/components/SectionHeading";
import { cardClass } from "@/components/ServiceList";
import { site, telHref } from "@/content/site";

const description = `How to reach ${site.name}.`;

export const metadata: Metadata = {
  title: "Contact",
  description,
  alternates: { canonical: "/contact/" },
  openGraph: { title: `Contact | ${site.name}`, description, url: "/contact/" },
};

const section = "mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20";
const label = "text-xs font-semibold uppercase tracking-widest text-brand-red";
const linkClass =
  "font-semibold underline decoration-brand-red decoration-2 underline-offset-4 hover:text-brand-red";

export default function ContactPage() {
  const { phone, email, address, hours } = site.contact;
  return (
    <>
      <PageHeader title="Contact">
        <p>
          Reach {site.owner ? `${site.owner.name}, ${site.owner.title},` : site.name} for quotes,
          scheduling, and general questions.
        </p>
      </PageHeader>

      <section aria-labelledby="details-heading" className="bg-neutral">
        <div className={section}>
          <SectionHeading id="details-heading">Contact details</SectionHeading>
          <dl className="mt-8 grid gap-6 sm:grid-cols-2">
            <div className={cardClass}>
              <dt className={label}>Phone</dt>
              <dd className="mt-2 text-xl">
                {phone ? (
                  <a href={telHref(phone)} className={linkClass}>
                    {phone}
                  </a>
                ) : (
                  <Placeholder>Business phone number.</Placeholder>
                )}
              </dd>
            </div>
            <div className={cardClass}>
              <dt className={label}>Email</dt>
              <dd className="mt-2 text-xl">
                {email ? (
                  <a href={`mailto:${email}`} className={`${linkClass} break-all`}>
                    {email}
                  </a>
                ) : (
                  <Placeholder>Business email address.</Placeholder>
                )}
              </dd>
            </div>
            <div className={cardClass}>
              <dt className={label}>Location</dt>
              <dd className="mt-2 text-lg">
                {address ? (
                  <address className="not-italic">
                    {address.map((line) => (
                      <span key={line} className="block">
                        {line}
                      </span>
                    ))}
                  </address>
                ) : (
                  <>
                    {site.location && (
                      <span className="block font-semibold">{site.location}</span>
                    )}
                    <span className="mt-3 block">
                      <Placeholder>Office or mailing address, if it should be public.</Placeholder>
                    </span>
                  </>
                )}
              </dd>
            </div>
            <div className={cardClass}>
              <dt className={label}>Hours</dt>
              <dd className="mt-2 text-lg">
                {hours ?? <Placeholder>Office or dispatch hours.</Placeholder>}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section aria-labelledby="quote-heading" className={section}>
        <SectionHeading id="quote-heading">Request a quote</SectionHeading>
        <div className="mt-6 max-w-3xl">
          <Placeholder block>
            No quote form is published yet because no approved form submission service is
            configured for this site. Until one is chosen, quote requests go through the phone and
            email above.
          </Placeholder>
        </div>
      </section>
    </>
  );
}
