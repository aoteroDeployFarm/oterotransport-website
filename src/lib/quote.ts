/**
 * Quote request rules shared by the /quote/ page form and the `/api/quote` Pages Function.
 * The server re-runs `validateQuote` on every request; the browser check is only for speed.
 * Keep this file free of path aliases and runtime-specific APIs so both sides can import it.
 */

export const QUOTE_ENDPOINT = "/api/quote";

export const SERVICES = ["Small-Load Delivery", "Move-Out Hauling", "Dump Run", "Other"] as const;
export const CONTACT_METHODS = ["email", "phone"] as const;
export const LOADING_HELP = ["Yes", "No", "Not sure"] as const;

/** Services whose destination is required. Disposal and other jobs may leave it blank. */
const DESTINATION_REQUIRED: readonly string[] = ["Small-Load Delivery"];

export const LIMITS = {
  name: 100,
  email: 254,
  phone: 30,
  pickup: 100,
  destination: 100,
  description: 2000,
  sizeWeight: 300,
  stairs: 300,
  access: 300,
} as const;

/** Largest request body the endpoint accepts, in bytes. */
export const MAX_BODY_BYTES = 16 * 1024;

export type QuoteFields = {
  name: string;
  email: string;
  phone: string;
  contactMethod: string;
  service: string;
  pickup: string;
  destination: string;
  date: string;
  flexibleDate: boolean;
  description: string;
  sizeWeight: string;
  stairs: string;
  access: string;
  loadingHelp: string;
};

export type QuoteField = keyof QuoteFields;
export type QuoteErrors = Partial<Record<QuoteField, string>>;

/** Wire format posted by the form. `website` is a honeypot that people never see. */
export type QuotePayload = QuoteFields & {
  submissionId: string;
  startedAt: number;
  website: string;
};

export const EMPTY_QUOTE: QuoteFields = {
  name: "",
  email: "",
  phone: "",
  contactMethod: "email",
  service: "",
  pickup: "",
  destination: "",
  date: "",
  flexibleDate: false,
  description: "",
  sizeWeight: "",
  stairs: "",
  access: "",
  loadingHelp: "",
};

export function destinationRequired(service: string) {
  return DESTINATION_REQUIRED.includes(service);
}

// No whitespace or address-list punctuation, so the value is safe as a Reply-To header.
const EMAIL_PATTERN = /^[^\s@,;:<>()[\]"\\]+@[^\s@,;:<>()[\]"\\]+\.[^\s@,;:<>()[\]"\\]+$/;
const PHONE_PATTERN = /^[0-9+().\-\s]+$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
// Control characters other than tab and newline.
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function text(value: unknown, multiline = false) {
  if (typeof value !== "string") return "";
  const cleaned = value.replace(CONTROL_CHARS, "").replace(/\r\n?/g, "\n");
  return (multiline ? cleaned : cleaned.replace(/\s+/g, " ")).trim();
}

function isRealDate(value: string) {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Trims and normalizes untrusted input into the expected shape. */
export function normalizeQuote(input: Record<string, unknown>): QuoteFields {
  return {
    name: text(input.name),
    email: text(input.email),
    phone: text(input.phone),
    contactMethod: text(input.contactMethod),
    service: text(input.service),
    pickup: text(input.pickup),
    destination: text(input.destination),
    date: text(input.date),
    flexibleDate: input.flexibleDate === true,
    description: text(input.description, true),
    sizeWeight: text(input.sizeWeight, true),
    stairs: text(input.stairs, true),
    access: text(input.access, true),
    loadingHelp: text(input.loadingHelp),
  };
}

function tooLong(field: keyof typeof LIMITS, value: string) {
  return value.length > LIMITS[field] ? `Use ${LIMITS[field]} characters or fewer.` : undefined;
}

/** Returns an error message per invalid field. An empty object means the request is valid. */
export function validateQuote(q: QuoteFields): QuoteErrors {
  const errors: QuoteErrors = {};

  if (!q.name) errors.name = "Enter your name.";
  else errors.name = tooLong("name", q.name);

  if (!q.email) errors.email = "Enter your email address.";
  else if (q.email.length > LIMITS.email || !EMAIL_PATTERN.test(q.email))
    errors.email = "Enter a valid email address, like name@example.com.";

  const phoneDigits = q.phone.replace(/\D/g, "").length;
  if (!q.phone) {
    if (q.contactMethod === "phone") errors.phone = "Enter a phone number so we can call you.";
  } else if (
    q.phone.length > LIMITS.phone ||
    !PHONE_PATTERN.test(q.phone) ||
    phoneDigits < 10 ||
    phoneDigits > 15
  ) {
    errors.phone = "Enter a valid phone number, including area code.";
  }

  if (!(CONTACT_METHODS as readonly string[]).includes(q.contactMethod))
    errors.contactMethod = "Choose how you would like us to contact you.";

  if (!(SERVICES as readonly string[]).includes(q.service))
    errors.service = "Choose the service you need.";

  if (!q.pickup) errors.pickup = "Enter the pickup city or ZIP code.";
  else errors.pickup = tooLong("pickup", q.pickup);

  if (!q.destination) {
    if (destinationRequired(q.service))
      errors.destination = "Enter the destination city or ZIP code.";
  } else {
    errors.destination = tooLong("destination", q.destination);
  }

  if (q.date && !isRealDate(q.date)) errors.date = "Enter a valid date.";

  if (!q.description) errors.description = "Describe the items or job.";
  else errors.description = tooLong("description", q.description);

  errors.sizeWeight = tooLong("sizeWeight", q.sizeWeight);
  errors.stairs = tooLong("stairs", q.stairs);
  errors.access = tooLong("access", q.access);

  if (q.loadingHelp && !(LOADING_HELP as readonly string[]).includes(q.loadingHelp))
    errors.loadingHelp = "Choose an option.";

  for (const key of Object.keys(errors) as QuoteField[]) {
    if (!errors[key]) delete errors[key];
  }
  return errors;
}
