/**
 * POST /api/quote — Cloudflare Pages Function for the /quote/ page form.
 *
 * Validates the request, then sends a notification email through the Gmail API as the
 * Google Workspace mailbox authorized with `npm run gmail:authorize` (scope: gmail.send).
 * Responds `{ ok: true }` only after Gmail accepts that business notification. When sending
 * is not configured it responds 503 so the form never reports a false success.
 *
 * After the notification is accepted, it sends the customer a short acknowledgment that
 * contains no submitted details. Because that email goes to a visitor-supplied address, it
 * is sent only when abuse protection is fully configured: a passed Turnstile check and the
 * QUOTE_LIMITS KV store, which caps acknowledgments per recipient and submissions per IP.
 * An acknowledgment failure never changes the successful result.
 *
 * Request contents, email addresses, and credentials are never logged.
 */
import { site } from "../../src/content/site";
import { buildRawMessage } from "../../src/lib/email-message";
import {
  MAX_BODY_BYTES,
  SUBMISSION_ID_PATTERN,
  normalizeQuote,
  validateQuote,
  type QuoteFields,
} from "../../src/lib/quote";

/** The subset of the Workers KV API used here. */
interface KvStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

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
  /**
   * Secret. Turnstile secret key. Enforced only when `turnstileSiteKey` in
   * src/content/site.ts is also set, so the two can be added in either order.
   */
  TURNSTILE_SECRET_KEY?: string;
  /** KV namespace binding for rate limits and duplicate detection. */
  QUOTE_LIMITS?: KvStore;
  /** Replaces the Google and Turnstile API origins, for local testing against a mock only. */
  QUOTE_TEST_API_ORIGIN?: string;
}

type Context = { request: Request; env: Env };

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const TURNSTILE_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
/** Faster than this between page load and submit is treated as automated. */
const MIN_FILL_MS = 3000;
const DEDUPE_TTL_SECONDS = 24 * 60 * 60;
/** Submissions allowed from one IP address per hour once QUOTE_LIMITS is bound. */
const IP_LIMIT_PER_HOUR = 5;
/** One acknowledgment per customer address per day. */
const ACK_TTL_SECONDS = 24 * 60 * 60;
const ACK_SUBJECT = `We received your quote request — ${site.name}`;

type ErrorCode =
  | "invalid"
  | "rejected"
  | "verification_failed"
  | "rate_limited"
  | "unavailable"
  | "delivery_failed";

type Result = { ok: true; acknowledged: boolean } | { error: ErrorCode; fields?: object };

function json(status: number, body: Result) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function apiUrl(url: string, testOrigin?: string) {
  if (!testOrigin) return url;
  const { pathname } = new URL(url);
  return `${testOrigin.replace(/\/$/, "")}${pathname}`;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Local per-data-center cache; a fallback for duplicate detection when KV is not bound. */
async function localCache(): Promise<Cache | null> {
  try {
    return await caches.open("quote-submissions");
  } catch {
    return null;
  }
}

function cacheKey(request: Request, submissionId: string) {
  return new Request(`${new URL(request.url).origin}/__quote-submission/${submissionId}`);
}

async function alreadySent(env: Env, request: Request, submissionId: string) {
  if (env.QUOTE_LIMITS && (await env.QUOTE_LIMITS.get(`sub:${submissionId}`).catch(() => null)))
    return true;
  const cache = await localCache();
  return Boolean(cache && (await cache.match(cacheKey(request, submissionId)).catch(() => null)));
}

async function recordSent(env: Env, request: Request, submissionId: string) {
  await env.QUOTE_LIMITS?.put(`sub:${submissionId}`, "1", {
    expirationTtl: DEDUPE_TTL_SECONDS,
  }).catch(() => undefined);
  const cache = await localCache();
  await cache
    ?.put(
      cacheKey(request, submissionId),
      new Response("sent", { headers: { "Cache-Control": `max-age=${DEDUPE_TTL_SECONDS}` } }),
    )
    .catch(() => undefined);
}

/** Counts this request against its IP's hourly limit. Returns false once over the limit. */
async function withinIpLimit(kv: KvStore, request: Request) {
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const hour = Math.floor(Date.now() / 3_600_000);
  // Hashed so the store never holds raw IP addresses; entries expire after the hour.
  const key = `ip:${hour}:${await sha256(`${hour}:${ip}`)}`;
  const count = Number((await kv.get(key).catch(() => null)) ?? 0);
  if (count >= IP_LIMIT_PER_HOUR) return false;
  await kv.put(key, String(count + 1), { expirationTtl: 3_700 }).catch(() => undefined);
  return true;
}

async function turnstilePassed(env: Env, request: Request, token: unknown) {
  if (typeof token !== "string" || !token || token.length > 2048) return false;
  try {
    const response = await fetch(apiUrl(TURNSTILE_URL, env.QUOTE_TEST_API_ORIGIN), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET_KEY ?? "",
        response: token,
        remoteip: request.headers.get("CF-Connecting-IP") ?? "",
      }),
    });
    const body = (await response.json()) as { success?: boolean };
    return response.ok && body.success === true;
  } catch {
    return false;
  }
}

/** Access tokens last about an hour; reuse one while this isolate stays warm. */
let cachedToken: { value: string; expiresAt: number } | null = null;

