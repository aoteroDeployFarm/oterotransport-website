# oterotransport-website

Website for Otero Transports (oterotransports.com). Next.js 16, TypeScript, Tailwind CSS 4,
App Router, statically exported for Cloudflare Pages.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local development server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm run build` | Static export to `out/` |

## Content

All business facts and copy live in `src/content/site.ts`. Any value left `null` or empty
renders a visible "Needs review" marker on the site instead of invented content. Fill in
verified facts only, then set `indexable: true` to lift the `noindex` tag and the
disallow-all `robots.txt`.

## Quote request form

The form on the Get a Quote page (`/quote/`) posts JSON to `/api/quote`, a Cloudflare Pages Function in
`functions/api/quote.ts`. Pages deploys the `functions/` directory alongside the static
`out/` export, and only `/api/*` requests invoke the function. Field rules and length limits
live in `src/lib/quote.ts` and run in both the browser and the function.

The function sends the notification through the Gmail API as a Google Workspace mailbox
that was authorized once with only the `gmail.send` scope. It answers `{ "ok": true }` only
after Gmail accepts the message; otherwise the form shows a failure message, keeps the
visitor's entries, and points to the phone number and email. It never logs request contents
or credentials.

After the business notification is accepted, the function sends the customer a short
acknowledgment from `Otero Transportation <transport@oterotransports.com>` with
`Reply-To: transport@oterotransports.com`. It contains fixed wording, the request reference
(a UUID the form generates), and the business phone number, and nothing the visitor typed.
The business notification is the primary result: if the acknowledgment fails, the form
still reports success and the log records only a failure category and the reference.

### Abuse protection

Because the acknowledgment goes to a visitor-supplied address, the form could otherwise be
scripted to send mail to strangers. Checks, from weakest to strongest:

- Same-origin requests only, JSON only, 16 KB body limit, server-side validation, and a
  UUID-only reference. These stop casual misuse but are easy to forge outside a browser.
- A hidden honeypot field and a minimum fill time. These stop simple bots; the fill time is
  reported by the browser and can be faked.
- **Cloudflare Turnstile** (when configured): every submission needs a token that the
  function verifies with Cloudflare. Tokens are single use, so each submission costs the
  sender a fresh challenge.
- **`QUOTE_LIMITS` KV store** (when bound): about 5 submissions per IP address per hour, one
  acknowledgment per customer address per 24 hours, and duplicate detection by reference for
  24 hours. Keys hold SHA-256 hashes, never raw IP or email addresses.

**Acknowledgments are sent only when Turnstile is enforced and `QUOTE_LIMITS` is bound.**
Without both, business notifications work as before and acknowledgments are skipped.

**Acknowledgment suppression.** A customer address receives at most one acknowledgment per
24 hours. Later requests from the same address in that window still reach the business
inbox, and the success screen simply omits the "A confirmation email was sent" line.

**What the KV limits do and do not guarantee.** Workers KV is eventually consistent and has
no atomic increment:

- Counters are read, then written. Requests that arrive at the same moment can read the same
  value, so a burst can exceed 5 per hour, and parallel requests for one address can each
  send an acknowledgment before either record is visible.
- Writes can take up to about 60 seconds to be seen at other Cloudflare locations.
- If KV is unavailable, the IP limit and duplicate check fail open (the notification is
  still sent); the acknowledgment fails closed (it is skipped).

So the KV limits stop sustained or sequential abuse, while Turnstile bounds bursts: every
request needs its own solved challenge. For a low-volume small-business form this is a
reasonable level of protection. If abuse ever appears, stronger options are a Cloudflare WAF
rate limiting rule on `/api/quote` (enforced at the edge) or a Durable Object for exact,
atomic counters.

**Costs** (check Cloudflare's current pricing before provisioning): Turnstile is free. Workers
KV on the free plan allows 100,000 reads and 1,000 writes per day; each delivered request
uses up to three writes, so about 300 requests per day fit. Pages Functions requests count
toward the free 100,000 Workers requests per day. Gmail sending uses the existing Workspace
mailbox, which allows about 2,000 messages per day.

**Activation sequence** (the production form keeps working at every step):

1. Create the Turnstile widget (Managed mode, hostnames `oterotransports.com`,
   `www.oterotransports.com`, and `oterotransport-website.pages.dev`; `www` is listed only as a
   safety net in case its redirect is ever off) and the `QUOTE_LIMITS` KV namespace.
2. In the Pages project, add the Production secret `TURNSTILE_SECRET_KEY` and the Production
   KV binding `QUOTE_LIMITS`. These take effect only on the next deployment, and the function
   enforces Turnstile only when the build also contains the site key, so neither step can
   lock out the current form.
3. Put the public site key in `turnstileSiteKey` in `src/content/site.ts`, then commit and
   deploy once. That deployment turns on the widget, the check, the limits, and
   acknowledgments together.
4. Submit a real test on the live `/quote/` page and confirm both emails.
5. To roll back, redeploy the previous deployment from the Pages dashboard, or set
   `turnstileSiteKey` back to `null` and deploy.

For local tests, use Cloudflare's published Turnstile testing keys
(developers.cloudflare.com/turnstile/troubleshooting/testing/) in place of the real site key
and secret, and restore the real keys afterwards. The real widget does not run on
`localhost`. The `pages-functions` preview binds a local `QUOTE_LIMITS` with
`--kv QUOTE_LIMITS`.

### Delivery setup

The endpoint answers 503 and the form says online quote requests are unavailable whenever
the Gmail variables below are missing. Production has them set.

Business mail is on Google Workspace (Google MX, SPF `include:_spf.google.com`, and the
`google._domainkey` DKIM record). Notifications are sent through the same Workspace, so no
other mail provider or DNS record is needed.

1. **Google Cloud project.** Enable the Gmail API. Set the OAuth consent screen to
   **Internal** so refresh tokens do not expire after 7 days.
2. **OAuth client.** Create a **Desktop app** client (or a Web application client with the
   authorized redirect URI `http://127.0.0.1:8765/oauth2/callback`). Download its JSON to
   `~/.config/otero-transports/` (outside the repository; `chmod 700` the folder). Check it
   with:

   ```sh
   npm run gmail:authorize -- --check
   ```

3. **Authorize the sending mailbox** (default `transport@oterotransports.com`):

   ```sh
   npm run gmail:authorize
   ```

   Sign in as that mailbox and allow only "Send email on your behalf". The helper requests
   `gmail.send` with offline access, checks that no other scope was granted, and writes
   `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, and `QUOTE_FROM_EMAIL` to
   `.dev.vars` (mode 600, gitignored) without printing them. Options: `--sender <email>`
   (From address), `--account <email>` (the Google account to sign in as, when the sender is
   a "send mail as" alias on it), `--name "<display name>"`, `--client <path>`. Currently:

   ```sh
   npm run gmail:authorize -- --account alex.otero@precisionneural.systems --sender transport@oterotransports.com
   ```
4. **Add Pages variables** in Cloudflare (Workers & Pages > oterotransport-website >
   Settings > Variables and Secrets), for Production, copying the values from `.dev.vars`:

   | Name | Type | Value |
   | --- | --- | --- |
   | `GMAIL_CLIENT_ID` | Text | OAuth client ID |
   | `GMAIL_CLIENT_SECRET` | Secret | OAuth client secret |
   | `GMAIL_REFRESH_TOKEN` | Secret | Refresh token from step 3 |
   | `QUOTE_FROM_EMAIL` | Text | e.g. `Otero Transportation Website <transport@oterotransports.com>` |
   | `QUOTE_TO_EMAIL` | Text | Optional. Defaults to the email in `src/content/site.ts` |
   | `TURNSTILE_SECRET_KEY` | Secret | See [Abuse protection](#abuse-protection) |

   Variables apply to the next deployment, so set them before the release deploys.

`QUOTE_FROM_EMAIL` must be the authorized mailbox or one of its verified "send mail as"
aliases; otherwise Gmail sends from the mailbox's primary address. Do not set
`QUOTE_TEST_API_ORIGIN` in Cloudflare; it only points local tests at a mock server.

To revoke access, remove the app under the mailbox's Google Account > Security > Third-party
access (or in the Workspace admin console), then delete the Pages secrets.

### Replies to customers

Each notification has `Reply-To` set to the customer's email, so pressing Reply in Gmail
addresses the customer, and the reply is sent from the Workspace mailbox. When the sender
and recipient are both `transport@`, Gmail files the notification in Sent and also shows it
in the inbox. Adding a DMARC record (`_dmarc` TXT, starting with `p=none`) is recommended.

### Verifying delivery before release

Verify with a real submission before deploying the quote page:

1. Complete steps 1–3 above, then restart the local preview so Wrangler loads `.dev.vars`.
2. Open `/quote/` and submit a request using an email address you control as the customer.
3. Confirm the form shows the success message, the notification arrives at
   `transport@oterotransports.com` and not in spam, and the reference and fields are correct.
4. Reply from Gmail and confirm the reply reaches the customer address.
5. Copy the values into the Production variables from step 4. Keep `.dev.vars` only as long
   as you need local testing.

### Testing the function locally

`npm run dev` does not run Pages Functions. Build, then serve `out/` with Wrangler:

```sh
npm run build
npx wrangler@4 pages dev out --kv QUOTE_LIMITS
```

Local variables go in `.dev.vars` (gitignored); `.dev.vars.example` lists the names.

## Cloudflare Pages settings

- Framework preset: Next.js (Static HTML Export)
- Build command: `npm run build`
- Build output directory: `out`
- Root directory: `/`
- Node version: read from `.node-version`
- Environment variables: see [Delivery setup](#delivery-setup) and
  [Abuse protection](#abuse-protection)
- Bindings: KV namespace `QUOTE_LIMITS` (see [Abuse protection](#abuse-protection))
- Functions: `functions/` is deployed automatically with the build output

`public/_headers` sets security and caching headers.

### Domains

`https://oterotransports.com` is the canonical address (`site.url`, canonical links, and the
sitemap all use it). `www.oterotransports.com` is attached to the Pages project as a custom
domain so it has a certificate, and a zone **Redirect Rule** sends it to the apex:

- When: `(http.host eq "www.oterotransports.com")`
- Then: dynamic redirect to `concat("https://oterotransports.com", http.request.uri.path)`,
  status 301, **preserve query string** on.

The rule only matches `www`, and nothing redirects the apex, so it cannot loop. Pages
`_redirects` cannot do this because it matches paths, not hostnames.

## Known dependency findings

`npm audit` reports 5 high-severity findings. They are one advisory counted along one chain:
`braces` <=3.0.3 ([GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm),
stack-exhaustion denial of service) via `micromatch` -> `fast-glob` ->
`@next/eslint-plugin-next` -> `eslint-config-next`.

- Scope: lint tooling only. `npm audit --omit=dev` reports 0 vulnerabilities and nothing in
  the chain ships in `out/`.
- No patched `braces` release exists (3.0.3 is the latest), so there is no compatible fix.
- Do not run `npm audit fix --force`: it downgrades `eslint-config-next` to 14.x.
- Re-check with `npm audit` when `braces` or `eslint-config-next` publishes a new release.
