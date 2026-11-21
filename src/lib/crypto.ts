import { sessionSecret } from "./config";

// Web Crypto only, so this works in route handlers and in proxy.ts alike.
const enc = new TextEncoder();

export function b64url(bytes: Uint8Array): string {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecode(s: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function hmacKey() {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(sessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function sign(data: string): Promise<string> {
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(), enc.encode(data));
  return b64url(new Uint8Array(sig));
}

async function verify(data: string, sig: string): Promise<boolean> {
  try {
    return await crypto.subtle.verify("HMAC", await hmacKey(), b64urlDecode(sig), enc.encode(data));
  } catch {
    return false;
  }
}

/** Constant-time string comparison (via HMAC verify). */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  return verify(b, await sign(a));
}

/** Signed, expiring token. Payload must carry `e` (expiry, unix seconds). */
export async function signToken(payload: { e: number } & Record<string, unknown>): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  return `${body}.${await sign(body)}`;
}

export async function readToken<T extends { e: number }>(
  token: string | null | undefined,
): Promise<T | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig || !(await verify(body, sig))) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body))) as T;
    if (typeof payload.e !== "number" || payload.e < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

export function randomToken(bytes = 24): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export const newId = () => crypto.randomUUID();
