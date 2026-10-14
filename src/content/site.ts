/**
 * Single source of truth for the business facts and copy.
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

/** A named place for structured data. Coverage limits belong in `description` or `serviceArea`. */
export type AreaServed =
  | { type: "State"; name: string; description?: string }
  | { type: "City"; name: string; state: string; stateCode: string };

export type Site = {
  name: string;
  url: string;
  /** Keep false while placeholders remain: emits noindex + a disallow-all robots.txt. */
  indexable: boolean;
  /** One sentence: what the business moves, for whom, and where. */
  tagline: string | null;
  /** Short paragraph expanding on the tagline for the home page. */
  intro: string | null;
  services: Service[];
  /** Geographic area actually served, e.g. a list of states or a metro area. */
  serviceArea: string | null;
  /** Primary straight-line radius in miles around `location` (not driving distance). */
  serviceRadiusMiles: number | null;
  /** Confirmed places served. Name specific cities rather than whole states unless confirmed. */
  areaServed: AreaServed[];
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

const companyIntro =
  "Otero Transportation started with a simple goal: build a business where a father and his two sons could work together. We’re starting with practical delivery and hauling jobs, using equipment we already own and arranging a rental trailer when the job calls for it. Tell us what needs to move, and we’ll review the load, locations, and scheduling before providing a quote.";

export const site: Site = {
  name: "Otero Transportation",
  url: "https://oterotransports.com",
  indexable: false,
  tagline:
    "Otero Transportation provides small-load deliveries, move-out hauling, and dump runs for homeowners, renters, and local businesses.",
  intro: companyIntro,
  services: [
    {
      name: "Small-Load Delivery",
      description:
        "Pickup and delivery of smaller items and manageable loads for individuals and local businesses. We select a vehicle based on the item’s size and the job’s requirements.",
    },
    {
      name: "Move-Out Hauling",
      description:
        "Hauling unwanted items away during a move-out or property cleanup. Send photos and a description so we can confirm the load size, access, and equipment needed.",
    },
    {
      name: "Dump Runs",
      description:
        "Pickup and transport of unwanted items to an appropriate disposal facility. Accepted materials, disposal fees, and hauling charges are confirmed before scheduling.",
    },
  ],
  serviceArea:
    "Based in Fort Collins, Colorado, we primarily serve locations within a 100-mile radius, including Cheyenne and Laramie, Wyoming. Longer-distance jobs within Colorado may be available for an additional travel charge. Share your pickup and destination locations so we can review the job and provide a quote.",
  serviceRadiusMiles: 100,
  areaServed: [
    {
      type: "State",
      name: "Colorado",
      description:
        "Primarily within a 100-mile radius of Fort Collins. Longer-distance jobs within Colorado may be available for an additional travel charge, subject to job review and scheduling.",
    },
    { type: "City", name: "Cheyenne", state: "Wyoming", stateCode: "WY" },
    { type: "City", name: "Laramie", state: "Wyoming", stateCode: "WY" },
  ],
  about: [companyIntro],
  credentials: { usdot: null, mc: null },
  owner: { name: "Alex Otero", title: "Owner/Operator" },
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
