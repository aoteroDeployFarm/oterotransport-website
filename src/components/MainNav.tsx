"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { nav, quoteHref } from "@/content/site";

const trim = (path: string) => path.replace(/\/+$/, "") || "/";

const linkClass =
  "block rounded px-2 py-2 text-neutral decoration-brand-yellow decoration-2 underline-offset-8 hover:text-white hover:underline sm:px-3";
const activeLinkClass = "text-white underline";
const quoteClass =
  "ml-2 block rounded bg-brand-red px-3 py-2 font-semibold text-white decoration-brand-yellow decoration-2 underline-offset-4 hover:bg-brand-red-hover sm:px-4";

/** Main menu. "Get a Quote" renders as the primary action; the current page gets aria-current. */
export function MainNav() {
  const pathname = trim(usePathname() ?? "/");
  return (
    <nav aria-label="Main">
      <ul className="-mx-2 flex flex-wrap items-center gap-y-2 text-sm font-medium sm:text-base">
        {nav.map((item) => {
          const current = trim(item.href) === pathname;
          const isQuote = item.href === quoteHref;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={
                  isQuote
                    ? `${quoteClass} ${current ? "underline" : ""}`
                    : `${linkClass} ${current ? activeLinkClass : ""}`
                }
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
