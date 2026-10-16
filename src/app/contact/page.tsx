import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Placeholder } from "@/components/Placeholder";
import { SectionHeading } from "@/components/SectionHeading";
import { cardClass } from "@/components/ServiceList";
import { quoteHref, site, telHref } from "@/content/site";

const description = `Reach ${site.name} by phone or email.`;

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
  const { phone, email } = site.contact;
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
          </dl>
          <p className="mt-8 text-lg">
            Need delivery or hauling pricing?{" "}
            <Link href={quoteHref} className={linkClass}>
              Get a Quote
            </Link>
            .
          </p>
        </div>
      </section>
    </>
  );
}
