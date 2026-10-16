#!/usr/bin/env node
/**
 * One-time local authorization for quote-form notifications.
 *
 * Signs a Google Workspace mailbox in through Google's consent screen with only the
 * `gmail.send` scope plus offline access, then saves the OAuth client ID, client secret,
 * refresh token, and sender address to `.dev.vars` (gitignored). Secret values are never
 * printed.
 *
 * Usage:
 *   npm run gmail:authorize -- [--client <path>] [--sender <email>] [--account <email>]
 *                              [--name <display name>] [--check]
 *
 * --sender is the From address (the mailbox or one of its "send mail as" aliases).
 * --account is the Google account to sign in as, when the sender is an alias on it.
 *
 * The client JSON stays outside the repository (default: the only *.json file in
 * ~/.config/otero-transports/). Use a "Desktop app" OAuth client, or a "Web application"
 * client that lists the redirect URI below.
 */
import { execFile } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { chmodSync, existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import http from "node:http";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCOPE = "https://www.googleapis.com/auth/gmail.send";
const PORT = 8765;
const REDIRECT_URI = `http://127.0.0.1:${PORT}/oauth2/callback`;
const TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_SENDER = "transport@oterotransports.com";
const DEFAULT_NAME = "Otero Transportation Website";
const CLIENT_DIR = join(homedir(), ".config", "otero-transports");
const DEV_VARS = resolve(dirname(fileURLToPath(import.meta.url)), "..", ".dev.vars");
/** Keys from earlier setups that no longer apply. */
const OBSOLETE_KEYS = ["RESEND_API_KEY", "QUOTE_EMAIL_API_URL"];

function fail(message) {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { check: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--check") args.check = true;
    else if (["--client", "--sender", "--account", "--name"].includes(arg))
      args[arg.slice(2)] = argv[++i];
    else fail(`Unknown option: ${arg}`);
  }
  return args;
}

function findClientFile(explicit) {
  if (explicit) return resolve(explicit.replace(/^~(?=\/)/, homedir()));
  if (!existsSync(CLIENT_DIR)) fail(`No client file given and ${CLIENT_DIR} does not exist.`);
  const files = readdirSync(CLIENT_DIR).filter((name) => name.endsWith(".json"));
  if (files.length !== 1)
    fail(`Expected exactly one .json file in ${CLIENT_DIR}, found ${files.length}. Use --client.`);
  return join(CLIENT_DIR, files[0]);
}

/** Reads and checks the OAuth client without ever printing its secret. */
function loadClient(path) {
  if (path.startsWith(resolve(dirname(DEV_VARS)) + "/"))
    fail("Keep the OAuth client file outside the repository.");
  let data;
  try {
    data = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    fail(`Could not read the OAuth client JSON at ${path}.`);
  }
  const type = data.installed ? "installed" : data.web ? "web" : null;
  if (!type) fail("The file is not an OAuth client (expected an \"installed\" or \"web\" section).");
  const client = data[type];
  if (!client.client_id || !client.client_secret) fail("The client file is missing its ID or secret.");
  if (type === "web" && !(client.redirect_uris ?? []).includes(REDIRECT_URI)) {
    fail(
      `This is a "Web application" client without the redirect URI ${REDIRECT_URI}.\n` +
        "  Either add that exact URI under Authorized redirect URIs in Google Cloud console,\n" +
        '  then download the JSON again, or create a "Desktop app" client instead.',
    );
  }
  return {
    type,
    clientId: client.client_id,
    clientSecret: client.client_secret,
    authUri: client.auth_uri ?? "https://accounts.google.com/o/oauth2/auth",
    tokenUri: client.token_uri ?? "https://oauth2.googleapis.com/token",
  };
}

function base64url(buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function writeDevVars(values) {
  const lines = existsSync(DEV_VARS) ? readFileSync(DEV_VARS, "utf8").split("\n") : [];
  const replaced = new Set();
  const kept = [];
  for (const line of lines) {
    const key = line.match(/^\s*([A-Z0-9_]+)\s*=/)?.[1];
    if (key && OBSOLETE_KEYS.includes(key)) continue;
    if (key && key in values) {
      kept.push(`${key}="${values[key]}"`);
      replaced.add(key);
    } else {
      kept.push(line);
    }
  }
  while (kept.length && kept[kept.length - 1] === "") kept.pop();
  for (const [key, value] of Object.entries(values)) {
    if (!replaced.has(key)) kept.push(`${key}="${value}"`);
  }
  writeFileSync(DEV_VARS, `${kept.join("\n")}\n`, { mode: 0o600 });
  chmodSync(DEV_VARS, 0o600);
}

async function exchangeCode(client, code, verifier) {
  const response = await fetch(client.tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
      redirect_uri: REDIRECT_URI,
      client_id: client.clientId,
      client_secret: client.clientSecret,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`token exchange failed (${response.status} ${body.error ?? ""})`);
  return body;
}

function page(title, text) {
  return `<!doctype html><meta charset="utf-8"><title>${title}</title>
<body style="font-family:system-ui;max-width:32rem;margin:4rem auto;padding:0 1rem">
<h1 style="font-size:1.4rem">${title}</h1><p>${text}</p></body>`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sender = args.sender ?? DEFAULT_SENDER;
  const account = args.account ?? sender;
  const name = args.name ?? DEFAULT_NAME;
  const emailPattern = /^[^\s@,;:<>()[\]"\\]+@[^\s@,;:<>()[\]"\\]+\.[^\s@,;:<>()[\]"\\]+$/;
  if (!emailPattern.test(sender)) fail(`Not a valid sender address: ${sender}`);
  if (!emailPattern.test(account)) fail(`Not a valid account address: ${account}`);
  if (/["<>\r\n]/.test(name)) fail("The display name cannot contain quotes, angle brackets, or line breaks.");

  const clientPath = findClientFile(args.client);
  const client = loadClient(clientPath);
  console.log(`OAuth client: ${client.type === "installed" ? "Desktop app" : "Web application"} (secret not shown)`);
  console.log(`Redirect URI: ${REDIRECT_URI}`);
  if (args.check) {
    console.log("✓ Client file is usable for authorization.");
    return;
  }

  const verifier = base64url(randomBytes(48));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  const state = base64url(randomBytes(24));
  const domain = account.split("@")[1];
  const authUrl = new URL(client.authUri);
  authUrl.search = new URLSearchParams({
    client_id: client.clientId,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "false",
    login_hint: account,
    hd: domain,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();

  const result = await new Promise((resolvePromise, rejectPromise) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url ?? "/", REDIRECT_URI);
      if (url.pathname !== "/oauth2/callback") {
        res.writeHead(404).end();
        return;
      }
      const finish = (status, title, text, outcome) => {
        res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" }).end(page(title, text));
        server.close();
        clearTimeout(timer);
        outcome();
      };
      if (url.searchParams.get("state") !== state) {
        finish(400, "Authorization failed", "The response did not match this session.", () =>
          rejectPromise(new Error("state mismatch")),
        );
        return;
      }
      const error = url.searchParams.get("error");
      const code = url.searchParams.get("code");
      if (error || !code) {
        finish(400, "Authorization cancelled", "No changes were saved.", () =>
          rejectPromise(new Error(`Google returned ${error ?? "no code"}`)),
        );
        return;
      }
      try {
        const tokens = await exchangeCode(client, code, verifier);
        finish(200, "Authorization complete", "You can close this tab and return to the terminal.", () =>
          resolvePromise(tokens),
        );
      } catch (exchangeError) {
        finish(500, "Authorization failed", "See the terminal for details.", () =>
          rejectPromise(exchangeError),
        );
      }
    });
    const timer = setTimeout(() => {
      server.close();
      rejectPromise(new Error("timed out waiting for the browser"));
    }, TIMEOUT_MS);
    server.on("error", (error) => rejectPromise(error));
    server.listen(PORT, "127.0.0.1", () => {
      console.log(`\nSign in as ${account} and allow "Send email on your behalf" only.`);
      if (account !== sender) console.log(`Messages will be sent as ${sender} (a "send mail as" alias).`);
      console.log("Opening your browser. If it does not open, visit this URL:\n");
      console.log(authUrl.toString());
      if (process.platform === "darwin") execFile("open", [authUrl.toString()], () => {});
    });
  }).catch((error) => fail(`Authorization did not complete: ${error.message}`));

  const granted = (result.scope ?? "").split(" ").filter(Boolean);
  if (granted.length !== 1 || granted[0] !== SCOPE)
    fail(`Unexpected scopes granted (${granted.join(", ") || "none"}). Nothing was saved.`);
  if (!result.refresh_token)
    fail("Google did not return a refresh token. Remove the app's access in the Google account and retry.");

  writeDevVars({
    GMAIL_CLIENT_ID: client.clientId,
    GMAIL_CLIENT_SECRET: client.clientSecret,
    GMAIL_REFRESH_TOKEN: result.refresh_token,
    QUOTE_FROM_EMAIL: `${name} <${sender}>`,
  });
  console.log(`\n✓ Granted scope: ${SCOPE}`);
  console.log("✓ Saved GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, and QUOTE_FROM_EMAIL");
  console.log(`  to ${DEV_VARS} (mode 600, gitignored). Values are not shown.`);
  console.log("  Restart the local preview so Wrangler loads them.");
}

main();
