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

Spam and abuse checks: same-origin requests only, JSON only, 16 KB body limit, a hidden
honeypot field, a minimum fill time, and server-side validation. The form blocks double
submits, and the function skips a submission ID it has already sent (best effort: Gmail has
no idempotency key, so a retry after a lost response can still send a second copy).

### Delivery setup (not active yet)

Until the variables below are set, the endpoint answers 503 and the form says online quote
requests are unavailable. Nothing is sent.

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
npx wrangler@4 pages dev out
```

Local variables go in `.dev.vars` (gitignored); `.dev.vars.example` lists the names.

## Cloudflare Pages settings

- Framework preset: Next.js (Static HTML Export)
- Build command: `npm run build`
- Build output directory: `out`
- Root directory: `/`
- Node version: read from `.node-version`
- Environment variables: see [Delivery setup](#delivery-setup-not-active-yet)
- Functions: `functions/` is deployed automatically with the build output

`public/_headers` sets security and caching headers.

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
