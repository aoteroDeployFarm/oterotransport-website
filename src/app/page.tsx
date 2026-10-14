import Link from "next/link";
import { Chevrons } from "@/components/Chevrons";
import { ContactActions, ContactCta } from "@/components/ContactCta";
import { Placeholder } from "@/components/Placeholder";
import { SectionHeading } from "@/components/SectionHeading";
import { ServiceList } from "@/components/ServiceList";
import { site, telHref } from "@/content/site";

const section = "mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20";
const factLabel = "text-xs font-semibold uppercase tracking-widest text-brand-red";

export default function HomePage() {
  const { phone } = site.contact;
  return (
    <>
      <section className="overflow-hidden bg-ink text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-2 lg:gap-12 lg:py-24">
          <div>
            <div className="flex items-center gap-4">
              <Chevrons />
              {site.location && (
                <p className="text-sm font-semibold uppercase tracking-widest text-brand-yellow">
                  {site.location}
                </p>
              )}
            </div>
            <h1 className="mt-5 text-5xl font-bold tracking-tight sm:text-6xl">{site.name}</h1>
            <div className="mt-6 max-w-xl text-lg text-neutral sm:text-xl">
              {site.tagline ? (
                <p>{site.tagline}</p>
              ) : (
                <Placeholder block>
                  One-sentence description of what {site.name} moves, for whom, and where.
                </Placeholder>
              )}
            </div>
            <div className="mt-8">
              <ContactActions />
            </div>
          </div>
          {/* Decorative brand artwork, not a depiction of actual equipment. WebP with PNG fallback. */}
          <picture>
            <source srcSet="/images/otero-transport-truck.webp" type="image/webp" />
            <img
              src="/images/otero-transport-truck.png"
              alt=""
              width={1200}
              height={800}
              decoding="async"
              className="mx-auto h-auto w-full max-w-lg lg:max-w-none"
            />
          </picture>
        </div>
      </section>

      {(site.owner || site.location || phone) && (
        <section aria-label="At a glance" className="border-b border-ink/10 bg-surface">
          <dl className="mx-auto grid max-w-6xl gap-x-8 gap-y-6 px-4 py-8 sm:grid-cols-3 sm:px-6">
            {site.owner && (
              <div>
                <dt className={factLabel}>{site.owner.title}</dt>
                <dd className="mt-1 text-lg font-semibold">{site.owner.name}</dd>
              </div>
            )}
            {site.location && (
              <div>
                <dt className={factLabel}>Based in</dt>
                <dd className="mt-1 text-lg font-semibold">{site.location}</dd>
              </div>
            )}
            {phone && (
              <div>
                <dt className={factLabel}>Call</dt>
                <dd className="mt-1 text-lg font-semibold">
                  <a
                    href={telHref(phone)}
                    className="underline decoration-brand-red decoration-2 underline-offset-4 hover:text-brand-red"
                  >
                    {phone}
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </section>
      )}

      <section aria-labelledby="intro-heading" className={section}>
        <SectionHeading id="intro-heading">What we do</SectionHeading>
        <div className="mt-6 max-w-3xl text-lg">
          {site.intro ? (
            <p>{site.intro}</p>
          ) : (
            <Placeholder block>
              Short introduction to the company: the customers it serves and the kind of work it
              takes on.
            </Placeholder>
          )}
        </div>
      </section>

      <section aria-labelledby="services-heading" className="border-y border-ink/10 bg-neutral">
        <div className={section}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading id="services-heading">Services</SectionHeading>
            <Link
              href="/services/"
              className="font-semibold underline decoration-brand-red decoration-2 underline-offset-4 hover:text-brand-red"
            >
              View all services
            </Link>
          </div>
          <div className="mt-8">
            <ServiceList />
          </div>
        </div>
      </section>

      <section aria-labelledby="area-heading" className={section}>
        <SectionHeading id="area-heading">Where we operate</SectionHeading>
        <div className="mt-6 max-w-3xl text-lg">
          {site.location && !site.serviceArea && (
            <p className="mb-4">
              {site.name} is based in {site.location}.
            </p>
          )}
          {site.serviceArea ? (
            <p>{site.serviceArea}</p>
          ) : (
            <Placeholder block>
              The states, regions, or lanes {site.name} actually serves.
            </Placeholder>
          )}
        </div>
      </section>

      <ContactCta />
    </>
  );
}
