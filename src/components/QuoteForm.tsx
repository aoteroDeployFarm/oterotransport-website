"use client";

import { useEffect, useRef, useState } from "react";
import { site, telHref } from "@/content/site";
import {
  EMPTY_QUOTE,
  LIMITS,
  LOADING_HELP,
  QUOTE_ENDPOINT,
  SERVICES,
  destinationRequired,
  normalizeQuote,
  validateQuote,
  type QuoteErrors,
  type QuoteField,
  type QuoteFields,
  type QuotePayload,
} from "@/lib/quote";

type Status = "idle" | "submitting" | "success" | "failed" | "unavailable" | "rejected";

/** Matches the server's minimum fill time so quick, legitimate submissions are not rejected. */
const MIN_FILL_MS = 3000;
const TIMEOUT_MS = 20000;

/** Order used for the error summary and for moving focus to the first problem. */
const FIELD_ORDER: QuoteField[] = [
  "name",
  "email",
  "phone",
  "contactMethod",
  "service",
  "pickup",
  "destination",
  "date",
  "description",
  "sizeWeight",
  "stairs",
  "access",
  "loadingHelp",
];

const FIELD_LABELS: Record<QuoteField, string> = {
  name: "Name",
  email: "Email",
  phone: "Phone",
  contactMethod: "Preferred contact method",
  service: "Service",
  pickup: "Pickup city or ZIP",
  destination: "Destination city or ZIP",
  date: "Preferred date",
  flexibleDate: "Flexible date",
  description: "Description of items or job",
  sizeWeight: "Approximate size and weight",
  stairs: "Stairs or elevator",
  access: "Access and parking",
  loadingHelp: "Loading help",
};

const fieldId = (field: QuoteField) => `quote-${field}`;

const labelClass = "block font-semibold";
const hintClass = "mt-1 text-sm text-ink/75";
const errorClass = "mt-2 text-sm font-semibold text-brand-red";
const controlClass =
  "mt-2 block w-full rounded border bg-surface px-3 py-2 text-base text-ink placeholder:text-ink/60";
const buttonClass =
  "inline-flex items-center justify-center rounded px-5 py-3 text-base font-semibold";
const linkClass =
  "font-semibold underline decoration-brand-red decoration-2 underline-offset-4 hover:text-brand-red";

function newSubmissionId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function controlBorder(error?: string) {
  return error ? "border-2 border-brand-red" : "border-ink/40";
}

function describedBy(field: QuoteField, hasHint: boolean, error?: string) {
  const ids = [hasHint && `${fieldId(field)}-hint`, error && `${fieldId(field)}-error`];
  return ids.filter(Boolean).join(" ") || undefined;
}

function FieldError({ field, error }: { field: QuoteField; error?: string }) {
  if (!error) return null;
  return (
    <p id={`${fieldId(field)}-error`} className={errorClass}>
      <span className="sr-only">Error: </span>
      {error}
    </p>
  );
}

function Optional() {
  return <span className="font-normal text-ink/75"> (optional)</span>;
}

