import Link from "next/link";
import { quoteHref, site, telHref } from "@/content/site";
import { SectionHeading } from "./SectionHeading";

const base =
  "inline-flex items-center justify-center rounded px-5 py-3 text-base font-semibold";
const primary = `${base} bg-brand-red text-white hover:bg-brand-red-hover`;
const secondary = `${base} border-2 border-current hover:bg-current/10`;

/**
 * Contact actions. "Get a Quote" is the primary action when shown; direct call / email
 * buttons appear only once those details are verified.
 */
export function ContactActions({
  quote = true,
  email: showEmail = true,
  linkToContact = true,
}: {
  quote?: boolean;
  email?: boolean;
  linkToContact?: boolean;
}) {
  const { phone } = site.contact;
  const email = showEmail ? site.contact.email : null;
  return (
    <div className="flex flex-wrap gap-3">
      {quote && (
        <Link href={quoteHref} className={primary}>
          Get a Quote
        </Link>
      )}
      {phone && (
        <a href={telHref(phone)} className={quote ? secondary : primary}>
          Call {phone}
        </a>
      )}
      {email && (
        <a href={`mailto:${email}`} className={quote || phone ? secondary : primary}>
          Email us
        </a>
      )}
      {linkToContact && (
        <Link href="/contact/" className={quote || phone || email ? secondary : primary}>
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
        <ContactActions linkToContact={false} />
      </div>
    </section>
  );
}
