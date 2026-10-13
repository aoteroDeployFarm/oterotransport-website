import Link from "next/link";
import { nav, site, telHref } from "@/content/site";

export function Header() {
  const { phone } = site.contact;
  return (
    <header className="bg-ink text-white">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded focus:bg-surface focus:px-3 focus:py-2 focus:text-ink"
      >
        Skip to main content
      </a>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3 text-lg font-semibold tracking-tight">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded bg-brand-yellow text-sm font-bold text-ink"
          >
            OT
          </span>
          {site.name}
        </Link>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <nav aria-label="Main">
            <ul className="-mx-2 flex flex-wrap items-center text-sm font-medium sm:text-base">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="block rounded px-2 py-2 text-neutral decoration-brand-yellow decoration-2 underline-offset-8 hover:text-white hover:underline sm:px-3"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          {phone && (
            <a
              href={telHref(phone)}
              className="hidden rounded bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-hover md:inline-flex"
            >
              Call {phone}
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