type GmailEnv = Env & Required<Pick<Env, "GMAIL_CLIENT_ID" | "GMAIL_CLIENT_SECRET" | "GMAIL_REFRESH_TOKEN">>;

async function accessToken(env: GmailEnv) {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const response = await fetch(apiUrl(TOKEN_URL, env.QUOTE_TEST_API_ORIGIN), {
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

/** Sends one message. Returns null on success or a short, content-free failure category. */
async function sendMail(env: GmailEnv, raw: string): Promise<string | null> {
  let token: string;
  try {
    token = await accessToken(env);
  } catch (error) {
    return error instanceof Error ? error.message : "token refresh failed";
  }
  try {
    const response = await fetch(apiUrl(SEND_URL, env.QUOTE_TEST_API_ORIGIN), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw }),
    });
    if (response.ok) return null;
    if (response.status === 401) cachedToken = null;
    return `send responded ${response.status}`;
  } catch {
    return "unreachable";
  }
}

/** The bare address from "Name <address>" or "address". */
function addressOf(value: string) {
  return value.match(/<([^>]+)>/)?.[1] ?? value.trim();
}

function notificationText(q: QuoteFields, submissionId: string) {
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

/**
 * Customer acknowledgment (wording approved by the owner). It deliberately includes nothing
 * the visitor typed: only fixed text, the server-validated reference, and site facts.
 */
function acknowledgmentText(submissionId: string) {
  const { phone } = site.contact;
  return [
    "Hello,",
    "",
    `Thank you for contacting ${site.name}. We received your quote request and will review it.`,
    "",
    "This message confirms that your request was received. It is not a booking confirmation;",
    "pricing and availability are confirmed after we review the details with you.",
    "",
    `Request reference: ${submissionId}`,
    "",
    `To add details or ask a question, reply to this email${phone ? ` or call ${phone}` : ""}.`,
    "If you did not submit this request, you can ignore this message.",
    "",
    site.name,
    site.url.replace(/^https?:\/\//, ""),
  ].join("\n");
}

/** Sends the acknowledgment when protection allows it. Never throws. */
async function acknowledge(
  env: GmailEnv,
  quote: QuoteFields,
  submissionId: string,
  verified: boolean,
  from: string,
  replyTo: string,
): Promise<boolean> {
  const kv = env.QUOTE_LIMITS;
  if (!verified || !kv) {
    console.error(`quote: acknowledgment skipped (protection not configured) ref=${submissionId}`);
    return false;
  }
  const key = `ack:${await sha256(quote.email.toLowerCase())}`;
  if (await kv.get(key).catch(() => null)) {
    console.error(`quote: acknowledgment skipped (recent acknowledgment) ref=${submissionId}`);
    return false;
  }
  // Record the acknowledgment before sending. KV is eventually consistent, so this narrows
  // but does not fully close the window for parallel requests (see README). If the record
  // cannot be written, skip the acknowledgment rather than send one without a cap.
  try {
    await kv.put(key, "1", { expirationTtl: ACK_TTL_SECONDS });
  } catch {
    console.error(`quote: acknowledgment skipped (limit store unavailable) ref=${submissionId}`);
    return false;
  }
  const failure = await sendMail(
    env,
    buildRawMessage({
      from: `${site.name} <${addressOf(from)}>`,
      to: quote.email,
      replyTo,
      subject: ACK_SUBJECT,
      text: acknowledgmentText(submissionId),
    }),
  );
  if (failure) {
    console.error(`quote: acknowledgment failed (${failure}) ref=${submissionId}`);
    return false;
  }
  return true;
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
  if (!SUBMISSION_ID_PATTERN.test(submissionId)) return json(400, { error: "invalid" });

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
  const gmailEnv: GmailEnv = { ...env, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN };

  // The check is enforced only when this build renders the widget (site key) and the
  // secret is available, so neither can be added first and lock out the form.
  const turnstileEnforced = Boolean(env.TURNSTILE_SECRET_KEY && site.turnstileSiteKey);
  const verified = turnstileEnforced
    ? await turnstilePassed(env, request, input.turnstileToken)
    : false;
  if (turnstileEnforced && !verified) return json(400, { error: "verification_failed" });

  // A retry of a submission that was already delivered: report success, send nothing.
  if (await alreadySent(env, request, submissionId))
    return json(200, { ok: true, acknowledged: false });

  if (env.QUOTE_LIMITS && !(await withinIpLimit(env.QUOTE_LIMITS, request))) {
    console.error(`quote: rate limited ref=${submissionId}`);
    return json(429, { error: "rate_limited" });
  }

  const failure = await sendMail(
    gmailEnv,
    buildRawMessage({
      from,
      to,
      replyTo: quote.email,
      subject: `Quote request: ${quote.service} from ${quote.name}`,
      text: notificationText(quote, submissionId),
    }),
  );
  if (failure) {
    console.error(`quote: notification failed (${failure}) ref=${submissionId}`);
    return json(502, { error: "delivery_failed" });
  }
  await recordSent(env, request, submissionId);

  const acknowledged = await acknowledge(gmailEnv, quote, submissionId, verified, from, to);
  return json(200, { ok: true, acknowledged });
}
