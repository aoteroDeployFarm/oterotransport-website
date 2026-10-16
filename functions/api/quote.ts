/**
 * POST /api/quote — Cloudflare Pages Function for the /quote/ page form.
 *
 * Validates the request, then sends a notification email through the Gmail API as the
 * Google Workspace mailbox authorized with `npm run gmail:authorize` (scope: gmail.send).
 * Responds `{ ok: true }` only after Gmail accepts the message. When sending is not
 * configured it responds 503 so the form never reports a false success.
 *
 * Request contents and personal information are never logged.
 */
import { site } from "../../src/content/site";
import { buildRawMessage } from "../../src/lib/email-message";
import {
  MAX_BODY_BYTES,
  normalizeQuote,
  validateQuote,
  type QuoteFields,
} from "../../src/lib/quote";

interface Env {
  /** OAuth client ID of the Google Cloud client used to authorize the mailbox. */
  GMAIL_CLIENT_ID?: string;
  /** Secret. OAuth client secret for GMAIL_CLIENT_ID. */
  GMAIL_CLIENT_SECRET?: string;
  /** Secret. Refresh token for the authorized mailbox, limited to the gmail.send scope. */
  GMAIL_REFRESH_TOKEN?: string;
  /**
   * Sender: the authorized mailbox or one of its "send mail as" aliases, optionally with a
   * display name, e.g. "Otero Transportation Website <transport@oterotransports.com>".
   */
  QUOTE_FROM_EMAIL?: string;
  /** Recipient. Defaults to the business email in src/content/site.ts. */
  QUOTE_TO_EMAIL?: string;
  /** Replaces the Google API origins, for local testing against a mock server only. */
  QUOTE_TEST_API_ORIGIN?: string;
}

type Context = { request: Request; env: Env };

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
/** Faster than this between page load and submit is treated as automated. */
const MIN_FILL_MS = 3000;
const SUBMISSION_ID = /^[A-Za-z0-9-]{8,64}$/;
const DEDUPE_TTL_SECONDS = 24 * 60 * 60;

type ErrorCode = "invalid" | "rejected" | "unavailable" | "delivery_failed";

function json(status: number, body: { ok: true } | { error: ErrorCode; fields?: object }) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/** Best-effort duplicate detection across retries of the same form submission. */
async function dedupeCache(): Promise<Cache | null> {
  try {
    return await caches.open("quote-submissions");
  } catch {
    return null;
  }
}

function dedupeKey(request: Request, submissionId: string) {
  return new Request(`${new URL(request.url).origin}/__quote-submission/${submissionId}`);
}

/** Access tokens last about an hour; reuse one while this isolate stays warm. */
let cachedToken: { value: string; expiresAt: number } | null = null;

function googleUrl(url: string, testOrigin?: string) {
  if (!testOrigin) return url;
  const { pathname } = new URL(url);
  return `${testOrigin.replace(/\/$/, "")}${pathname}`;
}

type GmailEnv = Env & Required<Pick<Env, "GMAIL_CLIENT_ID" | "GMAIL_CLIENT_SECRET" | "GMAIL_REFRESH_TOKEN">>;

async function accessToken(env: GmailEnv) {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const response = await fetch(googleUrl(TOKEN_URL, env.QUOTE_TEST_API_ORIGIN), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: env.GMAIL_CLIENT_ID,
      client_secret: env.GMAIL_CLIENT_SECRET,
      refresh_token: env.GMAIL_REFRESH_TOKEN,
    }),
  });
  if (!response.ok) throw new Error(`token refresh responded ${response.status}`);
  const body = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new Error("token refresh returned no access token");
  cachedToken = {
    value: body.access_token,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
  };
  return cachedToken.value;
}

