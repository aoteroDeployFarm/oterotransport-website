/**
 * Builds a plain-text RFC 5322 message encoded for the Gmail API `users.messages.send`
 * `raw` field (base64url). Used by the `/api/quote` Pages Function.
 * Keep this file free of path aliases and runtime-specific APIs so Node can test it.
 */

export type PlainMessage = {
  /** Address or `Display Name <address>`. */
  from: string;
  to: string;
  replyTo: string;
  subject: string;
  text: string;
};

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function base64Utf8(value: string) {
  return bytesToBase64(new TextEncoder().encode(value));
}

/** Header values must never carry line breaks; this blocks header injection. */
function headerValue(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

/** RFC 2047 encoded word for non-ASCII header text. */
function encodeHeaderText(value: string) {
  const clean = headerValue(value);
  return /^[\x20-\x7E]*$/.test(clean) ? clean : `=?UTF-8?B?${base64Utf8(clean)}?=`;
}

export function buildRawMessage(message: PlainMessage) {
  const body = base64Utf8(message.text.replace(/\r?\n/g, "\r\n"))
    .match(/.{1,76}/g)
    ?.join("\r\n");
  const lines = [
    `From: ${headerValue(message.from)}`,
    `To: ${headerValue(message.to)}`,
    `Reply-To: ${headerValue(message.replyTo)}`,
    `Subject: ${encodeHeaderText(message.subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    body ?? "",
  ];
  return base64Utf8(lines.join("\r\n"))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
