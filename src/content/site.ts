/**
 * Single source of truth for Otero Transports' business facts and copy.
 *
 * Every `null` / empty value below is an UNVERIFIED fact. The site renders a
 * visible "Needs review" marker in its place instead of inventing content.
 * Fill these in from verified company information only, then set
 * `indexable` to true so search engines are allowed to index the site.
 */

export type Service = {
  name: string;
  description: string;
};

export type Site = {
  name: string;
  url: string;
  /** Keep false while placeholders remain: emits noindex + a disallow-all robots.txt. */
  indexable: boolean;
  /** One sentence: what Otero Transports moves, for whom, and where. */
  tagline: string | null;
  /** Short paragraph expanding on the tagline for the home page. */
  intro: string | null;
  services: Service[];
  /** Geographic area actually served, e.g. a list of states or a metro area. */
  serviceArea: string | null;
  /** Company background for the About page, one string per paragraph. */
  about: string[];
  /** Regulatory identifiers. Only add numbers that can be verified in FMCSA records. */
  credentials: { usdot: string | null; mc: string | null };
  owner: { name: string; title: string } | null;
  /** Where the business is based. This is not a statement of service area. */
  location: string | null;
  contact: {
    /** US number in display format, e.g. "555-555-0100". */
    phone: string | null;
    email: string | null;
    /** Mailing or office address, one string per line. */
    address: string[] | null;
    hours: string | null;
  };
};

export const site: Site = {
  name: "Otero Transports",
  url: "https://oterotransports.com",
  indexable: false,
  tagline: null,
  intro: null,
  services: [],
  serviceArea: null,
  about: [],
  credentials: { usdot: null, mc: null },
  owner: { name: "Alexander Otero", title: "Owner/Operator" },
  location: "Fort Collins, CO",
  contact: {
    phone: "720-361-9823",
    email: "transport@oterotransports.com",
    address: null,
    hours: null,
  },
};

export const nav = [
  { href: "/", label: "Home" },
  { href: "/services/", label: "Services" },
  { href: "/about/", label: "About" },
  { href: "/contact/", label: "Contact" },
] as const;

/** Builds an E.164 tel: link, assuming a US number when no country code is given. */
export function telHref(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return `tel:${digits}`;
  return `tel:+${digits.length === 10 ? "1" : ""}${digits}`;
}