export function QuoteForm() {
  const [values, setValues] = useState<QuoteFields>(EMPTY_QUOTE);
  const [errors, setErrors] = useState<QuoteErrors>({});
  const [showSummary, setShowSummary] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [honeypot, setHoneypot] = useState("");

  const startedAt = useRef(0);
  const submissionId = useRef("");
  const submitting = useRef(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLHeadingElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    startedAt.current = Date.now();
    submissionId.current = newSubmissionId();
    // The page is prerendered, so the earliest selectable date is set in the browser.
    const today = new Date();
    today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    if (dateRef.current) dateRef.current.min = today.toISOString().slice(0, 10);
  }, []);

  useEffect(() => {
    if (status === "success") successRef.current?.focus();
  }, [status]);

  useEffect(() => {
    if (showSummary) summaryRef.current?.focus();
  }, [showSummary]);

  const phoneRequired = values.contactMethod === "phone";
  const destinationIsRequired = destinationRequired(values.service);
  const busy = status === "submitting";

  function update<K extends QuoteField>(field: K, value: QuoteFields[K]) {
    const next = { ...values, [field]: value };
    setValues(next);
    // A changed request gets a new ID so the provider does not treat it as a repeat.
    submissionId.current = newSubmissionId();
    if (status !== "idle" && status !== "submitting") setStatus("idle");
    // Once a field has an error, re-check it as the visitor fixes it.
    if (Object.keys(errors).length > 0) {
      const current = validateQuote(normalizeQuote(next));
      setErrors((previous) => {
        const kept: QuoteErrors = {};
        for (const key of Object.keys(previous) as QuoteField[]) {
          if (current[key]) kept[key] = current[key];
        }
        // Conditional requirements can add an error to a related field.
        if (field === "contactMethod" && current.phone) kept.phone = current.phone;
        if (field === "service" && current.destination) kept.destination = current.destination;
        return kept;
      });
    }
  }

  function showErrors(found: QuoteErrors) {
    setErrors(found);
    setShowSummary(false);
    // Re-trigger focus on the summary even if it was already shown.
    requestAnimationFrame(() => setShowSummary(true));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;

    const found = validateQuote(normalizeQuote(values));
    if (Object.keys(found).length > 0) {
      showErrors(found);
      return;
    }
    setErrors({});
    setShowSummary(false);

    submitting.current = true;
    setStatus("submitting");
    const payload: QuotePayload = {
      ...values,
      submissionId: submissionId.current,
      startedAt: startedAt.current,
      website: honeypot,
    };

    try {
      const wait = MIN_FILL_MS - (Date.now() - startedAt.current);
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      let response: Response;
      try {
        response = await fetch(QUOTE_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      const body = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        fields?: QuoteErrors;
      } | null;

      if (response.ok && body?.ok === true) {
        setStatus("success");
        return;
      }
      if (body?.error === "invalid" && body.fields && Object.keys(body.fields).length > 0) {
        setStatus("idle");
        showErrors(body.fields);
        return;
      }
      setStatus(
        body?.error === "unavailable"
          ? "unavailable"
          : body?.error === "rejected"
            ? "rejected"
            : "failed",
      );
    } catch {
      setStatus("failed");
    } finally {
      submitting.current = false;
    }
  }

  function reset() {
    setValues(EMPTY_QUOTE);
    setErrors({});
    setShowSummary(false);
    startedAt.current = Date.now();
    submissionId.current = newSubmissionId();
    setStatus("idle");
  }

  const { phone, email } = site.contact;
  const fallback = (
    <>
      {phone && (
        <>
          call{" "}
          <a href={telHref(phone)} className={linkClass}>
            {phone}
          </a>
        </>
      )}
      {phone && email && " or "}
      {email && (
        <>
          email{" "}
          <a href={`mailto:${email}`} className={`${linkClass} [overflow-wrap:anywhere]`}>
            {email}
          </a>
        </>
      )}
    </>
  );

  if (status === "success") {
    return (
      <div className="rounded-lg border border-ink/15 border-t-4 border-t-brand-red bg-surface p-6 shadow-sm">
        <h3 ref={successRef} tabIndex={-1} className="text-xl font-semibold">
          Thanks, we received your request
        </h3>
        <p className="mt-3 text-lg">
          We will review the details and contact you by{" "}
          {values.contactMethod === "phone" ? "phone" : "email"}. Your request does not confirm a
          booking; pricing and availability are confirmed after review.
        </p>
        <button
          type="button"
          onClick={reset}
          className={`${buttonClass} mt-6 border-2 border-current hover:bg-current/10`}
        >
          Submit another request
        </button>
      </div>
    );
  }

  const errorList = FIELD_ORDER.filter((field) => errors[field]);

  return (
    <form noValidate onSubmit={handleSubmit} aria-describedby="quote-intro" className="space-y-8">
      <p id="quote-intro" className="text-sm text-ink/75">
        All fields are required unless marked optional.
      </p>

      {showSummary && errorList.length > 0 && (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          aria-labelledby="quote-error-summary"
          className="rounded border-2 border-brand-red bg-surface p-5"
        >
          <h3 id="quote-error-summary" className="text-lg font-semibold">
            Please fix {errorList.length === 1 ? "this problem" : "these problems"}
          </h3>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            {errorList.map((field) => (
              <li key={field}>
                <a
                  href={`#${fieldId(field)}`}
                  onClick={(event) => {
                    event.preventDefault();
                    document.getElementById(fieldId(field))?.focus();
                  }}
                  className={linkClass}
                >
                  {errors[field]}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor={fieldId("name")} className={labelClass}>
            Name
          </label>
          <input
            id={fieldId("name")}
            name="name"
            type="text"
            autoComplete="name"
            required
            maxLength={LIMITS.name}
            value={values.name}
            onChange={(e) => update("name", e.target.value)}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={describedBy("name", false, errors.name)}
            className={`${controlClass} ${controlBorder(errors.name)}`}
          />
          <FieldError field="name" error={errors.name} />
        </div>

        <div>
          <label htmlFor={fieldId("email")} className={labelClass}>
            Email
          </label>
          <input
            id={fieldId("email")}
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            maxLength={LIMITS.email}
            value={values.email}
            onChange={(e) => update("email", e.target.value)}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={describedBy("email", false, errors.email)}
            className={`${controlClass} ${controlBorder(errors.email)}`}
          />
          <FieldError field="email" error={errors.email} />
        </div>

        <fieldset aria-describedby={errors.contactMethod ? `${fieldId("contactMethod")}-error` : undefined}>
          <legend className={labelClass}>Preferred contact method</legend>
          <div id={fieldId("contactMethod")} tabIndex={-1} className="mt-3 flex flex-wrap gap-x-6 gap-y-3">
            {(["email", "phone"] as const).map((method) => (
              <label key={method} className="inline-flex items-center gap-2 text-base">
                <input
                  type="radio"
                  name="contactMethod"
                  value={method}
                  checked={values.contactMethod === method}
                  onChange={() => update("contactMethod", method)}
                  className="h-5 w-5 accent-brand-red"
                />
                {method === "email" ? "Email" : "Phone"}
              </label>
            ))}
          </div>
          <FieldError field="contactMethod" error={errors.contactMethod} />
        </fieldset>

        <div>
          <label htmlFor={fieldId("phone")} className={labelClass}>
            Phone
            {!phoneRequired && <Optional />}
          </label>
          <p id={`${fieldId("phone")}-hint`} className={hintClass}>
            {phoneRequired ? "Required when you prefer a phone call." : "Include area code."}
          </p>
          <input
            id={fieldId("phone")}
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            required={phoneRequired}
            maxLength={LIMITS.phone}
            value={values.phone}
            onChange={(e) => update("phone", e.target.value)}
            aria-invalid={errors.phone ? true : undefined}
            aria-describedby={describedBy("phone", true, errors.phone)}
            className={`${controlClass} ${controlBorder(errors.phone)}`}
          />
          <FieldError field="phone" error={errors.phone} />
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor={fieldId("service")} className={labelClass}>
            Service
          </label>
          <select
            id={fieldId("service")}
            name="service"
            required
            value={values.service}
            onChange={(e) => update("service", e.target.value)}
            aria-invalid={errors.service ? true : undefined}
            aria-describedby={describedBy("service", false, errors.service)}
            className={`${controlClass} ${controlBorder(errors.service)} sm:max-w-sm`}
          >
            <option value="">Choose a service</option>
            {SERVICES.map((service) => (
              <option key={service} value={service}>
                {service}
              </option>
            ))}
          </select>
          <FieldError field="service" error={errors.service} />
        </div>

        <div>
          <label htmlFor={fieldId("pickup")} className={labelClass}>
            Pickup city or ZIP
          </label>
          <p id={`${fieldId("pickup")}-hint`} className={hintClass}>
            City or ZIP code only, no street address.
          </p>
          <input
            id={fieldId("pickup")}
            name="pickup"
            type="text"
            required
            maxLength={LIMITS.pickup}
            value={values.pickup}
            onChange={(e) => update("pickup", e.target.value)}
            aria-invalid={errors.pickup ? true : undefined}
            aria-describedby={describedBy("pickup", true, errors.pickup)}
            className={`${controlClass} ${controlBorder(errors.pickup)}`}
          />
          <FieldError field="pickup" error={errors.pickup} />
        </div>

        <div>
          <label htmlFor={fieldId("destination")} className={labelClass}>
            Destination city or ZIP
            {!destinationIsRequired && <Optional />}
          </label>
          <p id={`${fieldId("destination")}-hint`} className={hintClass}>
            {destinationIsRequired
              ? "Required for deliveries. City or ZIP code only."
              : "Optional for dump runs and hauling away."}
          </p>
          <input
            id={fieldId("destination")}
            name="destination"
            type="text"
            required={destinationIsRequired}
            maxLength={LIMITS.destination}
            value={values.destination}
            onChange={(e) => update("destination", e.target.value)}
            aria-invalid={errors.destination ? true : undefined}
            aria-describedby={describedBy("destination", true, errors.destination)}
            className={`${controlClass} ${controlBorder(errors.destination)}`}
          />
          <FieldError field="destination" error={errors.destination} />
        </div>

        <div>
          <label htmlFor={fieldId("date")} className={labelClass}>
            Preferred date
            <Optional />
          </label>
          <p id={`${fieldId("date")}-hint`} className={hintClass}>
            Flexible scheduling is available.
          </p>
          <input
            id={fieldId("date")}
            name="date"
            type="date"
            ref={dateRef}
            value={values.date}
            onChange={(e) => update("date", e.target.value)}
            aria-invalid={errors.date ? true : undefined}
            aria-describedby={describedBy("date", true, errors.date)}
            className={`${controlClass} ${controlBorder(errors.date)}`}
          />
          <FieldError field="date" error={errors.date} />
        </div>

        <div className="flex items-end">
          <label className="inline-flex items-center gap-2 pb-2 text-base">
            <input
              type="checkbox"
              name="flexibleDate"
              checked={values.flexibleDate}
              onChange={(e) => update("flexibleDate", e.target.checked)}
              className="h-5 w-5 accent-brand-red"
            />
            My date is flexible
          </label>
        </div>
      </div>

      <div>
        <label htmlFor={fieldId("description")} className={labelClass}>
          Description of items or job
        </label>
        <p id={`${fieldId("description")}-hint`} className={hintClass}>
          What needs to move or be hauled away, and roughly how much.
        </p>
        <textarea
          id={fieldId("description")}
          name="description"
          required
          rows={5}
          maxLength={LIMITS.description}
          value={values.description}
          onChange={(e) => update("description", e.target.value)}
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={describedBy("description", true, errors.description)}
          className={`${controlClass} ${controlBorder(errors.description)}`}
        />
        <FieldError field="description" error={errors.description} />
      </div>

      <fieldset className="rounded-lg border border-ink/15 bg-neutral p-5 sm:p-6">
        <legend className="px-1 text-lg font-semibold">
          Optional details
        </legend>
        <p className={hintClass}>
          These help us quote accurately. Please do not include gate codes or street addresses.
        </p>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          {(
            [
              ["sizeWeight", "For example: couch about 7 ft long, around 150 lb."],
              ["stairs", "For example: one flight at pickup, elevator at destination."],
              ["access", "For example: narrow driveway, street parking only."],
            ] as const
          ).map(([field, hint]) => (
            <div key={field}>
              <label htmlFor={fieldId(field)} className={labelClass}>
                {FIELD_LABELS[field]}
                <Optional />
              </label>
              <p id={`${fieldId(field)}-hint`} className={hintClass}>
                {hint}
              </p>
              <input
                id={fieldId(field)}
                name={field}
                type="text"
                maxLength={LIMITS[field]}
                value={values[field]}
                onChange={(e) => update(field, e.target.value)}
                aria-invalid={errors[field] ? true : undefined}
                aria-describedby={describedBy(field, true, errors[field])}
                className={`${controlClass} ${controlBorder(errors[field])}`}
              />
              <FieldError field={field} error={errors[field]} />
            </div>
          ))}
          <div>
            <label htmlFor={fieldId("loadingHelp")} className={labelClass}>
              Do you need help loading?
              <Optional />
            </label>
            <select
              id={fieldId("loadingHelp")}
              name="loadingHelp"
              value={values.loadingHelp}
              onChange={(e) => update("loadingHelp", e.target.value)}
              aria-invalid={errors.loadingHelp ? true : undefined}
              aria-describedby={describedBy("loadingHelp", false, errors.loadingHelp)}
              className={`${controlClass} ${controlBorder(errors.loadingHelp)}`}
            >
              <option value="">Not specified</option>
              {LOADING_HELP.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <FieldError field="loadingHelp" error={errors.loadingHelp} />
          </div>
        </div>
      </fieldset>

      {/* Honeypot: hidden from people and assistive technology; bots tend to fill it. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="quote-website">Website</label>
        <input
          id="quote-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      <div className="space-y-4">
        <div role="status" aria-live="polite">
          {busy && <p className="text-base">Sending your request…</p>}
        </div>
        <div role="alert">
          {(status === "failed" || status === "unavailable" || status === "rejected") && (
            <div className="rounded border-2 border-brand-red bg-surface p-5">
              <p className="font-semibold">
                {status === "rejected"
                  ? "We couldn’t accept this request."
                  : "We couldn’t send your request."}
              </p>
              <p className="mt-2">
                {status === "unavailable"
                  ? "Online quote requests are not available right now. "
                  : "Your details are still filled in, so you can try again in a few minutes. "}
                You can also {fallback}.
              </p>
            </div>
          )}
        </div>
        <p className="text-base">
          Submitting a request does not confirm a booking. Pricing and availability are confirmed
          after we review the details.
        </p>
        <button
          type="submit"
          disabled={busy}
          className={`${buttonClass} bg-brand-red text-white hover:bg-brand-red-hover disabled:cursor-wait disabled:opacity-70`}
        >
          {busy ? "Sending…" : "Request a Quote"}
        </button>
      </div>
    </form>
  );
}
