import Link from "next/link";
import { Chevrons } from "@/components/Chevrons";

export default function NotFound() {
  return (
    <div className="h-full bg-ink text-white">
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
        <Chevrons className="mb-5" />
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-yellow">Error 404</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">Page not found</h1>
        <p className="mt-4 text-lg text-neutral">The page you are looking for does not exist.</p>
        <p className="mt-8">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded bg-brand-red px-5 py-3 text-base font-semibold text-white hover:bg-brand-red-hover"
          >
            Back to the home page
          </Link>
        </p>
      </div>
    </div>
  );
}
