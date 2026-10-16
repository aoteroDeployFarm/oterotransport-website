import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { QuoteForm } from "@/components/QuoteForm";
import { SectionHeading } from "@/components/SectionHeading";
import { quoteHref, site, telHref } from "@/content/site";

const description = `Request a quote from ${site.name} for small-load delivery, move-out hauling, or a dump run.`;

export const metadata: Metadata = {
  title: "Get a Quote",
  description,
  alternates: { canonical: quoteHref },
  openGraph: { title: `Get a Quote | ${site.name}`, description, url: quoteHref },
};

const section = "mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20";

export default function QuotePage() {
  const { phone } = site.contact;
  return (
    <>
      <PageHeader title="Get a Quote">
        <p>Tell us about the job and we will follow up by your preferred contact method.</p>
        {phone && (
          <p className="mt-3">
            Prefer to talk it through? Call{" "}
            <a
              href={telHref(phone)}
              className="whitespace-nowrap font-semibold text-white underline decoration-brand-yellow decoration-2 underline-offset-4"
            >
              {phone}
            </a>
            .
          </p>
        )}
      </PageHeader>

      <section aria-labelledby="quote-heading" className={section}>
        <SectionHeading id="quote-heading">Job details</SectionHeading>
        <div className="mt-8 max-w-3xl">
          <QuoteForm />
        </div>
      </section>
    </>
  );
}
