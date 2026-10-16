import Link from "next/link";
import { site, telHref } from "@/content/site";
import { MainNav } from "./MainNav";

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
          <MainNav />
          {phone && (
            <a
              href={telHref(phone)}
              className="hidden rounded border-2 border-neutral px-4 py-1.5 text-sm font-semibold text-white hover:bg-white/10 md:inline-flex"
            >
              Call {phone}
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