function emailText(q: QuoteFields, submissionId: string) {
  const line = (label: string, value: string) => `${label}: ${value || "Not provided"}`;
  return [
    `New quote request from ${site.name} website.`,
    "",
    line("Name", q.name),
    line("Email", q.email),
    line("Phone", q.phone),
    line("Preferred contact", q.contactMethod === "phone" ? "Phone" : "Email"),
    "",
    line("Service", q.service),
    line("Pickup city or ZIP", q.pickup),
    line("Destination city or ZIP", q.destination),
    line("Preferred date", q.date),
    line("Flexible on date", q.flexibleDate ? "Yes" : "No"),
    "",
    "Description:",
    q.description,
    "",
    line("Approximate size and weight", q.sizeWeight),
    line("Stairs or elevator", q.stairs),
    line("Access notes", q.access),
    line("Loading help needed", q.loadingHelp),
    "",
    `Reference: ${submissionId}`,
    "Reply to this email to respond to the customer.",
  ].join("\n");
}

export async function onRequestPost({ request, env }: Context): Promise<Response> {
  const origin = request.headers.get("Origin");
  if (!origin || origin !== new URL(request.url).origin) return json(403, { error: "rejected" });

  if (!request.headers.get("Content-Type")?.startsWith("application/json"))
    return json(415, { error: "rejected" });

  const declaredLength = Number(request.headers.get("Content-Length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) return json(413, { error: "rejected" });

  let raw: unknown;
  try {
    const body = await request.text();
    if (body.length > MAX_BODY_BYTES) return json(413, { error: "rejected" });
    raw = JSON.parse(body);
  } catch {
    return json(400, { error: "invalid" });
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return json(400, { error: "invalid" });
  const input = raw as Record<string, unknown>;

  // Spam checks: a filled honeypot or an implausibly fast submission.
  const startedAt = typeof input.startedAt === "number" ? input.startedAt : 0;
  if (input.website || !startedAt || Date.now() - startedAt < MIN_FILL_MS)
    return json(400, { error: "rejected" });

  const submissionId = typeof input.submissionId === "string" ? input.submissionId : "";
  if (!SUBMISSION_ID.test(submissionId)) return json(400, { error: "invalid" });

  const quote = normalizeQuote(input);
  const fields = validateQuote(quote);
  if (Object.keys(fields).length > 0) return json(422, { error: "invalid", fields });

  const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN } = env;
  const from = env.QUOTE_FROM_EMAIL;
  const to = env.QUOTE_TO_EMAIL || site.contact.email;
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN || !from || !to) {
    console.error("quote: email delivery is not configured");
    return json(503, { error: "unavailable" });
  }

  const cache = await dedupeCache();
  const key = dedupeKey(request, submissionId);
  if (cache && (await cache.match(key).catch(() => undefined))) return json(200, { ok: true });

  let token: string;
  try {
    token = await accessToken({ ...env, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN });
  } catch (error) {
    // Only the status reaches the log, never credentials or request contents.
    console.error(`quote: gmail ${error instanceof Error ? error.message : "token refresh failed"}`);
    return json(502, { error: "delivery_failed" });
  }

  const message = buildRawMessage({
    from,
    to,
    replyTo: quote.email,
    subject: `Quote request: ${quote.service} from ${quote.name}`,
    text: emailText(quote, submissionId),
  });

  let response: Response;
  try {
    response = await fetch(googleUrl(SEND_URL, env.QUOTE_TEST_API_ORIGIN), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw: message }),
    });
  } catch {
    console.error("quote: gmail unreachable");
    return json(502, { error: "delivery_failed" });
  }

  if (!response.ok) {
    if (response.status === 401) cachedToken = null;
    console.error(`quote: gmail send responded ${response.status}`);
    return json(502, { error: "delivery_failed" });
  }

  if (cache) {
    try {
      await cache.put(
        key,
        new Response("sent", { headers: { "Cache-Control": `max-age=${DEDUPE_TTL_SECONDS}` } }),
      );
    } catch {
      // Dedupe is best effort; Gmail has no idempotency key, so a retry after a lost
      // response can still send a second copy.
    }
  }
  return json(200, { ok: true });
}
