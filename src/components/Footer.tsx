import Link from "next/link";
import { nav, site, telHref } from "@/content/site";

const linkClass = "underline-offset-4 hover:text-white hover:underline";

export function Footer() {
  const { phone, email } = site.contact;
  const { usdot, mc } = site.credentials;
  return (
    <footer className="mt-auto border-t-4 border-brand-red bg-ink text-neutral">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-3 sm:px-6">
        <div>
          <p className="text-lg font-semibold text-white">{site.name}</p>
          {site.location && <p className="mt-2 text-sm">{site.location}</p>}
          {(usdot || mc) && (
            <p className="mt-2 text-sm">
              {usdot && <span>USDOT {usdot}</span>}
              {usdot && mc && <span aria-hidden="true"> · </span>}
              {mc && <span>MC {mc}</span>}
            </p>
          )}
        </div>
        <nav aria-label="Footer">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-yellow">Site</p>
          <ul className="mt-3 space-y-2 text-sm">
            {nav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={linkClass}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-yellow">Contact</p>
          <div className="mt-3 space-y-2 text-sm">
            {phone && (
              <p>
                <a href={telHref(phone)} className={linkClass}>
                  {phone}
                </a>
              </p>
            )}
            {email && (
              <p>
                <a href={`mailto:${email}`} className={`${linkClass} break-all`}>
                  {email}
                </a>
              </p>
            )}
            {!phone && !email && (
              <p>
                <Link href="/contact/" className="underline underline-offset-4 hover:text-white">
                  Contact details
                </Link>
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="border-t border-white/15">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-neutral sm:px-6">
          © {new Date().getFullYear()} {site.name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
