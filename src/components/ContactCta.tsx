import Link from "next/link";
import { site, telHref } from "@/content/site";
import { SectionHeading } from "./SectionHeading";

const base =
  "inline-flex items-center justify-center rounded px-5 py-3 text-base font-semibold";
const primary = `${base} bg-brand-red text-white hover:bg-brand-red-hover`;
const secondary = `${base} border-2 border-current hover:bg-current/10`;

/** Contact actions. Direct call / email buttons appear only once those details are verified. */
export function ContactActions({ linkToContact = true }: { linkToContact?: boolean }) {
  const { phone, email } = site.contact;
  return (
    <div className="flex flex-wrap gap-3">
      {phone && (
        <a href={telHref(phone)} className={primary}>
          Call {phone}
        </a>
      )}
      {email && (
        <a href={`mailto:${email}`} className={phone ? secondary : primary}>
          Email us
        </a>
      )}
      {linkToContact && (
        <Link href="/contact/" className={phone || email ? secondary : primary}>
          Contact us
        </Link>
      )}
    </div>
  );
}

export function ContactCta() {
  return (
    <section aria-labelledby="cta-heading" className="border-t border-ink/10 bg-neutral">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-16 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <SectionHeading id="cta-heading">Have a load or a question?</SectionHeading>
          <p className="mt-4 text-lg">
            Get in touch with {site.owner ? site.owner.name : site.name} directly.
          </p>
        </div>
        <ContactActions />
      </div>
    </section>
  );
}
