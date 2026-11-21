// Minimal Google auth using only fetch + Web Crypto (no SDKs), so it stays portable.

type ServiceAccount = { client_email: string; private_key: string; project_id: string };

function serviceAccount(): ServiceAccount {
  const raw = (process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "").trim();
  const text = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  return JSON.parse(text) as ServiceAccount;
}

export const serviceAccountProject = () => serviceAccount().project_id;

const enc = new TextEncoder();
const b64url = (bytes: Uint8Array) =>
  Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function importPrivateKey(pem: string) {
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(Buffer.from(b64, "base64"));
  return crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

type Cached = { token: string; exp: number };
const cache = new Map<string, Cached>();

/** Access token for the service account (used for Firestore). */
export async function serviceAccountToken(scope: string): Promise<string> {
  const hit = cache.get(scope);
  if (hit && hit.exp > Date.now() / 1000 + 60) return hit.token;

  const sa = serviceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(enc.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claims = b64url(
    enc.encode(
      JSON.stringify({
        iss: sa.client_email,
        scope,
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      }),
    ),
  );
  const unsigned = `${header}.${claims}`;
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    await importPrivateKey(sa.private_key),
    enc.encode(unsigned),
  );
  const assertion = `${unsigned}.${b64url(new Uint8Array(sig))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) throw new Error(`Service account token failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cache.set(scope, { token: json.access_token, exp: now + json.expires_in });
  return json.access_token;
}

let driveCache: Cached | null = null;

/** Access token acting as your Google account (used for Drive; quota is yours). */
export async function driveToken(): Promise<string> {
  if (driveCache && driveCache.exp > Date.now() / 1000 + 60) return driveCache.token;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "",
      refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN ?? "",
    }),
  });
  if (!res.ok) throw new Error(`Drive token failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  driveCache = { token: json.access_token, exp: Math.floor(Date.now() / 1000) + json.expires_in };
  return json.access_token;
}
